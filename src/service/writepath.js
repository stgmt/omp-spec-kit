import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { commitMessage } from "./git.js";
import { reconcileClone } from "./sync.js";
import { taskLocalId } from "../authoring/task-ops.js";
import { preflightTeamTaskWrites } from "./team-task-writes.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { CREATION_TOKEN_RE, parseTaskCreationMarker } from "../kernel/task-creation-marker.js";
import { parseMarkdownDocument } from "../kernel/parsers/markdown.js";

function errorEnvelope(operation, requestId, code, message, extra = {}) {
  return {
    schemaVersion: "spec-kernel@2",
    requestId: requestId ?? null,
    operation,
    ok: false,
    graph: null,
    page: null,
    data: null,
    error: {
      code,
      message,
      operation,
      parameter: null,
      receivedType: null,
      receivedSummary: null,
      expected: null,
      limitName: null,
      limitValue: null,
      observedValue: null,
      specSlug: null,
      localId: null,
      canonicalId: null,
      path: null,
      anchor: null,
      headingOccurrenceId: null,
      linkOccurrenceId: null,
      rewriteKey: null,
      candidates: [],
      diagnosticIds: [],
      retryable: false,
      causeCode: null,
      ...extra,
    },
    diagnostics: [],
    provenance: null,
  };
}
async function releaseDeletedTeamTaskBindings({ store, bindings, logger }) {
  if (!Array.isArray(bindings) || bindings.length === 0) return;
  try {
    await store.applyTeamSpecsTaskBindings({ action: "unlink", bindings });
  } catch (error) {
    logger(`could not release deleted team task bindings: ${String(error?.message ?? error)}`);
  }
}


function shortHash(hash) {
  return typeof hash === "string" && hash.length > 0 ? hash.slice(0, 12) : "patch";
}

/**
 * The kernel applies a patch to the project's materialised read root; the
 * authoritative copy is the spec branch's worktree. Replace that one spec
 * directory after a successful apply, never the whole worktree.
 */
async function syncSpecTree({ fromRoot, worktree, spec }) {
  const source = path.join(fromRoot, ".specs", spec);
  const target = path.join(worktree.cwd, ".specs", spec);
  await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await cp(source, target, { recursive: true });
}

/**
 * The service is the only writer to the specs repository, so everything it
 * pushes must be bot-authored. A foreign author in the range means the clone's
 * context is not what we think it is (a hijacked git environment, an operator
 * committing into the clone) — pushing it would publish commits the service
 * never authored, which is exactly how test commits once reached `main`.
 */
async function foreignAuthors({ git, cwd, branch, identity }) {
  let base = `origin/${branch}`;
  if (await git.revParse(base, { cwd }).catch(() => null) === null) base = `refs/remotes/origin/${branch}`;
  const range = `${base}..HEAD`;
  let emails;
  try {
    emails = await git.commitAuthors(range, { cwd });
  } catch {
    // No remote branch yet (first push): only the tip can be judged.
    emails = await git.commitAuthors("HEAD", { cwd });
  }
  return [...new Set(emails.filter((email) => email !== identity.email))];
}

/**
 * Write path (TASK-5): claim check -> kernel apply -> git add/commit/push as
 * the bot with Spec-Author/Spec-Request-Id trailers. Success is reported to
 * the caller only after the push is confirmed (FR-5); a failed push leaves
 * the clone ahead of remote for retry/boot reconciliation.
 */
export function createWritePipeline({ mounts, claims, identity, store = null, logger = () => {}, publish = null, projection = null, branchManager = null }) {
  return {
    async specPatch({ args, ctx, project, force, requestId, schemaVersion }) {
      const spec = typeof args.spec === "string" ? args.spec : null;
      const holder = ctx.identity.login;
      const confirming = args.intent === "confirmTaskCreation";
      if (confirming && (args.dryRun !== true || !spec || !isValidSpecSlug(spec) ||
          taskLocalId(args.entity) === null || typeof args.creationToken !== "string" ||
          !CREATION_TOKEN_RE.test(args.creationToken))) {
        return { envelope: errorEnvelope("specPatch", requestId, "INVALID_REQUEST", "invalid task creation confirmation request") };
      }
      if (args.dryRun !== true && spec) {
        const held = claims.get(project, spec);
        if (held && held.holder !== holder && force !== true) {
          return {
            envelope: errorEnvelope("specPatch", requestId, "CLAIM_HELD", `spec is claimed by ${held.holder} until ${held.expiresAt}`, {
              specSlug: spec,
              holder: held.holder,
              expiresAt: held.expiresAt,
            }),
          };
        }
        if (held && held.holder !== holder && force === true) {
          logger(`forced write over claim: project=${project} spec=${spec} holder=${held.holder} owner=${holder}`);
        }
      }

      const release = args.dryRun === true && !confirming ? () => {} : await mounts.acquireWriteLock(project);
      let envelope;
      try {
        if (args.dryRun !== true && typeof mounts.migrating === "function" && mounts.migrating(project)) {
        return {
          envelope: errorEnvelope("specPatch", requestId, "SPEC_MIGRATING", `project ${project} is migrating to another specs repo; retry when the move lands`, {
            specSlug: spec,
            retryable: true,
            causeCode: "SPEC_MIGRATING",
          }),
        };
      }

      // A createSpec write can be refused by the authoring gate. Bootstrap its
      // missing canonical branch only after the authoring transaction applies.
      let createCanonicalAfterApply = false;
      let worktree = null;
      if (spec !== null) {
        try {
          worktree = await mounts.worktreeFor(project, spec);
        } catch (error) {
          if (error?.code === "SPEC_BRANCH_MISSING" && args.intent === "createSpec" && args.dryRun === true) {
            // A preview needs the project projection, not a new canonical branch.
          } else if (error?.code === "SPEC_BRANCH_MISSING" && args.intent === "createSpec" && branchManager) {
            createCanonicalAfterApply = true;
          } else {
            return {
              envelope: errorEnvelope("specPatch", requestId, error?.code ?? "INTERNAL_ERROR", String(error?.message ?? error), {
                specSlug: spec,
                causeCode: error?.code ?? null,
                retryable: false,
              }),
            };
          }
        }
      }
      if (confirming) {
        try {
          const { git, cwd, branch } = worktree;
          await git.fetch({ cwd });
          const remoteCommit = await git.revParse(`refs/remotes/origin/${branch}`, { cwd });
          const documentPath = `.specs/${spec}/TASKS.md`;
          const { stdout } = await git.run(["ls-tree", "-z", "--full-tree", remoteCommit, "--", documentPath], { cwd });
          const entries = stdout.split("\0").filter(Boolean);
          if (entries.length === 0) {
            return { envelope: {
              schemaVersion: "spec-kernel@2", requestId: requestId ?? null, operation: "specPatch",
              ok: true, graph: null, page: null, data: { outcome: "UNKNOWN" },
              error: null, diagnostics: [], provenance: null,
            } };
          }
          if (entries.length !== 1) throw new Error("authoritative task document path is ambiguous");
          const separator = entries[0].indexOf("\t");
          const [mode, type] = entries[0].slice(0, separator).split(" ");
          const entryPath = entries[0].slice(separator + 1);
          if (separator < 0 || entryPath !== documentPath || type !== "blob" || !["100644", "100755"].includes(mode)) {
            throw new Error("authoritative task document is not a regular file");
          }
          const rawText = await git.show(remoteCommit, documentPath, { cwd });
          const text = rawText.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
          const parsed = parseMarkdownDocument({ path: "TASKS.md", documentKind: "TASKS", text });
          const matches = parsed.definitions.filter((node) => node.role === "TASK" && node.localId === taskLocalId(args.entity));
          const confirmed = matches.length === 1 && parseTaskCreationMarker(matches[0].bodyText) === args.creationToken;
          return { envelope: {
            schemaVersion: "spec-kernel@2", requestId: requestId ?? null, operation: "specPatch",
            ok: true, graph: null, page: null, data: { outcome: confirmed ? "CONFIRMED" : "UNKNOWN" },
            error: null, diagnostics: [], provenance: null,
          } };
        } catch {
          return { envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", "could not verify the authoritative specification branch", {
            retryable: true, causeCode: "REMOTE_VERIFICATION_FAILED", specSlug: spec,
          }) };
        }
      }
      const root = spec === null ? null : await mounts.projectRoot(project);
      const authoringService = mounts.serviceFor(project);
      let teamTaskPlan = { binds: [], deletes: [] };
      try {
        teamTaskPlan = await preflightTeamTaskWrites({ args, ctx, project, store, authoringService });
      } catch (error) {
        return {
          envelope: errorEnvelope("specPatch", requestId, error?.code ?? "TEAM_TASK_PREFLIGHT_FAILED", String(error?.message ?? error), {
            specSlug: spec,
            causeCode: error?.code ?? null,
          }),
        };
      }
      envelope = await authoringService.runQuery("specPatch", args, { requestId, schemaVersion, actor: holder });
      if (!(envelope.ok && envelope.data?.outcome === "APPLIED")) return { envelope };
      const receipt = envelope.data.receipt ?? {};
      if (teamTaskPlan.binds.length > 0) {
        try {
          await store.applyTeamSpecsTaskBindings({ action: "bind", bindings: teamTaskPlan.binds });
        } catch (error) {
          const rollback = await authoringService.rollbackApplied(requestId, receipt.proposalHash).catch(() => null);
          if (rollback?.ok) {
            return {
              envelope: errorEnvelope("specPatch", requestId, error?.code ?? "TEAM_TASK_BINDING_FAILED", String(error?.message ?? error), {
                specSlug: spec,
                causeCode: error?.code ?? null,
              }),
            };
          }
          return {
            envelope: errorEnvelope("specPatch", requestId, "TEAM_TASK_BINDING_ROLLBACK_FAILED", "the applied team task could not be registered and its content could not be rolled back", {
              specSlug: spec,
              causeCode: error?.code ?? "TEAM_TASK_BINDING_FAILED",
              rollbackCode: rollback?.code ?? "ROLLBACK_UNAVAILABLE",
            }),
          };
        }
      }
      if (createCanonicalAfterApply) {
        const rollbackUnpublishedCreate = async () => {
          const rollback = await authoringService.rollbackApplied(requestId, receipt.proposalHash).catch(() => null);
          if (rollback?.ok) return null;
          return errorEnvelope(
            "specPatch",
            requestId,
            "INTERNAL_ERROR",
            "the unpublished createSpec could not be rolled back without overwriting local changes",
            {
              retryable: false,
              causeCode: "CREATE_SPEC_ROLLBACK_FAILED",
              rollbackCode: rollback?.code ?? "ROLLBACK_UNAVAILABLE",
              specSlug: spec,
            },
          );
        };
        let created;
        try {
          created = await branchManager.ensureCanonical({
            project,
            spec,
            requestId,
            login: holder,
            initialSpecRoot: root,
            initialCommitMessage: commitMessage({
              subject: `spec(${project}): apply ${short(receipt.proposalHash)}`,
              trailers: {
                "Spec-Author": holder,
                "Spec-Request-Id": String(requestId ?? ""),
              },
            }),
          });
        } catch {
          const rollbackFailure = await rollbackUnpublishedCreate();
          if (rollbackFailure) return { envelope: rollbackFailure };
          return {
            envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", "could not publish the new specification branch", {
              retryable: true,
              causeCode: "GIT_PUSH_FAILED",
              specSlug: spec,
            }),
          };
        }
        if (!created.ok) {
          const rollbackFailure = await rollbackUnpublishedCreate();
          return { envelope: rollbackFailure ?? created };
        }
        logger(`pushed ${project} ${short(receipt.proposalHash)}`);
        await publish?.publishSpec(project, spec).then((result) => {
          if (result?.outcome === "published" || result?.outcome === "adopted") logger(`published ${result.spec}@${result.version}`);
          if (result?.outcome === "rejected") logger(`publish rejected ${result.spec}: ${result.code}`);
          if (result?.outcome === "skipped") logger(`publish skipped ${result.spec}: ${result.reason}`);
        }).catch((publishError) => logger(`publish after write failed for ${project}/${spec}: ${publishError.message}`));
        return { envelope };
      }
      if (worktree === null) return { envelope };
      const { git, cwd, branch } = worktree;
      const pushBotCommits = async () => {
        const foreign = await foreignAuthors({ git, cwd, branch, identity });
        if (foreign.length > 0) {
          const refusal = new Error(`the clone carries commits authored by ${foreign.join(", ")}`);
          refusal.causeCode = "FOREIGN_COMMITS";
          throw refusal;
        }
        await git.push({ refspec: `HEAD:refs/heads/${branch}` }, { cwd });
      };
      try {
        await syncSpecTree({ fromRoot: root, worktree, spec });
        const changed = [`.specs/${spec}`];
        await git.add(changed, { cwd });
        await git.commit({
          message: commitMessage({
            subject: `spec(${project}): apply ${short(receipt.proposalHash)}`,
            trailers: {
              "Spec-Author": holder,
              "Spec-Request-Id": String(requestId ?? ""),
            },
          }),
          authorName: identity.name,
          authorEmail: identity.email,
          cwd,
        });
        await pushBotCommits();
        await releaseDeletedTeamTaskBindings({ store, bindings: teamTaskPlan.deletes, logger });
        logger(`pushed ${project} ${short(receipt.proposalHash)}`);
        await mounts.refreshProject?.(project);
        // Publish is post-confirmation work (FR-11): the write already
        // succeeded, so a publish failure is logged, never reported as a
        // failed write.
        await publish?.publishSpec(project, spec).then((result) => {
          if (result?.outcome === "published" || result?.outcome === "adopted") logger(`published ${result.spec}@${result.version}`);
          if (result?.outcome === "rejected") logger(`publish rejected ${result.spec}: ${result.code}`);
          if (result?.outcome === "skipped") logger(`publish skipped ${result.spec}: ${result.reason}`);
        }).catch((publishError) => logger(`publish after write failed for ${project}/${spec}: ${publishError.message}`));
        // Tracker projection is post-confirmation work too: the pushed commit
        // re-projects cards + the committed snapshot; failures are logged by
        // the projection loop, never reported as a failed write.
        projection?.syncNow();
      } catch (error) {
        const foreignRefusal = (caught) =>
          caught?.causeCode === "FOREIGN_COMMITS"
            ? {
                envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `refusing to publish: ${caught.message}`, {
                  retryable: false,
                  causeCode: "FOREIGN_COMMITS",
                  specSlug: spec,
                }),
              }
            : null;
        // Never publish commits the service did not author: a foreign author
        // means the clone's git context is not what we think it is.
        const direct = foreignRefusal(error);
        if (direct) return direct;
        // A rejected push means the remote moved (break-glass, another writer):
        // replay the local commit on top of it and retry once, so the write is
        // never silently dropped and the clone does not stay stuck ahead.
        const recovered = await reconcileClone({ git, cwd, branch, identity, logger })
          .then(pushBotCommits)
          .then(() => true)
          .catch((retryError) => {
            logger(`push retry after reconcile failed: ${retryError.message}`);
            return retryError;
          });
        if (recovered === true) {
          logger(`pushed ${project} ${short(receipt.proposalHash)} after reconcile`);
          await releaseDeletedTeamTaskBindings({ store, bindings: teamTaskPlan.deletes, logger });
          await mounts.refreshProject?.(project);
          await publish?.publishSpec(project, spec).then((result) => {
            if (result?.outcome === "published" || result?.outcome === "adopted") logger(`published ${result.spec}@${result.version}`);
            if (result?.outcome === "rejected") logger(`publish rejected ${result.spec}: ${result.code}`);
            if (result?.outcome === "skipped") logger(`publish skipped ${result.spec}: ${result.reason}`);
          }).catch((publishError) => logger(`publish after write failed for ${project}/${spec}: ${publishError.message}`));
          projection?.syncNow();
          return { envelope };
        }
        // A foreign author discovered during the retry is the same policy
        // refusal, not a transient failure: never report it as retryable.
        const afterReconcile = foreignRefusal(recovered);
        if (afterReconcile) return afterReconcile;
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `write applied locally but the push to the specs repo failed: ${error.message}`, {
            retryable: true,
            causeCode: "GIT_PUSH_FAILED",
            specSlug: spec,
          }),
        };
      }
      } finally {
        release();
      }
      return { envelope };
    },
  };
}

function short(hash) {
  return typeof hash === "string" && hash.length > 0 ? hash.slice(0, 12) : "patch";
}

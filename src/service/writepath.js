import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { commitMessage } from "./git.js";
import { reconcileClone } from "./sync.js";

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
export function createWritePipeline({ mounts, claims, identity, logger = () => {}, publish = null, projection = null, branchManager = null }) {
  return {
    async specPatch({ args, ctx, project, force, requestId, schemaVersion }) {
      const spec = typeof args.spec === "string" ? args.spec : null;
      const holder = ctx.identity.login;
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

      const releaseLock = args.dryRun === true ? () => {} : await mounts.acquireWriteLock(project);
      // The lock guards the working tree, not the network: a push can take
      // seconds, and readers waiting on the lock during it saw multi-second
      // boards. Release right after the commit, before the push.
      let lockReleased = false;
      const release = () => {
        if (lockReleased) return;
        lockReleased = true;
        releaseLock();
      };
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

      let worktree = null;
      if (spec !== null) {
        try {
          worktree = await mounts.worktreeFor(project, spec);
        } catch (error) {
          if (error?.code === "SPEC_BRANCH_MISSING" && args.intent === "createSpec" && branchManager) {
            const created = await branchManager.ensureCanonical({ project, spec, requestId, login: holder });
            if (!created.ok && created.error?.code !== "SPEC_EXISTS") return { envelope: created };
            worktree = await mounts.worktreeFor(project, spec);
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
      const root = spec === null ? null : await mounts.projectRoot(project);
      envelope = await mounts.serviceFor(project).runQuery("specPatch", args, { requestId, schemaVersion });
      if (!(envelope.ok && envelope.data?.outcome === "APPLIED")) return { envelope };
      if (worktree === null) return { envelope };
      const { git, cwd, branch } = worktree;

      const receipt = envelope.data.receipt ?? {};
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
        // Commit is the last step that needs the write lock: everything below
        // is remote work (push, publish, projection) and must not block reads.
        release();
        await pushBotCommits();
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

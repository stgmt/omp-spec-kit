import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { commitMessage } from "./git.js";
import { reconcileClone } from "./sync.js";
import { validateSpecBinding } from "./spec-binding.js";

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
 * directory after a successful apply, never the whole worktree. Archival moves
 * the spec from `.specs/<spec>` to `.specs/archive/<spec>`, so both trees have
 * to change on the branch.
 */
async function syncSpecTree({ fromRoot, worktree, spec, archiveDestination = null }) {
  const relative = archiveDestination ?? `.specs/${spec}`;
  const source = path.join(fromRoot, relative);
  const target = path.join(worktree.cwd, relative);
  await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await cp(source, target, { recursive: true });
  if (archiveDestination !== null) {
    await rm(path.join(worktree.cwd, ".specs", spec), { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
}

/**
 * Archive keeps the branch and makes the state explicit in its binding record.
 * The marker is committed with the move, so a later reader (the service, an
 * operator, a future restore) never has to infer "archived" from a missing
 * directory or an extra path.
 */
async function markArchived({ worktree, spec, destination, by, reason }) {
  const file = path.join(worktree, ".spec-kit.json");
  const binding = JSON.parse(await readFile(file, "utf8"));
  binding.archive = {
    at: new Date().toISOString(),
    by: String(by || "spec-registryd").slice(0, 160),
    path: destination,
    ...(typeof reason === "string" && reason.trim() ? { reason: reason.trim().slice(0, 512) } : {}),
  };
  const checked = validateSpecBinding(binding, { branch: binding.branch, repoUrl: binding.repo });
  if (!checked.ok) throw Object.assign(new Error(`archive marker is invalid: ${checked.errors.join("; ")}`), { code: "WRITE_STAGING_FAILED" });
  await writeFile(file, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
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
      // Archived specs are read-only. A replay of the request that archived
      // them is still allowed through the kernel memo; every other write is
      // refused with a pointer to the explicit archive read surface.
      if (worktree?.archived === true && mounts.serviceFor(project).hasApplied?.(requestId) !== true) {
        return {
          envelope: errorEnvelope("specPatch", requestId, "SPEC_ARCHIVED", `specification ${spec} is archived and read-only; read it with spec_catalog view: "branches" with includeArchived: true and spec_documents action: "read" with includeArchived: true`, {
            specSlug: spec,
            retryable: false,
            causeCode: "SPEC_ARCHIVED",
          }),
        };
      }
      const root = spec === null ? null : await mounts.projectRoot(project);
      envelope = await mounts.serviceFor(project).runQuery("specPatch", args, {
        requestId, schemaVersion, hostedCoverage: true, coverageOwner: ctx.role === "owner",
      });
      if (!(envelope.ok && envelope.data?.outcome === "APPLIED")) return { envelope };
      if (worktree === null) return { envelope };
      const { git, cwd, branch } = worktree;

      const receipt = envelope.data.receipt ?? {};
      // Archival removes the live spec tree and installs it under
      // `.specs/archive/<spec>`. Mirror that exact move on the branch; copying
      // the source tree would read a directory the kernel already removed.
      const archiveDestination = receipt.archive === undefined ? null : `.specs/archive/${spec}`;
      // A replay of an archive that already landed has nothing left in the
      // read root to copy: the branch holds the archive and the live tree is
      // gone. Check the branch before syncSpecTree reads a missing directory.
      const archiveLanded = async () => {
        if (archiveDestination === null) return false;
        for (const ref of ["HEAD", `origin/${branch}`]) {
          const archived = await git.objectType(ref, archiveDestination, { cwd }).catch(() => null);
          if (archived !== "tree") continue;
          const live = await git.objectType(ref, `.specs/${spec}`, { cwd }).catch(() => null);
          if (live === null) return true;
        }
        return false;
      };
      const forgetApplied = () => {
        if (typeof requestId !== "string" || requestId.length === 0) return;
        try {
          mounts.serviceFor(project).forgetApplied?.(requestId);
        } catch (error) {
          logger(`could not clear the applied memo for ${project}/${spec}: ${error.message}`);
        }
      };
      if (receipt.archive !== undefined && receipt.archive?.destination !== archiveDestination) {
        release();
        forgetApplied();
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after invalid archive receipt failed for ${project}/${spec}: ${refreshError.message}`));
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", "the archive receipt names an unexpected destination", {
            retryable: false,
            causeCode: "ARCHIVE_DESTINATION_INVALID",
            specSlug: spec,
          }),
        };
      }
      const pushBotCommits = async () => {
        const foreign = await foreignAuthors({ git, cwd, branch, identity });
        if (foreign.length > 0) {
          const refusal = new Error(`the clone carries commits authored by ${foreign.join(", ")}`);
          refusal.causeCode = "FOREIGN_COMMITS";
          throw refusal;
        }
        await git.push({ refspec: `HEAD:refs/heads/${branch}` }, { cwd });
      };
      const afterPush = async () => {
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after write failed for ${project}/${spec}: ${refreshError.message}`));
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
      };
      let stage = "sync";
      try {
        const alreadyArchived = await archiveLanded();
        if (!alreadyArchived) {
          await syncSpecTree({ fromRoot: root, worktree, spec, archiveDestination });
          if (archiveDestination !== null) {
            stage = "marker";
            await markArchived({ worktree: cwd, spec, destination: archiveDestination, by: holder, reason: args.reason });
          }
        }
        const changed = alreadyArchived
          ? []
          : archiveDestination === null
            ? [`.specs/${spec}`]
            : [".spec-kit.json", `.specs/${spec}`, archiveDestination];
        stage = "add";
        await git.add(changed, { cwd });
        stage = "commit";
        if (await git.hasStagedChanges({ cwd })) {
          await git.commit({
            message: commitMessage({
              subject: archiveDestination === null
                ? `spec(${project}): apply ${short(receipt.proposalHash)}`
                : `spec(${project}): archive ${short(receipt.proposalHash)}`,
              trailers: {
                "Spec-Author": holder,
                "Spec-Request-Id": String(requestId ?? ""),
              },
            }),
            authorName: identity.name,
            authorEmail: identity.email,
            cwd,
          });
        } else {
          // A replay (or a no-op write): the branch already carries the
          // change, so pushing below is a no-op. Creating an empty commit
          // would rewrite the same content under a new SHA.
          logger(`nothing to commit for ${project}/${spec}; the write is already on the branch`);
        }
        // Commit is the last step that needs the write lock: everything below
        // is remote work (push, publish, projection) and must not block reads.
        release();
      } catch (error) {
        // The kernel already applied the change to the read root, but the
        // branch never received it. Drop the APPLIED memo (otherwise the same
        // requestId replays a write that never landed), rebuild the
        // materialised root from the committed branches, and report the
        // failure — never let a failed commit masquerade as a successful push
        // of an empty range.
        release();
        forgetApplied();
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after failed commit failed for ${project}/${spec}: ${refreshError.message}`));
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `write applied locally but the ${stage} step on the specs branch failed: ${error.message}`, {
            retryable: true,
            causeCode: stage === "commit" ? "GIT_COMMIT_FAILED" : "WRITE_STAGING_FAILED",
            stage,
            specSlug: spec,
          }),
        };
      }
      try {
        await pushBotCommits();
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
          await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
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
      logger(`pushed ${project} ${short(receipt.proposalHash)}`);
      await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
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

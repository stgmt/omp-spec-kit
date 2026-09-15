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
 * The service is the only writer to the specs repository, so everything it
 * pushes must be bot-authored. A foreign author in the range means the clone's
 * context is not what we think it is (a hijacked git environment, an operator
 * committing into the clone) — pushing it would publish commits the service
 * never authored, which is exactly how test commits once reached `main`.
 */
async function foreignAuthors({ git, cwd, branch, identity }) {
  const range = `origin/${branch}..HEAD`;
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
export function createWritePipeline({ mounts, claims, git, identity, logger = () => {} }) {
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

      const envelope = await mounts.serviceFor(project).runQuery("specPatch", args, { requestId, schemaVersion });
      if (!(envelope.ok && envelope.data?.outcome === "APPLIED")) return { envelope };

      const receipt = envelope.data.receipt ?? {};
      const branch = mounts.config.branch;
      const pushBotCommits = async () => {
        const foreign = await foreignAuthors({ git, cwd: mounts.cloneDir, branch, identity });
        if (foreign.length > 0) {
          const refusal = new Error(`the clone carries commits authored by ${foreign.join(", ")}`);
          refusal.causeCode = "FOREIGN_COMMITS";
          throw refusal;
        }
        await git.push({ refspec: `HEAD:refs/heads/${branch}` }, { cwd: mounts.cloneDir });
      };
      try {
        const changed = (receipt.changedDocuments ?? [])
          .map((change) => `${project}/${change.path}`.split("\\").join("/"))
          .filter((p) => !p.includes(".."));
        await git.add(changed, { cwd: mounts.cloneDir });
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
          cwd: mounts.cloneDir,
        });
        await pushBotCommits();
        logger(`pushed ${project} ${short(receipt.proposalHash)}`);
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
        const recovered = await reconcileClone({ git, cwd: mounts.cloneDir, branch, identity, logger })
          .then(pushBotCommits)
          .then(() => true)
          .catch((retryError) => {
            logger(`push retry after reconcile failed: ${retryError.message}`);
            return retryError;
          });
        if (recovered === true) {
          logger(`pushed ${project} ${short(receipt.proposalHash)} after reconcile`);
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
      return { envelope };
    },
  };
}

function short(hash) {
  return typeof hash === "string" && hash.length > 0 ? hash.slice(0, 12) : "patch";
}

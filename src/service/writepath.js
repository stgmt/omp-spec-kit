import { commitMessage } from "./git.js";

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

      try {
        const receipt = envelope.data.receipt ?? {};
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
        await git.push({ refspec: `HEAD:refs/heads/${mounts.config.branch}` }, { cwd: mounts.cloneDir });
        logger(`pushed ${project} ${short(receipt.proposalHash)}`);
      } catch (error) {
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

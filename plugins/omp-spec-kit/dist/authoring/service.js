import { createHash } from "node:crypto";
import { detectSecret } from "./secrets.js";
import { error, isRetryable, safeErrorCode } from "./error-codes.js";
import { ProposalCompiler, publicOperationKind } from "./proposals.js";
import {
  canonicalJson,
  commitDocuments,
  readDocumentBytes,
  sha256,
  withWriteLock,
} from "./transactions.js";
import {
  ELICITATION_HINT,
  ELICITATION_REQUIRED,
  ELICITATION_SKILL_URI,
  FirstWriteElicitationGuard,
} from "./elicitation-guard.js";

export const AUTHORING_OPERATIONS = Object.freeze(["specPatch"]);


function compileRefusalCode(code) {
  return (
    code === "CONFLICT" ||
    code === "STATUS_CONFLICT" ||
    code === "DESIGN_REVIEW_REQUIRED" ||
    code === "DESIGN_REVIEW_INVALID"
  );
}

// The receipt's actor is an authenticated principal, never client text. The
// hosted transport passes the caller's verified login; the local stdio
// transport has no principal and falls back to one deterministic service
// identity so a transition record is never actorless or caller-supplied.
const DEFAULT_ACTOR = "registry";
const MAX_ACTOR_CHARS = 200;

function resolveActor(authenticatedActor, serviceActor) {
  for (const candidate of [authenticatedActor, serviceActor]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed === "") continue;
    if (trimmed.length > MAX_ACTOR_CHARS) continue;
    if (/[\x00-\x1f\x7f]/u.test(trimmed)) continue;
    if (detectSecret(trimmed)) continue;
    return trimmed;
  }
  return DEFAULT_ACTOR;
}

// The canonical request identity: a replay is the same requestId with the same
// payload, and a changed payload under a used requestId is a conflict.
function requestKeyFor(input) {
  return canonicalJson({
    requestId: input.requestId,
    spec: input.spec,
    intent: input.intent ?? "patch",
    reason: input.reason,
    operations: input.operations ?? null,
    requirement: input.requirement ?? null,
    body: input.body ?? null,
    criterion: input.criterion ?? null,
    title: input.title ?? null,
    summary: input.summary ?? null,
    entity: input.entity ?? null,
    status: input.status ?? null,
    expectedStatus: input.expectedStatus ?? null,
    localId: input.localId ?? null,
    owner: input.owner ?? null,
    tracking: input.tracking ?? null,
    dependsOn: input.dependsOn ?? null,
    refs: input.refs ?? null,
    requirements: input.requirements ?? null,
    metadata: input.metadata ?? null,
    contract: input.contract ?? null,
    doc: input.doc ?? input.document ?? null,
    newDoc: input.newDoc ?? null,
    actorRef: input.actorRef ?? null,
    designReview: input.designReview ?? null,
  });
}

function validateActorRef(actorRef) {
  if (actorRef === undefined || actorRef === null) return { ok: true };
  if (typeof actorRef !== "string" || actorRef.length === 0 || actorRef.length > 64) {
    return { ok: false, message: "actorRef must be a string up to 64 characters" };
  }
  if (/[\x00-\x1f\x7f\\/]/u.test(actorRef)) {
    return { ok: false, message: "actorRef contains forbidden control characters or path separators" };
  }
  if (detectSecret(actorRef)) {
    return { ok: false, message: "actorRef resembles a secret credential" };
  }
  return { ok: true };
}

export class SpecPatchService {
  constructor(root, getGraph, refreshGraph, options = {}) {
    this.root = root;
    this.getGraph = getGraph;
    this.refreshGraph = refreshGraph;
    this.options = options;
    this.compiler = new ProposalCompiler(root);
    this.elicitationGuard = options.elicitationGuard ?? new FirstWriteElicitationGuard();
    this.applied = new Map();
    this.operations = AUTHORING_OPERATIONS;
  }

  async execute(input = {}) {
    const requestId = input.requestId;

    const actorValidation = validateActorRef(input.actorRef);
    if (!actorValidation.ok) {
      return error("INVALID_REQUEST", actorValidation.message, { requestId });
    }

    if (input.dryRun !== undefined && typeof input.dryRun !== "boolean") {
      return error("INVALID_REQUEST", "dryRun must be a boolean when provided", {
        requestId,
        parameter: "dryRun",
        expected: "boolean",
        receivedType: typeof input.dryRun,
      });
    }

    const dryRun = input.dryRun ?? true;

    const refusal = (code, message, findings = [], proposalHash = "", extra = {}) => ({
      ok: true,
      data: {
        schemaVersion: "spec-mcp-operations-patch@1",
        requestId: typeof requestId === "string" ? requestId : "",
        dryRun: false,
        proposalHash,
        outcome: "REFUSED",
        error: {
          code,
          message,
          retryable: isRetryable(code),
          requestId: typeof requestId === "string" ? requestId : "",
          proposalHash,
          changedPaths: [],
          ...(findings.length > 0 ? { findings } : {}),
          ...extra,
        },
      },
    });

    if (!dryRun) {
      if (this.options.authorityAllowed === false) {
        return refusal("PATH_FORBIDDEN", "untrusted caller cannot mutate specifications");
      }

      // Replay detection using canonical request key before compile
      const requestKey = requestKeyFor(input);
      const prior = this.applied.get(requestId);
      if (prior) {
        if (prior.requestKey === requestKey) {
          return prior.response;
        }
        return refusal("CONFLICT", `requestId ${requestId} already used with different payload`);
      }
    }

    if (typeof this.refreshGraph === "function") await this.refreshGraph();
    const graph = await this.getGraph();

    const compileRes = await this.compiler.compile(input, graph);
    if (!compileRes.ok) {
      if (!dryRun && compileRefusalCode(compileRes.error?.code)) {
        const detail = {};
        for (const key of ["currentStatus", "expectedStatus", "localId", "causeCode"]) {
          if (compileRes.error?.[key] !== undefined) detail[key] = compileRes.error[key];
        }
        return refusal(
          compileRes.error.code,
          compileRes.error.message,
          compileRes.error.findings,
          compileRes.error.proposalHash,
          detail,
        );
      }
      return compileRes;
    }
    const proposal = compileRes.data;
    const requestKey = requestKeyFor(input);
    const actor = resolveActor(input.actor, this.options.actor);
    const transitions = (proposal.transitions ?? []).map((transition) => ({
      requestId: typeof requestId === "string" ? requestId : null,
      ...transition,
      actor,
    }));

    // Mode 1: dryRun preview (no write lock, no staging, no writes)
    if (dryRun) {
      return {
        ok: true,
        data: {
          schemaVersion: "spec-mcp-operations-patch@1",
          requestId: requestId ?? null,
          dryRun: true,
          proposalHash: proposal.proposalHash,
          outcome: "PREVIEW",
          spec: proposal.spec,
          baseGenerationSha256: proposal.baseSnapshotSha256,
          unchanged: proposal.unchanged === true,
          operations: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            operation: publicOperationKind(change.operation),
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
            unchanged: change.unchanged === true,
            diff: change.preview.unifiedDiff,
          })),
          transitions: transitions.map((transition) => ({ ...transition, at: null })),
          findings: proposal.findings ?? [],
          ...(proposal.designReview ? { designReview: proposal.designReview } : {}),
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
        },
      };
    }

    // Mode 2: dryRun: false transactional commit
    const proposalHash = proposal.proposalHash;

    // Nothing to write: a structured task operation already matches the stored
    // state. No staging, no lock, and no transition record — replaying a
    // status write that already landed cannot create a second history event.
    if (proposal.unchanged === true) {
      const response = {
        ok: true,
        data: {
          schemaVersion: "spec-mcp-operations-patch@1",
          requestId,
          dryRun: false,
          proposalHash,
          outcome: "UNCHANGED",
          spec: proposal.spec,
          unchanged: true,
          transitions: [],
        },
      };
      if (typeof requestId === "string") this.applied.set(requestId, { requestKey, response });
      return response;
    }


    try {
      const result = await withWriteLock(this.root, requestId, async () => {
        // Under write lock, verify graph fingerprint hasn't changed
        const freshGraph = typeof this.refreshGraph === "function" ? await this.refreshGraph() : await this.getGraph();
        if (freshGraph.fingerprint !== proposal.baseSnapshotSha256) {
          return refusal("CONFLICT", "graph snapshot changed after proposal", [], proposalHash);
        }

        // Under write lock, verify each document preimage hash
        for (const change of proposal.changes) {
          const current = await readDocumentBytes(this.root, proposal.spec, change.document);
          const currentHash = current.ok ? current.sha256 : sha256(Buffer.alloc(0));
          if (currentHash !== change.preview.beforeSha256) {
            return refusal("CONFLICT", "a targeted document changed after proposal creation", [], proposalHash);
          }
        }

        const guardCheck = this.elicitationGuard.checkAndRecord(proposal.spec, proposal.changes);
        if (!guardCheck.ok) {
          return {
            ok: true,
            data: {
              schemaVersion: "spec-mcp-operations-patch@1",
              requestId: typeof requestId === "string" ? requestId : "",
              dryRun: false,
              proposalHash,
              outcome: "REFUSED",
              error: {
                code: ELICITATION_REQUIRED,
                message: `${ELICITATION_HINT} (first creation of ${guardCheck.documents.join(", ")} was stopped; retry is allowed)`,
                retryable: false,
                requestId: typeof requestId === "string" ? requestId : "",
                proposalHash,
                skill: ELICITATION_SKILL_URI,
                documents: guardCheck.documents,
                changedPaths: [],
                findings: [],
              },
            },
          };
        }

        let changesToApply = proposal.changes;
        if (proposal.kind === "archive") {
          changesToApply = proposal.changes.map((c) => ({
            ...c,
            destination: "." + "specs/archive/" + proposal.spec + "/" + c.document,
          }));
        }

        await commitDocuments(this.root, requestId, changesToApply, this.options);
        if (typeof this.refreshGraph === "function") await this.refreshGraph();

        const at = new Date().toISOString();
        const receiptTransitions = transitions.map((transition) => ({ ...transition, at }));
        const receipt = {
          schemaVersion: "spec-mcp-operations-receipt@1",
          requestId,
          proposalHash,
          outcome: "APPLIED",
          reason: input.reason,
          ...(input.actorRef ? { actorRef: input.actorRef } : {}),
          transitions: receiptTransitions,
          changedDocuments: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
          })),
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
          ...(proposal.designReview ? { designReview: proposal.designReview } : {}),
          findings: [],
        };

        return {
          ok: true,
          data: {
            schemaVersion: "spec-mcp-operations-patch@1",
            requestId,
            dryRun: false,
            proposalHash,
            outcome: "APPLIED",
            transitions: receiptTransitions,
            receipt,
          },
        };
      });

      if (result.ok && result.data?.outcome === "APPLIED") {
        this.applied.set(requestId, { requestKey, response: result });
      }
      return result;
    } catch (caught) {
      const code = safeErrorCode(caught?.code ?? "INTERNAL_ERROR");
      return refusal(code, caught?.message || "specification transaction was refused", [], proposalHash);
    }
  }
}

export function createAuthoringService(root, getGraph, refreshGraph, options = {}) {
  return new SpecPatchService(root, getGraph, refreshGraph, options);
}

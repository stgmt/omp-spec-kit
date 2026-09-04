import { createHash } from "node:crypto";
import { detectSecret } from "./secrets.js";
import { ProposalCompiler, publicOperationKind } from "./proposals.js";
import {
  canonicalJson,
  commitDocuments,
  readDocumentBytes,
  sha256,
  withWriteLock,
} from "./transactions.js";

export const AUTHORING_OPERATIONS = Object.freeze(["specPatch"]);

const WRITE_ERROR_CODES = new Set([
  "INVALID_REQUEST",
  "PATH_FORBIDDEN",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RECOVERY_REQUIRED",
  "DEADLINE_EXCEEDED",
  "CONCURRENT_READ",
  "ROLLBACK_FAILED",
  "INTERNAL_ERROR",
]);

function isRetryable(code) {
  return (
    code === "CONFLICT" ||
    code === "DEADLINE_EXCEEDED" ||
    code === "CONCURRENT_READ" ||
    code === "RECOVERY_REQUIRED" ||
    code === "ROLLBACK_FAILED"
  );
}

function safeErrorCode(code) {
  if (WRITE_ERROR_CODES.has(code)) return code;
  if (code === "DOC_NOT_FOUND" || code === "NOT_FOUND") return "PATH_FORBIDDEN";
  return "VALIDATION_FAILED";
}

function error(code, message, extra = {}) {
  const normalizedCode = safeErrorCode(code);
  return {
    ok: false,
    error: {
      code: normalizedCode,
      message,
      retryable: isRetryable(normalizedCode),
      requestId: extra.requestId ?? null,
      proposalHash: extra.proposalHash ?? null,
      changedPaths: extra.changedPaths ?? [],
      findings: extra.findings ?? [],
      ...extra,
    },
  };
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

    const refusal = (code, message, findings = [], proposalHash = "") => ({
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
        },
      },
    });

    if (!dryRun) {
      if (this.options.authorityAllowed === false) {
        return refusal("PATH_FORBIDDEN", "untrusted caller cannot mutate specifications");
      }

      // Replay detection using canonical request key before compile
      const identity = {
        requestId,
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
        metadata: input.metadata ?? null,
        contract: input.contract ?? null,
        doc: input.doc ?? input.document ?? null,
        newDoc: input.newDoc ?? null,
        actorRef: input.actorRef ?? null,
      };
      const requestKey = canonicalJson(identity);
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
      if (!dryRun && compileRes.error?.code === "CONFLICT") {
        return refusal("CONFLICT", compileRes.error.message, compileRes.error.findings, compileRes.error.proposalHash);
      }
      return compileRes;
    }
    const proposal = compileRes.data;

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
          operations: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            operation: publicOperationKind(change.operation),
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
            diff: change.preview.unifiedDiff,
          })),
          findings: proposal.findings ?? [],
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
        },
      };
    }

    // Mode 2: dryRun: false transactional commit
    const proposalHash = proposal.proposalHash;

    const identity = {
      requestId,
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
      metadata: input.metadata ?? null,
      contract: input.contract ?? null,
      doc: input.doc ?? input.document ?? null,
      newDoc: input.newDoc ?? null,
      actorRef: input.actorRef ?? null,
    };
    const requestKey = canonicalJson(identity);

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

        let changesToApply = proposal.changes;
        if (proposal.kind === "archive") {
          changesToApply = proposal.changes.map((c) => ({
            ...c,
            destination: "." + "specs/archive/" + proposal.spec + "/" + c.document,
          }));
        }

        await commitDocuments(this.root, requestId, changesToApply, this.options);
        if (typeof this.refreshGraph === "function") await this.refreshGraph();

        const receipt = {
          schemaVersion: "spec-mcp-operations-receipt@1",
          requestId,
          proposalHash,
          outcome: "APPLIED",
          reason: input.reason,
          ...(input.actorRef ? { actorRef: input.actorRef } : {}),
          changedDocuments: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
          })),
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
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

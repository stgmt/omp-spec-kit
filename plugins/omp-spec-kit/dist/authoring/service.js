import { createHash } from "node:crypto";
import { FIXED_DOCUMENT_FILES } from "../kernel/types.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { validateMetadata } from "../kernel/query/extended.js";
import { detectSecret } from "./secrets.js";
import { createProposalService } from "./proposals.js";
import {
  canonicalJson,
  commitDocuments,
  documentAbsolute,
  readDocumentBytes,
  sha256,
  specificationDirectoryExists,
  withWriteLock,
} from "./transactions.js";

const AUTHORING_OPERATIONS = Object.freeze([
  "proposePatch",
  "applyProposedPatch",
  "amendRequirement",
  "addAcceptanceCriterion",
  "addPhase",
  "setEntityStatus",
  "setSpecStatus",
  "setRequirementMetadata",
  "deleteSpecDoc",
  "renameSpecDoc",
  "createSpec",
  "archiveSpec",
  "addBacklogTask",
  "registerIncidentBacklog",
]);
export { AUTHORING_OPERATIONS };

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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requestIdFor(name, input) {
  if (typeof input.requestId === "string" && input.requestId.length > 0) return input.requestId;
  return `${name}-${createHash("sha256").update(canonicalJson(input)).digest("hex").slice(0, 24)}`;
}

function reasonFor(input) {
  return typeof input.reason === "string" && input.reason.trim() ? input.reason : `authoring facade ${input.operation ?? "request"}`;
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

function operationForFacade(name, input) {
  const spec = input.spec;
  if (typeof spec !== "string" || !isValidSpecSlug(spec)) return error("PATH_FORBIDDEN", "spec must be a valid specification slug");
  const reason = reasonFor(input);
  const document = input.doc ?? input.document;

  if (name === "amendRequirement") {
    if (typeof input.requirement !== "string" || typeof input.body !== "string") return error("INVALID_REQUEST", "amendRequirement requires requirement and body");
    return { spec, reason, operations: [{ kind: "append_to_section", document: "FR.md", heading: input.requirement, text: input.body, expectedSha: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "setSpecStatus") {
    const heading = typeof input.heading === "string" && input.heading.trim()
      ? input.heading.trim()
      : ["Public states", "Current product status", "Status", "Readiness rule", "Scope"];
    return { spec, reason, operations: [{ kind: "append_to_section", document: "README.md", heading, text: `\n- **Status:** ${input.status}\n` }] };
  }

  if (name === "deleteSpecDoc") {
    if (typeof document !== "string") return error("INVALID_REQUEST", "deleteSpecDoc requires doc");
    return { spec, reason, operations: [{ kind: "delete_document", document, expectedSha: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "renameSpecDoc") {
    if (typeof document !== "string" || typeof input.newDoc !== "string") return error("INVALID_REQUEST", "renameSpecDoc requires doc and newDoc");
    return { spec, reason, operations: [{ kind: "rename_document", document, newDocument: input.newDoc }] };
  }

  if (name === "setEntityStatus") {
    if (typeof input.entity !== "string" || typeof input.status !== "string") return error("INVALID_REQUEST", "setEntityStatus requires entity and status");
    return { spec, reason, operations: [{ kind: "replace_task_status", document: "TASKS.md", entity: input.entity, status: input.status }] };
  }


  if (name === "setRequirementMetadata") {
    const payload = input.metadata ?? input.contract;
    if (!isObject(payload) || typeof input.requirement !== "string") return error("INVALID_REQUEST", `${name} requires requirement and an object payload`);
    const validation = validateMetadata(payload);
    if (!validation.valid) {
      return error("VALIDATION_FAILED", `invalid requirement metadata: ${validation.issues.map((i) => i.message).join(", ")}`, { findings: validation.issues });
    }
    const rendered = `\n\nMetadata for ${input.requirement}:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
    return { spec, reason, operations: [{ kind: "append_to_section", document: "FR.md", heading: input.requirement, text: rendered }] };
  }

  if (name === "addAcceptanceCriterion") {
    if (typeof input.requirement !== "string" || typeof input.criterion !== "string") return error("INVALID_REQUEST", "addAcceptanceCriterion requires requirement and criterion");
    const suffix = (Number.parseInt(createHash("sha256").update(`${spec}\u0000${input.requirement}\u0000${input.criterion}`).digest("hex").slice(0, 8), 16) % 1_000_000) + 1;
    return { spec, reason, operations: [{ kind: "insert_at_eof", document: "ACCEPTANCE_CRITERIA.md", text: `\n## AC-9000.${suffix} — ${input.requirement}\n\n${input.criterion}\n` }] };
  }

  if (name === "addPhase") {
    if (typeof input.title !== "string" || input.title.trim() === "") return error("INVALID_REQUEST", "addPhase requires title");
    return { spec, reason, operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: `\n## Phase — ${input.title.trim()}\n` }] };
  }

  if (name === "addBacklogTask" || name === "registerIncidentBacklog") {
    const title = input.title ?? input.summary;
    if (typeof title !== "string" || title.trim() === "") return error("INVALID_REQUEST", `${name} requires title or summary`);
    let reqLines = "";
    if (Array.isArray(input.requirements) && input.requirements.length > 0) {
      const normalizedReqs = [...new Set(input.requirements.filter((r) => typeof r === "string" && r.trim()).map((r) => r.trim()))].sort();
      if (normalizedReqs.length > 0) {
        reqLines = `\n- **Requirements:** ${normalizedReqs.join(", ")}`;
      }
    } else if (typeof input.requirements === "string" && input.requirements.trim()) {
      reqLines = `\n- **Requirements:** ${input.requirements.trim()}`;
    }
    return {
      spec,
      reason,
      operations: [
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: `\n## Backlog — ${title.trim()}\n\n- **Status:** todo\n- **Done When:** ${reason}${reqLines}\n`,
        },
      ],
    };
  }

  if (name === "createSpec") {
    const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : spec;
    const docs = [];
    for (const doc of Object.values(FIXED_DOCUMENT_FILES)) {
      docs.push({ kind: "replace_document", document: doc, content: `# ${title}\n\nStatus: DRAFT\n` });
    }
    docs.push({ kind: "replace_document", document: `${spec}.feature`, content: `Feature: ${title}\n` });
    docs.push({ kind: "replace_document", document: `${spec}_SCHEMA.md`, content: `# ${title} Schema\n\nStatus: DRAFT\n` });
    return { spec, reason, operations: docs };
  }

  return error("INVALID_REQUEST", `no operation compiler for ${name}`);
}

function expectedDocumentsMatch(expectedDocuments, proposal) {
  if (!Array.isArray(expectedDocuments)) return false;
  const expected = expectedDocuments
    .map((entry) => {
      const rawDocument = entry?.document ?? entry?.path;
      const prefix = ".specs/" + proposal.spec + "/";
      const doc = typeof rawDocument === "string" && rawDocument.startsWith(prefix) ? rawDocument.slice(prefix.length) : rawDocument;
      return { document: doc, sha256: entry?.sha256 ?? entry?.beforeSha256 };
    })
    .sort((left, right) => String(left.document).localeCompare(String(right.document)));
  const actual = proposal.changes
    .map((change) => ({ document: change.document, sha256: change.preview.beforeSha256 }))
    .sort((left, right) => left.document.localeCompare(right.document));
  return JSON.stringify(expected) === JSON.stringify(actual);
}

export function createAuthoringService(root, getGraph, refreshGraph, options = {}) {
  const proposals = createProposalService(root, getGraph);
  const applied = new Map();

  async function proposePatch(input = {}) {
    if (typeof refreshGraph === "function") await refreshGraph();
    return proposals.proposePatch(input);
  }

  async function applyProposedPatch(input = {}) {
    const requestId = input.requestId;
    const proposalId = input.proposalId;
    const proposalHash = input.proposalSha256;

    const refusal = (code, message, findings = []) => ({
      ok: true,
      data: {
        schemaVersion: "spec-mcp-operations-apply@1",
        requestId,
        proposalHash: typeof proposalHash === "string" ? proposalHash : "",
        outcome: "REFUSED",
        error: {
          code,
          message,
          retryable: isRetryable(code),
          requestId: typeof requestId === "string" ? requestId : "",
          ...(typeof proposalHash === "string" ? { proposalHash } : {}),
          changedPaths: [],
          ...(findings.length > 0 ? { findings } : {}),
        },
      },
    });

    if (
      typeof requestId !== "string" ||
      typeof proposalId !== "string" ||
      typeof proposalHash !== "string" ||
      typeof input.reason !== "string" ||
      input.reason.trim() === ""
    ) {
      return error("INVALID_REQUEST", "requestId, proposalId, proposalSha256, and non-empty reason are required", { requestId, proposalHash, changedPaths: [] });
    }

    const actorValidation = validateActorRef(input.actorRef);
    if (!actorValidation.ok) {
      return refusal("INVALID_REQUEST", actorValidation.message);
    }

    // Replay identity checking
    const identity = {
      proposalId,
      proposalHash,
      expectedDocuments: Array.isArray(input.expectedDocuments)
        ? [...input.expectedDocuments].sort((a, b) => String(a?.path ?? a?.document).localeCompare(String(b?.path ?? b?.document)))
        : null,
      reason: input.reason,
      approval: input.approval,
      actorRef: input.actorRef ?? null,
    };
    const requestKey = canonicalJson(identity);
    const prior = applied.get(requestId);
    if (prior) {
      if (prior.requestKey === requestKey) {
        return prior.response;
      }
      return refusal("CONFLICT", `requestId ${requestId} already used with different payload`);
    }

    if (input.approval !== "approve") {
      return refusal("INVALID_REQUEST", "explicit approval=approve is required before applying a proposal");
    }

    const proposal = proposals.getProposal(proposalId);
    if (!proposal) return refusal("CONFLICT", "proposal is unknown or expired");
    if (proposal.proposalSha256 !== proposalHash) return refusal("CONFLICT", "proposal hash does not match the stored proposal");
    if (!expectedDocumentsMatch(input.expectedDocuments, proposal)) return refusal("CONFLICT", "expected document hashes do not match the proposal");
    if (options.authorityAllowed === false) return refusal("PATH_FORBIDDEN", "untrusted caller cannot mutate specifications");

    try {
      const result = await withWriteLock(root, requestId, async () => {
        // Fresh graph check directly under write lock
        const graph = typeof refreshGraph === "function" ? await refreshGraph() : await getGraph();
        if (graph.fingerprint !== proposal.baseSnapshotSha256) {
          return refusal("CONFLICT", "graph snapshot changed after proposal");
        }

        // Verify all document hashes on disk directly under write lock before applying
        for (const change of proposal.changes) {
          const current = await readDocumentBytes(root, proposal.spec, change.document);
          const currentHash = current.ok ? current.sha256 : sha256(Buffer.alloc(0));
          if (currentHash !== change.preview.beforeSha256) {
            return refusal("CONFLICT", "a targeted document changed after proposal creation");
          }
        }

        let changesToApply = proposal.changes;
        if (proposal.kind === "archive") {
          changesToApply = proposal.changes.map((c) => ({
            ...c,
            destination: `.specs/archive/${proposal.spec}/${c.document}`,
          }));
        }

        await commitDocuments(root, requestId, changesToApply, options);
        if (typeof refreshGraph === "function") await refreshGraph();

        const fixedReason = "approved proposal applied";
        const receipt = {
          schemaVersion: "spec-mcp-operations-receipt@1",
          requestId,
          proposalHash,
          outcome: "APPLIED",
          reason: fixedReason,
          ...(input.actorRef ? { actorRef: input.actorRef } : {}),
          changedDocuments: proposal.changes.map((change) => ({
            path: ".specs/" + change.spec + "/" + change.document,
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
          })),
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
          findings: [],
        };
        return { ok: true, data: { schemaVersion: "spec-mcp-operations-apply@1", requestId, proposalHash, outcome: "APPLIED", receipt } };
      });

      if (result.ok && result.data?.outcome === "APPLIED") {
        applied.set(requestId, { requestKey, response: result });
      }
      return result;
    } catch (caught) {
      const code = safeErrorCode(caught?.code ?? "INTERNAL_ERROR");
      return refusal(code, caught.message || "specification transaction was refused");
    }
  }

  async function compileFacade(name, input = {}) {
    if (!AUTHORING_OPERATIONS.includes(name)) return error("UNKNOWN_OPERATION", `unknown authoring operation: ${name}`);
    if (name === "proposePatch") return proposePatch(input);
    if (name === "applyProposedPatch") {
      return applyProposedPatch(input);
    }
    if (typeof refreshGraph === "function") await refreshGraph();
    const graph = await getGraph();
    if (name === "archiveSpec") {
      return proposals.proposeArchive({
        ...input,
        requestId: requestIdFor(name, input),
        repositoryRootFingerprint: graph.fingerprint,
      });
    }
    if (name === "createSpec") {
      const existing = await specificationDirectoryExists(root, input.spec);
      if (!existing.ok) return error(existing.code, existing.message);
      if (existing.exists) return error("CONFLICT", `specification already exists: ${input.spec}`);
    }
    const compiled = operationForFacade(name, { ...input, operation: name });
    if (compiled.ok === false) return compiled;
    return proposePatch({
      requestId: requestIdFor(name, input),
      repositoryRootFingerprint: graph.fingerprint,
      spec: compiled.spec,
      reason: compiled.reason,
      operations: compiled.operations,
    });
  }

  return {
    operations: AUTHORING_OPERATIONS,
    proposePatch,
    applyProposedPatch,
    compileFacade,
    getProposal: proposals.getProposal,
  };
}

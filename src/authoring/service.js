import { createHash } from "node:crypto";
import { FIXED_DOCUMENT_FILES } from "../kernel/types.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { createProposalService } from "./proposals.js";
import { canonicalJson, commitArchive, commitDocuments, documentAbsolute, readDocumentBytes, sha256, specificationDirectoryExists, withWriteLock } from "./transactions.js";

const AUTHORING_OPERATIONS = Object.freeze([
  "proposeSpecChange",
  "applySpecChange",
  "proposePatch",
  "applyProposedPatch",
  "applySpecTransaction",
  "appendToSection",
  "insertAfterHeading",
  "insertAtEof",
  "replaceInSection",
  "amendRequirement",
  "addAcceptanceCriterion",
  "addPhase",
  "setEntityStatus",
  "setSpecStatus",
  "setRequirementMetadata",
  "proposeRequirementContract",
  "proposeSpecRepairs",
  "applySpecRepairs",
  "deleteSpecDoc",
  "renameSpecDoc",
  "createSpec",
  "archiveSpec",
  "addBacklogTask",
  "registerIncidentBacklog",
]);
export { AUTHORING_OPERATIONS };

function error(code, message, extra = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: code === "CONFLICT" || code === "WRITE_FAILED",
      findings: [],
      nextAction: code === "CONFLICT" ? "re-read the proposal and affected documents" : "fix the request and retry",
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

function operationForFacade(name, input) {
  const spec = input.spec;
  if (typeof spec !== "string" || !isValidSpecSlug(spec)) return error("PATH_FORBIDDEN", "spec must be a valid specification slug");
  const reason = reasonFor(input);
  const document = input.doc ?? input.document;
  if (name === "proposeSpecChange") {
    if (typeof document !== "string" || !isObject(input.change)) return error("INVALID_REQUEST", "proposeSpecChange requires doc and a change object");
    const operation = {
      ...input.change,
      kind: input.change.kind ?? input.change.operation ?? "replace_document",
      document,
    };
    if (operation.kind === "replace_document" && typeof operation.content !== "string") return error("INVALID_REQUEST", "replace_document change requires content");
    return { spec, reason, operations: [operation] };
  }
  if (name === "appendToSection" || name === "insertAfterHeading") {
    if (typeof document !== "string" || typeof input.heading !== "string" || typeof input.text !== "string") return error("INVALID_REQUEST", `${name} requires doc, heading, and text`);
    return { spec, reason, operations: [{ kind: name === "appendToSection" ? "append_to_section" : "insert_after_heading", document, heading: input.heading, text: input.text, expectedDocumentSha256: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "insertAtEof") {
    if (typeof document !== "string" || typeof input.text !== "string") return error("INVALID_REQUEST", "insertAtEof requires doc and text");
    return { spec, reason, operations: [{ kind: "insert_at_eof", document, text: input.text, expectedDocumentSha256: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "replaceInSection") {
    if (typeof document !== "string" || typeof input.heading !== "string" || typeof input.oldText !== "string" || typeof input.newText !== "string") return error("INVALID_REQUEST", "replaceInSection requires doc, heading, oldText, and newText");
    return { spec, reason, operations: [{ kind: "replace_in_section", document, heading: input.heading, oldText: input.oldText, newText: input.newText, replaceAll: input.replaceAll === true, expectedDocumentSha256: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "amendRequirement") {
    if (typeof input.requirement !== "string" || typeof input.body !== "string") return error("INVALID_REQUEST", "amendRequirement requires requirement and body");
    return { spec, reason, operations: [{ kind: "append_to_section", document: "FR.md", heading: input.requirement, text: input.body, expectedDocumentSha256: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "deleteSpecDoc") {
    if (typeof document !== "string") return error("INVALID_REQUEST", "deleteSpecDoc requires doc");
    return { spec, reason, operations: [{ kind: "delete_document", document, expectedDocumentSha256: typeof input.expectedSha === "string" ? input.expectedSha : undefined }] };
  }
  if (name === "renameSpecDoc") {
    if (typeof document !== "string" || typeof input.newDoc !== "string") return error("INVALID_REQUEST", "renameSpecDoc requires doc and newDoc");
    return { spec, reason, operations: [{ kind: "rename_document", document, newDocument: input.newDoc }] };
  }
  if (name === "setEntityStatus") {
    if (typeof input.entity !== "string" || typeof input.status !== "string") return error("INVALID_REQUEST", "setEntityStatus requires entity and status");
    return { spec, reason, operations: [{ kind: "replace_task_status", document: "TASKS.md", entity: input.entity, status: input.status }] };
  }
  if (name === "setSpecStatus") {
    return { spec, reason, operations: [{ kind: "append_to_section", document: "README.md", heading: "Current status", text: `Status: ${input.status}` }] };
  }
  if (name === "setRequirementMetadata" || name === "proposeRequirementContract") {
    const payload = input.metadata ?? input.contract;
    if (!isObject(payload) || typeof input.requirement !== "string") return error("INVALID_REQUEST", `${name} requires requirement and an object payload`);
    const rendered = `\n\nMetadata for ${input.requirement}:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
    return { spec, reason, operations: [{ kind: "append_to_section", document: "FR.md", heading: input.requirement, text: rendered }] };
  }
  if (name === "addAcceptanceCriterion") {
    if (typeof input.requirement !== "string" || typeof input.criterion !== "string") return error("INVALID_REQUEST", "addAcceptanceCriterion requires requirement and criterion");
    const suffix = Number.parseInt(createHash("sha256").update(`${spec}\u0000${input.requirement}\u0000${input.criterion}`).digest("hex").slice(0, 8), 16) % 1_000_000 + 1;
    return { spec, reason, operations: [{ kind: "insert_at_eof", document: "ACCEPTANCE_CRITERIA.md", text: `\n## AC-9000.${suffix} — ${input.requirement}\n\n${input.criterion}\n` }] };
  }
  if (name === "addPhase") {
    if (typeof input.title !== "string") return error("INVALID_REQUEST", "addPhase requires title");
    return { spec, reason, operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: `\n## Phase — ${input.title}\n` }] };
  }
  if (name === "addBacklogTask" || name === "registerIncidentBacklog") {
    const title = input.title ?? input.summary;
    if (typeof title !== "string") return error("INVALID_REQUEST", `${name} requires title or summary`);
    return { spec, reason, operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: `\n## Backlog — ${title}\n\n- **Status:** todo\n- **Done When:** ${reason}\n` }] };
  }
  if (name === "createSpec") {
    const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : spec;
    const docs = [];
    for (const document of Object.values(FIXED_DOCUMENT_FILES)) {
      docs.push({ kind: "replace_document", document, content: `# ${title}\n\nStatus: DRAFT\n` });
    }
    docs.push({ kind: "replace_document", document: `${spec}.feature`, content: `Feature: ${title}\n` });
    docs.push({ kind: "replace_document", document: `${spec}_SCHEMA.md`, content: `# ${title} Schema\n\nStatus: DRAFT\n` });
    return { spec, reason, operations: docs };
  }
  if (name === "proposeSpecRepairs") {
    if (!Array.isArray(input.repairs)) return error("INVALID_REQUEST", "proposeSpecRepairs requires a repairs array");
    return { spec, reason, operations: input.repairs };
  }
  return error("INVALID_REQUEST", `no operation compiler for ${name}`);
}

function expectedDocumentsMatch(expectedDocuments, proposal) {
  if (!Array.isArray(expectedDocuments)) return false;
  const expected = expectedDocuments.map((entry) => ({
    document: entry.document ?? entry.path,
    sha256: entry.sha256 ?? entry.beforeSha256,
  })).sort((left, right) => String(left.document).localeCompare(String(right.document)));
  const actual = proposal.changes.map((change) => ({ document: change.document, sha256: change.preview.beforeSha256 })).sort((left, right) => left.document.localeCompare(right.document));
  return JSON.stringify(expected) === JSON.stringify(actual);
}

export function createAuthoringService(root, getGraph, refreshGraph, options = {}) {
  const proposals = createProposalService(root, getGraph);
  const applied = new Map();

  async function proposePatch(input = {}) {
    return proposals.proposePatch(input);
  }

  async function applyProposedPatch(input = {}) {
    const requestId = input.requestId;
    const proposalId = input.proposalId;
    if (typeof requestId !== "string" || typeof proposalId !== "string" || typeof input.proposalSha256 !== "string" || typeof input.reason !== "string") return error("INVALID_REQUEST", "requestId, proposalId, proposalSha256, and reason are required");
    const prior = applied.get(requestId);
    if (prior) return prior;
    if (input.approval !== "approve") return error("CONFLICT", "explicit approval=approve is required before applying a proposal");
    const proposal = proposals.getProposal(proposalId);
    if (!proposal) return error("CONFLICT", "proposal is unknown or expired");
    if (proposal.proposalSha256 !== input.proposalSha256) return error("CONFLICT", "proposal hash does not match the stored proposal");
    if (!expectedDocumentsMatch(input.expectedDocuments, proposal)) return error("CONFLICT", "expected document hashes do not match the proposal");
    if (options.authorityAllowed === false) return error("PATH_FORBIDDEN", "untrusted caller cannot mutate specifications");
    const graph = await getGraph();
    if (graph.fingerprint !== proposal.baseSnapshotSha256) return error("CONFLICT", "graph snapshot changed after proposal");
    try {
      const receipt = await withWriteLock(root, requestId, async () => {
        if (proposal.kind === "archive") {
          const archived = await commitArchive(root, requestId, proposal.spec, proposal.archive.sourceDigest);
          await refreshGraph();
          return {
            requestId,
            proposalId,
            outcome: "COMMITTED",
            reason: input.reason,
            actorRef: input.actorRef ?? null,
            archivedSpec: { from: archived.from, to: archived.to, digest: archived.digest },
            changedDocuments: [],
            findings: [],
          };
        }
        for (const change of proposal.changes) {
          const current = await readDocumentBytes(root, proposal.spec, change.document);
          const currentHash = current.ok ? current.sha256 : sha256(Buffer.alloc(0));
          if (currentHash !== change.preview.beforeSha256) throw Object.assign(new Error(`document changed: ${change.document}`), { code: "CONFLICT" });
        }
        await commitDocuments(root, requestId, proposal.changes);
        await refreshGraph();
        return {
          requestId,
          proposalId,
          outcome: "COMMITTED",
          reason: input.reason,
          actorRef: input.actorRef ?? null,
          changedDocuments: proposal.changes.map((change) => ({ document: change.document, beforeSha256: change.preview.beforeSha256, afterSha256: change.preview.afterSha256 })),
          findings: [],
        };
      });
      const result = { ok: true, data: { receipt } };
      applied.set(requestId, result);
      return result;
    } catch (caught) {
      return error(caught?.code === "CONFLICT" ? "CONFLICT" : caught?.code === "RECOVERY_REQUIRED" ? "RECOVERY_REQUIRED" : "WRITE_FAILED", caught instanceof Error ? caught.message : "specification transaction failed");
    }
  }

  async function compileFacade(name, input = {}) {
    if (!AUTHORING_OPERATIONS.includes(name)) return error("UNKNOWN_OPERATION", `unknown authoring operation: ${name}`);
    if (name === "proposePatch") return proposePatch(input);
    if (name === "applyProposedPatch" || name === "applySpecChange" || name === "applySpecTransaction" || name === "applySpecRepairs") return applyProposedPatch(input);
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
    consumeRequest: proposals.consumeRequest,
  };
}

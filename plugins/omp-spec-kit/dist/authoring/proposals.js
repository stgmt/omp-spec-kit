import { createHash } from "node:crypto";
import {
  canonicalJson,
  documentAbsolute,
  readDocumentBytes,
  sha256,
  requestIdWithinBounds,
  specificationDirectoryDigest,
  specificationDirectoryExists,
} from "./transactions.js";
import { buildKernelGraph } from "../kernel/index.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";
import { detectSecret } from "./secrets.js";
import { FIXED_DOCUMENT_FILES } from "../kernel/types.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { validateMetadata } from "../kernel/query/extended.js";

const MAX_REASON_BYTES = 512;
const MAX_DIFF_BYTES = 64 * 1024;

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

function success(data) {
  return { ok: true, data };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function marksmanSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function reasonValid(reason) {
  return (
    typeof reason === "string" &&
    reason.trim().length > 0 &&
    Buffer.byteLength(reason, "utf8") <= MAX_REASON_BYTES
  );
}

function normalizeOperation(operation) {
  if (!isObject(operation) || typeof operation.kind !== "string") return null;
  const kind = operation.kind.replace(/([A-Z])/gu, (match) => `_${match.toLowerCase()}`);
  return { ...operation, kind };
}

function headingRange(text, selector) {
  if (Array.isArray(selector)) {
    for (const s of selector) {
      const found = headingRange(text, s);
      if (found) return found;
    }
    return null;
  }
  if (typeof selector !== "string" || selector.trim() === "") return null;
  const lines = text.split(/\r?\n/u);
  const wanted = selector.trim().replace(/^#+\s*/u, "");
  const slug = marksmanSlug(wanted);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (
      !match ||
      (match[2].trim() !== wanted &&
        !match[2].trim().startsWith(`${wanted} `) &&
        marksmanSlug(match[2]) !== slug &&
        !marksmanSlug(match[2]).startsWith(`${slug}-`))
    )
      continue;
    const level = match[1].length;
    let end = lines.length;
    for (let deeper = index + 1; deeper < lines.length; deeper += 1) {
      const nextMatch = lines[deeper].match(/^(#{1,6})\s+/u);
      if (nextMatch && nextMatch[1].length <= level) {
        end = deeper;
        break;
      }
    }
    return { start: index, end, lines };
  }
  return null;
}

function replaceOnce(text, oldText, newText, replaceAll) {
  if (typeof oldText !== "string" || oldText.length === 0)
    return { ok: false, code: "INVALID_REQUEST", message: "oldText must be non-empty" };
  const occurrences = text.split(oldText).length - 1;
  if (occurrences === 0)
    return { ok: false, code: "VALIDATION_FAILED", message: "oldText was not found in the selected section" };
  if (!replaceAll && occurrences > 1)
    return { ok: false, code: "CONFLICT", message: "oldText occurs more than once; set replaceAll or narrow the section" };
  return { ok: true, text: replaceAll ? text.split(oldText).join(newText) : text.replace(oldText, newText) };
}

export function applyOperation(text, operation) {
  const kind = operation.kind;
  if (kind === "replace_document") {
    if (typeof operation.content !== "string")
      return { ok: false, code: "INVALID_REQUEST", message: "replace_document.content must be text" };
    return { ok: true, text: operation.content };
  }
  if (kind === "delete_document") return { ok: true, text: "", delete: true };
  if (kind === "replace_task_status") {
    if (typeof operation.entity !== "string" || typeof operation.status !== "string")
      return { ok: false, code: "INVALID_REQUEST", message: "replace_task_status needs entity and status" };
    const lines = text.split(/\r?\n/u);
    const heading = lines.findIndex((line) => /^##\s+/.test(line) && line.includes(operation.entity));
    if (heading < 0)
      return { ok: false, code: "VALIDATION_FAILED", message: `task heading not found: ${operation.entity}` };
    let end = lines.length;
    for (let index = heading + 1; index < lines.length; index += 1) {
      if (/^##\s+/.test(lines[index])) {
        end = index;
        break;
      }
    }
    const status = lines.slice(heading + 1, end).findIndex((line) => /^\s*-\s+\*\*Status:\*\*/u.test(line));
    if (status < 0)
      return { ok: false, code: "VALIDATION_FAILED", message: `task status field not found: ${operation.entity}` };
    lines[heading + 1 + status] = `- **Status:** ${operation.status}`;
    return { ok: true, text: lines.join("\n") };
  }
  if (kind === "insert_at_eof") {
    if (typeof operation.text !== "string")
      return { ok: false, code: "INVALID_REQUEST", message: "insert_at_eof.text must be text" };
    return { ok: true, text: `${text}${text.length > 0 && !text.endsWith("\n") ? "\n" : ""}${operation.text}` };
  }
  const selector = operation.heading ?? operation.section;
  const selected = headingRange(text, selector);
  if (!selected) return { ok: false, code: "VALIDATION_FAILED", message: `heading not found: ${selector ?? "<missing>"}` };
  const sectionLines = selected.lines.slice(selected.start, selected.end);
  if (kind === "replace_section") {
    if (typeof operation.content !== "string")
      return { ok: false, code: "INVALID_REQUEST", message: "replace_section.content must be text" };
    const replacement = [selected.lines[selected.start], operation.content].filter((line) => line.length > 0).join("\n");
    return { ok: true, text: [...selected.lines.slice(0, selected.start), replacement, ...selected.lines.slice(selected.end)].join("\n") };
  }
  if (kind === "insert_after_heading" || kind === "append_to_section") {
    if (typeof operation.text !== "string")
      return { ok: false, code: "INVALID_REQUEST", message: `${kind}.text must be text` };
    const next = selected.lines.slice(selected.start, selected.end);
    const insertionIndex = kind === "insert_after_heading" ? 1 : next.length;
    next.splice(insertionIndex, 0, operation.text);
    return { ok: true, text: [...selected.lines.slice(0, selected.start), ...next, ...selected.lines.slice(selected.end)].join("\n") };
  }
  if (kind === "rename_heading") {
    if (typeof operation.newHeading !== "string" || operation.newHeading.trim() === "")
      return { ok: false, code: "INVALID_REQUEST", message: "newHeading must be non-empty" };
    const next = selected.lines.slice(selected.start, selected.end);
    const prefix = next[0].match(/^(#{1,6})\s+/u)?.[1] ?? "##";
    next[0] = `${prefix} ${operation.newHeading.trim()}`;
    return { ok: true, text: [...selected.lines.slice(0, selected.start), ...next, ...selected.lines.slice(selected.end)].join("\n") };
  }
  if (kind === "replace_in_section") {
    const replacement = replaceOnce(sectionLines.join("\n"), operation.oldText, operation.newText ?? "", operation.replaceAll === true);
    if (!replacement.ok) return replacement;
    return { ok: true, text: [...selected.lines.slice(0, selected.start), replacement.text, ...selected.lines.slice(selected.end)].join("\n") };
  }
  return { ok: false, code: "INVALID_REQUEST", message: `unsupported edit operation: ${operation.kind}` };
}

function diffPreview(before, after) {
  const beforeLines = before.toString("utf8").split(/\r?\n/u);
  const afterLines = after.toString("utf8").split(/\r?\n/u);
  const lines = ["--- before", "+++ after"];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < max; index += 1) {
    const left = beforeLines[index];
    const right = afterLines[index];
    if (left === right) continue;
    if (left !== undefined) lines.push(`-${left}`);
    if (right !== undefined) lines.push(`+${right}`);
  }
  const raw = lines.join("\n");
  if (Buffer.byteLength(raw, "utf8") <= MAX_DIFF_BYTES) return { text: raw, truncated: false };
  return { text: raw.slice(0, MAX_DIFF_BYTES - 3) + "...", truncated: true };
}

export async function loadDocument(root, spec, document, allowMissing) {
  const resolved = documentAbsolute(root, spec, document);
  if (!resolved.ok) return resolved;
  const current = await readDocumentBytes(root, spec, document);
  if (!current.ok) {
    if (allowMissing && current.code === "DOC_NOT_FOUND")
      return { ...resolved, bytes: Buffer.alloc(0), sha256: sha256(Buffer.alloc(0)) };
    return current;
  }
  return current;
}

function markdownLinkTargets(text) {
  const links = [];
  const pattern = /\]\(\s*<?([^>\s)]+)(?:\s+[^)]*)?>?\s*\)/gu;
  for (const match of text.matchAll(pattern)) {
    const target = match[1];
    if (typeof target === "string" && target.length > 0)
      links.push({ target, line: text.slice(0, match.index).split(/\r?\n/u).length });
  }
  return links;
}

async function inboundDocumentLinks(root, spec, targetDocument) {
  const documents = new Set([...Object.values(FIXED_DOCUMENT_FILES), `${spec}.feature`, `${spec}_SCHEMA.md`]);
  const links = [];
  for (const document of documents) {
    const current = await loadDocument(root, spec, document, true);
    if (!current.ok) return current;
    if (current.bytes.length === 0) continue;
    for (const link of markdownLinkTargets(current.bytes.toString("utf8"))) {
      const targetPath = link.target.split("#", 1)[0].replace(/^\.\/+/u, "");
      if (targetPath === targetDocument) links.push({ document, target: link.target, line: link.line });
    }
  }
  return { ok: true, links };
}

function archivalReferences(graph, spec) {
  const nodeIds = new Set(graph.nodes.filter((node) => node.specSlug === spec).map((node) => node.canonicalId));
  return [
    ...new Set(
      graph.edges
        .filter((edge) => nodeIds.has(edge.to))
        .map((edge) => graph.nodes.find((node) => node.canonicalId === edge.from))
        .filter((node) => node && node.specSlug !== spec)
        .map((node) => node.canonicalId),
    ),
  ].sort();
}

export function publicOperationKind(operation) {
  switch (operation?.kind) {
    case "insert_at_eof":
    case "insert_after_heading":
    case "append_to_section":
      return "insert";
    case "replace_section":
    case "replace_in_section":
    case "replace_task_status":
    case "replace_document":
      return "replace";
    case "delete_document":
      return "delete";
    case "rename_document":
      return "rename";
    default:
      return "replace";
  }
}

export function operationForFacade(name, input) {
  const spec = input.spec;
  if (typeof spec !== "string" || !isValidSpecSlug(spec))
    return error("PATH_FORBIDDEN", "spec must be a valid specification slug");
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason : `spec_patch ${name}`;
  const document = input.doc ?? input.document;

  if (name === "amendRequirement") {
    if (typeof input.requirement !== "string" || typeof input.body !== "string")
      return error("INVALID_REQUEST", "amendRequirement requires requirement and body");
    return {
      spec,
      reason,
      operations: [
        {
          kind: "append_to_section",
          document: "FR.md",
          heading: input.requirement,
          text: input.body,
          expectedSha: typeof input.expectedSha === "string" ? input.expectedSha : undefined,
        },
      ],
    };
  }
  if (name === "setSpecStatus") {
    const heading =
      typeof input.heading === "string" && input.heading.trim()
        ? input.heading.trim()
        : ["Public states", "Current product status", "Status", "Readiness rule", "Scope"];
    return {
      spec,
      reason,
      operations: [
        {
          kind: "append_to_section",
          document: "README.md",
          heading,
          text: `\n- **Status:** ${input.status}\n`,
        },
      ],
    };
  }

  if (name === "deleteSpecDoc") {
    if (typeof document !== "string") return error("INVALID_REQUEST", "deleteSpecDoc requires doc");
    return {
      spec,
      reason,
      operations: [
        {
          kind: "delete_document",
          document,
          expectedSha: typeof input.expectedSha === "string" ? input.expectedSha : undefined,
        },
      ],
    };
  }
  if (name === "renameSpecDoc") {
    if (typeof document !== "string" || typeof input.newDoc !== "string")
      return error("INVALID_REQUEST", "renameSpecDoc requires doc and newDoc");
    return {
      spec,
      reason,
      operations: [{ kind: "rename_document", document, newDocument: input.newDoc }],
    };
  }

  if (name === "setEntityStatus") {
    if (typeof input.entity !== "string" || typeof input.status !== "string")
      return error("INVALID_REQUEST", "setEntityStatus requires entity and status");
    return {
      spec,
      reason,
      operations: [
        {
          kind: "replace_task_status",
          document: "TASKS.md",
          entity: input.entity,
          status: input.status,
        },
      ],
    };
  }

  if (name === "setRequirementMetadata") {
    const payload = input.metadata ?? input.contract;
    if (!isObject(payload) || typeof input.requirement !== "string")
      return error("INVALID_REQUEST", `${name} requires requirement and an object payload`);
    const validation = validateMetadata(payload);
    if (!validation.valid) {
      return error(
        "VALIDATION_FAILED",
        `invalid requirement metadata: ${validation.issues.map((i) => i.message).join(", ")}`,
        { findings: validation.issues },
      );
    }
    const rendered = "\n\nMetadata for " + input.requirement + ":\n\n```json\n" + JSON.stringify(payload, null, 2) + "\n```\n";
    return {
      spec,
      reason,
      operations: [
        {
          kind: "append_to_section",
          document: "FR.md",
          heading: input.requirement,
          text: rendered,
        },
      ],
    };
  }

  if (name === "addAcceptanceCriterion") {
    if (typeof input.requirement !== "string" || typeof input.criterion !== "string")
      return error("INVALID_REQUEST", "addAcceptanceCriterion requires requirement and criterion");
    const suffix =
      (Number.parseInt(
        createHash("sha256").update(`${spec}\u0000${input.requirement}\u0000${input.criterion}`).digest("hex").slice(0, 8),
        16,
      ) %
        1_000_000) +
      1;
    return {
      spec,
      reason,
      operations: [
        {
          kind: "insert_at_eof",
          document: "ACCEPTANCE_CRITERIA.md",
          text: `\n## AC-9000.${suffix} — ${input.requirement}\n\n${input.criterion}\n`,
        },
      ],
    };
  }

  if (name === "addPhase") {
    if (typeof input.title !== "string" || input.title.trim() === "")
      return error("INVALID_REQUEST", "addPhase requires title");
    return {
      spec,
      reason,
      operations: [
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: `\n## Phase — ${input.title.trim()}\n`,
        },
      ],
    };
  }

  if (name === "addBacklogTask" || name === "registerIncidentBacklog") {
    const title = input.title ?? input.summary;
    if (typeof title !== "string" || title.trim() === "")
      return error("INVALID_REQUEST", `${name} requires title or summary`);
    let reqLines = "";
    if (Array.isArray(input.requirements) && input.requirements.length > 0) {
      const normalizedReqs = [
        ...new Set(input.requirements.filter((r) => typeof r === "string" && r.trim()).map((r) => r.trim())),
      ].sort();
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

export class ProposalCompiler {
  constructor(root) {
    this.root = root;
  }

  async compile(input = {}, graph) {
    const requestId = input.requestId;
    const spec = input.spec;
    const reason = input.reason;

    if (
      !requestIdWithinBounds(requestId) ||
      !reasonValid(reason) ||
      typeof spec !== "string" ||
      !isValidSpecSlug(spec)
    ) {
      return error("INVALID_REQUEST", "requestId, valid spec slug, and reason are required");
    }

    const intent = input.intent ?? "patch";

    if (intent === "archiveSpec") {
      if (typeof input.repositoryRootFingerprint === "string" && input.repositoryRootFingerprint !== graph.fingerprint) {
        return error("CONFLICT", "repositoryRootFingerprint does not match the current graph snapshot", {
          causeCode: "REPOSITORY_ROOT_FINGERPRINT_MISMATCH",
        });
      }
      if (!graph.nodes.some((node) => node.specSlug === spec)) {
        return error("NOT_FOUND", `specification not found: ${spec}`);
      }
      const references = archivalReferences(graph, spec);
      if (references.length > 0) {
        return error("CONFLICT", `archival is blocked by ${references.length} live inbound reference(s)`, { references });
      }
      const source = await specificationDirectoryDigest(this.root, spec);
      if (!source.ok) return error(source.code, source.message);
      const normalizedOperations = [{ kind: "archive_spec", spec }];
      const archive = {
        spec,
        sourceDigest: source.digest,
        fileCount: source.files.length,
        destination: `.${'specs'}/archive/${spec}`,
      };
      const changes = source.files.map((file) => ({
        spec,
        document: file.path,
        beforeBytes: Buffer.alloc(0),
        afterBytes: Buffer.alloc(0),
        operation: { kind: "archive_document", document: file.path, spec },
        deleteAfter: true,
        destination: `.${'specs'}/archive/${spec}/${file.path}`,
        preview: {
          document: file.path,
          beforeSha256: file.sha256,
          afterSha256: null,
          unifiedDiff: `--- .${'specs'}/${spec}/${file.path}\n+++ .${'specs'}/archive/${spec}/${file.path}`,
          diffTruncated: false,
        },
      }));
      const proposalMaterial = {
        kind: "archive_spec",
        requestId,
        repositoryRootFingerprint: graph.fingerprint,
        spec,
        reason,
        normalizedOperations,
        archive,
      };
      const proposalSha256 = sha256(canonicalJson(proposalMaterial));
      return success({
        proposalHash: proposalSha256,
        spec,
        baseSnapshotSha256: graph.fingerprint,
        normalizedOperations,
        documents: changes.map((c) => c.preview),
        affectedNodeIds: graph.nodes
          .filter((node) => node.specSlug === spec)
          .map((node) => node.canonicalId)
          .sort(),
        findings: [],
        complete: true,
        changes,
        archive,
        kind: "archive",
      });
    }

    let rawOperations;
    if (intent === "patch") {
      if (typeof input.repositoryRootFingerprint !== "string" || input.repositoryRootFingerprint !== graph.fingerprint) {
        return error("CONFLICT", "repositoryRootFingerprint does not match the current graph snapshot", {
          causeCode: "REPOSITORY_ROOT_FINGERPRINT_MISMATCH",
        });
      }
      if (!Array.isArray(input.operations) || input.operations.length === 0) {
        return error("INVALID_REQUEST", "operations array is required and must not be empty");
      }
      rawOperations = input.operations;
    } else if (intent === "createSpec") {
      const existing = await specificationDirectoryExists(this.root, spec);
      if (!existing.ok) return error(existing.code, existing.message);
      if (existing.exists) return error("CONFLICT", `specification already exists: ${spec}`);
      const compiled = operationForFacade("createSpec", input);
      if (compiled.ok === false) return compiled;
      rawOperations = compiled.operations;
    } else {
      const compiled = operationForFacade(intent, input);
      if (compiled.ok === false) return compiled;
      rawOperations = compiled.operations;
    }

    const normalizedOperations = [];
    const documents = new Map();
    const addChange = (document, beforeBytes, afterBytes, operation, deleteAfter = false) => {
      const diff = diffPreview(beforeBytes, afterBytes);
      const preview = {
        document,
        beforeSha256: sha256(beforeBytes),
        afterSha256: sha256(afterBytes),
        unifiedDiff: diff.text,
        diffTruncated: diff.truncated,
      };
      normalizedOperations.push({ ...operation });
      documents.set(document, { spec, document, beforeBytes, afterBytes, operation, deleteAfter, preview });
    };

    for (const rawOperation of rawOperations) {
      const operation = normalizeOperation(rawOperation);
      if (!operation || typeof operation.document !== "string")
        return error("INVALID_REQUEST", "every operation needs a document");
      if (operation.spec !== undefined && operation.spec !== spec)
        return error("INVALID_REQUEST", "mixed-spec operations are forbidden");
      if (documents.has(operation.document))
        return error("INVALID_REQUEST", "duplicate document target: " + operation.document);
      const secretCategory = detectSecret(operation.content) ?? detectSecret(operation.text) ?? detectSecret(operation.newText);
      if (secretCategory) {
        return error("VALIDATION_FAILED", `proposed edit contains secret-like content: ${secretCategory}`);
      }
      if (operation.kind === "rename_document") {
        if (
          typeof operation.newDocument !== "string" ||
          operation.newDocument === operation.document ||
          documents.has(operation.newDocument)
        )
          return error("INVALID_REQUEST", "rename_document needs a distinct newDocument");
        const current = await loadDocument(this.root, spec, operation.document, false);
        if (!current.ok) return error(current.code, current.message);
        const expectedSha = operation.expectedDocumentSha256 ?? operation.expectedSha;
        if (typeof expectedSha === "string" && expectedSha.length > 0 && current.sha256 !== expectedSha) {
          return error("CONFLICT", `document ${operation.document} hash ${current.sha256} does not match expectedSha ${expectedSha}`);
        }
        const target = await loadDocument(this.root, spec, operation.newDocument, true);
        if (!target.ok) return error(target.code, target.message);
        if (target.bytes.length > 0)
          return error("CONFLICT", `rename target already exists: ${operation.newDocument}`);
        const inbound = await inboundDocumentLinks(this.root, spec, operation.document);
        if (!inbound.ok) return error(inbound.code, inbound.message);
        if (inbound.links.length > 0)
          return error("CONFLICT", "rename would break inbound Markdown links", { inboundLinks: inbound.links });
        addChange(operation.document, current.bytes, Buffer.alloc(0), operation, true);
        addChange(operation.newDocument, Buffer.alloc(0), current.bytes, {
          kind: "replace_document",
          document: operation.newDocument,
          content: current.bytes.toString("utf8"),
        });
        continue;
      }
      const current = await loadDocument(this.root, spec, operation.document, operation.kind === "replace_document");
      if (!current.ok) return error(current.code, current.message);
      const expectedSha = operation.expectedDocumentSha256 ?? operation.expectedSha;
      if (typeof expectedSha === "string" && expectedSha.length > 0 && current.sha256 !== expectedSha) {
        return error("CONFLICT", `document ${operation.document} hash ${current.sha256} does not match expectedSha ${expectedSha}`);
      }
      const transformed = applyOperation(current.bytes.toString("utf8"), operation);
      if (!transformed.ok) return error(transformed.code, transformed.message, { document: operation.document });
      const newline = current.bytes.toString("utf8").includes("\r\n") ? "\r\n" : "\n";
      const transformedText = newline === "\n" ? transformed.text : transformed.text.replace(/\r?\n/gu, newline);
      addChange(operation.document, current.bytes, Buffer.from(transformedText, "utf8"), operation, transformed.delete === true);
    }

    const snapshot = await readRepositorySpecs({ root: this.root });
    if (snapshot.error) return error("PATH_FORBIDDEN", "specification repository could not be read");
    const replacements = new Map();
    for (const change of documents.values()) {
      const key = `.${'specs'}/${change.spec}/${change.document}`;
      replacements.set(key, change.deleteAfter ? null : change.afterBytes);
    }
    const resultingFiles = snapshot.files
      .filter((file) => !replacements.has(file.path))
      .concat([...replacements.entries()].filter(([, bytes]) => bytes !== null).map(([path, bytes]) => ({ path, bytes })))
      .sort((left, right) => left.path.localeCompare(right.path));
    const resulting = buildKernelGraph({ files: resultingFiles });
    if (resulting.graph.valid !== true) {
      const findings = resulting.diagnostics
        .filter((diagnostic) => diagnostic.severity === "ERROR")
        .map((diagnostic) => ({
          code: diagnostic.code,
          ...(diagnostic.span?.path ? { path: diagnostic.span.path } : {}),
          message: diagnostic.message ?? diagnostic.code,
        }))
        .sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "") || left.code.localeCompare(right.code));
      return error("VALIDATION_FAILED", "resulting specification graph is invalid", { findings });
    }

    const previews = [...documents.values()].map((entry) => entry.preview).sort((left, right) => left.document.localeCompare(right.document));
    const proposalMaterial = {
      requestId,
      repositoryRootFingerprint: graph.fingerprint,
      spec,
      reason,
      normalizedOperations,
      previews,
    };
    const proposalSha256 = sha256(canonicalJson(proposalMaterial));

    return success({
      proposalHash: proposalSha256,
      spec,
      baseSnapshotSha256: graph.fingerprint,
      normalizedOperations,
      documents: previews,
      affectedNodeIds: [],
      findings: [],
      complete: true,
      changes: [...documents.values()],
      previews,
      kind: "patch",
    });
  }
}

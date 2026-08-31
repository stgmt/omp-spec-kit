import {
  canonicalJson,
  documentAbsolute,
  readDocumentBytes,
  sha256,
  requestIdWithinBounds,
  specificationDirectoryDigest,
} from "./transactions.js";

import { FIXED_DOCUMENT_FILES } from "../kernel/types.js";
const MAX_PROPOSALS = 128;
const MAX_REASON_BYTES = 512;
const MAX_DIFF_BYTES = 64 * 1024;
const PROPOSAL_TTL_MS = 10 * 60 * 1000;

function error(code, message, extra = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: code === "CONFLICT" || code === "WRITE_FAILED",
      findings: [],
      nextAction: code === "CONFLICT" ? "re-read the affected document and propose again" : "fix the request and retry",
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
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, "").trim().replace(/\s+/gu, "-").replace(/-+/gu, "-").replace(/^-+|-+$/gu, "");
}

function reasonValid(reason) {
  return typeof reason === "string" && reason.trim().length > 0 && Buffer.byteLength(reason, "utf8") <= MAX_REASON_BYTES;
}

function normalizeOperation(operation) {
  if (!isObject(operation) || typeof operation.kind !== "string") return null;
  const kind = operation.kind.replace(/([A-Z])/gu, (match) => `_${match.toLowerCase()}`);
  return { ...operation, kind };
}

function headingRange(text, selector) {
  if (typeof selector !== "string" || selector.trim() === "") return null;
  const lines = text.split(/\r?\n/u);
  const wanted = selector.trim().replace(/^#+\s*/u, "");
  const slug = marksmanSlug(wanted);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match || (match[2].trim() !== wanted && !match[2].trim().startsWith(`${wanted} `) && marksmanSlug(match[2]) !== slug && !marksmanSlug(match[2]).startsWith(`${slug}-`))) continue;
    const level = match[1].length;
    let end = lines.length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextHeading = lines[next].match(/^(#{1,6})\s+/u);
      if (nextHeading && nextHeading[1].length <= level) {
        end = next;
        break;
      }
    }
    return { lines, start: index, end, level };
  }
  return null;
}

function replaceOnce(text, oldText, newText, replaceAll) {
  if (typeof oldText !== "string" || oldText.length === 0) return { ok: false, code: "INVALID_REQUEST", message: "oldText must be non-empty" };
  const occurrences = text.split(oldText).length - 1;
  if (occurrences === 0) return { ok: false, code: "VALIDATION_FAILED", message: "oldText was not found in the selected section" };
  if (!replaceAll && occurrences > 1) return { ok: false, code: "CONFLICT", message: "oldText occurs more than once; set replaceAll or narrow the section" };
  return { ok: true, text: replaceAll ? text.split(oldText).join(newText) : text.replace(oldText, newText) };
}

function applyOperation(text, operation) {
  const kind = operation.kind;
  if (kind === "replace_document") {
    if (typeof operation.content !== "string") return { ok: false, code: "INVALID_REQUEST", message: "replace_document.content must be text" };
    return { ok: true, text: operation.content };
  }
  if (kind === "delete_document") return { ok: true, text: "", delete: true };
  if (kind === "replace_task_status") {
    if (typeof operation.entity !== "string" || typeof operation.status !== "string") return { ok: false, code: "INVALID_REQUEST", message: "replace_task_status needs entity and status" };
    const lines = text.split(/\r?\n/u);
    const heading = lines.findIndex((line) => /^##\s+/.test(line) && line.includes(operation.entity));
    if (heading < 0) return { ok: false, code: "VALIDATION_FAILED", message: `task heading not found: ${operation.entity}` };
    let end = lines.length;
    for (let index = heading + 1; index < lines.length; index += 1) {
      if (/^##\s+/.test(lines[index])) {
        end = index;
        break;
      }
    }
    const status = lines.slice(heading + 1, end).findIndex((line) => /^\s*-\s+\*\*Status:\*\*/u.test(line));
    if (status < 0) return { ok: false, code: "VALIDATION_FAILED", message: `task status field not found: ${operation.entity}` };
    lines[heading + 1 + status] = `- **Status:** ${operation.status}`;
    return { ok: true, text: lines.join("\n") };
  }
  if (kind === "insert_at_eof") {
    if (typeof operation.text !== "string") return { ok: false, code: "INVALID_REQUEST", message: "insert_at_eof.text must be text" };
    return { ok: true, text: `${text}${text.length > 0 && !text.endsWith("\n") ? "\n" : ""}${operation.text}` };
  }
  const selector = operation.heading ?? operation.section;
  const selected = headingRange(text, selector);
  if (!selected) return { ok: false, code: "VALIDATION_FAILED", message: `heading not found: ${selector ?? "<missing>"}` };
  const sectionLines = selected.lines.slice(selected.start, selected.end);
  if (kind === "replace_section") {
    if (typeof operation.content !== "string") return { ok: false, code: "INVALID_REQUEST", message: "replace_section.content must be text" };
    const replacement = [selected.lines[selected.start], operation.content].filter((line) => line.length > 0).join("\n");
    return { ok: true, text: [...selected.lines.slice(0, selected.start), replacement, ...selected.lines.slice(selected.end)].join("\n") };
  }
  if (kind === "insert_after_heading" || kind === "append_to_section") {
    if (typeof operation.text !== "string") return { ok: false, code: "INVALID_REQUEST", message: `${kind}.text must be text` };
    const next = selected.lines.slice(selected.start, selected.end);
    const insertionIndex = kind === "insert_after_heading" ? 1 : next.length;
    next.splice(insertionIndex, 0, operation.text);
    return { ok: true, text: [...selected.lines.slice(0, selected.start), ...next, ...selected.lines.slice(selected.end)].join("\n") };
  }
  if (kind === "rename_heading") {
    if (typeof operation.newHeading !== "string" || operation.newHeading.trim() === "") return { ok: false, code: "INVALID_REQUEST", message: "newHeading must be non-empty" };
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

async function loadDocument(root, spec, document, allowMissing) {
  const resolved = documentAbsolute(root, spec, document);
  if (!resolved.ok) return resolved;
  const current = await readDocumentBytes(root, spec, document);
  if (!current.ok) {
    if (allowMissing && current.code === "DOC_NOT_FOUND") return { ...resolved, bytes: Buffer.alloc(0), sha256: sha256(Buffer.alloc(0)) };
    return current;
  }
  return current;
}
function markdownLinkTargets(text) {
  const links = [];
  const pattern = /\]\(\s*<?([^>\s)]+)(?:\s+[^)]*)?>?\s*\)/gu;
  for (const match of text.matchAll(pattern)) {
    const target = match[1];
    if (typeof target === "string" && target.length > 0) links.push({ target, line: text.slice(0, match.index).split(/\r?\n/u).length });
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
  return [...new Set(
    graph.edges
      .filter((edge) => nodeIds.has(edge.to))
      .map((edge) => graph.nodes.find((node) => node.canonicalId === edge.from))
      .filter((node) => node && node.specSlug !== spec)
      .map((node) => node.canonicalId),
  )].sort();
}


function pruneStore(store) {
  const now = Date.now();
  for (const [id, proposal] of store) if (proposal.expiresAt <= now) store.delete(id);
  while (store.size >= MAX_PROPOSALS) store.delete(store.keys().next().value);
}

export function createProposalService(root, getGraph) {
  const proposals = new Map();
  const terminalRequests = new Map();

  async function proposePatch(input = {}) {
    const requestId = input.requestId;
    const spec = input.spec;
    const reason = input.reason;
    const operations = input.operations;
    const graph = await getGraph();
    if (!requestIdWithinBounds(requestId) || !reasonValid(reason) || typeof spec !== "string" || !Array.isArray(operations) || operations.length === 0) {
      return error("INVALID_REQUEST", "requestId, spec, reason, and a non-empty operations array are required");
    }
    if (typeof input.repositoryRootFingerprint !== "string" || input.repositoryRootFingerprint !== graph.fingerprint) {
      return error("CONFLICT", "repositoryRootFingerprint does not match the current graph snapshot");
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
      documents.set(document, { spec, document, beforeBytes, afterBytes, deleteAfter, preview });
    };
    for (const rawOperation of operations) {
      const operation = normalizeOperation(rawOperation);
      if (!operation || typeof operation.document !== "string") return error("INVALID_REQUEST", "every operation needs a document");
      if (operation.spec !== undefined && operation.spec !== spec) return error("INVALID_REQUEST", "mixed-spec operations are forbidden");
      if (documents.has(operation.document)) return error("CONFLICT", `duplicate document target: ${operation.document}`);
      if (operation.kind === "rename_document") {
        if (typeof operation.newDocument !== "string" || operation.newDocument === operation.document || documents.has(operation.newDocument)) return error("INVALID_REQUEST", "rename_document needs a distinct newDocument");
        const current = await loadDocument(root, spec, operation.document, false);
        if (!current.ok) return error(current.code, current.message);
        const target = await loadDocument(root, spec, operation.newDocument, true);
        if (!target.ok) return error(target.code, target.message);
        if (target.bytes.length > 0) return error("CONFLICT", `rename target already exists: ${operation.newDocument}`);
        const inbound = await inboundDocumentLinks(root, spec, operation.document);
        if (!inbound.ok) return error(inbound.code, inbound.message);
        if (inbound.links.length > 0) return error("CONFLICT", "rename would break inbound Markdown links", { inboundLinks: inbound.links });
        addChange(operation.document, current.bytes, Buffer.alloc(0), operation, true);
        addChange(operation.newDocument, Buffer.alloc(0), current.bytes, { kind: "replace_document", document: operation.newDocument, content: current.bytes.toString("utf8") });
        continue;
      }
      const current = await loadDocument(root, spec, operation.document, operation.kind === "replace_document");
      if (!current.ok) return error(current.code, current.message);
      const transformed = applyOperation(current.bytes.toString("utf8"), operation);
      if (!transformed.ok) return error(transformed.code, transformed.message, { document: operation.document });
      const newline = current.bytes.toString("utf8").includes("\r\n") ? "\r\n" : "\n";
      const transformedText = newline === "\n" ? transformed.text : transformed.text.replace(/\r?\n/gu, newline);
      addChange(operation.document, current.bytes, Buffer.from(transformedText, "utf8"), operation, transformed.delete === true);
    }
    const previews = [...documents.values()].map((entry) => entry.preview).sort((left, right) => left.document.localeCompare(right.document));
    const proposalMaterial = { requestId, repositoryRootFingerprint: graph.fingerprint, spec, reason, normalizedOperations, previews };
    const proposalSha256 = sha256(canonicalJson(proposalMaterial));
    const proposalId = proposalSha256;
    pruneStore(proposals);
    const proposal = {
      proposalId,
      proposalSha256,
      spec,
      baseSnapshotSha256: graph.fingerprint,
      normalizedOperations,
      documents: previews,
      affectedNodeIds: [],
      findings: [],
      complete: true,
      expiresAt: Date.now() + PROPOSAL_TTL_MS,
      changes: [...documents.values()],
    };
    proposals.set(proposalId, proposal);
    terminalRequests.set(requestId, proposalId);
    return success({ requestId, proposal: { ...proposal, expiresAt: undefined, changes: undefined } });
  }

  async function proposeArchive(input = {}) {
    const { requestId, spec, reason, repositoryRootFingerprint } = input;
    const graph = await getGraph();
    if (!requestIdWithinBounds(requestId) || !reasonValid(reason) || typeof spec !== "string") {
      return error("INVALID_REQUEST", "requestId, spec, and reason are required");
    }
    if (typeof repositoryRootFingerprint !== "string" || repositoryRootFingerprint !== graph.fingerprint) {
      return error("CONFLICT", "repositoryRootFingerprint does not match the current graph snapshot");
    }
    if (!graph.nodes.some((node) => node.specSlug === spec)) return error("NOT_FOUND", `specification not found: ${spec}`);
    const references = archivalReferences(graph, spec);
    if (references.length > 0) {
      return error("CONFLICT", `archival is blocked by ${references.length} live inbound reference(s)`, { references });
    }
    const source = await specificationDirectoryDigest(root, spec);
    if (!source.ok) return error(source.code, source.message);
    const normalizedOperations = [{ kind: "archive_spec", spec }];
    const archive = { spec, sourceDigest: source.digest, fileCount: source.files.length, destination: `.specs/archive/${spec}` };
    const proposalMaterial = { kind: "archive_spec", requestId, repositoryRootFingerprint: graph.fingerprint, spec, reason, normalizedOperations, archive };
    const proposalSha256 = sha256(canonicalJson(proposalMaterial));
    const proposal = {
      kind: "archive",
      proposalId: proposalSha256,
      proposalSha256,
      spec,
      baseSnapshotSha256: graph.fingerprint,
      normalizedOperations,
      documents: [],
      affectedNodeIds: graph.nodes.filter((node) => node.specSlug === spec).map((node) => node.canonicalId).sort(),
      findings: [],
      complete: true,
      expiresAt: Date.now() + PROPOSAL_TTL_MS,
      changes: [],
      archive,
    };
    pruneStore(proposals);
    proposals.set(proposalSha256, proposal);
    terminalRequests.set(requestId, proposalSha256);
    return success({ requestId, proposal: { ...proposal, expiresAt: undefined, changes: undefined } });
  }

  function getProposal(proposalId) {
    pruneStore(proposals);
    return proposals.get(proposalId);
  }

  function consumeRequest(requestId) {
    return terminalRequests.get(requestId);
  }

  return { proposePatch, proposeArchive, getProposal, consumeRequest, proposals };
}

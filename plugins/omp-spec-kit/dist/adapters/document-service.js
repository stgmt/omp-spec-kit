import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isValidSpecSlug } from "../kernel/identity.js";
import { KERNEL_SCHEMA_VERSION } from "../kernel/types.js";
import { specificationDirectoryDigest } from "../authoring/transactions.js";
import { PLUGIN_VERSION } from "./plugin-version.js";

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_SECTION_LINES = 500;
const MAX_SNAPSHOT_FILES = 4096;
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".md", ".feature", ".json"]);
const MIME_TYPES = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
});

export const DOCUMENT_OPERATIONS = Object.freeze([
  "mcpPreflight",
  "listSpecDocs",
  "readSpecDoc",
  "readAttachment",
]);

function operationError(code, message, extra = {}) {
  return { ok: false, error: { code, message, retryable: false, ...extra } };
}

function operationSuccess(data) {
  return { ok: true, data, page: null };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function rootId(root) {
  const normalized = process.platform === "win32" ? root.toLowerCase() : root;
  return sha256(`omp-spec-kit-root-v1\u0000${normalized}`);
}

function safeRelativePath(relative) {
  if (typeof relative !== "string" || relative.length === 0 || relative.includes("\u0000")) return false;
  if (path.isAbsolute(relative)) return false;
  const parts = relative.split(/[\\/]/u);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function slashPath(relative) {
  return relative.split(path.sep).join("/");
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

async function containedSpecDirectory(root, spec) {
  if (!isValidSpecSlug(spec)) return operationError("PATH_FORBIDDEN", "spec must be a valid specification slug", { spec });
  const specsDir = path.join(root, ".specs");
  const specDir = path.join(specsDir, spec);
  try {
    const rootReal = await realpath(root);
    const specReal = await realpath(specDir);
    if (!isInside(rootReal, specReal) || slashPath(path.relative(specsDir, specReal)) !== spec) {
      return operationError("PATH_FORBIDDEN", "specification path escapes the repository root", { spec });
    }
    const stats = await lstat(specDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return operationError("PATH_FORBIDDEN", "specification directory is not regular", { spec });
    return { ok: true, rootReal, specReal, specDir };
  } catch {
    return operationError("NOT_FOUND", `specification not found: ${spec}`, { spec });
  }
}

function isInside(root, candidate) {
  const left = slashPath(root);
  const right = slashPath(candidate);
  const compareLeft = process.platform === "win32" ? left.toLowerCase() : left;
  const compareRight = process.platform === "win32" ? right.toLowerCase() : right;
  return compareRight === compareLeft || compareRight.startsWith(`${compareLeft}/`);
}

async function walkSpecFiles(specDir, relative = "") {
  const entries = (await readdir(relative ? path.join(specDir, relative) : specDir, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const childAbsolute = path.join(specDir, childRelative);
    const stats = await lstat(childAbsolute);
    if (stats.isSymbolicLink()) throw new Error(`PATH_FORBIDDEN:${childRelative}`);
    if (stats.isDirectory()) {
      files.push(...(await walkSpecFiles(specDir, childRelative)));
      continue;
    }
    if (stats.isFile()) files.push({ relative: slashPath(childRelative), bytes: stats.size });
  }
  return files;
}

async function resolveSpecFile(root, spec, relative) {
  const directory = await containedSpecDirectory(root, spec);
  if (!directory.ok) return directory;
  if (!safeRelativePath(relative)) return operationError("PATH_FORBIDDEN", "document path must stay inside the specification", { spec, path: relative });
  const candidate = path.resolve(directory.specDir, relative);
  if (!isInside(directory.specDir, candidate)) return operationError("PATH_FORBIDDEN", "document path escapes the specification", { spec, path: relative });
  try {
    const stats = await lstat(candidate);
    if (stats.isSymbolicLink() || !stats.isFile()) return operationError("PATH_FORBIDDEN", "document must be a regular file", { spec, path: slashPath(relative) });
    const realFile = await realpath(candidate);
    if (!isInside(directory.specReal, realFile)) return operationError("PATH_FORBIDDEN", "document resolves outside the specification", { spec, path: slashPath(relative) });
    return { ok: true, ...directory, absolute: candidate, relative: slashPath(path.relative(directory.specDir, candidate)) };
  } catch {
    return operationError("DOC_NOT_FOUND", `document not found: ${relative}`, { spec, path: slashPath(relative) });
  }
}

async function listSpecDocs(root, args) {
  const directory = await containedSpecDirectory(root, args.spec);
  if (!directory.ok) return directory;
  let files;
  try {
    files = await walkSpecFiles(directory.specDir);
  } catch (error) {
    return operationError("PATH_FORBIDDEN", "specification inventory encountered a linked path", { spec: args.spec, causeCode: String(error.message).split(":", 1)[0] });
  }
  let snapshot;
  if (args.includeSnapshot === true) {
    const first = await specSnapshot(root, args.spec);
    if (!first.ok) return first;
    const second = await specSnapshot(root, args.spec, first.digest);
    if (!second.ok) return second;
    snapshot = second;
    files = snapshot.files.map((file) => ({ relative: file.path, bytes: file.bytes }));
  }
  const docs = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())).map((file) => file.relative).sort();
  const attachments = files.filter((file) => !TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())).map((file) => file.relative).sort();
  return operationSuccess({ kind: "spec-documents", spec: args.spec, docs, count: docs.length, attachments, ...(snapshot ? { snapshot: snapshot.digest, files: snapshot.files } : {}) });
}

async function specSnapshot(root, spec, expected = null) {
  try {
    const directory = await containedSpecDirectory(root, spec);
    if (!directory.ok) return directory;
    const files = await walkSpecFiles(directory.specDir);
    if (files.length > MAX_SNAPSHOT_FILES) return operationError("LIMIT_EXCEEDED", "specification has too many files for a snapshot", { spec, limitName: "maxSnapshotFiles", limitValue: MAX_SNAPSHOT_FILES, observedValue: files.length });
    const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
    if (totalBytes > MAX_SNAPSHOT_BYTES) return operationError("LIMIT_EXCEEDED", "specification exceeds the snapshot read budget", { spec, limitName: "maxSnapshotBytes", limitValue: MAX_SNAPSHOT_BYTES, observedValue: totalBytes });
    const result = await specificationDirectoryDigest(root, spec);
    if (!result.ok) return operationError(result.code, result.message, { spec });
    if (expected !== null && result.digest !== expected) {
      return operationError("CONFLICT", "specification changed since the snapshot; obtain a new snapshot before reading", { spec, causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true });
    }
    return result;
  } catch (error) {
    if (String(error?.message ?? "").startsWith("PATH_FORBIDDEN:")) {
      return operationError("PATH_FORBIDDEN", "specification snapshot encountered a linked path", { spec });
    }
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return operationError("CONFLICT", "specification changed while creating or reading the snapshot", { spec, causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true });
    }
    return operationError("INTERNAL_ERROR", "specification snapshot could not be read", { spec });
  }
}

// Keep each original newline with its line so that concatenating paged reads
// reproduces the exact UTF-8 source, including CRLF and a final empty line.
function sourceLines(content) {
  const lines = content.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  if (content.length === 0 || content.endsWith("\n")) lines.push("");
  return lines;
}

function sectionWindow(text, section) {
  const lines = text.split(/\r?\n/u);
  const wanted = section.trim().replace(/^#+\s*/u, "");
  const wantedSlug = marksmanSlug(wanted);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match) continue;
    if (match[2].trim() === wanted || marksmanSlug(match[2]) === wantedSlug) {
      start = index;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/u);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  return { lines, start, end, heading: lines[start].trim() };
}

async function readSpecDoc(root, args) {
  if (!safeRelativePath(args.doc)) return operationError("PATH_FORBIDDEN", "document path must stay inside the specification", { spec: args.spec, path: args.doc });
  let before;
  if (args.snapshot !== undefined) {
    if (typeof args.snapshot !== "string" || !/^[0-9a-f]{64}$/u.test(args.snapshot)) {
      return operationError("INVALID_REQUEST", "snapshot must be a SHA-256 digest", { parameter: "snapshot" });
    }
    before = await specSnapshot(root, args.spec, args.snapshot);
    if (!before.ok) return before;
  }
  const resolved = await resolveSpecFile(root, args.spec, args.doc);
  if (!resolved.ok) {
    if (before && resolved.error.code === "DOC_NOT_FOUND") {
      const after = await specSnapshot(root, args.spec, args.snapshot);
      if (!after.ok) return after;
    }
    return resolved;
  }
  const extension = path.extname(resolved.relative).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) return operationError("DOC_NOT_FOUND", "requested path is not a text document", { spec: args.spec, doc: resolved.relative });
  const expectedFile = before?.files.find((file) => file.path === resolved.relative);
  if (before && !expectedFile) return operationError("CONFLICT", "document was added after the snapshot; obtain a new snapshot before reading", { spec: args.spec, doc: resolved.relative, causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true });
  const bytePage = args.byteOffset !== undefined || args.byteLimit !== undefined;
  if (bytePage && (args.offset !== undefined || args.limit !== undefined || args.section != null || args.readForEdit === true)) return operationError("INVALID_REQUEST", "byte pagination cannot be combined with line, section or edit reads");
  if (bytePage && (!Number.isSafeInteger(args.byteOffset ?? 0) || (args.byteOffset ?? 0) < 0 || !Number.isSafeInteger(args.byteLimit ?? 65536) || (args.byteLimit ?? 65536) < 4 || (args.byteLimit ?? 65536) > MAX_DOCUMENT_BYTES)) return operationError("INVALID_REQUEST", "byteOffset must be nonnegative and byteLimit must be between 4 and 2097152");
  const paged = bytePage || (args.limit !== undefined && args.section == null && args.readForEdit !== true);
  const maxReadBytes = paged ? MAX_SNAPSHOT_BYTES : MAX_DOCUMENT_BYTES;
  const sourceSize = expectedFile?.bytes ?? (await lstat(resolved.absolute)).size;
  if (sourceSize > maxReadBytes) return operationError("LIMIT_EXCEEDED", "document exceeds the read budget", { spec: args.spec, doc: resolved.relative, limitName: "maxDocumentBytes", limitValue: maxReadBytes, observedValue: sourceSize });
  let bytes;
  try {
    bytes = await readFile(resolved.absolute);
  } catch (error) {
    if (before && (error?.code === "ENOENT" || error?.code === "ENOTDIR")) {
      return operationError("CONFLICT", "document changed while reading the snapshot", { spec: args.spec, doc: resolved.relative, causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true });
    }
    throw error;
  }
  const digest = sha256(bytes);
  if (expectedFile && (expectedFile.sha256 !== digest || expectedFile.bytes !== bytes.length)) {
    return operationError("CONFLICT", "document changed since the snapshot; obtain a new snapshot before reading", { spec: args.spec, doc: resolved.relative, causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true });
  }
  if (bytes.length > maxReadBytes) return operationError("LIMIT_EXCEEDED", "document exceeds the read budget", { spec: args.spec, doc: resolved.relative, limitName: "maxDocumentBytes", limitValue: maxReadBytes, observedValue: bytes.length });
  const content = bytes.toString("utf8");
  if (before) {
    if (!Buffer.from(content, "utf8").equals(bytes)) return operationError("INVALID_UTF8", "document is not valid UTF-8", { spec: args.spec, doc: resolved.relative });
    const after = await specSnapshot(root, args.spec, args.snapshot);
    if (!after.ok) return after;
  }
  const snapshotField = before ? { snapshot: args.snapshot } : {};
  if (bytePage) {
    const startByte = args.byteOffset ?? 0;
    if (startByte > bytes.length || (startByte < bytes.length && (bytes[startByte] & 0xc0) === 0x80)) return operationError("INVALID_REQUEST", "byteOffset must point to a UTF-8 character boundary within the document");
    if (!Buffer.from(content, "utf8").equals(bytes)) return operationError("INVALID_UTF8", "document is not valid UTF-8", { spec: args.spec, doc: resolved.relative });
    let endByte = Math.min(startByte + (args.byteLimit ?? 65536), bytes.length);
    while (endByte < bytes.length && (bytes[endByte] & 0xc0) === 0x80) endByte--;
    return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, startByte, endByte, nextByteOffset: endByte, totalBytes: bytes.length, truncated: endByte < bytes.length, sha256: digest, content: bytes.subarray(startByte, endByte).toString("utf8"), ...snapshotField });
  }
  if (args.readForEdit === true) {
    const headings = content.split(/\r?\n/u).flatMap((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
      return match ? [{ level: match[1].length, text: match[2].trim(), anchor: marksmanSlug(match[2]), line: index + 1 }] : [];
    });
    return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, mode: "read_for_edit", sha256: digest, content, bytes: bytes.length, totalLines: content.split(/\r?\n/u).length, headings, ...snapshotField });
  }
  if (args.section !== undefined && args.section !== null) {
    const selected = sectionWindow(content, String(args.section));
    if (!selected) return operationError("SECTION_NOT_FOUND", `section not found: ${args.section}`, { spec: args.spec, doc: resolved.relative, section: args.section });
    const sectionContent = (before ? sourceLines(content) : selected.lines).slice(selected.start, selected.end);
    const sectionText = sectionContent.join(before ? "" : "\n");
    return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, section: selected.heading, startLine: selected.start + 1, endLine: selected.end, lines: sectionContent.length, bytes: Buffer.byteLength(sectionText, "utf8"), sha256: digest, content: sectionText, ...snapshotField });
  }
  const allLines = before ? sourceLines(content) : content.split(/\r?\n/u);
  const startLine = args.offset === undefined ? 1 : args.offset;
  const limit = args.limit === undefined ? allLines.length : args.limit;
  if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SECTION_LINES) return operationError("LIMIT_EXCEEDED", `offset must be positive and limit must be 1 through ${MAX_SECTION_LINES}`, { parameter: "limit" });
  const slice = allLines.slice(startLine - 1, startLine - 1 + limit);
  if (Buffer.byteLength(slice.join(before ? "" : "\n"), "utf8") > MAX_DOCUMENT_BYTES) return operationError("LIMIT_EXCEEDED", "page exceeds the response budget; use byteOffset and byteLimit", { spec: args.spec, doc: resolved.relative, limitName: "maxPageBytes", limitValue: MAX_DOCUMENT_BYTES });
  return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, startLine, endLine: slice.length === 0 ? startLine - 1 : startLine + slice.length - 1, lines: slice.length, totalLines: allLines.length, totalBytes: bytes.length, truncated: startLine - 1 + slice.length < allLines.length, sha256: digest, content: slice.join(before ? "" : "\n"), ...snapshotField });
}

async function readAttachment(root, args) {
  const resolved = await resolveSpecFile(root, args.spec, args.path);
  if (!resolved.ok) return resolved;
  const extension = path.extname(resolved.relative).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return operationError("ATTACHMENT_NOT_FOUND", "text documents must be read with read_spec_doc", { spec: args.spec, path: resolved.relative });
  const bytes = await readFile(resolved.absolute);
  if (bytes.length > MAX_ATTACHMENT_BYTES) return operationError("LIMIT_EXCEEDED", "attachment exceeds the read budget", { spec: args.spec, path: resolved.relative, limitName: "maxAttachmentBytes", limitValue: MAX_ATTACHMENT_BYTES, observedValue: bytes.length });
  return operationSuccess({ kind: "attachment", spec: args.spec, path: resolved.relative, mime: MIME_TYPES[extension] ?? "application/octet-stream", bytes: bytes.length, sha256: sha256(bytes), base64: bytes.toString("base64") });
}

function mcpPreflight(root, args, context = {}) {
  // The local stdio/test transport may name the worktree serving this call; the
  // hosted transport refuses that instruction before reaching here, so a
  // declared worktree is a local fact, not a root comparison.
  const declaredWorktree = typeof args.declaredWorktree === "string" && args.declaredWorktree.length > 0;
  const project = typeof context.project === "string" && context.project.length > 0 ? context.project : null;
  const transport = typeof context.transport === "string" ? context.transport : "local";
  const bindingStatus = typeof context.bindingStatus === "string" ? context.bindingStatus : null;
  // Writes need a corpus: spec_patch fails at graph-read time on a root with no
  // corpus directory, so mutationReady must reflect corpus presence rather than
  // promise a write the kernel will refuse.
  let corpusPresent = false;
  try {
    corpusPresent = statSync(path.join(root, '.specs')).isDirectory();
  } catch {}

  // Five separate admission facts, never one tautological root match: the
  // connection answered; which project served this call; how that project is
  // bound to a repository; whether its corpus is present; whether a write can
  // proceed. `rootId` is a local root identity hash, never an absolute path.
  const binding = project === null ? "not-applicable" : (bindingStatus ?? "unknown");
  return operationSuccess({
    kind: "mcp-preflight",
    connection: { healthy: true, transport },
    project: {
      selected: project,
      source: project === null ? null : (context.projectSource ?? null),
      selectedByCaller: (context.projectSource ?? null) === "explicit",
    },
    repository: { binding, rootId: rootId(root) },
    worktree: { transport, declared: declaredWorktree },
    corpus: { present: corpusPresent, available: corpusPresent },
    lockMode: "owner",
    writeMode: "proposal-first",
    versions: { mcp: KERNEL_SCHEMA_VERSION, plugin: PLUGIN_VERSION, omp: "18.0.11" },
    dependencies: { graph: "ready", watcher: "disabled", lock: "available", sqlite: "disabled" },
    mutationReady: corpusPresent && (project === null || binding === "active" || binding === "migrating"),
  });
}

export async function executeDocumentOperation(root, operation, args = {}, context = {}) {
  if (operation === "mcpPreflight") return mcpPreflight(root, args, context);
  if (operation === "listSpecDocs") return listSpecDocs(root, args);
  if (operation === "readSpecDoc") return readSpecDoc(root, args);
  if (operation === "readAttachment") return readAttachment(root, args);
  return operationError("UNKNOWN_OPERATION", `unknown document operation: ${operation}`);
}

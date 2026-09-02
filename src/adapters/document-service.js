import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isValidSpecSlug } from "../kernel/identity.js";
import { KERNEL_SCHEMA_VERSION } from "../kernel/types.js";

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_SECTION_LINES = 500;
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

function documentKind(relative) {
  const extension = path.extname(relative).toLowerCase();
  if (extension === ".feature") return "FEATURE";
  if (extension === ".json") return "JSON";
  if (extension === ".md") return "MARKDOWN";
  return "BINARY";
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
  const docs = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())).map((file) => file.relative).sort();
  const attachments = files.filter((file) => !TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())).map((file) => file.relative).sort();
  return operationSuccess({ kind: "spec-documents", spec: args.spec, docs, count: docs.length, attachments });
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
  const resolved = await resolveSpecFile(root, args.spec, args.doc);
  if (!resolved.ok) return resolved;
  const extension = path.extname(resolved.relative).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) return operationError("DOC_NOT_FOUND", "requested path is not a text document", { spec: args.spec, doc: resolved.relative });
  const bytes = await readFile(resolved.absolute);
  if (bytes.length > MAX_DOCUMENT_BYTES) return operationError("LIMIT_EXCEEDED", "document exceeds the read budget", { spec: args.spec, doc: resolved.relative, limitName: "maxDocumentBytes", limitValue: MAX_DOCUMENT_BYTES, observedValue: bytes.length });
  const content = bytes.toString("utf8");
  const digest = sha256(bytes);
  if (args.readForEdit === true) {
    const headings = content.split(/\r?\n/u).flatMap((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
      return match ? [{ level: match[1].length, text: match[2].trim(), anchor: marksmanSlug(match[2]), line: index + 1 }] : [];
    });
    return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, mode: "read_for_edit", sha256: digest, bytes: bytes.length, totalLines: content.split(/\r?\n/u).length, headings });
  }
  if (args.section !== undefined && args.section !== null) {
    const selected = sectionWindow(content, String(args.section));
    if (!selected) return operationError("SECTION_NOT_FOUND", `section not found: ${args.section}`, { spec: args.spec, doc: resolved.relative, section: args.section });
    const sectionContent = selected.lines.slice(selected.start, selected.end);
    return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, section: selected.heading, startLine: selected.start + 1, endLine: selected.end, lines: sectionContent.length, bytes: Buffer.byteLength(sectionContent.join("\n"), "utf8"), sha256: digest, content: sectionContent.join("\n") });
  }
  const allLines = content.split(/\r?\n/u);
  const startLine = args.offset === undefined ? 1 : args.offset;
  const limit = args.limit === undefined ? allLines.length : args.limit;
  if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SECTION_LINES) return operationError("LIMIT_EXCEEDED", `offset must be positive and limit must be 1 through ${MAX_SECTION_LINES}`, { parameter: "limit" });
  const slice = allLines.slice(startLine - 1, startLine - 1 + limit);
  return operationSuccess({ kind: "document", spec: args.spec, doc: resolved.relative, startLine, endLine: slice.length === 0 ? startLine - 1 : startLine + slice.length - 1, lines: slice.length, totalLines: allLines.length, totalBytes: bytes.length, truncated: startLine - 1 + slice.length < allLines.length, sha256: digest, content: slice.join("\n") });
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

function mcpPreflight(root, args, context) {
  const declared = args.declaredWorktree;
  const declaredAbsolute = typeof declared === "string" && path.isAbsolute(declared) ? path.resolve(declared) : null;
  const matches = declaredAbsolute === null || (process.platform === "win32" ? declaredAbsolute.toLowerCase() === root.toLowerCase() : declaredAbsolute === root);
  const authoring = ["authoring", "v0.6.0", "v0.7.0"].includes(context.stage);
  return operationSuccess({
    kind: "mcp-preflight",
    resolvedRootId: rootId(root),
    worktree: { declared: declaredAbsolute === null ? null : rootId(declaredAbsolute), matchesResolvedRoot: matches },
    lockMode: authoring ? "owner" : "read-only",
    writeMode: authoring ? "proposal-first" : "disabled",
    versions: { mcp: KERNEL_SCHEMA_VERSION, plugin: "0.4.1", omp: "18.0.11" },
    dependencies: { graph: "ready", watcher: "disabled", lock: authoring ? "available" : "disabled", sqlite: "disabled" },
    mutationReady: authoring && matches,
  });
}

export async function executeDocumentOperation(root, operation, args = {}, context = {}) {
  if (operation === "mcpPreflight") return mcpPreflight(root, args, context);
  if (operation === "listSpecDocs") return listSpecDocs(root, args);
  if (operation === "readSpecDoc") return readSpecDoc(root, args);
  if (operation === "readAttachment") return readAttachment(root, args);
  return operationError("UNKNOWN_OPERATION", `unknown document operation: ${operation}`);
}

// Bounded filesystem repository reader (the only kernel module that touches
// node:fs). Accepts one explicit root, inspects only `.specs/<slug>/` canonical
// document names, rejects every link/junction/reparse segment BEFORE opening
// bytes, enforces input budgets, and returns sanitized failures as
// { error } — it never throws past its boundary and never writes anything.

import { lstat, readdir, realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { FIXED_DOCUMENT_FILES } from "../types.js";
import { isValidSpecSlug } from "../identity.js";

export class AdapterContainmentError extends Error {
  constructor(code, diagnostics) {
    super(code);
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

function sanitizedDiagnostic(code, relativePath, extra = {}) {
  return { code, path: relativePath, ...extra };
}

export async function readRepositorySpecs({ root, limits } = {}) {
  const budgets = {
    maxDocuments: limits?.maxDocuments ?? 2000,
    maxBytesPerDocument: limits?.maxBytesPerDocument ?? 2 * 1024 * 1024,
    maxAggregateBytes: limits?.maxAggregateBytes ?? 50 * 1024 * 1024,
    maxPathBytes: limits?.maxPathBytes ?? 512,
  };
  const diagnostics = [];

  if (typeof root !== "string" || root.length === 0) {
    return { error: { code: "ADAPTER_CONTAINMENT_ERROR", diagnostics: [sanitizedDiagnostic("PATH_ESCAPE", "")] } };
  }

  let rootReal;
  try {
    const rootStats = await lstat(root);
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      return {
        error: {
          code: "ADAPTER_CONTAINMENT_ERROR",
          diagnostics: [sanitizedDiagnostic("SYMLINK_REJECTED", ".specs")],
        },
      };
    }
    rootReal = await realpath(root);
  } catch {
    return {
      error: { code: "ADAPTER_READ_ERROR", diagnostics: [sanitizedDiagnostic("IO_READ_FAILED", "")] },
    };
  }

  const specsDir = path.join(root, ".specs");
  let specEntries;
  try {
    const specsStats = await lstat(specsDir);
    if (specsStats.isSymbolicLink() || !specsStats.isDirectory()) {
      return { files: [] };
    }
    const realSpecs = await realpath(specsDir);
    // Reject linked ancestors: the .specs directory must resolve inside root.
    if (!isInsideRoot(rootReal, realSpecs)) {
      return {
        error: {
          code: "ADAPTER_CONTAINMENT_ERROR",
          diagnostics: [sanitizedDiagnostic("SYMLINK_REJECTED", ".specs")],
        },
      };
    }
    specEntries = await readdir(specsDir, { withFileTypes: true });
  } catch {
    // A missing .specs directory is an empty corpus, not a failure.
    return { files: [] };
  }

  const files = [];
  let aggregateBytes = 0;
  let refused = false;

  for (const specEntry of specEntries) {
    if (refused) break;
    if (!specEntry.isDirectory()) continue; // non-directories in .specs are not specs
    const slug = specEntry.name;
    if (!isValidSpecSlug(slug)) continue; // not a valid spec slug: outside the corpus
    const specDir = path.join(specsDir, slug);
    const relativeSpecDir = `.specs/${slug}`;
    try {
      const dirStats = await lstat(specDir);
      if (dirStats.isSymbolicLink()) throw containment("SYMLINK_REJECTED", relativeSpecDir);
      if (!dirStats.isDirectory()) throw containment("NON_REGULAR_FILE", relativeSpecDir);
      const realSpec = await realpath(specDir);
      if (!isInsideRoot(rootReal, realSpec)) throw containment("SYMLINK_REJECTED", relativeSpecDir);
    } catch (error) {
      return adapterFailure(error, diagnostics, "ADAPTER_CONTAINMENT_ERROR");
    }

    let docEntries;
    try {
      docEntries = await readdir(specDir, { withFileTypes: true });
    } catch {
      return {
        error: { code: "ADAPTER_READ_ERROR", diagnostics: [sanitizedDiagnostic("IO_READ_FAILED", relativeSpecDir)] },
      };
    }

    for (const docEntry of docEntries) {
      try {
        if (docEntry.isSymbolicLink()) {
          throw containment("SYMLINK_REJECTED", `${relativeSpecDir}/${docEntry.name}`);
        }
        if (!docEntry.isFile()) {
          // Junctions/reparse points can surface as directories in Dirent; lstat
          // every non-regular entry so a linked segment is refused, never skipped.
          const entryStats = await lstat(path.join(specDir, docEntry.name));
          if (entryStats.isSymbolicLink()) {
            throw containment("SYMLINK_REJECTED", `${relativeSpecDir}/${docEntry.name}`);
          }
          continue;
        }
      } catch (error) {
        return adapterFailure(error, diagnostics, "ADAPTER_CONTAINMENT_ERROR");
      }
      const filename = docEntry.name;
      if (!isCanonicalDocumentName(filename, slug)) continue;
      const relativePath = `${relativeSpecDir}/${filename}`;
      if (Buffer.byteLength(relativePath, "utf8") > budgets.maxPathBytes) {
        diagnostics.push(sanitizedDiagnostic("PATH_ESCAPE", relativePath));
        refused = true;
        break;
      }
      const absolute = path.join(specDir, filename);
      try {
        const stats = await lstat(absolute);
        if (stats.isSymbolicLink()) throw containment("SYMLINK_REJECTED", relativePath);
        if (!stats.isFile()) throw containment("NON_REGULAR_FILE", relativePath);
        // Linked-ancestor check: the file must resolve inside the spec directory.
        const realFile = await realpath(absolute);
        if (!isInsideRoot(rootReal, realFile)) throw containment("SYMLINK_REJECTED", relativePath);
        if (stats.size > budgets.maxBytesPerDocument) {
          diagnostics.push(sanitizedDiagnostic("FILE_TOO_LARGE", relativePath));
          refused = true;
          break;
        }
        if (aggregateBytes + stats.size > budgets.maxAggregateBytes) {
          diagnostics.push(
            sanitizedDiagnostic("CORPUS_LIMIT_EXCEEDED", relativePath, { limitName: "maxAggregateBytes" }),
          );
          refused = true;
          break;
        }
        if (files.length + 1 > budgets.maxDocuments) {
          diagnostics.push(sanitizedDiagnostic("CORPUS_LIMIT_EXCEEDED", relativePath, { limitName: "maxDocuments" }));
          refused = true;
          break;
        }
        const bytes = await readFile(absolute);
        aggregateBytes += bytes.length;
        files.push({ path: relativePath, bytes: new Uint8Array(bytes) });
      } catch (error) {
        return adapterFailure(error, diagnostics, "ADAPTER_READ_ERROR");
      }
    }
  }

  if (refused || diagnostics.length > 0) {
    return { error: { code: "ADAPTER_CONTAINMENT_ERROR", diagnostics } };
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files };
}

function isInsideRoot(rootReal, candidateReal) {
  if (candidateReal === rootReal) return true;
  const normalizedRoot = rootReal.split(path.sep).join("/");
  const normalizedCandidate = candidateReal.split(path.sep).join("/");
  return (
    normalizedCandidate.startsWith(`${normalizedRoot}/`) ||
    // Windows drive-letter case variance
    normalizedCandidate.toLowerCase().startsWith(`${normalizedRoot.toLowerCase()}/`)
  );
}

function containment(code, relativePath) {
  const error = new Error(code);
  error.adapterCode = code;
  error.adapterPath = relativePath;
  return error;
}

function adapterFailure(error, diagnostics, fallbackCode) {
  if (error && error.adapterCode) {
    diagnostics.push(sanitizedDiagnostic(error.adapterCode, error.adapterPath ?? ""));
    return { error: { code: fallbackCode === "ADAPTER_READ_ERROR" && error.adapterCode === "IO_READ_FAILED" ? "ADAPTER_READ_ERROR" : "ADAPTER_CONTAINMENT_ERROR", diagnostics } };
  }
  diagnostics.push(sanitizedDiagnostic("IO_READ_FAILED", ""));
  return { error: { code: fallbackCode, diagnostics } };
}

// Exact canonical names only: fixed documents plus the two slug-derived forms.
export function isCanonicalDocumentName(filename, specSlug) {
  for (const kind of Object.keys(FIXED_DOCUMENT_FILES)) {
    if (FIXED_DOCUMENT_FILES[kind] === filename) return true;
  }
  return filename === `${specSlug}.feature` || filename === `${specSlug}_SCHEMA.md`;
}

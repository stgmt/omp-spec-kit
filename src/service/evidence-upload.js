import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { EVIDENCE_PATH, EVIDENCE_SCHEMA } from "../evidence/service.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";
import { buildKernelGraph } from "../kernel/graph/build.js";

// Keep this no larger than the evidence reader's limit.
export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

function uploadError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

async function safeDirectory(dir) {
  try { await mkdir(dir); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw uploadError("EVIDENCE_PATH_UNSAFE", 409);
}

/** Store a complete producer artifact, never a caller-supplied path. */
export async function storeProjectEvidence(mounts, project, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw uploadError("INVALID_EVIDENCE", 400);
  let binding;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    for (const match of text.matchAll(/[^\n]+/gu)) {
      if (!match[0].trim()) continue;
      const frame = JSON.parse(match[0]);
      if (!frame || typeof frame !== "object" || Array.isArray(frame)) throw new Error();
      if (frame.ompSpecKitEvidence?.binding) {
        if (binding) throw new Error();
        binding = frame.ompSpecKitEvidence.binding;
      }
    }
  } catch { throw uploadError("INVALID_EVIDENCE", 400); }
  if (!binding || binding.schemaVersion !== EVIDENCE_SCHEMA || typeof binding.graphFingerprint !== "string") {
    throw uploadError("INVALID_EVIDENCE", 400);
  }
  const root = await mounts.resolveProjectRoot(project);
  const repository = await readRepositorySpecs({ root });
  if (repository.error) throw uploadError("EVIDENCE_CORPUS_UNAVAILABLE", 409);
  const { graph } = buildKernelGraph(repository);
  if (!graph.valid || graph.fingerprint !== binding.graphFingerprint) throw uploadError("EVIDENCE_STALE", 409);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw uploadError("EVIDENCE_PATH_UNSAFE", 409);
  const base = path.join(root, ".omp-spec-kit");
  const dir = path.join(base, "evidence");
  await safeDirectory(base);
  await safeDirectory(dir);
  const destination = path.join(root, ...EVIDENCE_PATH.split("/"));
  const temporary = path.join(dir, `.upload-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.close();
    handle = null;
    await rename(temporary, destination);
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

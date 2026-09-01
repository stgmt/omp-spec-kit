import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIXED_DOCUMENT_FILES } from "../kernel/types.js";
import { isValidSpecSlug } from "../kernel/identity.js";

const LOCK_FILE = ".omp-spec-kit-write.lock";
const STAGING_DIRECTORY = ".omp-spec-kit-staging";
const MAX_REQUEST_ID_BYTES = 128;

function normalized(value) {
  return value.split(path.sep).join("/");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalJson(value) {
  const normalize = (candidate) => {
    if (candidate === undefined) return null;
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate !== null && typeof candidate === "object") {
      const sorted = {};
      for (const key of Object.keys(candidate).sort()) sorted[key] = normalize(candidate[key]);
      return sorted;
    }
    return candidate;
  };
  return JSON.stringify(normalize(value));
}

export function isCanonicalDocument(document, spec) {
  if (typeof document !== "string" || document.length === 0 || path.isAbsolute(document)) return false;
  const segments = document.split(/[\\/]/u);
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\u0000"))) return false;
  const fixed = Object.values(FIXED_DOCUMENT_FILES);
  return segments.length === 1 && (fixed.includes(document) || document === `${spec}.feature` || document === `${spec}_SCHEMA.md`);
}

export function validateSpecDocument(spec, document) {
  if (!isValidSpecSlug(spec)) return { ok: false, code: "PATH_FORBIDDEN", message: "spec must be a valid specification slug" };
  if (!isCanonicalDocument(document, spec)) return { ok: false, code: "PATH_FORBIDDEN", message: "document must be a canonical spec document" };
  return { ok: true, absolute: path.join(process.cwd(), ".specs", spec, document), relative: `.specs/${spec}/${document}` };
}

export function documentAbsolute(root, spec, document) {
  const checked = validateSpecDocument(spec, document);
  if (!checked.ok) return checked;
  return { ok: true, absolute: path.join(root, ".specs", spec, document), relative: checked.relative };
}

export async function readDocumentBytes(root, spec, document) {
  const checked = await inspectAuthoringTarget(root, spec, document, { allowMissing: true });
  if (!checked.ok) return checked;
  if (checked.missing) return documentNotFound(`document does not exist: ${document}`, { spec, document });
  try {
    const bytes = await readFile(checked.absolute);
    return { ...checked, bytes, sha256: sha256(bytes) };
  } catch (error) {
    if (error?.code === "ENOENT") return documentNotFound(`document does not exist: ${document}`, { spec, document });
    return pathForbidden(`document is not readable: ${document}`, { spec, document });
  }
}

async function tryStat(absolute) {
  try {
    return await lstat(absolute);
  } catch {
    return null;
  }
}
function isInsidePath(root, candidate) {
  const rootPath = path.resolve(root).split(path.sep).join("/");
  const candidatePath = path.resolve(candidate).split(path.sep).join("/");
  const normalize = (value) => (process.platform === "win32" ? value.toLowerCase() : value);
  const left = normalize(rootPath);
  const right = normalize(candidatePath);
  return right === left || right.startsWith(`${left}/`);
}
async function syncFile(absolute) {
  let handle;
  try {
    handle = await open(absolute, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) throw error;
  } finally {
    await handle?.close();
  }
}

async function syncDirectory(absolute) {
  try {
    const handle = await open(absolute, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!["EISDIR", "EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) throw error;
  }
}

async function writeJournal(absolute, journal) {
  await writeFile(absolute, `${JSON.stringify(journal)}\n`, "utf8");
  await syncFile(absolute);
}

function pathForbidden(message, extra = {}) {
  return { ok: false, code: "PATH_FORBIDDEN", message, ...extra };
}

function documentNotFound(message, extra = {}) {
  return { ok: false, code: "DOC_NOT_FOUND", message, ...extra };
}

async function inspectAuthoringTarget(root, spec, document, { allowMissing = false } = {}) {
  const resolved = documentAbsolute(root, spec, document);
  if (!resolved.ok) return resolved;
  let rootReal;
  try {
    rootReal = await realpath(root);
  } catch {
    return pathForbidden("repository root is not a readable directory", { spec, document });
  }
  const specsDir = path.join(root, ".specs");
  let specsStat;
  try {
    specsStat = await lstat(specsDir);
  } catch (error) {
    if (error?.code === "ENOENT") return documentNotFound("specification root does not exist", { spec, document });
    return pathForbidden("specification root cannot be inspected", { spec, document });
  }
  if (specsStat.isSymbolicLink() || !specsStat.isDirectory()) return pathForbidden("specification root must be a regular directory", { spec, document });
  let specsReal;
  try {
    specsReal = await realpath(specsDir);
  } catch {
    return pathForbidden("specification root cannot be resolved", { spec, document });
  }
  if (!isInsidePath(rootReal, specsReal)) return pathForbidden("specification root escapes the repository", { spec, document });
  const specDir = path.join(specsDir, spec);
  let specStat;
  try {
    specStat = await lstat(specDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return allowMissing
        ? { ...resolved, rootReal, specsDir, specDir, missing: true }
        : documentNotFound(`specification does not exist: ${spec}`, { spec, document });
    }
    return pathForbidden("specification directory cannot be inspected", { spec, document });
  }
  if (specStat.isSymbolicLink() || !specStat.isDirectory()) return pathForbidden("specification directory must be a regular directory", { spec, document });
  let specReal;
  try {
    specReal = await realpath(specDir);
  } catch {
    return pathForbidden("specification directory cannot be resolved", { spec, document });
  }
  const relativeSpec = path.relative(specsReal, specReal).split(path.sep).join("/");
  if (!isInsidePath(specsReal, specReal) || (process.platform === "win32" ? relativeSpec.toLowerCase() : relativeSpec) !== (process.platform === "win32" ? spec.toLowerCase() : spec)) {
    return pathForbidden("specification directory resolves outside its canonical parent", { spec, document });
  }
  const target = resolved.absolute;
  let targetStat;
  try {
    targetStat = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return allowMissing
        ? { ...resolved, rootReal, specsDir, specDir, specReal, missing: true }
        : documentNotFound(`document does not exist: ${document}`, { spec, document });
    }
    return pathForbidden("document cannot be inspected", { spec, document });
  }
  if (targetStat.isSymbolicLink() || !targetStat.isFile()) return pathForbidden("document must be a regular file", { spec, document });
  let targetReal;
  try {
    targetReal = await realpath(target);
  } catch {
    return pathForbidden("document cannot be resolved", { spec, document });
  }
  if (!isInsidePath(specReal, targetReal)) return pathForbidden("document resolves outside its specification", { spec, document });
  return { ...resolved, rootReal, specsDir, specDir, specReal, targetReal, missing: false };
}

export async function specificationDirectoryExists(root, spec) {
  const checked = await inspectAuthoringTarget(root, spec, `${spec}.feature`, { allowMissing: true });
  if (!checked.ok) return checked;
  return { ok: true, exists: checked.specReal !== undefined, specDir: checked.specDir };
}
async function collectDirectoryFiles(directory, rootReal, relative = "", files = []) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const child = path.join(directory, entry.name);
    const childStat = await lstat(child);
    if (childStat.isSymbolicLink()) return pathForbidden("specification generation contains a linked path", { path: childRelative });
    if (childStat.isDirectory()) {
      const childReal = await realpath(child);
      if (!isInsidePath(rootReal, childReal)) return pathForbidden("specification generation escapes the repository", { path: childRelative });
      const result = await collectDirectoryFiles(child, rootReal, childRelative, files);
      if (!result.ok) return result;
      continue;
    }
    if (!childStat.isFile()) return pathForbidden("specification generation contains a non-file entry", { path: childRelative });
    const bytes = await readFile(child);
    files.push({ path: childRelative, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { ok: true, files };
}

export async function specificationDirectoryDigest(root, spec) {
  const checked = await inspectAuthoringTarget(root, spec, `${spec}.feature`);
  if (!checked.ok) return checked;
  const collected = await collectDirectoryFiles(checked.specDir, checked.rootReal);
  if (!collected.ok) return collected;
  const material = collected.files.map((entry) => `${entry.path}\u0000${entry.sha256}\u0000${entry.bytes}\n`).join("");
  return { ok: true, spec, absolute: checked.specDir, digest: sha256(Buffer.from(material, "utf8")), files: collected.files };
}

export async function commitArchive(root, requestId, spec, expectedDigest) {
  const source = await specificationDirectoryDigest(root, spec);
  if (!source.ok) throw Object.assign(new Error(source.message), { code: source.code });
  if (source.digest !== expectedDigest) throw Object.assign(new Error("specification changed after archival proof"), { code: "CONFLICT" });
  const specsDir = path.join(root, ".specs");
  const archiveDir = path.join(specsDir, "archive");
  const destination = path.join(archiveDir, spec);
  let archiveStat;
  try {
    archiveStat = await lstat(archiveDir);
  } catch (error) {
    if (error?.code !== "ENOENT") throw Object.assign(new Error("archive directory cannot be inspected"), { code: "PATH_FORBIDDEN" });
  }
  if (archiveStat && (archiveStat.isSymbolicLink() || !archiveStat.isDirectory())) throw Object.assign(new Error("archive directory must be a regular directory"), { code: "PATH_FORBIDDEN" });
  if (!archiveStat) await mkdir(archiveDir);
  const archiveReal = await realpath(archiveDir);
  const rootReal = await realpath(root);
  if (!isInsidePath(rootReal, archiveReal)) throw Object.assign(new Error("archive directory escapes the repository"), { code: "PATH_FORBIDDEN" });
  let destinationStat;
  try {
    destinationStat = await lstat(destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw Object.assign(new Error("archive destination cannot be inspected"), { code: "PATH_FORBIDDEN" });
  }
  if (destinationStat) throw Object.assign(new Error(`archive destination already exists: ${spec}`), { code: "DEST_EXISTS" });
  const sourceCheck = await specificationDirectoryDigest(root, spec);
  if (!sourceCheck.ok) throw Object.assign(new Error(sourceCheck.message), { code: sourceCheck.code });
  if (sourceCheck.digest !== expectedDigest) throw Object.assign(new Error("specification changed after archival proof"), { code: "CONFLICT" });
  let moved = false;
  try {
    await rename(source.absolute, destination);
    moved = true;
    await syncDirectory(path.dirname(source.absolute));
    await syncDirectory(archiveDir);
    const movedStat = await lstat(destination);
    if (movedStat.isSymbolicLink() || !movedStat.isDirectory()) throw Object.assign(new Error("archive destination is not a regular directory"), { code: "PATH_FORBIDDEN" });
    const movedReal = await realpath(destination);
    if (!isInsidePath(archiveReal, movedReal)) throw Object.assign(new Error("archive destination escapes the repository"), { code: "PATH_FORBIDDEN" });
    return { ok: true, from: `.specs/${spec}`, to: `.specs/archive/${spec}`, digest: expectedDigest };
  } catch (error) {
    if (moved) {
      try {
        const movedStat = await lstat(destination);
        if (!movedStat.isSymbolicLink() && movedStat.isDirectory()) {
          await rename(destination, source.absolute);
          await syncDirectory(path.dirname(source.absolute));
          await syncDirectory(archiveDir);
        }
      } catch (restoreError) {
        const recovery = new Error("archival rollback could not restore the original specification");
        recovery.code = "RECOVERY_REQUIRED";
        recovery.cause = restoreError;
        throw recovery;
      }
    }
    throw error;
  }
}
function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function lstatOrNull(absolute) {
  try {
    return await lstat(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function committedGenerationValid(root, journal) {
  for (const change of journal.changes ?? []) {
    const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
    if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
    if (change.deleteAfter) {
      if (!checked.missing) return false;
      continue;
    }
    if (checked.missing) return false;
    const bytes = await readFile(checked.absolute);
    if (sha256(bytes) !== change.afterSha256) return false;
  }
  return true;
}

async function rollbackInterruptedGeneration(root, stageRoot, journal) {
  for (const change of [...(journal.changes ?? [])].reverse()) {
    const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
    if (!checked.ok) throw Object.assign(new Error(checked.message), { code: "RECOVERY_REQUIRED" });
    const targetStat = await lstatOrNull(checked.absolute);
    if (targetStat && (targetStat.isSymbolicLink() || !targetStat.isFile())) throw Object.assign(new Error("recovery target is not a regular file"), { code: "RECOVERY_REQUIRED" });
    const backup = path.join(stageRoot, ".backup", change.spec, change.document);
    const backupStat = await lstatOrNull(backup);
    if (backupStat) {
      if (backupStat.isSymbolicLink() || !backupStat.isFile()) throw Object.assign(new Error("recovery backup is not a regular file"), { code: "RECOVERY_REQUIRED" });
      if (targetStat) await rm(checked.absolute, { force: true });
      await mkdir(path.dirname(checked.absolute), { recursive: true });
      await rename(backup, checked.absolute);
      continue;
    }
    if (!targetStat) continue;
    const targetBytes = await readFile(checked.absolute);
    if (sha256(targetBytes) !== change.afterSha256) throw Object.assign(new Error("recovery found an unrecognized target generation"), { code: "RECOVERY_REQUIRED" });
    await rm(checked.absolute, { force: true });
  }
}

async function recoverInterruptedTransactions(root, lockPath, lockMetadata) {
  const stagingParent = path.join(root, ".specs", STAGING_DIRECTORY);
  const stagingStat = await lstatOrNull(stagingParent);
  if (stagingStat && (stagingStat.isSymbolicLink() || !stagingStat.isDirectory())) throw Object.assign(new Error("transaction staging parent is not a regular directory"), { code: "RECOVERY_REQUIRED" });
  if (stagingStat) {
    const entries = await readdir(stagingParent, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) throw Object.assign(new Error("transaction staging contains an unsafe entry"), { code: "RECOVERY_REQUIRED" });
      const stageRoot = path.join(stagingParent, entry.name);
      const journalPath = path.join(stageRoot, "transaction.json");
      let journal;
      try {
        journal = JSON.parse(await readFile(journalPath, "utf8"));
      } catch (error) {
        throw Object.assign(new Error(`transaction journal is unreadable: ${error.message}`), { code: "RECOVERY_REQUIRED" });
      }
      if (journal?.schema !== "omp-spec-kit-authoring-transaction@1" || journal.requestId !== lockMetadata.requestId || !Array.isArray(journal.changes)) {
        throw Object.assign(new Error("transaction journal identity is invalid"), { code: "RECOVERY_REQUIRED" });
      }
      if (journal.phase !== "committed" || !(await committedGenerationValid(root, journal))) await rollbackInterruptedGeneration(root, stageRoot, journal);
      await rm(stageRoot, { recursive: true, force: true });
    }
    await rmdir(stagingParent).catch(() => {});
  }
  await rm(lockPath, { force: true });
  return true;
}


async function acquireLock(root, requestId) {
  const lockPath = path.join(root, ".specs", LOCK_FILE);
  let handle;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt > 0) {
        const conflict = new Error("another specification transaction owns the write lock");
        conflict.code = "CONFLICT";
        throw conflict;
      }
      let metadata;
      try {
        metadata = JSON.parse(await readFile(lockPath, "utf8"));
      } catch {
        metadata = null;
      }
      if (!metadata || processAlive(metadata.pid)) {
        const conflict = new Error("another specification transaction owns the write lock");
        conflict.code = "CONFLICT";
        throw conflict;
      }
      await recoverInterruptedTransactions(root, lockPath, metadata);
    }
  }
  if (!handle) {
    const conflict = new Error("another specification transaction owns the write lock");
    conflict.code = "CONFLICT";
    throw conflict;
  }
  const metadata = { schema: "omp-spec-kit-write-lock@1", pid: process.pid, requestId, startedAt: new Date().toISOString() };
  try {
    await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
  } catch (error) {
    await handle.close();
    await rm(lockPath, { force: true });
    throw error;
  }
  try {
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) {
      await handle.close();
      await rm(lockPath, { force: true });
      throw error;
    }
  }
  return async () => {
    await handle.close();
    await rm(lockPath, { force: true });
  };
}

function stagingName(requestId) {
  const safe = sha256(String(requestId)).slice(0, 32);
  return safe || "transaction";
}

export async function withWriteLock(root, requestId, operation) {
  const release = await acquireLock(root, requestId);
  try {
    return await operation();
  } finally {
    await release();
  }
}

/** Commit a complete set of changed document bytes with rollback on failure. */
function injectFault(options, point) {
  if (options?.faultAt === point) throw Object.assign(new Error("deterministic transaction fault"), { code: "INTERNAL_ERROR" });
}
export async function commitDocuments(root, requestId, changes, options = {}) {
  if (!Array.isArray(changes) || changes.length === 0) throw Object.assign(new Error("transaction needs at least one document"), { code: "INVALID_REQUEST" });
  const stagingParent = path.join(root, ".specs", STAGING_DIRECTORY);
  const stageRoot = path.join(stagingParent, stagingName(requestId));
  const journalPath = path.join(stageRoot, "transaction.json");
  const backups = [];
  const installed = [];
  const journal = {
    schema: "omp-spec-kit-authoring-transaction@1",
    requestId,
    phase: "prepared",
    changes: changes.map((change) => ({ spec: change.spec, document: change.document, afterSha256: sha256(change.afterBytes), deleteAfter: change.deleteAfter === true })),
    installed: [],
  };
  try {
    const rootCheck = await inspectAuthoringTarget(root, changes[0].spec, changes[0].document, { allowMissing: true });
    if (!rootCheck.ok) throw Object.assign(new Error(rootCheck.message), { code: rootCheck.code });
    let stagingStat;
    try {
      stagingStat = await lstat(stagingParent);
    } catch (error) {
      if (error?.code !== "ENOENT") throw Object.assign(new Error("transaction staging parent cannot be inspected"), { code: "PATH_FORBIDDEN" });
    }
    if (stagingStat && (stagingStat.isSymbolicLink() || !stagingStat.isDirectory())) throw Object.assign(new Error("transaction staging parent must be a regular directory"), { code: "PATH_FORBIDDEN" });
    let stageStat;
    try {
      stageStat = await lstat(stageRoot);
    } catch (error) {
      if (error?.code !== "ENOENT") throw Object.assign(new Error("transaction staging directory cannot be inspected"), { code: "PATH_FORBIDDEN" });
    }
    if (stageStat) throw Object.assign(new Error("transaction staging directory already exists"), { code: "CONFLICT" });
    await mkdir(stageRoot, { recursive: true });
    await writeJournal(journalPath, journal);
    for (const change of changes) {
      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
      const stageSpecDir = path.join(stageRoot, change.spec);
      const stageSpecStat = await tryStat(stageSpecDir);
      if (stageSpecStat && (stageSpecStat.isSymbolicLink() || !stageSpecStat.isDirectory())) throw Object.assign(new Error("staged specification directory must be a regular directory"), { code: "PATH_FORBIDDEN" });
      await mkdir(stageSpecDir, { recursive: true });
      const stagePath = path.join(stageSpecDir, change.document);
      const existingStage = await tryStat(stagePath);
      if (existingStage && (existingStage.isSymbolicLink() || !existingStage.isFile())) throw Object.assign(new Error("staged document must be a regular file"), { code: "PATH_FORBIDDEN" });
      await writeFile(stagePath, change.afterBytes);
      await syncFile(stagePath);
      await syncDirectory(stageSpecDir);
    }
    await syncDirectory(stageRoot);
    journal.phase = "ready";
    await writeJournal(journalPath, journal);
    injectFault(options, "after-staging");
    for (const change of changes) {
      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
      const target = checked.absolute;
      const stagePath = path.join(stageRoot, change.spec, change.document);
      const existing = await tryStat(target);
      const backup = path.join(stageRoot, ".backup", change.spec, change.document);
      if (existing?.isSymbolicLink() || (existing && !existing.isFile())) throw Object.assign(new Error("target document must be a regular file"), { code: "PATH_FORBIDDEN" });
      if (existing?.isFile()) {
        await mkdir(path.dirname(backup), { recursive: true });
        await rename(target, backup);
        await syncDirectory(path.dirname(target));
        await syncFile(backup);
        backups.push({ target, backup, spec: change.spec, document: change.document });
        injectFault(options, "during-swap");
      }
      const beforeInstall = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
      if (!beforeInstall.ok) throw Object.assign(new Error(beforeInstall.message), { code: beforeInstall.code });
      await mkdir(path.dirname(target), { recursive: true });
      if (change.deleteAfter) {
        const afterRemove = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
        if (!afterRemove.ok || !afterRemove.missing) throw Object.assign(new Error("deleted document remained after removal"), { code: "WRITE_FAILED" });
      } else {
        await rename(stagePath, target);
        await syncFile(target);
        await syncDirectory(path.dirname(target));
        const afterInstall = await inspectAuthoringTarget(root, change.spec, change.document);
        if (!afterInstall.ok) throw Object.assign(new Error(afterInstall.message), { code: afterInstall.code });
      }
      installed.push({ target, spec: change.spec, document: change.document });
      journal.installed.push({ spec: change.spec, document: change.document, deleteAfter: change.deleteAfter === true });
      journal.phase = "installing";
      await writeJournal(journalPath, journal);
    }
    journal.phase = "committed";
    await writeJournal(journalPath, journal);
    await syncDirectory(path.dirname(stageRoot));
    injectFault(options, "during-cleanup");
    await rm(stageRoot, { recursive: true, force: true });
    await rmdir(stagingParent).catch(() => {});
    return { ok: true };
  } catch (error) {
    let rollbackError;
    try {
      for (const change of installed) {
        const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true });
        if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
        await rm(checked.absolute, { force: true });
      }
      for (const backup of backups) {
        const checked = await inspectAuthoringTarget(root, backup.spec, backup.document, { allowMissing: true });
        if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
        const backupStat = await lstat(backup.backup);
        if (backupStat.isSymbolicLink() || !backupStat.isFile()) throw Object.assign(new Error("transaction backup is not a regular file"), { code: "RECOVERY_REQUIRED" });
        await mkdir(path.dirname(checked.absolute), { recursive: true });
        await rename(backup.backup, checked.absolute);
        await syncFile(checked.absolute);
        await syncDirectory(path.dirname(checked.absolute));
      }
      await rm(stageRoot, { recursive: true, force: true });
      await rmdir(stagingParent).catch(() => {});
    } catch (restoreError) {
      rollbackError = restoreError;
    }
    if (rollbackError) {
      const recovery = new Error("transaction rollback could not prove a complete old generation");
      recovery.code = "RECOVERY_REQUIRED";
      recovery.cause = rollbackError;
      throw recovery;
    }
    throw error;
  }
}

export function changedDocumentHash(document, beforeBytes, afterBytes) {
  return {
    document,
    beforeSha256: sha256(beforeBytes),
    afterSha256: sha256(afterBytes),
    beforeBytes,
    afterBytes,
  };
}

export function requestIdWithinBounds(requestId) {
  return typeof requestId === "string" && requestId.length > 0 && Buffer.byteLength(requestId, "utf8") <= MAX_REQUEST_ID_BYTES;
}

export function relativeDocument(root, spec, document) {
  const resolved = documentAbsolute(root, spec, document);
  return resolved.ok ? normalized(resolved.relative) : null;
}

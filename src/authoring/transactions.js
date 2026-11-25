import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalDocumentKind, isLegacySpecificationDocument } from "../kernel/types.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";
import { buildKernelGraph } from "../kernel/index.js";

const LOCK_FILE = ".omp-spec-kit-write.lock";
const STAGING_DIRECTORY = ".omp-spec-kit-staging";
const RECEIPTS_DIRECTORY = ".receipts";
export const MIGRATION_RECEIPT_SCHEMA = "omp-spec-kit-migration-receipt@1";
const REMOVE_TREE_OPTIONS = Object.freeze({ recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
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
  return segments.length === 1 && canonicalDocumentKind(document, spec) !== null;
}

export function validateSpecDocument(spec, document, { allowLegacy = false } = {}) {
  if (!isValidSpecSlug(spec)) return { ok: false, code: "PATH_FORBIDDEN", message: "spec must be a valid specification slug" };
  if (!isCanonicalDocument(document, spec) && !(allowLegacy && isLegacySpecificationDocument(document, spec))) return { ok: false, code: "PATH_FORBIDDEN", message: "document must be a canonical spec document" };
  return { ok: true, absolute: path.join(process.cwd(), ".specs", spec, document), relative: `.specs/${spec}/${document}` };
}

export function documentAbsolute(root, spec, document, options = {}) {
  const checked = validateSpecDocument(spec, document, options);
  if (!checked.ok) return checked;
  return { ok: true, absolute: path.join(root, ".specs", spec, document), relative: checked.relative };
}

export async function readDocumentBytes(root, spec, document, options = {}) {
  const checked = await inspectAuthoringTarget(root, spec, document, { allowMissing: true, ...options });
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

function recoveryRequired(message) {
  return Object.assign(new Error(message), { code: "RECOVERY_REQUIRED" });
}

async function migrationReceiptDirectory(root, create = false) {
  const rootReal = await realpath(root);
  const specs = path.join(rootReal, ".specs");
  const specsStat = await lstatOrNull(specs);
  if (!specsStat && !create) return null;
  if (!specsStat || specsStat.isSymbolicLink() || !specsStat.isDirectory()) throw recoveryRequired("specification root is not a regular directory");
  if (!isInsidePath(rootReal, await realpath(specs))) throw recoveryRequired("specification root escapes the repository");
  let parent = specs;
  for (const name of [STAGING_DIRECTORY, RECEIPTS_DIRECTORY]) {
    const directory = path.join(parent, name);
    let stat = await lstatOrNull(directory);
    if (!stat && create) {
      await mkdir(directory).catch((error) => { if (error?.code !== "EEXIST") throw error; });
      stat = await lstatOrNull(directory);
    }
    if (!stat) return null;
    if (stat.isSymbolicLink() || !stat.isDirectory() || !isInsidePath(rootReal, await realpath(directory))) {
      throw recoveryRequired("migration receipt directory is not a contained regular directory");
    }
    parent = directory;
  }
  return parent;
}

function validMigrationReceipt(receipt, requestId) {
  const hash = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
  if (!(receipt?.schema === MIGRATION_RECEIPT_SCHEMA && receipt.requestId === requestId &&
    requestIdWithinBounds(receipt.requestId) && isValidSpecSlug(receipt.spec) &&
    hash(receipt.requestKeyHash) && hash(receipt.snapshot) && hash(receipt.proposalHash) &&
    receipt.migration?.snapshot === receipt.snapshot && hash(receipt.migration?.sourceHash) &&
    Array.isArray(receipt.changes) && receipt.changes.length > 0 &&
    Array.isArray(receipt.changedDocuments) && receipt.changedDocuments.length === receipt.changes.length)) return false;
  const names = new Set();
  return receipt.changes.every((change, index) => {
    if (!(change?.spec === receipt.spec &&
      typeof change.document === "string" && hash(change.beforeSha256) && hash(change.afterSha256) &&
      typeof change.deleteAfter === "boolean" && typeof change.beforeMissing === "boolean" &&
      typeof change.migrationLegacy === "boolean" && change.destination === null && change.destinationSha256 === null &&
      validateSpecDocument(change.spec, change.document, { allowLegacy: change.migrationLegacy }).ok &&
      (!change.migrationLegacy || (change.deleteAfter && isLegacySpecificationDocument(change.document, change.spec))))) return false;
    if (names.has(change.document)) return false;
    names.add(change.document);
    const published = receipt.changedDocuments[index];
    return published?.path === `.specs/${change.spec}/${change.document}` &&
      published.beforeSha256 === change.beforeSha256 &&
      published.afterSha256 === (change.deleteAfter ? null : change.afterSha256);
  });
}

/** Read only an integrity-checked receipt, while the caller owns the write lock. */
export async function readMigrationReceipt(root, requestId) {
  if (!requestIdWithinBounds(requestId)) throw Object.assign(new Error("invalid requestId"), { code: "INVALID_REQUEST" });
  const directory = await migrationReceiptDirectory(root);
  if (!directory) return null;
  const absolute = path.join(directory, `${sha256(requestId)}.json`);
  const stat = await lstatOrNull(absolute);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 1024 * 1024) throw recoveryRequired("migration receipt is not a safe regular file");
  let receipt;
  try { receipt = JSON.parse(await readFile(absolute, "utf8")); }
  catch { throw recoveryRequired("migration receipt is unreadable"); }
  if (!validMigrationReceipt(receipt, requestId)) throw recoveryRequired("migration receipt identity is invalid");
  return receipt;
}

export async function migrationReceiptGenerationValid(root, receipt) {
  if (!validMigrationReceipt(receipt, receipt?.requestId)) throw recoveryRequired("migration receipt identity is invalid");
  return committedGenerationValid(root, receipt);
}

async function persistMigrationReceipt(root, stageRoot, receipt) {
  if (!validMigrationReceipt(receipt, receipt?.requestId)) throw recoveryRequired("migration receipt identity is invalid");
  if (!(await committedGenerationValid(root, receipt))) throw recoveryRequired("cannot prove committed migration generation");
  const directory = await migrationReceiptDirectory(root, true);
  const absolute = path.join(directory, `${sha256(receipt.requestId)}.json`);
  const existing = await readMigrationReceipt(root, receipt.requestId);
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(receipt)) throw recoveryRequired("migration receipt conflicts with existing operation");
    return;
  }
  // The temporary file lives in the already protected transaction directory;
  // rename publishes a complete receipt in one operation, never a partial one.
  const temporary = path.join(stageRoot, ".receipt.pending");
  const tempStat = await lstatOrNull(temporary);
  if (tempStat && (tempStat.isSymbolicLink() || !tempStat.isFile())) throw recoveryRequired("pending migration receipt is unsafe");
  await writeFile(temporary, `${JSON.stringify(receipt)}\n`, { encoding: "utf8", mode: 0o600 });
  await syncFile(temporary);
  await rename(temporary, absolute);
  await syncFile(absolute);
  await syncDirectory(directory);
}

function pathForbidden(message, extra = {}) {
  return { ok: false, code: "PATH_FORBIDDEN", message, ...extra };
}

function documentNotFound(message, extra = {}) {
  return { ok: false, code: "DOC_NOT_FOUND", message, ...extra };
}

async function inspectSpecificationDirectory(root, spec, document, allowMissing) {
  if (!isValidSpecSlug(spec)) return pathForbidden("spec must be a valid specification slug", { spec });
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
        ? { ok: true, rootReal, specsDir, specDir, missing: true }
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
  return { ok: true, rootReal, specsDir, specDir, specReal, missing: false };
}

async function inspectAuthoringTarget(root, spec, document, { allowMissing = false, allowLegacy = false } = {}) {
  const resolved = documentAbsolute(root, spec, document, { allowLegacy });
  if (!resolved.ok) return resolved;
  const directory = await inspectSpecificationDirectory(root, spec, document, allowMissing);
  if (!directory.ok) return directory;
  if (directory.missing) return { ...resolved, ...directory };
  const { rootReal, specsDir, specDir, specReal } = directory;
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
  const checked = await inspectSpecificationDirectory(root, spec, null, true);
  if (!checked.ok) return checked;
  return { ok: true, exists: checked.specReal !== undefined, specDir: checked.specDir };
}

async function collectDirectoryFiles(directory, rootReal, relative = "", files = []) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
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
  const checked = await inspectSpecificationDirectory(root, spec, null, false);
  if (!checked.ok) return checked;
  const collected = await collectDirectoryFiles(checked.specDir, checked.rootReal);
  if (!collected.ok) return collected;
  const material = collected.files.map((entry) => `${entry.path}\u0000${entry.sha256}\u0000${entry.bytes}\n`).join("");
  return { ok: true, spec, absolute: checked.specDir, digest: sha256(Buffer.from(material, "utf8")), files: collected.files };
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
    if (change.destination) {
      const destPath = path.join(root, change.destination);
      const destStat = await lstatOrNull(destPath);
      if (!destStat || !destStat.isFile()) return false;
      const bytes = await readFile(destPath);
      if (sha256(bytes) !== change.destinationSha256) return false;
      continue;
    }
    const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
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
  if (journal.durableReceipt) {
    // Check every path before touching any of them. A user may have edited a
    // file while the process was down; recovery must not overwrite those bytes.
    const restore = [];
    for (const change of journal.changes ?? []) {
      if (change.destination) throw recoveryRequired("migration recovery cannot contain an archive destination");
      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
      if (!checked.ok) throw recoveryRequired(checked.message);
      const backupParent = path.join(stageRoot, ".backup", change.spec);
      for (const ancestor of [path.join(stageRoot, ".backup"), backupParent]) {
        const ancestorStat = await lstatOrNull(ancestor);
        if (ancestorStat && (ancestorStat.isSymbolicLink() || !ancestorStat.isDirectory() || !isInsidePath(stageRoot, await realpath(ancestor)))) {
          throw recoveryRequired("migration backup directory is unsafe");
        }
      }
      const backup = path.join(backupParent, change.document);
      const backupStat = await lstatOrNull(backup);
      const targetStat = await lstatOrNull(checked.absolute);
      if ((backupStat && (backupStat.isSymbolicLink() || !backupStat.isFile())) ||
          (targetStat && (targetStat.isSymbolicLink() || !targetStat.isFile()))) {
        throw recoveryRequired("migration recovery encountered an unsafe file");
      }
      if (backupStat) {
        if (sha256(await readFile(backup)) !== change.beforeSha256) throw recoveryRequired("migration backup no longer matches its preimage");
        if (targetStat && (change.deleteAfter || sha256(await readFile(checked.absolute)) !== change.afterSha256)) {
          throw recoveryRequired("migration recovery found an external change");
        }
        restore.push({ target: checked.absolute, backup, removeOnly: false });
      } else if (change.beforeMissing) {
        if (targetStat && (change.deleteAfter || sha256(await readFile(checked.absolute)) !== change.afterSha256)) {
          throw recoveryRequired("migration recovery found an external change");
        }
        if (targetStat) restore.push({ target: checked.absolute, removeOnly: true });
      } else if (!targetStat || sha256(await readFile(checked.absolute)) !== change.beforeSha256) {
        throw recoveryRequired("migration original generation cannot be proved");
      }
    }
    for (const item of restore.reverse()) {
      await rm(item.target, { force: true });
      if (!item.removeOnly) {
        await mkdir(path.dirname(item.target), { recursive: true });
        await rename(item.backup, item.target);
        await syncFile(item.target);
      }
      await syncDirectory(path.dirname(item.target));
    }
    return;
  }
  for (const change of [...(journal.changes ?? [])].reverse()) {
    if (change.destination) {
      const destPath = path.join(root, change.destination);
      await rm(destPath, { force: true }).catch(() => {});
      const backup = path.join(stageRoot, ".backup", change.spec, change.document);
      const backupStat = await lstatOrNull(backup);
      if (backupStat?.isFile()) {
        const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
        if (checked.ok) {
          await mkdir(path.dirname(checked.absolute), { recursive: true });
          await rename(backup, checked.absolute);
        }
      }
      continue;
    }
    const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
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

export async function recoverInterruptedTransactions(root, lockPath, lockMetadata) {
  const stagingParent = path.join(root, ".specs", STAGING_DIRECTORY);
  const stagingStat = await lstatOrNull(stagingParent);
  if (stagingStat && (stagingStat.isSymbolicLink() || !stagingStat.isDirectory())) throw Object.assign(new Error("transaction staging parent is not a regular directory"), { code: "RECOVERY_REQUIRED" });
  if (stagingStat) {
    const entries = await readdir(stagingParent, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === RECEIPTS_DIRECTORY) {
        // Receipts are retained alongside transaction journals and are not a
        // transaction to roll back. Validate the reserved entry before skipping.
        const receiptStat = await lstat(path.join(stagingParent, entry.name));
        if (receiptStat.isSymbolicLink() || !receiptStat.isDirectory()) throw recoveryRequired("migration receipt directory is unsafe");
        continue;
      }
      if (entry.isSymbolicLink() || !entry.isDirectory()) throw Object.assign(new Error("transaction staging contains an unsafe entry"), { code: "RECOVERY_REQUIRED" });
      const stageRoot = path.join(stagingParent, entry.name);
      const journalPath = path.join(stageRoot, "transaction.json");
      let journal;
      try {
        journal = JSON.parse(await readFile(journalPath, "utf8"));
      } catch (error) {
        throw Object.assign(new Error(`transaction journal is unreadable: ${error.message}`), { code: "RECOVERY_REQUIRED" });
      }
      const completedMigration = journal?.phase === "committed" && journal?.durableReceipt;
      if (journal?.schema !== "omp-spec-kit-authoring-transaction@1" ||
          (lockMetadata && journal.requestId !== lockMetadata.requestId && !completedMigration) ||
          !requestIdWithinBounds(journal.requestId) || entry.name !== stagingName(journal.requestId) || !Array.isArray(journal.changes)) {
        throw Object.assign(new Error("transaction journal identity is invalid"), { code: "RECOVERY_REQUIRED" });
      }
      if (journal.durableReceipt && (!validMigrationReceipt(journal.durableReceipt, journal.requestId) ||
          canonicalJson(journal.durableReceipt.changes) !== canonicalJson(journal.changes))) {
        throw recoveryRequired("migration journal and receipt do not describe the same operation");
      }
      if (journal.phase === "committed" && journal.durableReceipt) {
        if (!(await committedGenerationValid(root, journal))) throw recoveryRequired("committed migration generation cannot be proved");
        await persistMigrationReceipt(root, stageRoot, journal.durableReceipt);
      } else if (journal.phase !== "committed" || !(await committedGenerationValid(root, journal))) {
        await rollbackInterruptedGeneration(root, stageRoot, journal);
      }
      await rm(stageRoot, REMOVE_TREE_OPTIONS);
    }
    await rmdir(stagingParent).catch(() => {});
  }
  if (lockPath) {
    await rm(lockPath, { force: true });
  }
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
      // Only one restarted process may examine and recover a stale generation.
      // A stranded recovery lease is deliberately fail-closed; it is not proof
      // that another process finished restoring the files.
      const recoveryLockPath = `${lockPath}.recovery`;
      let recoveryLease;
      try { recoveryLease = await open(recoveryLockPath, "wx"); }
      catch (cause) {
        if (cause?.code === "EEXIST") throw recoveryRequired("another recovery owns the specification recovery lease");
        throw cause;
      }
      try {
        let current;
        try { current = JSON.parse(await readFile(lockPath, "utf8")); }
        catch (cause) { if (cause?.code === "ENOENT") continue; throw recoveryRequired("stale write lock identity is unreadable"); }
        if (!current || processAlive(current.pid)) throw Object.assign(new Error("another specification transaction owns the write lock"), { code: "CONFLICT" });
        await recoverInterruptedTransactions(root, lockPath, current);
      } finally {
        await recoveryLease.close();
        await rm(recoveryLockPath, { force: true });
      }
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
  try {
    // Recover a committed journal left by an interrupted cleanup even when a
    // prior process released its lock after reporting an infrastructure error.
    await recoverInterruptedTransactions(root, null, null);
  } catch (error) {
    await handle.close();
    await rm(lockPath, { force: true });
    throw error;
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

function injectFault(options, point) {
  if (typeof options?.faultInjector === "function") options.faultInjector(point);
  if (options?.faultAt === point) {
    const error = new Error(`deterministic transaction fault at ${point}`);
    error.code = "INTERNAL_ERROR";
    throw error;
  }
}

export function migrationReceiptChanges(changes) {
  return changes.map((change) => ({
    spec: change.spec,
    document: change.document,
    beforeSha256: change.beforeBytes === undefined ? null : sha256(change.beforeBytes),
    beforeMissing: change.beforeMissing === true,
    afterSha256: sha256(change.afterBytes),
    deleteAfter: change.deleteAfter === true,
    migrationLegacy: change.migrationLegacy === true,
    destination: change.destination ?? null,
    destinationSha256: change.destination ? sha256(change.beforeBytes) : null,
  }));
}

/** Commit a complete set of changed document bytes with rollback on failure. */
export async function commitDocuments(root, requestId, changes, options = {}) {
  if (!Array.isArray(changes) || changes.length === 0) throw Object.assign(new Error("transaction needs at least one document"), { code: "INVALID_REQUEST" });
  for (const change of changes) {
    if (change.migrationLegacy === true && (!change.deleteAfter || !isLegacySpecificationDocument(change.document, change.spec))) {
      throw Object.assign(new Error("legacy documents may only be deleted by migration"), { code: "PATH_FORBIDDEN" });
    }
  }
  const stagingParent = path.join(root, ".specs", STAGING_DIRECTORY);
  const stageRoot = path.join(stagingParent, stagingName(requestId));
  const journalPath = path.join(stageRoot, "transaction.json");
  const backups = [];
  const installed = [];
  const journal = {
    schema: "omp-spec-kit-authoring-transaction@1",
    requestId,
    phase: "prepared",
    changes: migrationReceiptChanges(changes),
    installed: [],
    ...(options.durableMigrationReceipt ? { durableReceipt: options.durableMigrationReceipt } : {}),
  };
  if (journal.durableReceipt && (!validMigrationReceipt(journal.durableReceipt, requestId) ||
      canonicalJson(journal.durableReceipt.changes) !== canonicalJson(journal.changes))) {
    throw recoveryRequired("migration receipt and transaction differ");
  }

  try {
    const firstSpec = changes[0].spec;
    const rootCheck = await inspectAuthoringTarget(root, firstSpec, changes[0].document, { allowMissing: true, allowLegacy: changes[0].migrationLegacy === true });
    if (!rootCheck.ok) throw Object.assign(new Error(rootCheck.message), { code: rootCheck.code });
    let stagingStat = await tryStat(stagingParent);
    if (stagingStat && (stagingStat.isSymbolicLink() || !stagingStat.isDirectory())) throw Object.assign(new Error("transaction staging parent must be a regular directory"), { code: "PATH_FORBIDDEN" });
    let stageStat = await tryStat(stageRoot);
    if (stageStat) throw Object.assign(new Error("transaction staging directory already exists"), { code: "CONFLICT" });
    await mkdir(stageRoot, { recursive: true });
    await writeJournal(journalPath, journal);

    // Phase 1: Staging files
    for (const change of changes) {
      if (change.destination) {
        const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
        if (!checked.ok || checked.missing) throw Object.assign(new Error(checked.message ?? "document not found"), { code: checked.code ?? "DOC_NOT_FOUND" });
        const sourceBytes = await readFile(checked.absolute);
        const stageDestDir = path.join(stageRoot, "dest", path.dirname(change.destination));
        await mkdir(stageDestDir, { recursive: true });
        const stageDestPath = path.join(stageDestDir, path.basename(change.destination));
        await writeFile(stageDestPath, sourceBytes);
        await syncFile(stageDestPath);
        continue;
      }
      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
      const stageSpecDir = path.join(stageRoot, change.spec);
      await mkdir(stageSpecDir, { recursive: true });
      const stagePath = path.join(stageSpecDir, change.document);
      await writeFile(stagePath, change.afterBytes);
      await syncFile(stagePath);
      await syncDirectory(stageSpecDir);
    }
    await syncDirectory(stageRoot);
    journal.phase = "ready";
    await writeJournal(journalPath, journal);
    injectFault(options, "after-staging");

    // Phase 2: Installing/Swapping
    injectFault(options, "before-swap");
    for (const change of changes) {
      if (change.destination) {
        const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
        if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
        const sourcePath = checked.absolute;
        const destPath = path.join(root, change.destination);
        const backup = path.join(stageRoot, ".backup", change.spec, change.document);
        await mkdir(path.dirname(backup), { recursive: true });
        await rename(sourcePath, backup);
        await syncFile(backup);
        const originalBytes = await readFile(backup);
        backups.push({ target: sourcePath, backup, spec: change.spec, document: change.document, beforeSha256: sha256(originalBytes) });
        injectFault(options, "during-swap");

        const stageDestPath = path.join(stageRoot, "dest", path.dirname(change.destination), path.basename(change.destination));
        await mkdir(path.dirname(destPath), { recursive: true });
        await rename(stageDestPath, destPath);
        await syncFile(destPath);
        await syncDirectory(path.dirname(destPath));
        installed.push({ target: destPath, isArchiveDest: true });
        injectFault(options, "after-install");
        continue;
      }

      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
      const target = checked.absolute;
      const stagePath = path.join(stageRoot, change.spec, change.document);
      const existing = await tryStat(target);
      const backup = path.join(stageRoot, ".backup", change.spec, change.document);
      if (existing?.isSymbolicLink() || (existing && !existing.isFile())) throw Object.assign(new Error("target document must be a regular file"), { code: "PATH_FORBIDDEN" });
      if (existing?.isFile()) {
        const originalBytes = await readFile(target);
        await mkdir(path.dirname(backup), { recursive: true });
        await rename(target, backup);
        await syncDirectory(path.dirname(target));
        await syncFile(backup);
        backups.push({ target, backup, spec: change.spec, document: change.document, beforeSha256: sha256(originalBytes) });
        injectFault(options, "during-swap");
      }
      await mkdir(path.dirname(target), { recursive: true });
      if (change.deleteAfter) {
        // Document deleted: backup already holds the prior file
      } else {
        await rename(stagePath, target);
        await syncFile(target);
        await syncDirectory(path.dirname(target));
      }
      installed.push({ target, spec: change.spec, document: change.document });
      journal.installed.push({ spec: change.spec, document: change.document, deleteAfter: change.deleteAfter === true });
      journal.phase = "installing";
      await writeJournal(journalPath, journal);
      injectFault(options, "after-install");
    }

    // Phase 3: Post-installation verification before commit
    injectFault(options, "before-commit");
    for (const change of changes) {
      if (change.destination) {
        const destPath = path.join(root, change.destination);
        const destStat = await lstatOrNull(destPath);
        if (!destStat || !destStat.isFile()) {
          throw Object.assign(new Error(`destination verification failed for ${change.destination}`), { code: "WRITE_FAILED" });
        }
        continue;
      }
      const checked = await inspectAuthoringTarget(root, change.spec, change.document, { allowMissing: true, allowLegacy: change.migrationLegacy === true });
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code });
      if (change.deleteAfter) {
        if (!checked.missing) throw Object.assign(new Error("deleted document remained after installation"), { code: "WRITE_FAILED" });
      } else {
        if (checked.missing) throw Object.assign(new Error("installed document missing"), { code: "WRITE_FAILED" });
        const bytes = await readFile(checked.absolute);
        if (sha256(bytes) !== sha256(change.afterBytes)) throw Object.assign(new Error("installed document hash mismatch"), { code: "WRITE_FAILED" });
      }
    }

    // Commit
    journal.phase = "committed";
    await writeJournal(journalPath, journal);
    await syncDirectory(path.dirname(stageRoot));
    if (journal.durableReceipt) {
      injectFault(options, "after-commit-before-receipt");
      await persistMigrationReceipt(root, stageRoot, journal.durableReceipt);
    }

    // If archiving, remove empty source spec directory
    for (const change of changes) {
      if (change.destination) {
        const specDir = path.join(root, ".specs", change.spec);
        await rm(specDir, { recursive: true, force: true }).catch(() => {});
        break;
      }
    }

    injectFault(options, "during-cleanup");
    await rm(stageRoot, REMOVE_TREE_OPTIONS);
    await rmdir(stagingParent).catch(() => {});
    return { ok: true };
  } catch (error) {
    // A committed migration may already have published its durable receipt.
    // Never roll it back after that point: retain the journal for recovery.
    if (journal.durableReceipt && journal.phase === "committed") {
      const failure = recoveryRequired("migration commit requires journal recovery");
      failure.cause = error;
      throw failure;
    }
    let rollbackError;
    try {
      injectFault(options, "during-rollback");
      for (const inst of installed) {
        if (inst.isArchiveDest) {
          await rm(inst.target, { force: true }).catch(() => {});
        } else {
          await rm(inst.target, { force: true }).catch(() => {});
        }
      }
      for (const backup of backups) {
        await mkdir(path.dirname(backup.target), { recursive: true });
        await rename(backup.backup, backup.target);
        await syncFile(backup.target);
        await syncDirectory(path.dirname(backup.target));
        // Verify restored bytes match beforeSha256
        const restoredBytes = await readFile(backup.target);
        if (sha256(restoredBytes) !== backup.beforeSha256) {
          throw new Error(`restored file hash mismatch on rollback: ${backup.target}`);
        }
      }
      await rm(stageRoot, REMOVE_TREE_OPTIONS);
      await rmdir(stagingParent).catch(() => {});
    } catch (restoreError) {
      rollbackError = restoreError;
    }

    if (rollbackError) {
      try {
        journal.phase = "rollback_failed";
        journal.rollbackError = rollbackError.message;
        await writeJournal(journalPath, journal);
      } catch {}
      const failure = new Error("transaction rollback could not prove a complete old generation: " + rollbackError.message);
      failure.code = "ROLLBACK_FAILED";
      failure.retryable = true;
      failure.cause = rollbackError;
      throw failure;
    }
    throw error;
  }
}

async function isLockedByOther(lockPath) {
  const stat = await tryStat(lockPath);
  if (!stat) return false;
  try {
    const text = await readFile(lockPath, "utf8");
    const meta = JSON.parse(text);
    if (meta?.pid === process.pid) return false;
    return processAlive(meta?.pid);
  } catch {
    return true;
  }
}

/** Consistent reader of repository specifications. */
export async function readConsistentRepositorySpecs({ root, maxRetries = 5 } = {}) {
  const stagingParent = path.join(root, ".specs", STAGING_DIRECTORY);
  const stagingStat = await tryStat(stagingParent);
  if (stagingStat?.isDirectory()) {
    try {
      const entries = await readdir(stagingParent, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const journalPath = path.join(stagingParent, entry.name, "transaction.json");
        const journalStat = await tryStat(journalPath);
        if (journalStat?.isFile()) {
          try {
            const journal = JSON.parse(await readFile(journalPath, "utf8"));
            if (journal?.phase && journal.phase !== "committed") {
              const err = new Error("transaction recovery is required before reading specification corpus");
              err.code = "RECOVERY_REQUIRED";
              err.retryable = true;
              return { error: err };
            }
          } catch {}
        }
      }
    } catch {}
  }

  const lockPath = path.join(root, ".specs", LOCK_FILE);
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    if (await isLockedByOther(lockPath)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    const snapA = await readRepositorySpecs({ root });
    if (snapA.error) return snapA;

    if (await isLockedByOther(lockPath)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    const snapB = await readRepositorySpecs({ root });
    if (snapB.error) return snapB;

    if (await isLockedByOther(lockPath)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    const filesA = [...snapA.files].sort((l, r) => l.path.localeCompare(r.path));
    const filesB = [...snapB.files].sort((l, r) => l.path.localeCompare(r.path));
    if (filesA.length === filesB.length) {
      let identical = true;
      for (let i = 0; i < filesA.length; i++) {
        if (filesA[i].path !== filesB[i].path || sha256(filesA[i].bytes) !== sha256(filesB[i].bytes)) {
          identical = false;
          break;
        }
      }
      if (identical) {
        return snapB;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const conflict = new Error("specification corpus changed concurrently during read; please retry");
  conflict.code = "CONCURRENT_READ";
  conflict.retryable = true;
  return { error: conflict };
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

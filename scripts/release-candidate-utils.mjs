import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const TAG_RE = /^v\d+\.\d+\.\d+$/;

export function fail(message) {
  throw new Error(`release-candidate: ${message}`);
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isSha256(value) {
  return typeof value === "string" && SHA256_RE.test(value);
}

export function isCommit(value) {
  return typeof value === "string" && COMMIT_RE.test(value);
}

export function assertTag(tag) {
  if (!TAG_RE.test(tag)) fail(`tag must match vMAJOR.MINOR.PATCH, got ${JSON.stringify(tag)}`);
  return tag;
}

export function assertCommit(commit) {
  if (!isCommit(commit)) fail(`commit must be 40 lowercase hexadecimal characters, got ${JSON.stringify(commit)}`);
  return commit;
}

export function parseArgs(argv, allowed) {
  const output = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.includes(flag)) fail(`unsupported argument ${JSON.stringify(flag)}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`argument ${flag} requires a value`);
    if (output[flag] !== undefined) fail(`argument ${flag} was supplied more than once`);
    output[flag] = value;
    index += 1;
  }
  return output;
}

export function relativeSafePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) fail(`${label} must be a non-empty relative path`);
  const normalized = value.split("\\").join("/");
  if (normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") fail(`${label} must not escape its parent`);
  return normalized;
}

export async function readStrictJson(filePath, label) {
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular file`);
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`${label} must be valid JSON: ${error.message}`);
  }
}

export async function collectRegularFiles(root) {
  const rows = [];
  async function visit(directory, relativeDirectory = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in candidate payload: ${relative}`);
      if (stats.isDirectory()) {
        await visit(absolute, relative);
        continue;
      }
      if (!stats.isFile()) fail(`non-regular candidate payload entry: ${relative}`);
      const bytes = await readFile(absolute);
      rows.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), mode: stats.mode & 0o777, absolute });
    }
  }
  await visit(root);
  return rows;
}

export function packageTreeDigest(files) {
  return sha256(
    Buffer.from(JSON.stringify(files.map(({ path: filePath, bytes, sha256: digest, mode }) => [filePath, mode, bytes, digest]))),
  );
}

function writeString(buffer, offset, length, value, label) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) fail(`${label} is too long for deterministic tar`);
  bytes.copy(buffer, offset);
}

function writeOctal(buffer, offset, length, value) {
  const encoded = Math.trunc(value).toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) fail(`tar field ${value} overflows ${length} bytes`);
  writeString(buffer, offset, length, `${encoded}\0`, "tar octal value");
}

function tarHeader(relativePath, bytes, mode) {
  const header = Buffer.alloc(512, 0);
  writeString(header, 0, 100, relativePath, "tar path");
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, bytes.length);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, 257, 6, "ustar\0", "tar magic");
  writeString(header, 263, 2, "00", "tar version");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const encoded = checksum.toString(8).padStart(6, "0");
  writeString(header, 148, 8, `${encoded}\0 `, "tar checksum");
  return header;
}

export async function createDeterministicTar(files) {
  const chunks = [];
  for (const file of files) {
    const bytes = await readFile(file.absolute);
    chunks.push(tarHeader(file.path, bytes, file.mode), bytes);
    const padding = (512 - (bytes.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

export function candidateDigest(candidateWithoutDigest) {
  return sha256(Buffer.from(canonicalJson(candidateWithoutDigest)));
}

export function toPublicFileRows(files) {
  return files.map(({ path: filePath, bytes, sha256: digest, mode }) => ({ path: filePath, mode, bytes, sha256: digest }));
}

export function assertCandidateShape(candidate, label) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) fail(`${label} must be an object`);
  const required = ["schema", "version", "tag", "commit", "packageTreeDigest", "archive", "files", "candidateDigest"];
  const actual = Object.keys(candidate).sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required.sort()[index])) {
    fail(`${label} has unexpected fields`);
  }
  if (candidate.schema !== "omp-spec-kit-release-candidate@1") fail(`${label} schema mismatch`);
  assertTag(candidate.tag);
  if (candidate.version !== candidate.tag.slice(1)) fail(`${label} version/tag mismatch`);
  assertCommit(candidate.commit);
  if (!isSha256(candidate.packageTreeDigest) || !isSha256(candidate.candidateDigest)) fail(`${label} digest field invalid`);
  if (!candidate.archive || typeof candidate.archive !== "object" || Array.isArray(candidate.archive)) fail(`${label} archive invalid`);
  if (!Object.hasOwn(candidate.archive, "file") || !Object.hasOwn(candidate.archive, "sha256") || !Object.hasOwn(candidate.archive, "bytes")) {
    fail(`${label} archive fields invalid`);
  }
  if (path.basename(candidate.archive.file) !== candidate.archive.file || !isSha256(candidate.archive.sha256) || !Number.isInteger(candidate.archive.bytes) || candidate.archive.bytes < 0) {
    fail(`${label} archive identity invalid`);
  }
  if (!Array.isArray(candidate.files) || candidate.files.length === 0) fail(`${label} files must be non-empty`);
  const seen = new Set();
  for (const file of candidate.files) {
    if (
      !file ||
      typeof file !== "object" ||
      !relativeSafePath(file.path, `${label} file path`) ||
      !Number.isInteger(file.mode) ||
      file.mode < 0 ||
      file.mode > 0o777 ||
      !Number.isInteger(file.bytes) ||
      file.bytes < 0 ||
      !isSha256(file.sha256)
    ) {
      fail(`${label} file row invalid`);
    }
    if (seen.has(file.path)) fail(`${label} file paths must be unique`);
    seen.add(file.path);
  }
  const lexical = [...candidate.files].map((file) => file.path).sort((left, right) => left.localeCompare(right));
  if (candidate.files.some((file, index) => file.path !== lexical[index])) fail(`${label} files must be lexical`);
  const { candidateDigest: suppliedDigest, ...withoutDigest } = candidate;
  if (candidateDigest(withoutDigest) !== suppliedDigest) fail(`${label} candidate digest mismatch`);
  if (packageTreeDigest(candidate.files) !== candidate.packageTreeDigest) fail(`${label} package tree digest mismatch`);
  return candidate;
}

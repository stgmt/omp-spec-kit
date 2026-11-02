/**
 * Stamp for every directory an installer owns.
 *
 * A copy on a host is otherwise indistinguishable from a current one: the
 * version it reports lives inside the copy, so a stale copy keeps answering
 * with its own old number and nothing notices. The stamp records what was
 * written and a digest of the bytes, so "is this copy stale" becomes a
 * comparison of two files instead of a guess.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const STAMP_FILE = ".installed.json";
export const STAMP_SCHEMA = "omp-spec-kit/install-stamp@1";

function walk(root, directory = root, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (relative === STAMP_FILE) continue;
    if (entry.isDirectory()) walk(root, absolute, found);
    else if (entry.isFile()) found.push(relative);
  }
  return found;
}

/** Content hash of a directory, independent of file timestamps and order. */
export function treeDigest(root) {
  if (!existsSync(root)) return null;
  const hash = createHash("sha256");
  for (const relative of walk(root)) {
    hash.update(relative);
    hash.update("\u0000");
    hash.update(readFileSync(path.join(root, relative)));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

export function readStamp(root) {
  const target = path.join(root, STAMP_FILE);
  if (!existsSync(target)) return null;
  try {
    const value = JSON.parse(readFileSync(target, "utf8"));
    return value?.schema === STAMP_SCHEMA ? value : null;
  } catch {
    return null;
  }
}

export function writeStamp(root, { version, source }) {
  const stamp = {
    schema: STAMP_SCHEMA,
    version,
    source,
    installedAt: new Date().toISOString(),
    digest: treeDigest(root),
  };
  writeFileSync(path.join(root, STAMP_FILE), `${JSON.stringify(stamp, null, 2)}\n`);
  return stamp;
}

/**
 * Compare one installed copy against the version this repository serves.
 * `edits` reports bytes that changed since the install without a version
 * change, which is what a half-applied upgrade looks like.
 */
export function inspectCopy(root, expectedVersion) {
  const stamp = readStamp(root);
  const current = treeDigest(root);
  if (stamp === null) {
    return { root, state: current === null ? "missing" : "unstamped", stamp: null, version: null, edits: false };
  }
  const stale = stamp.version !== expectedVersion;
  const edits = stamp.digest !== current;
  return {
    root,
    state: stale ? "stale" : edits ? "edited" : "current",
    stamp,
    version: stamp.version,
    edits,
  };
}

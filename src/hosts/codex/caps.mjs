/**
 * Codex PreToolUse capability detection.
 *
 * Codex honors PreToolUse `permissionDecision:"allow"` together with
 * `updatedInput` (input replacement) and `additionalContext` from
 * `codex-cli 0.141.0`. Older builds ignore those fields, so a hook that needs
 * to attach the session project must fail closed there instead of letting an
 * unchanged call through.
 *
 * Detection parses `codex --version` and compares it with the first verified
 * release. Any failure → false → the caller denies.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** First Codex release verified to honor PreToolUse allow+updatedInput. */
export const MIN_REWRITE_VERSION = Object.freeze([0, 141, 0]);

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_FILE = "omp-spec-kit-codex-caps.json";

/** Parse `codex-cli 0.141.0` → [0, 141, 0]. */
export function parseCodexVersion(raw) {
  const text = String(raw ?? "");
  const isDigit = (character) => character >= "0" && character <= "9";
  for (let index = 0; index < text.length; index += 1) {
    let cursor = index;
    const parts = [];
    while (parts.length < 3) {
      const start = cursor;
      while (cursor < text.length && isDigit(text[cursor])) cursor += 1;
      if (cursor === start) break;
      parts.push(Number(text.slice(start, cursor)));
      if (parts.length < 3) {
        if (text[cursor] !== ".") break;
        cursor += 1;
      }
    }
    if (parts.length === 3) return parts;
  }
  return null;
}

/** Semantic >= over [major, minor, patch]. */
export function versionGte(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

function defaultRunVersion() {
  const options = { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true };
  // On Windows `codex` is a .cmd shim that execFile cannot launch directly.
  return process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", "codex --version"], options)
    : execFileSync("codex", ["--version"], options);
}

/**
 * Whether the running Codex honors PreToolUse allow+updatedInput.
 * Fails closed (false) on any error.
 */
export function codexSupportsUpdatedInput(io = {}) {
  const now = io.now ?? Date.now;
  const cachePath = io.cachePath ?? path.join(tmpdir(), CACHE_FILE);
  const runVersion = io.runVersion ?? defaultRunVersion;

  try {
    const cached = JSON.parse(readFileSync(cachePath, "utf8"));
    if (cached && typeof cached.at === "number" && now() - cached.at < CACHE_TTL_MS) {
      return cached.supported === true;
    }
  } catch {
    // cache miss or corrupt — re-detect below
  }

  let supported = false;
  try {
    const version = parseCodexVersion(runVersion());
    supported = version === null ? false : versionGte(version, MIN_REWRITE_VERSION);
  } catch {
    supported = false;
  }

  try {
    writeFileSync(cachePath, JSON.stringify({ at: now(), supported }));
  } catch {
    // best effort
  }

  return supported;
}

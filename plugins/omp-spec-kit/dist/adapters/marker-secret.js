/**
 * Marker-signing secret shared by the service-side projection and the manual
 * spec-graph-sync / writeback listener paths. Both sides must resolve to the
 * same value or the committed-snapshot signature never verifies — writeback
 * then refuses every card and the sweep silently applies nothing.
 *
 * Resolution order:
 *   1. SPEC_SYNC_MARKER_KEY (>= 32 chars) — explicit, wins everywhere;
 *   2. the persisted key file (~/.omp/spec-sync-marker-key, or filePath) —
 *      also lets an operator align a service deployment with an existing
 *      listener by mounting the same file;
 *   3. derived from the service secrets key — deterministic across restarts,
 *      so the service survives container rebuilds without a mounted file;
 *   4. generated and persisted (allowGenerate) — the script/listener default;
 *   5. publicly derivable fallback — loud warning, since a predictable secret
 *      defeats the signature's purpose (forged cardIds ownership could drive
 *      deletions/writeback under a shared-secret deployment).
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { digest } from "./youtrack-projection.js";

export const MARKER_KEY_PATH = path.join(homedir(), ".omp", "spec-sync-marker-key");
export const MARKER_SECRET_MIN_LENGTH = 32;

export function resolveMarkerSecret({
  env = process.env,
  secretsKey = null,
  filePath = MARKER_KEY_PATH,
  allowGenerate = false,
  logger = () => {},
} = {}) {
  const fromEnv = env.SPEC_SYNC_MARKER_KEY;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    if (fromEnv.length >= MARKER_SECRET_MIN_LENGTH) return fromEnv;
    // A set-but-short key must fail closed: silently falling through would
    // resolve the service to the secretsKey-derived value while the listener
    // generates a random one — the sides then diverge with zero diagnostics.
    throw new Error(
      `SPEC_SYNC_MARKER_KEY is set but only ${fromEnv.length} chars (need >= ${MARKER_SECRET_MIN_LENGTH}) — ` +
        "refusing to fall back silently; unset it or provide a full-length key",
    );
  }
  let existing = null;
  try {
    existing = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    // Only "file absent" may fall through — an unreadable but present key
    // file (EACCES/EISDIR) is a misconfigured deployment, and silently
    // resolving to a different secret is the divergence this module prevents.
    if (error?.code !== "ENOENT") {
      throw new Error(`marker key file ${filePath} exists but cannot be read: ${error?.message ?? error}`);
    }
  }
  if (typeof existing === "string" && existing.length > 0) {
    if (existing.length >= MARKER_SECRET_MIN_LENGTH) return existing;
    // Same hazard as a short env key: a truncated mounted file must fail
    // closed, not silently resolve to a secret no other party shares.
    throw new Error(
      `marker key file ${filePath} is present but only ${existing.length} chars (need >= ${MARKER_SECRET_MIN_LENGTH}) — ` +
        "refusing to fall back silently; fix or delete the file",
    );
  }
  if (typeof secretsKey === "string" && secretsKey.length > 0) {
    return digest("projection-marker:" + secretsKey);
  }
  if (allowGenerate) {
    const generated = randomBytes(24).toString("hex");
    mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    writeFileSync(filePath, generated + "\n", { mode: 0o600 });
    return generated;
  }
  logger(
    "marker secret falls back to a publicly derivable value — set SPEC_SYNC_MARKER_KEY " +
      "(or SPEC_REGISTRY_SECRETS_KEY) so tracker-side edits cannot forge marker ownership",
  );
  return digest("projection-marker:unkeyed");
}

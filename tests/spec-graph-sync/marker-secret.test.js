import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveMarkerSecret } from "../../src/adapters/marker-secret.js";
import { digest } from "../../src/adapters/youtrack-projection.js";

const ENV_KEY = "e".repeat(40);
const FILE_KEY = "f".repeat(40);

function withDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "marker-secret-"));
  try {
    return fn(path.join(dir, "spec-sync-marker-key"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("resolveMarkerSecret", () => {
  it("prefers SPEC_SYNC_MARKER_KEY over the file and the derived value", () =>
    withDir((filePath) => {
      writeFileSync(filePath, FILE_KEY + "\n");
      const secret = resolveMarkerSecret({ env: { SPEC_SYNC_MARKER_KEY: ENV_KEY }, secretsKey: "sk", filePath });
      assert.equal(secret, ENV_KEY);
    }));

  it("falls back to the persisted key file", () =>
    withDir((filePath) => {
      writeFileSync(filePath, FILE_KEY + "\n");
      const secret = resolveMarkerSecret({ env: {}, secretsKey: "sk", filePath });
      assert.equal(secret, FILE_KEY);
    }));

  it("derives from the service secrets key before generating", () =>
    withDir((filePath) => {
      const secret = resolveMarkerSecret({ env: {}, secretsKey: "sk", filePath, allowGenerate: true });
      assert.equal(secret, digest("projection-marker:sk"));
      assert.equal(existsSync(filePath), false, "no throwaway file when the derived secret wins");
    }));

  it("generates and persists a key when allowed (script default)", () =>
    withDir((filePath) => {
      const first = resolveMarkerSecret({ env: {}, filePath, allowGenerate: true });
      assert.equal(existsSync(filePath), true);
      assert.equal(readFileSync(filePath, "utf8").trim(), first);
      const second = resolveMarkerSecret({ env: {}, filePath, allowGenerate: true });
      assert.equal(second, first, "the persisted key is reused across runs");
    }));

  it("warns loudly and returns the derivable fallback when nothing is configured", () =>
    withDir((filePath) => {
      const logs = [];
      const secret = resolveMarkerSecret({ env: {}, filePath, logger: (m) => logs.push(m) });
      assert.equal(secret, digest("projection-marker:unkeyed"));
      assert.equal(logs.length, 1, "the weak fallback is announced, not silent");
      assert.match(logs[0], /SPEC_SYNC_MARKER_KEY/);
    }));

  it("fails closed on a set-but-short env key (service and listener would diverge silently)", () =>
    withDir((filePath) => {
      writeFileSync(filePath, FILE_KEY + "\n");
      assert.throws(
        () => resolveMarkerSecret({ env: { SPEC_SYNC_MARKER_KEY: "short" }, secretsKey: "sk", filePath }),
        /SPEC_SYNC_MARKER_KEY is set but only 5 chars/,
      );
    }));

  it("an empty env value is treated as unset (compose :? semantics)", () =>
    withDir((filePath) => {
      const secret = resolveMarkerSecret({ env: { SPEC_SYNC_MARKER_KEY: "" }, secretsKey: "sk", filePath });
      assert.equal(secret, digest("projection-marker:sk"));
    }));

  it("fails closed on a present-but-short key file (same divergence hazard as env)", () =>
    withDir((filePath) => {
      writeFileSync(filePath, "truncated-key\n");
      assert.throws(
        () => resolveMarkerSecret({ env: {}, secretsKey: "sk", filePath }),
        /present but only 13 chars/,
      );
    }));

  it("an empty key file is treated as absent", () =>
    withDir((filePath) => {
      writeFileSync(filePath, "\n");
      const secret = resolveMarkerSecret({ env: {}, secretsKey: "sk", filePath });
      assert.equal(secret, digest("projection-marker:sk"));
    }));

  it("throws on a key-file read error other than ENOENT (unreadable path, not absent)", () =>
    withDir((filePath) => {
      // A directory at the key path fails reads with EISDIR/EPERM — not
      // "no file": the deployment mounted the key wrongly and silently
      // deriving a different secret would diverge from the listener.
      mkdirSync(filePath);
      assert.throws(
        () => resolveMarkerSecret({ env: {}, secretsKey: "sk", filePath }),
        /exists but cannot be read/,
      );
    }));
});

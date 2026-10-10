import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function testUnitTokens() {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return (manifest.scripts["test:unit"] ?? "").split(/\s+/).filter(Boolean);
}

describe("test:unit registration guards", () => {
  // Mutual guard with tests/deploy-dockerignore.test.mjs: this file asserts
  // that file's registration, that file asserts this one — removing either
  // token from test:unit trips the surviving guard.
  for (const registered of [
    "tests/deploy-dockerignore.test.mjs",
  ]) {
    it(`${registered} runs under test:unit exactly once and exists on disk`, () => {
      const hits = testUnitTokens().filter((token) => token === registered);
      assert.equal(hits.length, 1, `${registered} must be listed in test:unit`);
      assert.ok(existsSync(path.join(ROOT, registered)), `${registered} missing on disk`);
    });
  }
});

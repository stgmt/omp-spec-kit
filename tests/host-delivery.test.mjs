import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { auditCodexEntry, auditEntry } from "../scripts/host-delivery.mjs";
import { inspectCopy, readStamp, writeStamp } from "../scripts/install-stamp.mjs";
import { checkVersions, setVersion } from "../scripts/version.mjs";

const scratch = [];
function scratchRoot(name) {
  const root = mkdtempSync(path.join(tmpdir(), `omp-spec-kit-${name}-`));
  scratch.push(root);
  return root;
}

after(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

describe("MCP entry audit", () => {
  const url = "http://127.0.0.1:8650/mcp";

  it("accepts an entry that references the environment", () => {
    const entry = { type: "http", url, headers: { Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}" } };
    assert.deepEqual(auditEntry(entry, { url }), []);
  });

  it("accepts a url that points at the environment variable", () => {
    const entry = { type: "http", url: "${OMP_SPEC_REGISTRY_URL}", headers: { Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}" } };
    assert.deepEqual(auditEntry(entry, { url }), []);
  });

  it("reports a literal bearer token", () => {
    const entry = { url, headers: { Authorization: "Bearer perm-YWRtaW4=.NDItMw==.4GaC0NcO8TJh9aIsMmRVatesn78FKb" } };
    assert.match(auditEntry(entry, { url }).join(";"), /embeds a literal token/u);
  });

  it("reports the removed project header", () => {
    const entry = {
      url,
      headers: { Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}", "X-Spec-Project": "stgmt/omp-spec-kit" },
    };
    assert.match(auditEntry(entry, { url }).join(";"), /removed X-Spec-Project header/u);
  });

  it("reports a missing entry and a url mismatch", () => {
    assert.deepEqual(auditEntry(undefined, { url }), ["no entry"]);
    assert.match(auditEntry({ url: "http://elsewhere:8650/mcp" }, { url }).join(";"), /url is/u);
  });

  it("reports a stdio entry as not being an HTTP endpoint", () => {
    assert.match(auditEntry({ command: "node", args: ["server.mjs"] }, { url }).join(";"), /launches a command/u);
  });

  it("checks the Codex TOML table the same way", () => {
    assert.deepEqual(
      auditCodexEntry({ url: `"${url}"`, bearer_token_env_var: '"OMP_SPEC_REGISTRY_TOKEN"', http_headers: "-" }, { url }),
      [],
    );
    const wrong = auditCodexEntry({ url: `"${url}"`, bearer_token_env_var: '"OTHER_TOKEN"' }, { url }).join(";");
    assert.match(wrong, /bearer_token_env_var/u);
  });

  it("rejects Codex headers that carry a token or the removed header", () => {
    const table = {
      url: `"${url}"`,
      bearer_token_env_var: '"OMP_SPEC_REGISTRY_TOKEN"',
      http_headers: '["Authorization" = "Bearer perm-YWRtaW4=.NDItMw==", "X-Spec-Project" = "a/b"]',
    };
    const problems = auditCodexEntry(table, { url }).join(";");
    assert.match(problems, /removed X-Spec-Project header/u);
    assert.match(problems, /embeds a literal token/u);
  });
});

describe("install stamp", () => {
  function copy(name, files) {
    const root = scratchRoot(name);
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(root, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    return root;
  }

  it("reads a current copy, a stale copy, and a missing one", () => {
    const root = copy("current", { "dist/adapters/plugin-version.js": 'export const PLUGIN_VERSION = "3.2.1";\n' });
    writeStamp(root, { version: "3.2.1", source: "repo" });
    assert.equal(inspectCopy(root, "3.2.1").state, "current");
    assert.equal(inspectCopy(root, "3.3.0").state, "stale");
    assert.equal(inspectCopy(path.join(root, "absent"), "3.2.1").state, "missing");
  });

  it("reports bytes that changed under an unchanged version", () => {
    const root = copy("edited", { "dist/a.js": "one\n" });
    writeStamp(root, { version: "3.2.1", source: "repo" });
    writeFileSync(path.join(root, "dist", "a.js"), "two\n");
    const inspected = inspectCopy(root, "3.2.1");
    assert.equal(inspected.state, "edited");
    assert.equal(inspected.edits, true);
  });

  it("treats a copy without a stamp as unstamped, not as current", () => {
    const root = copy("unstamped", { "dist/a.js": "one\n" });
    assert.equal(readStamp(root), null);
    assert.equal(inspectCopy(root, "3.2.1").state, "unstamped");
  });
});

describe("release version", () => {
  function repository(version) {
    const root = scratchRoot("version");
    const json = (file, value) => writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
    mkdirSync(path.join(root, "plugins", "omp-spec-kit", ".claude-plugin"), { recursive: true });
    mkdirSync(path.join(root, "src", "adapters"), { recursive: true });
    mkdirSync(path.join(root, "src", "v0.1"), { recursive: true });
    mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
    json("package.json", { name: "omp-spec-kit", version });
    json("plugins/omp-spec-kit/package.json", { name: "omp-spec-kit", version });
    json("plugins/omp-spec-kit/.claude-plugin/plugin.json", { name: "omp-spec-kit", version });
    json(".claude-plugin/marketplace.json", { metadata: { version }, plugins: [{ name: "omp-spec-kit", version }] });
    writeFileSync(path.join(root, "src", "adapters", "plugin-version.js"), `export const PLUGIN_VERSION = "${version}";\n`);
    writeFileSync(path.join(root, "src", "v0.1", "extension.js"), `export const PLUGIN_VERSION = "${version}";\n`);
    return root;
  }

  it("reports a copy that disagrees with the record", () => {
    const root = repository("3.2.1");
    writeFileSync(path.join(root, "src", "v0.1", "extension.js"), 'export const PLUGIN_VERSION = "3.2.0";\n');
    const result = checkVersions(root);
    assert.equal(result.ok, false);
    assert.equal(result.record, "3.2.1");
    assert.deepEqual(
      result.rows.filter((row) => !row.ok).map((row) => row.file),
      ["src/v0.1/extension.js"],
    );
  });

  it("writes every copy from one argument", () => {
    const root = repository("3.2.1");
    const result = setVersion("3.3.0", root);
    assert.equal(result.ok, true);
    assert.equal(result.record, "3.3.0");
    assert.equal(result.rows.length, 7);
    assert.ok(result.rows.every((row) => row.value === "3.3.0"));
  });

  it("refuses a version that is not a bare semver", () => {
    const root = repository("3.2.1");
    assert.throws(() => setVersion("v3.3.0", root), /bare semver/u);
  });
});

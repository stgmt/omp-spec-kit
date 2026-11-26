import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { auditCodexEntry, auditEntry, run as runHostDelivery } from "../scripts/host-delivery.mjs";
import { PLUGIN_VERSION } from "../src/adapters/plugin-version.js";
import { installerArguments } from "../scripts/lib/installer-arguments.mjs";
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

describe("installer arguments", () => {
  it("has one owner for the registry-target triple", () => {
    const options = { url: "http://127.0.0.1:8650/mcp", project: "acme/widgets", workspace: "/tmp/workspace" };
    assert.deepEqual(installerArguments(null, options), ["--url", options.url, "--project", options.project, "--workspace", options.workspace]);
    assert.deepEqual(installerArguments("claude", options), ["--host", "claude", "--url", options.url, "--project", options.project, "--workspace", options.workspace]);
  });
});

describe("Claude repair forwards the project scope", () => {
  const environmentKeys = ["HOME", "USERPROFILE", "PI_CONFIG_DIR", "PATH"];
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

  function fakeClaude(root) {
    const bin = path.join(root, "bin");
    mkdirSync(bin, { recursive: true });
    const marker = path.join(root, "updated.marker");
    const current = `[{"id":"omp-spec-kit@omp-spec-kit","version":"${PLUGIN_VERSION}"}]`;
    const stale = '[{"id":"omp-spec-kit@omp-spec-kit","version":"0.0.0"}]';
    if (process.platform === "win32") {
      writeFileSync(path.join(bin, "claude.cmd"), [
        "@echo off",
        `if "%~2"=="list" (if exist "${marker}" (echo ${current}) else (echo ${stale}))`,
        `if "%~2"=="update" echo.> "${marker}"`,
        "exit /b 0",
        "",
      ].join("\r\n"));
    } else {
      const shim = path.join(bin, "claude");
      writeFileSync(shim, `#!/bin/sh\nif [ "$2" = "list" ]; then\n  if [ -f "${marker}" ]; then echo '${current}'; else echo '${stale}'; fi\nelif [ "$2" = "update" ]; then : > "${marker}"; fi\nexit 0\n`);
      chmodSync(shim, 0o755);
    }
    return bin;
  }

  async function repairWith({ explicitProject, recordOnly }) {
    const root = scratchRoot("claude-repair");
    const workspace = path.join(root, "workspace");
    mkdirSync(workspace, { recursive: true });
    if (recordOnly) {
      mkdirSync(path.join(workspace, ".omp-spec-kit"), { recursive: true });
      writeFileSync(path.join(workspace, ".omp-spec-kit", "project.json"), '{"schema":"omp-spec-kit/project-binding@1","project":"acme/widgets"}\n');
      // The installer rewrites this config only after the project check passes;
      // a dropped resolved project leaves the stale endpoint untouched.
      writeFileSync(path.join(workspace, ".mcp.json"), '{"mcpServers":{"omp-spec-kit":{"type":"http","url":"http://127.0.0.1:1/stale"}}}\n');
    }
    process.env.HOME = root;
    process.env.USERPROFILE = root;
    process.env.PI_CONFIG_DIR = path.join(root, ".omp");
    process.env.PATH = `${fakeClaude(root)}${path.delimiter}${originalEnvironment.PATH ?? ""}`;
    const args = ["--fix", "--host", "claude", "--url", "http://127.0.0.1:8650/mcp", "--workspace", workspace];
    if (explicitProject) args.push("--project", "acme/widgets");
    const lines = [];
    await runHostDelivery(args, {}, (line) => lines.push(line));
    return { root, workspace, lines };
  }

  after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("passes an explicit --project through the Claude repair installer", async () => {
    const { workspace, lines } = await repairWith({ explicitProject: true, recordOnly: false });
    assert.ok(lines.some((line) => line.includes("repaired claude:")), lines.join("\n"));
    const record = JSON.parse(readFileSync(path.join(workspace, ".omp-spec-kit", "project.json"), "utf8"));
    assert.equal(record.project, "acme/widgets", lines.join("\n"));
  });

  it("resolves the project from the workspace record when --project is absent", async () => {
    const { workspace, lines } = await repairWith({ explicitProject: false, recordOnly: true });
    assert.ok(lines.some((line) => line.includes("repaired claude:")), lines.join("\n"));
    const config = JSON.parse(readFileSync(path.join(workspace, ".mcp.json"), "utf8"));
    assert.equal(config.mcpServers["omp-spec-kit"].url, "http://127.0.0.1:8650/mcp", lines.join("\n"));
  });
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

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Runs the real payload verifiers (scripts/verify-package.mjs and
// scripts/verify-marketplace.mjs) against a copy of the verified inputs. Each
// rejection test mutates one copied file and expects that verifier to fail with
// its own message. Requires a built dist (npm run build).
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const COPIED = ["scripts/verify-package.mjs", "scripts/verify-marketplace.mjs", "src", "plugins/omp-spec-kit", ".claude-plugin", "package.json", "LICENSE"];
const copies = [];

after(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

function copyRepository() {
  const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-verify-")));
  copies.push(dir);
  for (const entry of COPIED) {
    const target = path.join(dir, entry);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(repositoryRoot, entry), target, { recursive: true });
  }
  return dir;
}

function verify(dir, script) {
  return spawnSync(process.execPath, [path.join(dir, "scripts", script)], {
    cwd: dir,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
  });
}

function editJson(dir, relative, mutate) {
  const file = path.join(dir, relative);
  const value = JSON.parse(readFileSync(file, "utf8"));
  mutate(value);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertRejected(result, message) {
  assert.notEqual(result.status, 0, `verifier accepted a tampered tree; stdout=${result.stdout}`);
  assert.match(result.stderr, message);
}

describe("payload verifiers accept the untouched inputs", () => {
  it("passes verify-marketplace and verify-package on a copy", () => {
    const dir = copyRepository();
    assert.equal(verify(dir, "verify-marketplace.mjs").status, 0);
    assert.equal(verify(dir, "verify-package.mjs").status, 0);
  });
});

describe("marketplace catalog guards", () => {
  it("rejects the retired .omp-plugin catalog", () => {
    const dir = copyRepository();
    mkdirSync(path.join(dir, ".omp-plugin"), { recursive: true });
    cpSync(path.join(dir, ".claude-plugin", "marketplace.json"), path.join(dir, ".omp-plugin", "marketplace.json"));
    assertRejected(verify(dir, "verify-marketplace.mjs"), /is retired; \.claude-plugin\/marketplace\.json is the only catalog/u);
  });

  it("rejects a catalog anywhere other than .claude-plugin/marketplace.json", () => {
    const dir = copyRepository();
    renameSync(path.join(dir, ".claude-plugin", "marketplace.json"), path.join(dir, ".claude-plugin", "catalog.json"));
    assertRejected(verify(dir, "verify-marketplace.mjs"), /catalog layout must be exactly \.claude-plugin\/marketplace\.json/u);
  });
});

describe("payload verifier rejections", () => {
  it("rejects a retired bin launcher in the payload", () => {
    const dir = copyRepository();
    mkdirSync(path.join(dir, "plugins", "omp-spec-kit", "bin"), { recursive: true });
    writeFileSync(path.join(dir, "plugins", "omp-spec-kit", "bin", "omp-spec-kit-mcp"), "#!/bin/sh\n");
    assertRejected(verify(dir, "verify-package.mjs"), /payload (files|directories) must be exactly/u);
  });

  it("rejects a .mcp.json command other than node", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".mcp.json"), (value) => {
      value.mcpServers["omp-spec-kit"].command = "npx";
    });
    assertRejected(verify(dir, "verify-package.mjs"), /\.mcp\.json command must be "node"/u);
  });

  it("rejects a literal project root in place of the CLAUDE_PROJECT_DIR placeholder", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".mcp.json"), (value) => {
      value.mcpServers["omp-spec-kit"].env.OMP_SPEC_KIT_ROOT = "/abs/project";
    });
    assertRejected(verify(dir, "verify-package.mjs"), /env OMP_SPEC_KIT_ROOT must be exactly/u);
  });

  it("rejects extra .mcp.json args beyond the dist server path", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".mcp.json"), (value) => {
      value.mcpServers["omp-spec-kit"].args.push("--inspect");
    });
    assertRejected(verify(dir, "verify-package.mjs"), /\.mcp\.json args must be exactly/u);
  });

  it("rejects a .mcp.json server entry with an extra cwd key", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".mcp.json"), (value) => {
      value.mcpServers["omp-spec-kit"].cwd = ".";
    });
    assertRejected(verify(dir, "verify-package.mjs"), /\.mcp\.json omp-spec-kit entry fields must be exactly/u);
  });

  it("rejects a plugin.json that declares mcpServers", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".claude-plugin", "plugin.json"), (value) => {
      value.mcpServers = {};
    });
    assertRejected(verify(dir, "verify-package.mjs"), /plugin\.json fields must be exactly/u);
  });

  it("rejects a plugin.json version that differs from PLUGIN_VERSION", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", ".claude-plugin", "plugin.json"), (value) => {
      value.version = "2.8.1";
    });
    assertRejected(verify(dir, "verify-package.mjs"), /plugin\.json identity\/version mismatch/u);
  });

  it("rejects a hook timeout other than 10 seconds", () => {
    const dir = copyRepository();
    editJson(dir, path.join("plugins", "omp-spec-kit", "hooks", "hooks.json"), (value) => {
      value.hooks.PreToolUse[0].hooks[0].timeout = 11;
    });
    assertRejected(verify(dir, "verify-package.mjs"), /hooks\/hooks\.json hook must be a command with timeout 10/u);
  });

  it("rejects a hook entry that does not load the classifier", () => {
    const dir = copyRepository();
    const hook = path.join(dir, "plugins", "omp-spec-kit", "hooks", "pretooluse.mjs");
    writeFileSync(hook, readFileSync(hook, "utf8").replace('"../dist/enforcement/classifier.js"', '"../dist/enforcement/guard.js"'));
    assertRejected(verify(dir, "verify-package.mjs"), /hooks\/pretooluse\.mjs must load \.\.\/dist\/enforcement\/classifier\.js/u);
  });
});

describe("payload extension and hook import rejections", () => {
  it("rejects a dist extension that is stale against src/v0.1", () => {
    const dir = copyRepository();
    const dist = path.join(dir, "plugins", "omp-spec-kit", "dist", "extension.js");
    writeFileSync(dist, readFileSync(dist, "utf8").replace('export const PLUGIN_VERSION = "2.9.0";', 'export const PLUGIN_VERSION = "2.8.1";'));
    assertRejected(verify(dir, "verify-package.mjs"), /dist\/extension\.js is stale against src\/v0\.1\/extension\.js/u);
  });

  it("rejects a source-only PLUGIN_VERSION change to src/v0.1/extension.js", () => {
    const dir = copyRepository();
    const source = path.join(dir, "src", "v0.1", "extension.js");
    writeFileSync(source, readFileSync(source, "utf8").replace('export const PLUGIN_VERSION = "2.9.0";', 'export const PLUGIN_VERSION = "2.8.1";'));
    assertRejected(verify(dir, "verify-package.mjs"), /dist\/extension\.js is stale against src\/v0\.1\/extension\.js/u);
  });

  it("rejects an extension whose SCHEMA_VERSION is not 1 in both source and dist", () => {
    const dir = copyRepository();
    const source = path.join(dir, "src", "v0.1", "extension.js");
    const dist = path.join(dir, "plugins", "omp-spec-kit", "dist", "extension.js");
    const bumped = (text) => text.replace(/SCHEMA_VERSION = "1";/u, 'SCHEMA_VERSION = "9";');
    writeFileSync(source, bumped(readFileSync(source, "utf8")));
    writeFileSync(dist, bumped(readFileSync(dist, "utf8")));
    editJson(dir, path.join("plugins", "omp-spec-kit", "dist", "manifest.json"), (value) => {
      value.files["extension.js"].sha256 = createHash("sha256").update(readFileSync(dist)).digest("hex");
    });
    assertRejected(verify(dir, "verify-package.mjs"), /extension\.js does not embed exported SCHEMA_VERSION 1/u);
  });

  it("rejects a hook that imports a package outside node builtins", () => {
    const dir = copyRepository();
    const hook = path.join(dir, "plugins", "omp-spec-kit", "hooks", "normalize.mjs");
    writeFileSync(hook, `import zod from "zod";\n${readFileSync(hook, "utf8")}`);
    assertRejected(verify(dir, "verify-package.mjs"), /has forbidden runtime import: zod/u);
  });

  it("rejects a hook that imports the classifier directly", () => {
    const dir = copyRepository();
    const hook = path.join(dir, "plugins", "omp-spec-kit", "hooks", "normalize.mjs");
    writeFileSync(hook, `import "../dist/enforcement/classifier.js";\n${readFileSync(hook, "utf8")}`);
    assertRejected(verify(dir, "verify-package.mjs"), /has forbidden runtime import: \.\.\/dist\/enforcement\/classifier\.js/u);
  });
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Runs the tagged-candidate extractor against throwaway git repositories whose
// v9.9.9 tag carries one MCP declaration shape per case. Accepted shapes must
// extract the declared entrypoint; anything else must fail with the shape guard.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTRACTOR = path.join(repositoryRoot, "scripts", "lifecycle", "build-tagged-candidate.mjs");
const PLUGIN_ROOT_ENTRY = "${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js";
const TAGGED_SERVER = "// tagged server\n";
const directories = [];

after(() => {
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
});

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
}

// files maps package-relative paths to contents the tag provides but the dist
// manifest does not list, so only the fallback path can extract them. distFiles
// maps dist-relative paths the manifest does list, so the tree copy extracts them.
function taggedRepository(server, { files = {}, distFiles = {} } = {}) {
  const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-tagged-")));
  directories.push(dir);
  const pluginDir = path.join(dir, "plugins", "omp-spec-kit");
  mkdirSync(path.join(pluginDir, "dist", "mcp"), { recursive: true });
  writeFileSync(path.join(pluginDir, "package.json"), `${JSON.stringify({ name: "omp-spec-kit", version: "9.9.9" }, null, 2)}\n`);
  writeFileSync(path.join(pluginDir, "dist", "mcp", "server.js"), TAGGED_SERVER);
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(pluginDir, ...relative.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  for (const [relative, contents] of Object.entries(distFiles)) {
    const target = path.join(pluginDir, "dist", ...relative.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  const manifestFiles = Object.fromEntries(["mcp/server.js", ...Object.keys(distFiles)].map((name) => [name, {}]));
  writeFileSync(
    path.join(pluginDir, "dist", "manifest.json"),
    `${JSON.stringify({ schema: "omp-spec-kit-dist-manifest@1", pluginVersion: "9.9.9", files: manifestFiles }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(pluginDir, ".mcp.json"),
    `${JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "stdio", ...server } } }, null, 2)}\n`,
  );
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "tagged fixture"]);
  git(dir, ["tag", "v9.9.9"]);
  return dir;
}

function extract(repo) {
  const env = { ...process.env };
  delete env.OMP_SPEC_KIT_BDD_CONTAINER;
  for (const key of Object.keys(env)) if (key.startsWith("OMP_SPEC_KIT_TAGGED_COMMIT")) delete env[key];
  const output = path.join(repo, "out");
  const result = spawnSync(process.execPath, [EXTRACTOR, "--tag", "v9.9.9", "--output", output, "--repository-root", repo], {
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  return { result, output };
}

describe("tagged candidate accepts the declared MCP shapes", () => {
  it("extracts the current ${CLAUDE_PLUGIN_ROOT} entrypoint", () => {
    const { result, output } = extract(taggedRepository({ command: "node", args: [PLUGIN_ROOT_ENTRY], env: { OMP_SPEC_KIT_ROOT: "${CLAUDE_PROJECT_DIR}" } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(output, "dist", "mcp", "server.js"), "utf8"), TAGGED_SERVER);
    assert.equal(JSON.parse(result.stdout).schema, "omp-spec-kit-tagged-candidate-extraction@1");
  });

  it("extracts the historical node dist/mcp/server.js shape", () => {
    const { result, output } = extract(taggedRepository({ command: "node", args: ["dist/mcp/server.js"] }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(output, "dist", "mcp", "server.js"), "utf8"), TAGGED_SERVER);
  });
});

describe("tagged candidate bin launcher", () => {
  const LAUNCHER = "#!/bin/sh\necho tagged launcher\n";

  it("extracts a bin launcher the tag provides byte-for-byte", () => {
    const { result, output } = extract(taggedRepository({ command: "./bin/omp-spec-kit-mcp" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(output, "bin", "omp-spec-kit-mcp"), "utf8"), LAUNCHER);
  });

  it("makes the extracted bin launcher executable", { skip: process.platform === "win32" }, () => {
    const { result, output } = extract(taggedRepository({ command: "./bin/omp-spec-kit-mcp" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(path.join(output, "bin", "omp-spec-kit-mcp")).mode & 0o777, 0o755);
  });

  it("rejects a launcher command that names a different bin file", () => {
    const { result } = extract(taggedRepository({ command: "./bin/other-launcher" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER } }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported command shape/u);
  });
});

describe("tagged candidate fallback and Windows launcher", () => {
  const LAUNCHER = "#!/bin/sh\necho tagged launcher\n";
  const CMD_LAUNCHER = "@echo off\necho tagged cmd launcher\n";

  it("fails when the declared bin entrypoint is neither extracted nor provided by the tag", () => {
    const { result } = extract(taggedRepository({ command: "./bin/omp-spec-kit-mcp" }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing its declared entrypoint/u);
  });

  it("leaves a tag-provided entrypoint outside bin/ without the executable bit", { skip: process.platform === "win32" }, () => {
    const { result, output } = extract(taggedRepository({ command: "node", args: ["lib/server.js"] }, { files: { "lib/server.js": "// lib server\n" } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(path.join(output, "lib", "server.js")).mode & 0o111, 0);
  });

  it("extracts the Windows launcher the tag provides next to the POSIX launcher", () => {
    const { result, output } = extract(
      taggedRepository({ command: "./bin/omp-spec-kit-mcp" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER, "bin/omp-spec-kit-mcp.cmd": CMD_LAUNCHER } }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(output, "bin", "omp-spec-kit-mcp.cmd"), "utf8"), CMD_LAUNCHER);
  });

  it("extracts no Windows launcher when the tag provides only the POSIX launcher", () => {
    const { result, output } = extract(taggedRepository({ command: "./bin/omp-spec-kit-mcp" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(output, "bin", "omp-spec-kit-mcp.cmd")), false);
  });
});

describe("tagged candidate tree-copy modes", () => {
  const LAUNCHER = "#!/bin/sh\necho tagged launcher\n";
  const EXTRA = "// extra dist entry\n";

  it("keeps a manifest-listed dist entry non-executable under the node shape", { skip: process.platform === "win32" }, () => {
    const { result, output } = extract(taggedRepository({ command: "node", args: [PLUGIN_ROOT_ENTRY] }, { distFiles: { "extra.js": EXTRA } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(output, "dist", "extra.js"), "utf8"), EXTRA);
    assert.equal(statSync(path.join(output, "dist", "extra.js")).mode & 0o111, 0);
  });

  it("keeps a manifest-listed dist entry non-executable under the bin shape", { skip: process.platform === "win32" }, () => {
    const { result, output } = extract(
      taggedRepository({ command: "./bin/omp-spec-kit-mcp" }, { files: { "bin/omp-spec-kit-mcp": LAUNCHER }, distFiles: { "extra.js": EXTRA } }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(path.join(output, "dist", "extra.js")).mode & 0o111, 0);
  });
});

describe("tagged candidate rejects other MCP declaration shapes", () => {
  it("rejects a launcher other than node", () => {
    const { result } = extract(taggedRepository({ command: "npx", args: ["-y", "omp-spec-kit"] }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported command shape/u);
  });

  it("rejects a placeholder entrypoint followed by extra arguments", () => {
    const { result } = extract(taggedRepository({ command: "node", args: [PLUGIN_ROOT_ENTRY, "--inspect"] }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported command shape/u);
  });

  it("rejects a placeholder entrypoint that names a file other than the tagged server", () => {
    const { result } = extract(taggedRepository({ command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/other.js"] }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported command shape/u);
  });
});

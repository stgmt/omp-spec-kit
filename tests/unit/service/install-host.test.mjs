import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeClaudeMcpConfig, mergeOmpMcpConfig, parseHostArgs } from "../../../scripts/install-host.mjs";
import { readProjectBinding } from "../../../src/enforcement/project-binding.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "spec-install-host-"));
  tempDirs.push(dir);
  return dir;
}

describe("install-host CLI", () => {
  it("parses the Claude host and validates the endpoint", () => {
    const parsed = parseHostArgs(
      ["--host", "claude", "--url", "http://127.0.0.1:8650/mcp", "--project", "stgmt/alpha"],
      {},
    );
    assert.equal(parsed.host, "claude");
    assert.equal(parsed.url, "http://127.0.0.1:8650/mcp");
    assert.equal(parsed.token, null);
    assert.equal(parsed.project, "stgmt/alpha");
    assert.throws(
      () => parseHostArgs(["--host", "claude", "--url", "http://x", "--project", "stgmt/alpha"], {}),
      /ending in \/mcp/u,
    );
    assert.throws(
      () => parseHostArgs(["--host", "claude", "--url", "http://127.0.0.1:8650/mcp", "--token", "t", "--project", "stgmt/alpha"], {}),
      /not written to Claude config/u,
    );
    assert.throws(() => parseHostArgs(["--host", "nope", "--project", "stgmt/alpha"], {}), /--host must be/u);
  });

  it("requires an explicit project and never falls back to an environment variable", () => {
    const argv = ["--host", "claude", "--url", "http://127.0.0.1:8650/mcp"];
    assert.throws(() => parseHostArgs(argv, {}), /--project owner\/project is required/u);
    // A leftover global project variable is not a routing default.
    assert.throws(() => parseHostArgs(argv, { OMP_SPEC_PROJECT: "stgmt/omp-spec-kit" }), /--project owner\/project is required/u);
    // A filesystem path is not a registry identity.
    assert.throws(
      () => parseHostArgs([...argv, "--project", "E:/repos/omp-spec-kit"], {}),
      /owner\/project registry identity/u,
    );
  });

  it("merges one server into an existing .mcp.json without a token or a project header", () => {
    const dir = tempDir();
    const configPath = path.join(dir, ".mcp.json");
    writeFileSync(configPath, JSON.stringify({ mcpServers: { other: { type: "stdio", command: "x" } } }));
    mergeClaudeMcpConfig({ configPath, url: "http://127.0.0.1:8650/mcp" });
    const text = readFileSync(configPath, "utf8");
    const config = JSON.parse(text);
    assert.deepEqual(Object.keys(config.mcpServers).sort(), ["omp-spec-kit", "other"]);
    assert.equal(config.mcpServers["omp-spec-kit"].type, "http");
    assert.deepEqual(Object.keys(config.mcpServers["omp-spec-kit"].headers), ["Authorization"]);
    assert.equal(config.mcpServers["omp-spec-kit"].headers.Authorization, "Bearer ${OMP_SPEC_REGISTRY_TOKEN}");
    assert.equal(config.mcpServers.other.command, "x");
    assert.doesNotMatch(text, /X-Spec-Project/u);
    assert.doesNotMatch(text, /secret-value/u);
    if (process.platform !== "win32") {
      assert.equal(statSync(configPath).mode & 0o777, 0o600);
      assert.equal(statSync(`${configPath}.bak`).mode & 0o777, 0o600);
    }
  });

  it("accepts the Claude host without a token because the config uses an env reference", () => {
    const parsed = parseHostArgs(
      ["--host", "claude", "--url", "http://127.0.0.1:8650/mcp", "--project", "stgmt/alpha"],
      {},
    );
    assert.equal(parsed.host, "claude");
    assert.equal(parsed.token, null);
  });

  it("writes the workspace project record the hosts read at call time", () => {
    const workspace = tempDir();
    const configPath = path.join(tempDir(), "mcp.json");
    const parsed = parseHostArgs(
      ["--host", "omp", "--url", "http://127.0.0.1:8650/mcp", "--project", "acme/gamma", "--workspace", workspace],
      {},
    );
    assert.equal(parsed.workspace, path.resolve(workspace));
    const installer = spawnSync(
      process.execPath,
      [
        path.join(repositoryRoot, "scripts", "install-host.mjs"),
        "--host", "omp",
        "--url", "http://127.0.0.1:8650/mcp",
        "--project", "acme/gamma",
        "--workspace", workspace,
        "--config", configPath,
      ],
      { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(installer.status, 0, installer.stderr || installer.stdout);
    assert.deepEqual(readProjectBinding(workspace), {
      project: "acme/gamma",
      file: path.join(workspace, ".omp-spec-kit", "project.json"),
    });
    // OMP reads its native config, not the plugin `.mcp.json`: the entry must
    // be written there, with an env reference and no removed header.
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(written.mcpServers["omp-spec-kit"].type, "http");
    assert.equal(written.mcpServers["omp-spec-kit"].url, "http://127.0.0.1:8650/mcp");
    assert.deepEqual(written.mcpServers["omp-spec-kit"].headers, {
      Authorization: "Bearer ${OMP_SPEC_REGISTRY_TOKEN}",
    });
  });

  it("merges the OMP native server without dropping the servers already configured", () => {
    const configPath = path.join(tempDir(), "agent", "mcp.json");
    mergeOmpMcpConfig({ configPath, url: "http://127.0.0.1:8650/mcp" });
    const first = JSON.parse(readFileSync(configPath, "utf8"));
    first.mcpServers.other = { command: "npx", args: ["-y", "other"] };
    writeFileSync(configPath, JSON.stringify(first, null, 2));
    mergeOmpMcpConfig({ configPath, url: "http://127.0.0.1:8650/mcp" });
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.deepEqual(Object.keys(config.mcpServers).sort(), ["omp-spec-kit", "other"]);
    assert.equal(config.mcpServers.other.command, "npx");
    const text = readFileSync(configPath, "utf8");
    assert.doesNotMatch(text, /X-Spec-Project/u);
    assert.doesNotMatch(text, /perm-/u);
  });

  it("refuses to install without an explicit project", () => {
    const workspace = tempDir();
    const installer = spawnSync(
      process.execPath,
      [path.join(repositoryRoot, "scripts", "install-host.mjs"), "--host", "omp", "--workspace", workspace],
      { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(installer.status, 1);
    assert.match(installer.stderr, /--project owner\/project is required/u);
    assert.equal(readProjectBinding(workspace), null);
  });
});

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { mergeClaudeMcpConfig, parseHostArgs } from "../../../scripts/install-host.mjs";

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
    const parsed = parseHostArgs(["--host", "claude", "--url", "http://127.0.0.1:8650/mcp"], {});
    assert.equal(parsed.host, "claude");
    assert.equal(parsed.url, "http://127.0.0.1:8650/mcp");
    assert.equal(parsed.token, null);
    assert.throws(() => parseHostArgs(["--host", "claude", "--url", "http://x"], {}), /ending in \/mcp/u);
    assert.throws(() => parseHostArgs(["--host", "claude", "--url", "http://127.0.0.1:8650/mcp", "--token", "t"], {}), /not written to Claude config/u);
    assert.throws(() => parseHostArgs(["--host", "nope"], {}), /--host must be/u);
  });

  it("merges one server into an existing .mcp.json without writing the token", () => {
    const dir = tempDir();
    const configPath = path.join(dir, ".mcp.json");
    writeFileSync(configPath, JSON.stringify({ mcpServers: { other: { type: "stdio", command: "x" } } }));
    mergeClaudeMcpConfig({ configPath, url: "http://127.0.0.1:8650/mcp", project: "stgmt/omp-spec-kit" });
    const text = readFileSync(configPath, "utf8");
    const config = JSON.parse(text);
    assert.deepEqual(Object.keys(config.mcpServers).sort(), ["omp-spec-kit", "other"]);
    assert.equal(config.mcpServers["omp-spec-kit"].type, "http");
    assert.equal(config.mcpServers["omp-spec-kit"].headers.Authorization, "Bearer ${OMP_SPEC_REGISTRY_TOKEN}");
    assert.equal(config.mcpServers["omp-spec-kit"].headers["X-Spec-Project"], "stgmt/omp-spec-kit");
    assert.equal(config.mcpServers.other.command, "x");
    assert.doesNotMatch(text, /secret-value/u);
    if (process.platform !== "win32") {
      assert.equal(statSync(configPath).mode & 0o777, 0o600);
      assert.equal(statSync(`${configPath}.bak`).mode & 0o777, 0o600);
    }
  });

  it("accepts the Claude host without a token because the config uses an env reference", () => {
    const parsed = parseHostArgs(["--host", "claude", "--url", "http://127.0.0.1:8650/mcp"], {});
    assert.equal(parsed.host, "claude");
    assert.equal(parsed.token, null);
  });
});

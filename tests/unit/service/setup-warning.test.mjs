import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { registerSetupWarning, setupWarning } from "../../../src/enforcement/setup-warning.js";

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("setup warning", () => {
  it("warns for an empty project without any MCP signal", () => {
    const warning = setupWarning({ root: tempDir("spec-setup-empty-"), env: {} });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /no \.specs corpus/u);
    assert.doesNotMatch(warning, /Bearer|token-value/u);
  });

  it("stays silent for a hosted project configured through .mcp.json", () => {
    const root = tempDir("spec-setup-hosted-");
    writeFileSync(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "http", url: "http://127.0.0.1:8650/mcp" } } }),
    );
    assert.equal(setupWarning({ root, env: {} }), "");
  });

  it("does not treat an unrelated MCP server as configuration", () => {
    const root = tempDir("spec-setup-unrelated-");
    writeFileSync(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { github: { type: "http", url: "https://api.github.com/mcp" } } }),
    );
    assert.match(setupWarning({ root, env: {} }), /SPEC_SETUP_REQUIRED/u);
  });

  it("stays silent when the endpoint/token environment pair is set", () => {
    const root = tempDir("spec-setup-env-");
    const warning = setupWarning({
      root,
      env: { OMP_SPEC_REGISTRY_URL: "http://127.0.0.1:8650/mcp", OMP_SPEC_REGISTRY_TOKEN: "t" },
    });
    assert.equal(warning, "");
  });

  it("warns for a local corpus with no MCP configuration", () => {
    const root = tempDir("spec-setup-local-");
    mkdirSync(path.join(root, ".specs", "demo"), { recursive: true });
    const warning = setupWarning({ root, env: {} });
    assert.match(warning, /OMP_SPEC_REGISTRY_URL is not set/u);
  });

  it("honors a host-specific configured verdict", () => {
    const root = tempDir("spec-setup-host-");
    assert.equal(setupWarning({ root, env: {}, configured: true }), "");
    assert.match(setupWarning({ root, env: {}, configured: false }), /not configured for this host/u);
  });

  it("registers one session_start message on the OMP extension API", () => {
    const handlers = new Map();
    const sent = [];
    const pi = {
      on(name, handler) {
        handlers.set(name, handler);
      },
      sendMessage(message, options) {
        sent.push({ message, options });
      },
    };
    assert.equal(registerSetupWarning(pi, { root: tempDir("spec-setup-omp-"), env: {}, configured: false }), true);
    handlers.get("session_start")();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].message.customType, "spec-setup");
    assert.match(sent[0].message.content, /SPEC_SETUP_REQUIRED/u);
    assert.equal(sent[0].options.deliverAs, "nextTurn");
  });

  it("never throws when the host has no sendMessage", () => {
    const handlers = new Map();
    const pi = { on: (name, handler) => handlers.set(name, handler) };
    registerSetupWarning(pi, { root: tempDir("spec-setup-omp2-"), env: {}, configured: false });
    assert.doesNotThrow(() => handlers.get("session_start")());
  });
});

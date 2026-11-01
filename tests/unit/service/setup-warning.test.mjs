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

function writeRecord(root, project = "stgmt/alpha") {
  mkdirSync(path.join(root, ".omp-spec-kit"), { recursive: true });
  writeFileSync(
    path.join(root, ".omp-spec-kit", "project.json"),
    JSON.stringify({ schema: "omp-spec-kit/project-binding@1", project }),
  );
}

describe("setup warning", () => {
  it("warns for a workspace with neither endpoint nor project record", () => {
    const warning = setupWarning({ root: tempDir("spec-setup-empty-"), env: {} });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /no project selection record/u);
    assert.doesNotMatch(warning, /Bearer|token-value/u);
  });

  it("still warns when the endpoint is configured but the workspace has no project record", () => {
    const root = tempDir("spec-setup-endpoint-only-");
    const warning = setupWarning({
      root,
      env: { OMP_SPEC_REGISTRY_URL: "http://127.0.0.1:8650/mcp", OMP_SPEC_REGISTRY_TOKEN: "t" },
    });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /no project selection record/u);
    assert.match(warning, /spec_repo \{"action":"bind"/u);
  });

  it("warns when only the .mcp.json entry exists and no project record does", () => {
    const root = tempDir("spec-setup-hosted-");
    writeFileSync(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "http", url: "http://127.0.0.1:8650/mcp" } } }),
    );
    const warning = setupWarning({ root, env: {} });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /no project selection record/u);
  });

  it("stays silent only when the endpoint and the project record are both present", () => {
    const root = tempDir("spec-setup-bound-");
    writeFileSync(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "http", url: "http://127.0.0.1:8650/mcp" } } }),
    );
    writeRecord(root);
    assert.equal(setupWarning({ root, env: {} }), "");

    const envRoot = tempDir("spec-setup-bound-env-");
    writeRecord(envRoot);
    assert.equal(
      setupWarning({ root: envRoot, env: { OMP_SPEC_REGISTRY_URL: "http://127.0.0.1:8650/mcp", OMP_SPEC_REGISTRY_TOKEN: "t" } }),
      "",
    );
  });

  it("does not treat an unrelated MCP server as the registry endpoint", () => {
    const root = tempDir("spec-setup-unrelated-");
    writeFileSync(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { github: { type: "http", url: "https://api.github.com/mcp" } } }),
    );
    const warning = setupWarning({ root, env: {} });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /OMP_SPEC_REGISTRY_URL is not set/u);
  });

  it("warns for a local corpus with no endpoint and no record", () => {
    const root = tempDir("spec-setup-local-");
    mkdirSync(path.join(root, ".specs", "demo"), { recursive: true });
    const warning = setupWarning({ root, env: {} });
    assert.match(warning, /OMP_SPEC_REGISTRY_URL is not set/u);
  });

  it("honors a host-specific endpoint verdict but still needs the record", () => {
    const unbound = tempDir("spec-setup-host-");
    const warning = setupWarning({ root: unbound, env: {}, configured: true });
    assert.match(warning, /SPEC_SETUP_REQUIRED/u);
    assert.match(warning, /no project selection record/u);

    const bound = tempDir("spec-setup-host-bound-");
    writeRecord(bound);
    assert.equal(setupWarning({ root: bound, env: {}, configured: true }), "");
    assert.match(setupWarning({ root: unbound, env: {}, configured: false }), /not configured for this host/u);
  });

  it("never tells the user to restart a session to change project", () => {
    const warning = setupWarning({ root: tempDir("spec-setup-restart-"), env: {} });
    assert.doesNotMatch(warning, /restart the session/iu);
    assert.match(warning, /no restart is needed/u);
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

  it("evaluates the message against the session workspace from ctx", () => {
    const handlers = new Map();
    const sent = [];
    const bound = tempDir("spec-setup-omp-ctx-");
    writeRecord(bound);
    const pi = {
      on(name, handler) {
        handlers.set(name, handler);
      },
      sendMessage(message) {
        sent.push(message);
      },
    };
    registerSetupWarning(pi, { root: tempDir("spec-setup-omp-other-"), env: {}, configured: true });
    handlers.get("session_start")({}, { cwd: bound });
    assert.equal(sent.length, 0);
  });

  it("never throws when the host has no sendMessage", () => {
    const handlers = new Map();
    const pi = { on: (name, handler) => handlers.set(name, handler) };
    registerSetupWarning(pi, { root: tempDir("spec-setup-omp2-"), env: {}, configured: false });
    assert.doesNotThrow(() => handlers.get("session_start")());
  });
});

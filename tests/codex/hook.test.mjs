import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const hookUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "codex", "hook.mjs")).href;
const classifierUrl = pathToFileURL(path.join(repositoryRoot, "src", "enforcement", "classifier.js")).href;
const { createCodexGuard, readCodexServer } = await import(hookUrl);
const { classifyToolCall } = await import(classifierUrl);

let projectDir;
let codexHome;

function writeConfig(home, table) {
  mkdirSync(path.join(home, ".codex"), { recursive: true });
  writeFileSync(path.join(home, ".codex", "config.toml"), `[mcp_servers.spec_registry]\n${table}\n`);
}

before(() => {
  projectDir = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-"));
  mkdirSync(path.join(projectDir, ".specs", "foo"), { recursive: true });
  mkdirSync(path.join(projectDir, "src"), { recursive: true });
  writeFileSync(path.join(projectDir, ".specs", "foo", "foo.md"), "# Foo\n");
  writeFileSync(path.join(projectDir, "src", "app.js"), "export const x = 1;\n");

  codexHome = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-home-"));
  writeConfig(codexHome, 'url = "http://127.0.0.1:8650/mcp"\nbearer_token_env_var = "OMP_SPEC_REGISTRY_TOKEN"');
  writeFileSync(
    path.join(codexHome, ".codex", "spec-kit-guard.json"),
    JSON.stringify({ registryServer: "spec_registry", registryUrl: "http://127.0.0.1:8650/mcp" }),
  );
});

after(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(codexHome, { recursive: true, force: true });
});

function guard(home = codexHome) {
  return createCodexGuard({ home, classifier: classifyToolCall });
}

function payload(toolName, toolInput) {
  return {
    session_id: "test-session",
    turn_id: "turn-1",
    transcript_path: path.join(projectDir, "transcript.jsonl"),
    cwd: projectDir,
    hook_event_name: "PreToolUse",
    model: "test",
    permission_mode: "default",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "call-1",
  };
}

describe("Codex spec guard", () => {
  it("blocks a shell command that mentions .specs", () => {
    const decision = guard().decide(payload("Bash", { command: "cat .specs/foo/foo.md" }));
    assert.equal(decision.block, true);
    assert.match(decision.reason, /RAW_SPEC_WRITE/u);
  });

  it("allows an ordinary shell command", () => {
    assert.equal(guard().decide(payload("Bash", { command: "node --version" })).block, false);
  });

  it("blocks an apply_patch that targets .specs", () => {
    const patch = "*** Begin Patch\n*** Update File: .specs/foo/foo.md\n@@\n-a\n+b\n*** End Patch";
    const decision = guard().decide(payload("apply_patch", { command: patch }));
    assert.equal(decision.block, true);
    assert.match(decision.reason, /RAW_SPEC_WRITE/u);
  });

  it("allows an apply_patch outside .specs", () => {
    const patch = "*** Begin Patch\n*** Update File: src/app.js\n@@\n-a\n+b\n*** End Patch";
    assert.equal(guard().decide(payload("apply_patch", { command: patch })).block, false);
  });

  it("allows spec_patch from the configured HTTP registry", () => {
    assert.equal(guard().decide(payload("mcp__spec_registry__spec_patch", { spec: "foo", operations: [] })).block, false);
  });

  it("blocks spec_patch from the retired local stdio server", () => {
    const decision = guard().decide(payload("mcp__omp_spec_kit__spec_patch", { spec: "foo" }));
    assert.equal(decision.block, true);
    assert.match(decision.reason, /UNREGISTERED_AUTHORING_CALL/u);
  });

  it("blocks any MCP call when the registry is a stdio server", () => {
    const localHome = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-local-"));
    writeConfig(localHome, 'command = "node"\nargs = ["server.js"]');
    writeFileSync(
      path.join(localHome, ".codex", "spec-kit-guard.json"),
      JSON.stringify({ registryServer: "spec_registry" }),
    );
    try {
      const decision = guard(localHome).decide(payload("mcp__spec_registry__spec_patch", { spec: "foo" }));
      assert.equal(decision.block, true);
      assert.match(decision.reason, /REGISTRY_TRANSPORT_INVALID/u);
    } finally {
      rmSync(localHome, { recursive: true, force: true });
    }
  });

  it("requires a design review for a scenario-authoring patch", () => {
    const operations = [
      { kind: "replace_document", document: "foo/foo.feature", content: "Feature: Foo\n  Scenario: Bar\n    Given b\n" },
    ];
    const decision = guard().decide(payload("mcp__spec_registry__spec_patch", { spec: "foo", operations }));
    assert.equal(decision.block, true);
    assert.match(decision.reason, /DESIGN_REVIEW_REQUIRED/u);
  });

  it("blocks a malformed payload without a tool name", () => {
    const decision = guard().decide({ tool_input: {} });
    assert.equal(decision.block, true);
    assert.match(decision.reason, /tool name is missing/u);
  });

  it("parses one mcp_servers table", () => {
    const table = readCodexServer('[mcp_servers.spec_registry]\nurl = "http://x/mcp"\n\n[other]\na = 1\n', "spec_registry");
    assert.deepEqual(table, { url: '"http://x/mcp"' });
  });
});

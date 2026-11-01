import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const hookUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "codex", "hook.mjs")).href;
const sessionstartUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "codex", "sessionstart.mjs")).href;
const classifierUrl = pathToFileURL(path.join(repositoryRoot, "src", "enforcement", "classifier.js")).href;
const { createCodexGuard, emitDecision, readCodexServer } = await import(hookUrl);
const { codexConfigured, warningForPayload } = await import(sessionstartUrl);
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
  mkdirSync(path.join(projectDir, ".omp-spec-kit"), { recursive: true });
  writeFileSync(
    path.join(projectDir, ".omp-spec-kit", "project.json"),
    JSON.stringify({ schema: "omp-spec-kit/project-binding@1", project: "stgmt/alpha" }),
  );

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

  it("allows spec_patch from the configured HTTP registry and attaches the workspace project", () => {
    const decision = guard().decide(payload("mcp__spec_registry__spec_patch", { spec: "foo", operations: [] }));
    assert.equal(decision.block, false);
    assert.equal(decision.input.project, "stgmt/alpha");
    assert.equal(decision.input.spec, "foo");
  });

  it("leaves an explicit per-call project untouched", () => {
    const decision = guard().decide(
      payload("mcp__spec_registry__spec_patch", { spec: "foo", operations: [], project: "acme/gamma" }),
    );
    assert.equal(decision.block, false);
    assert.equal(decision.input, undefined);
  });

  it("refuses a spec call in a workspace with no project record and leaves unrelated calls alone", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-unbound-"));
    try {
      writeFileSync(path.join(bare, "app.js"), "export const x = 1;\n");
      const unbound = (toolName, toolInput) => ({ ...payload(toolName, toolInput), cwd: bare });
      const refused = guard().decide(unbound("mcp__spec_registry__spec_catalog", { view: "inventory" }));
      assert.equal(refused.block, true);
      assert.match(refused.reason, /^PROJECT_REQUIRED: /u);
      assert.match(refused.reason, /spec_repo \{"action":"bind"/u);
      assert.equal(guard().decide(unbound("Bash", { command: "node --version" })).block, false);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
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

  it("reports the setup warning only when the Codex registry is not configured", () => {
    assert.equal(codexConfigured({ home: codexHome }), true);
    assert.equal(warningForPayload({ cwd: projectDir }, { home: codexHome, env: {} }), "");
    const emptyHome = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-empty-"));
    try {
      assert.equal(codexConfigured({ home: emptyHome }), false);
      const warning = warningForPayload({ cwd: projectDir }, { home: emptyHome, env: {} });
      assert.match(warning, /SPEC_SETUP_REQUIRED/u);
      assert.match(warning, /not configured for this host/u);
    } finally {
      rmSync(emptyHome, { recursive: true, force: true });
    }
  });

  it("emits the JSON deny shape Codex 0.166 honors and exits 0", () => {
    const installRoot = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-install-"));
    try {
      cpSync(path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist"), path.join(installRoot, "dist"), { recursive: true });
      mkdirSync(path.join(installRoot, "hosts", "codex"), { recursive: true });
      writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ version: "0.166.0" }));
      for (const name of ["hook.mjs", "normalize.mjs", "caps.mjs"]) {
        copyFileSync(path.join(repositoryRoot, "src", "hosts", "codex", name), path.join(installRoot, "hosts", "codex", name));
      }
      mkdirSync(path.join(installRoot, "enforcement"), { recursive: true });
      copyFileSync(
        path.join(repositoryRoot, "src", "enforcement", "project-binding.js"),
        path.join(installRoot, "enforcement", "project-binding.js"),
      );
      copyFileSync(path.join(repositoryRoot, "src", "enforcement", "setup-warning.js"), path.join(installRoot, "hosts", "codex", "setup-warning.js"));
      const runHook = (payloadValue, managedRoot = installRoot) => spawnSync(process.execPath, [path.join(installRoot, "hosts", "codex", "hook.mjs")], {
        input: JSON.stringify(payloadValue),
        encoding: "utf8",
        cwd: projectDir,
        env: { ...process.env, USERPROFILE: codexHome, HOME: codexHome, CODEX_MANAGED_PACKAGE_ROOT: managedRoot },
      });
      const blocked = runHook(payload("Bash", { command: "cat .specs/foo/foo.md" }));
      assert.equal(blocked.status, 0, blocked.stderr);
      const envelope = JSON.parse(blocked.stdout);
      assert.equal(envelope.decision, "block");
      assert.match(envelope.reason, /RAW_SPEC_WRITE/u);
      assert.equal(envelope.hookSpecificOutput.permissionDecision, "deny");
      const allowed = runHook(payload("Bash", { command: "node --version" }));
      assert.equal(allowed.status, 0, allowed.stderr);
      assert.equal(allowed.stdout.trim(), "");
      const legacyRoot = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-codex-legacy-"));
      try {
        writeFileSync(path.join(legacyRoot, "package.json"), JSON.stringify({ version: "0.144.6" }));
        const legacy = runHook(payload("Bash", { command: "cat .specs/foo/foo.md" }), legacyRoot);
        assert.equal(legacy.status, 2);
        assert.match(legacy.stderr, /RAW_SPEC_WRITE/u);
      } finally {
        rmSync(legacyRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      }
    } finally {
      rmSync(installRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  });

  it("attaches the project with updatedInput when Codex honors it", () => {
    const chunks = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      chunks.push(String(chunk));
      return true;
    };
    try {
      emitDecision({ block: false, input: { spec: "foo", project: "stgmt/alpha" } }, { supportsUpdatedInput: () => true });
    } finally {
      process.stdout.write = originalWrite;
    }
    const envelope = JSON.parse(chunks.join(""));
    assert.equal(envelope.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.equal(envelope.hookSpecificOutput.permissionDecision, "allow");
    assert.deepEqual(envelope.hookSpecificOutput.updatedInput, { spec: "foo", project: "stgmt/alpha" });
  });

  it("denies with PROJECT_INJECTION_UNAVAILABLE when Codex ignores updatedInput", () => {
    const chunks = [];
    const originalWrite = process.stderr.write;
    const originalExitCode = process.exitCode;
    process.stderr.write = (chunk) => {
      chunks.push(String(chunk));
      return true;
    };
    try {
      emitDecision({ block: false, input: { project: "stgmt/alpha" } }, { supportsUpdatedInput: () => false });
    } finally {
      process.stderr.write = originalWrite;
      process.exitCode = originalExitCode;
    }
    assert.match(chunks.join(""), /PROJECT_INJECTION_UNAVAILABLE/u);
  });
});

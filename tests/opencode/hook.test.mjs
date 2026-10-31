import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "opencode", "plugin.mjs")).href;
const setupUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "opencode", "setup.mjs")).href;
const classifierUrl = pathToFileURL(path.join(repositoryRoot, "src", "enforcement", "classifier.js")).href;
const { createGuard } = await import(pluginUrl);
const { OmpSpecKitSetup, opencodeConfigured } = await import(setupUrl);
const { classifyToolCall } = await import(classifierUrl);

const SCENARIO_FEATURE = "Feature: Foo\n  Scenario: Foo works\n    Given a foo\n";

let projectDir;
let opencodeConfig;

before(() => {
  projectDir = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-opencode-"));
  mkdirSync(path.join(projectDir, ".specs", "foo"), { recursive: true });
  mkdirSync(path.join(projectDir, "src"), { recursive: true });
  writeFileSync(path.join(projectDir, ".specs", "foo", "foo.md"), "# Foo\n");
  writeFileSync(path.join(projectDir, ".specs", "foo", "foo.feature"), SCENARIO_FEATURE);
  writeFileSync(path.join(projectDir, "src", "app.js"), "export const x = 1;\n");
  opencodeConfig = path.join(projectDir, "opencode.json");
  writeFileSync(
    opencodeConfig,
    JSON.stringify({ mcp: { "spec-registry": { type: "remote", url: "http://127.0.0.1:8650/mcp" } } }),
  );
});

after(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function guard(config = { registryServer: "spec-registry", opencodeConfigPath: opencodeConfig }) {
  return createGuard({ directory: projectDir, config, classifier: classifyToolCall });
}

async function call(hook, tool, args) {
  await hook["tool.execute.before"]({ tool, sessionID: "s", callID: "c" }, { args });
}

describe("OpenCode spec guard", () => {
  it("blocks a direct write inside .specs", async () => {
    await assert.rejects(call(guard(), "write", { filePath: ".specs/foo/foo.md", content: "x" }), /RAW_SPEC_WRITE/u);
  });

  it("blocks an edit through an absolute .specs path", async () => {
    const target = path.join(projectDir, ".specs", "foo", "foo.md");
    await assert.rejects(call(guard(), "edit", { filePath: target, oldString: "a", newString: "b" }), /RAW_SPEC_WRITE/u);
  });

  it("redirects a direct read of .specs to the MCP surface", async () => {
    await assert.rejects(call(guard(), "read", { filePath: ".specs/foo/foo.md" }), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a shell command that mentions .specs", async () => {
    await assert.rejects(call(guard(), "bash", { command: "cat .specs/foo/foo.md" }), /RAW_SPEC_WRITE/u);
  });

  it("blocks a patch that targets .specs", async () => {
    const patchText = "*** Begin Patch\n*** Update File: .specs/foo/foo.md\n@@\n-a\n+b\n*** End Patch";
    await assert.rejects(call(guard(), "patch", { patchText }), /RAW_SPEC_WRITE/u);
  });

  it("blocks a mutating call with no target", async () => {
    await assert.rejects(call(guard(), "write", { content: "x" }), /TARGET_INDETERMINATE/u);
  });

  it("allows an ordinary write outside .specs", async () => {
    await call(guard(), "write", { filePath: "src/app.js", content: "export const x = 2;\n" });
  });

  it("allows spec_patch from the registry server", async () => {
    await call(guard(), "spec-registry_spec_patch", { spec: "foo", intent: "patch", operations: [] });
  });

  it("blocks spec_patch from the retired local stdio server", async () => {
    await assert.rejects(
      call(guard(), "omp-spec-kit_spec_patch", { spec: "foo" }),
      /UNREGISTERED_AUTHORING_CALL/u,
    );
  });

  it("blocks the bare short name", async () => {
    await assert.rejects(call(guard(), "spec_patch", { spec: "foo" }), /UNREGISTERED_AUTHORING_CALL/u);
  });

  it("requires a design review for a scenario-authoring patch", async () => {
    const operations = [
      { kind: "replace_document", document: "foo/foo.feature", content: "Feature: Foo\n  Scenario: Bar\n    Given b\n" },
    ];
    await assert.rejects(
      call(guard(), "spec-registry_spec_patch", { spec: "foo", intent: "patch", operations }),
      /DESIGN_REVIEW_REQUIRED/u,
    );
  });

  it("refuses to start when the registry transport is local", () => {
    const localConfig = path.join(projectDir, "local.json");
    writeFileSync(localConfig, JSON.stringify({ mcp: { "spec-registry": { type: "local", command: ["node", "server.js"] } } }));
    assert.throws(
      () => createGuard({ directory: projectDir, config: { registryServer: "spec-registry", opencodeConfigPath: localConfig }, classifier: classifyToolCall }),
      /type remote/u,
    );
  });

  it("refuses to start without a guard config", () => {
    assert.throws(() => createGuard({ directory: projectDir, config: {}, classifier: classifyToolCall }), /registryServer/u);
  });

  it("refuses to start without a classifier", () => {
    assert.throws(() => createGuard({ directory: projectDir, config: { registryServer: "spec-registry" } }), /classifier is required/u);
  });
});

describe("OpenCode setup reporter", () => {
  it("injects the warning into the first chat message when the host is not configured", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-opencode-home-"));
    const directory = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-opencode-project-"));
    try {
      assert.equal(opencodeConfigured({ home }), false);
      const plugin = await OmpSpecKitSetup({ directory, home });
      const first = { parts: [] };
      await plugin["chat.message"]({ sessionID: "s" }, first);
      assert.equal(first.parts.length, 1);
      assert.match(first.parts[0].text, /SPEC_SETUP_REQUIRED/u);
      const second = { parts: [] };
      await plugin["chat.message"]({ sessionID: "s" }, second);
      assert.equal(second.parts.length, 0, "the warning is emitted once per session");
      await plugin.event({ event: { type: "session.created" } });
      const third = { parts: [] };
      await plugin["chat.message"]({ sessionID: "s" }, third);
      assert.equal(third.parts.length, 1, "a new session re-arms the warning");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("stays silent when opencode.json declares the remote registry", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-opencode-home2-"));
    const directory = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-opencode-project2-"));
    try {
      mkdirSync(path.join(home, ".config", "opencode"), { recursive: true });
      writeFileSync(
        path.join(home, ".config", "opencode", "spec-kit-guard.json"),
        JSON.stringify({ registryServer: "spec-registry" }),
      );
      writeFileSync(
        path.join(home, ".config", "opencode", "opencode.json"),
        JSON.stringify({ mcp: { "spec-registry": { type: "remote", url: "http://127.0.0.1:8650/mcp" } } }),
      );
      assert.equal(opencodeConfigured({ home }), true);
      const plugin = await OmpSpecKitSetup({ directory, home });
      const output = { parts: [] };
      await plugin["chat.message"]({ sessionID: "s" }, output);
      assert.equal(output.parts.length, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

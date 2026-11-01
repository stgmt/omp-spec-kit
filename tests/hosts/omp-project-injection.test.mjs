/**
 * Per-session project injection at the real host surfaces.
 *
 * Proves that a session's project comes from the repo-local record for the
 * workspace the session is actually in, that a workspace without one refuses a
 * spec call while leaving ordinary tools alone, and that a filesystem path is
 * never sent as a project identity.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createSpecEnforcementHandler } from "../../src/enforcement/adapter.js";
import { classifyToolCall } from "../../src/enforcement/classifier.js";
import { createGuard } from "../../src/hosts/opencode/plugin.mjs";
import { isProjectIdentity, projectBindingPath, readProjectBinding } from "../../src/enforcement/project-binding.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

function tempDir(prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function bindWorkspace(project) {
  const root = tempDir("omp-spec-kit-bound-");
  mkdirSync(path.join(root, ".omp-spec-kit"), { recursive: true });
  writeFileSync(
    path.join(root, ".omp-spec-kit", "project.json"),
    JSON.stringify({ schema: "omp-spec-kit/project-binding@1", project }),
  );
  return root;
}

const handler = createSpecEnforcementHandler({});
const SPEC_CALL = { toolName: "mcp__omp_spec_kit_spec_catalog", input: { view: "inventory" } };

describe("OMP tool_call handler carries the session project", () => {
  it("injects the recorded project into a spec call for this session's cwd", () => {
    const root = bindWorkspace("stgmt/alpha");
    const result = handler({ ...SPEC_CALL, input: { view: "inventory" } }, { cwd: root });
    assert.equal(result.block, undefined);
    assert.deepEqual(result.input, { view: "inventory", project: "stgmt/alpha" });
  });

  it("switches project when only that session's workspace changes", () => {
    const alpha = bindWorkspace("stgmt/alpha");
    const beta = bindWorkspace("acme/gamma");
    const first = handler({ ...SPEC_CALL, input: {} }, { cwd: alpha });
    const second = handler({ ...SPEC_CALL, input: {} }, { cwd: beta });
    assert.equal(first.input.project, "stgmt/alpha");
    assert.equal(second.input.project, "acme/gamma");
    assert.notEqual(first.input.project, second.input.project);
  });

  it("refuses a spec call in a workspace with no record", () => {
    const root = tempDir("omp-spec-kit-unbound-");
    const result = handler({ ...SPEC_CALL, input: {} }, { cwd: root });
    assert.equal(result.block, true);
    assert.match(result.reason, /^PROJECT_REQUIRED: /u);
    assert.match(result.reason, /spec_repo \{"action":"bind"/u);
  });

  it("leaves an unrelated bash call untouched in an unbound workspace", () => {
    const root = tempDir("omp-spec-kit-unbound-bash-");
    const result = handler({ toolName: "bash", input: { command: "node --version" } }, { cwd: root });
    assert.equal(result, undefined);
  });

  it("does not override an explicit per-call project", () => {
    const root = bindWorkspace("stgmt/alpha");
    const result = handler({ ...SPEC_CALL, input: { project: "acme/gamma" } }, { cwd: root });
    assert.equal(result, undefined);
  });

  it("never sends a filesystem path as the project", () => {
    const root = tempDir("omp-spec-kit-path-record-");
    mkdirSync(path.join(root, ".omp-spec-kit"), { recursive: true });
    writeFileSync(
      projectBindingPath(root),
      JSON.stringify({ schema: "omp-spec-kit/project-binding@1", project: root }),
    );
    assert.equal(readProjectBinding(root), null, "a path is not a project identity");
    assert.equal(isProjectIdentity(root), false);
    const result = handler({ ...SPEC_CALL, input: {} }, { cwd: root });
    assert.equal(result.block, true);
    assert.match(result.reason, /^PROJECT_REQUIRED: /u);

    const bound = bindWorkspace("stgmt/alpha");
    const injected = handler({ ...SPEC_CALL, input: {} }, { cwd: bound }).input.project;
    assert.equal(isProjectIdentity(injected), true);
    assert.doesNotMatch(injected, /[\\/]{2}|^[A-Za-z]:/u, "the injected project is not a path");
  });
});

describe("OpenCode guard carries the session project", () => {
  function guardFor(directory) {
    const configDir = tempDir("omp-spec-kit-opencode-config-");
    const configPath = path.join(configDir, "opencode.json");
    writeFileSync(
      configPath,
      JSON.stringify({ mcp: { "spec-registry": { type: "remote", url: "http://127.0.0.1:8650/mcp" } } }),
    );
    return createGuard({
      directory,
      classifier: classifyToolCall,
      config: { registryServer: "spec-registry", opencodeConfigPath: configPath },
    });
  }

  it("attaches the recorded project to a registry spec call", async () => {
    const root = bindWorkspace("stgmt/alpha");
    const hooks = guardFor(root);
    const output = { args: { view: "inventory" } };
    await hooks["tool.execute.before"]({ tool: "spec-registry_spec_catalog" }, output);
    assert.deepEqual(output.args, { view: "inventory", project: "stgmt/alpha" });
  });

  it("keeps an explicit project and leaves unrelated tools alone", async () => {
    const root = bindWorkspace("stgmt/alpha");
    const hooks = guardFor(root);
    const explicit = { args: { view: "inventory", project: "acme/gamma" } };
    await hooks["tool.execute.before"]({ tool: "spec-registry_spec_catalog" }, explicit);
    assert.deepEqual(explicit.args, { view: "inventory", project: "acme/gamma" });

    const untouched = { args: { command: "node --version" } };
    await hooks["tool.execute.before"]({ tool: "bash" }, untouched);
    assert.deepEqual(untouched.args, { command: "node --version" });
  });

  it("refuses a spec call in a workspace with no record", async () => {
    const root = tempDir("omp-spec-kit-opencode-unbound-");
    const hooks = guardFor(root);
    await assert.rejects(
      () => hooks["tool.execute.before"]({ tool: "spec-registry_spec_catalog" }, { args: {} }),
      /^Error: PROJECT_REQUIRED: /u,
    );
  });
});

describe("installers carry no project default", () => {
  const installers = ["install-host.mjs", "install-opencode-guard.mjs", "install-codex-guard.mjs"];

  for (const name of installers) {
    it(`${name} has no hardcoded project and no header/env routing default`, () => {
      const source = readFileSync(path.join(repositoryRoot, "scripts", name), "utf8");
      assert.doesNotMatch(source, /stgmt\/omp-spec-kit/u, "no hardcoded project literal");
      assert.doesNotMatch(source, /X-Spec-Project/u, "no connection-wide project header");
      assert.doesNotMatch(source, /OMP_SPEC_PROJECT/u, "no global project environment default");
      assert.match(source, /--project/u, "the flag is documented");
    });
  }
});

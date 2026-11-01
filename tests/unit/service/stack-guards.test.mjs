import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installCodexGuard, installOpenCodeGuard } from "../../../skills/spec-stack-setup/guards.mjs";

function tempHome() {
  const dir = mkdtempSync(path.join(tmpdir(), "spec-stack-guards-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }) };
}

test("a missing host config skips the guard without running the installer", () => {
  const home = tempHome();
  try {
    let calls = 0;
    const run = () => { calls += 1; return { status: 0 }; };
    assert.deepEqual(
      installOpenCodeGuard({ token: "t", url: "http://127.0.0.1:1/mcp", project: "demo/stack", workspace: "/workspace", repoRoot: "/repo", homeDir: home.dir, run }),
      { status: "absent", path: null, detail: null },
    );
    assert.equal(calls, 0);
  } finally {
    home.cleanup();
  }
});

test("a conflicting OpenCode config is a reported skip, not a setup failure", () => {
  const home = tempHome();
  try {
    mkdirSync(path.join(home.dir, ".config", "opencode"), { recursive: true });
    const seen = [];
    const run = (command, args, options) => {
      seen.push({ command, args, options });
      return { status: 1, stderr: "install-opencode-guard: mcp.spec-registry points at http://127.0.0.1:8650/mcp; the installed stack serves http://127.0.0.1:8644/mcp\n" };
    };
    const result = installOpenCodeGuard({
      token: "secret-token",
      url: "http://127.0.0.1:8644/mcp",
      project: "demo/stack",
      workspace: "/workspace",
      repoRoot: "/repo",
      homeDir: home.dir,
      run,
    });
    assert.equal(result.status, "skipped");
    assert.match(result.detail, /points at http:\/\/127\.0\.0\.1:8650\/mcp/u);
    assert.equal(result.path, path.join(home.dir, ".config", "opencode"));
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].args.slice(1), [
      "--url", "http://127.0.0.1:8644/mcp",
      "--project", "demo/stack",
      "--workspace", "/workspace",
    ], "the installer gets an explicit project and workspace");
    assert.equal(seen[0].options.env.OMP_SPEC_REGISTRY_TOKEN, "secret-token");
  } finally {
    home.cleanup();
  }
});

test("a successful install is reported with the host config path", () => {
  const home = tempHome();
  try {
    mkdirSync(path.join(home.dir, ".codex"), { recursive: true });
    const result = installCodexGuard({
      token: "t",
      url: "http://127.0.0.1:8644/mcp",
      project: "demo/stack",
      workspace: "/workspace",
      repoRoot: "/repo",
      homeDir: home.dir,
      run: () => ({ status: 0, stdout: "guard installed" }),
    });
    assert.equal(result.status, "installed");
    assert.equal(result.path, path.join(home.dir, ".codex"));
    assert.equal(result.detail, null);
  } finally {
    home.cleanup();
  }
});

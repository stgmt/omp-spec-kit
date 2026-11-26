import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

test("the Codex installer keeps setup-warning beside project-binding and the SessionStart adapter loads", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "codex-loader-"));
  const previous = { USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME };
  try {
    const codexHome = path.join(home, ".codex");
    mkdirSync(codexHome, { recursive: true });
    const project = path.join(home, "project");
    mkdirSync(path.join(project, ".specs", "demo"), { recursive: true });
    writeFileSync(path.join(project, ".specs", "demo", "README.md"), "# demo\n");

    const installer = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts", "install-codex-guard.mjs"),
        "--url", "http://127.0.0.1:8650/mcp",
        "--token", "test-token",
        // A unit test must not write a throwaway token into the account
        // environment; the installer would then leave a dead bearer token
        // behind for every later real install.
        "--no-persist-env",
        "--project", "stgmt/omp-spec-kit",
        "--workspace", project,
        "--codex-home", codexHome,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, USERPROFILE: home, HOME: home },
      },
    );
    assert.equal(installer.status, 0, installer.stderr || installer.stdout);
    assert.doesNotMatch(
      installer.stdout ?? "",
      /environment: /u,
      "the test install writes no environment value",
    );

    const installRoot = path.join(codexHome, "spec-kit-guard");
    const built = path.join(REPO_ROOT, "plugins", "omp-spec-kit", "dist", "enforcement", "setup-warning.js");
    const installed = path.join(installRoot, "enforcement", "setup-warning.js");
    assert.equal(
      readFileSync(installed, "utf8"),
      readFileSync(built, "utf8"),
      "the built setup-warning is installed beside its project-binding import",
    );
    assert.ok(
      existsSync(path.join(installRoot, "enforcement", "project-binding.js")),
      "project-binding.js sits beside the installed setup-warning",
    );

    const hostShim = path.join(installRoot, "hosts", "codex", "setup-warning.js");
    assert.match(
      readFileSync(hostShim, "utf8"),
      /export \* from "\.\.\/\.\.\/enforcement\/setup-warning\.js"/u,
      "the host copy re-exports the built setup-warning",
    );
    const shim = await import(`${pathToFileURL(hostShim).href}?shim=${Date.now()}`);
    assert.equal(typeof shim.setupWarning, "function", "the host re-export resolves");

    // The SessionStart adapter is the live consumer; before this fix it died
    // with ERR_MODULE_NOT_FOUND on `./project-binding.js`.
    const sessionStart = await import(
      `${pathToFileURL(path.join(installRoot, "hosts", "codex", "sessionstart.mjs")).href}?ss=${Date.now()}`
    );
    assert.equal(typeof sessionStart.warningForPayload, "function", "the installed SessionStart adapter loads");
  } finally {
    if (previous.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previous.USERPROFILE;
    if (previous.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = previous.HOME;
    cleanup(home);
  }
});

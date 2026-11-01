import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

test("the OpenCode installer writes a loadable .js bridge, not only .mjs", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "opencode-loader-"));
  const previous = { USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME };
  try {
    const configDir = path.join(home, ".config", "opencode");
    const pluginsDir = path.join(configDir, "plugins");
    const configPath = path.join(configDir, "opencode.json");
    mkdirSync(configDir, { recursive: true });
    const project = path.join(home, "project");
    mkdirSync(path.join(project, ".specs", "demo"), { recursive: true });
    writeFileSync(path.join(project, ".specs", "demo", "README.md"), "# demo\n");

    const installer = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts", "install-opencode-guard.mjs"),
        "--url", "http://127.0.0.1:8650/mcp",
        "--token", "test-token",
        "--project", "stgmt/omp-spec-kit",
        "--workspace", project,
        "--config", configPath,
        "--plugins-dir", pluginsDir,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, USERPROFILE: home, HOME: home },
      },
    );
    assert.equal(installer.status, 0, installer.stderr || installer.stdout);

    const bridgePath = path.join(pluginsDir, "omp-spec-kit-guard.js");
    const bridge = readFileSync(bridgePath, "utf8");
    assert.match(bridge, /await import\("\.\/omp-spec-kit\/hosts\/opencode\/plugin\.mjs"\)/u);
    assert.ok(
      readFileSync(path.join(pluginsDir, "omp-spec-kit-guard.mjs"), "utf8").includes("OmpSpecKitGuard"),
      "the legacy .mjs loader stays for older hosts",
    );
    const guard = JSON.parse(readFileSync(path.join(configDir, "spec-kit-guard.json"), "utf8"));
    assert.equal(guard.opencodeConfigPath, configPath, "the guard reads the config it wrote");
    assert.equal(guard.project, undefined, "the guard config stores no project");

    // The workspace record is the only project carrier.
    const record = JSON.parse(readFileSync(path.join(project, ".omp-spec-kit", "project.json"), "utf8"));
    assert.deepEqual(record, { schema: "omp-spec-kit/project-binding@1", project: "stgmt/omp-spec-kit" });
    const opencodeConfig = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(opencodeConfig.mcp["spec-registry"].headers["X-Spec-Project"], undefined);
    // opencode.json is a shared, committable file: the token is referenced,
    // never written, so the installer cannot leak a credential into it.
    assert.equal(opencodeConfig.mcp["spec-registry"].headers.Authorization, "Bearer {env:OMP_SPEC_REGISTRY_TOKEN}");
    assert.doesNotMatch(readFileSync(configPath, "utf8"), /test-token/u);

    // OpenCode 1.19.3 loads `.js` plugins. Run the installed bridge against a
    // temporary home so the test proves the loader, not only the source text.
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    const { OmpSpecKitGuard } = await import(`${pathToFileURL(bridgePath).href}?v=${Date.now()}`);
    const hooks = await OmpSpecKitGuard({ directory: project });
    await assert.rejects(
      () => hooks["tool.execute.before"](
        { tool: "read" },
        { args: { filePath: path.join(project, ".specs", "demo", "README.md") } },
      ),
      /SPEC_READ_REDIRECT/u,
    );
  } finally {
    if (previous.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previous.USERPROFILE;
    if (previous.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = previous.HOME;
    cleanup(home);
  }
});

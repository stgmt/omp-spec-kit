import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { candidateFileMode } from "../../scripts/release-candidate-utils.mjs";
import { expectedManagerToolCount } from "../../scripts/verify-release.mjs";
import { loadAndConnect, substitutePluginRoot, targetConfigName } from "../../scripts/lifecycle/lib/omp-session.mjs";
import { PACKAGE_ROOT_REFUSED, resolveRepositoryContext } from "../../src/adapters/query-service.js";

// Unit coverage for the release tooling and the lifecycle helpers whose failure
// modes shipped incorrectly before: placeholder substitution, candidate file
// modes, the release manager tool count, version identity across the built
// payload, the MCP preflight versions, and the bounded connect retry.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN_ROOT = path.join(repositoryRoot, "plugins", "omp-spec-kit");
const { version: PLUGIN_VERSION } = JSON.parse(readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8"));
const SERVERS = {
  src: path.join(repositoryRoot, "src", "mcp", "server.js"),
  dist: path.join(PLUGIN_ROOT, "dist", "mcp", "server.js"),
};

function preflightVersions(serverPath) {
  const cwd = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-preflight-")));
  const env = { ...process.env };
  delete env.OMP_SPEC_KIT_ROOT;
  delete env.OMP_SPEC_KIT_PACKAGE_ROOT;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let buffered = "";
    const timer = setTimeout(() => finish(new Error("mcp_preflight timed out")), 20_000);
    function finish(error, value) {
      clearTimeout(timer);
      child.kill();
      child.once("exit", () => rmSync(cwd, { recursive: true, force: true, maxRetries: 3 }));
      if (error) reject(error);
      else resolve(value);
    }
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffered += chunk;
      let newline = buffered.indexOf("\n");
      while (newline !== -1) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf("\n");
        if (line.trim() === "") continue;
        const message = JSON.parse(line);
        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
          child.stdin.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "mcp_preflight", arguments: { schemaVersion: "spec-kernel@2", requestId: "tooling-preflight" } },
          })}\n`);
        } else if (message.id === 2) {
          finish(null, message.result.structuredContent.data.versions);
        }
      }
    });
    child.on("error", (error) => finish(error));
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "tooling-test", version: "1" } },
    })}\n`);
  });
}

describe("MCP preflight reports the packaged versions", () => {
  for (const [label, serverPath] of Object.entries(SERVERS)) {
    it(`the ${label} server reports plugin ${PLUGIN_VERSION} and OMP 18.0.11`, async () => {
      const versions = await preflightVersions(serverPath);
      assert.equal(versions.plugin, PLUGIN_VERSION);
      assert.equal(versions.omp, "18.0.11");
    });
  }
});

describe("plugin-root placeholder substitution", () => {
  it("inserts the root verbatim, including $ replacement patterns, and recurses into arrays and objects", () => {
    const root = "C:/Users/me/plugins$&/omp-spec-kit$'$$";
    const substituted = substitutePluginRoot(["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js", { env: { A: "${CLAUDE_PLUGIN_ROOT}/x" } }], root);
    assert.deepEqual(substituted, [`${root}/dist/mcp/server.js`, { env: { A: `${root}/x` } }]);
  });
});

describe("target config lookup", () => {
  it("resolves a target by suffix only when its own source entry exists", () => {
    const configs = { "claude-plugins:omp-spec-kit": {} };
    assert.equal(targetConfigName(configs, {}, "omp-spec-kit"), undefined);
    assert.equal(targetConfigName(configs, { "claude-plugins:omp-spec-kit": { path: "/p/.mcp.json" } }, "omp-spec-kit"), "claude-plugins:omp-spec-kit");
  });
});

describe("bounded connect retry", () => {
  const NAME = "claude-plugins:omp-spec-kit";
  const targetConfigs = { [NAME]: { type: "stdio", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"] } };
  const targetSources = { [NAME]: { path: path.join(PLUGIN_ROOT, ".mcp.json") } };

  function fakeModules(outcomes) {
    const counters = { constructed: 0, disconnected: 0 };
    class MCPManager {
      constructor() {
        counters.constructed += 1;
        this.attempt = counters.constructed;
      }
      async connectServers() {
        if (outcomes[this.attempt - 1] === "ok") return { connectedServers: [NAME], tools: [{}] };
        return { connectedServers: [], tools: [] };
      }
      getTools() {
        return [{ mcpServerName: NAME, mcpToolName: "spec_catalog" }];
      }
      async disconnectAll() {
        counters.disconnected += 1;
      }
    }
    return { modules: { MCPManager }, counters };
  }

  it("returns the connected tool when the third attempt succeeds", async () => {
    const { modules, counters } = fakeModules(["fail", "fail", "ok"]);
    const connected = await loadAndConnect(PLUGIN_ROOT, "omp-spec-kit", targetConfigs, targetSources, modules, 5_000);
    assert.equal(connected.serverName, NAME);
    assert.equal(connected.tool.mcpToolName, "spec_catalog");
    assert.equal(counters.constructed, 3);
    assert.equal(counters.disconnected, 2);
  });

  it("stops after exactly three attempts and names the bound", async () => {
    const { modules, counters } = fakeModules(["fail", "fail", "fail"]);
    await assert.rejects(
      loadAndConnect(PLUGIN_ROOT, "omp-spec-kit", targetConfigs, targetSources, modules, 5_000),
      /connect failed after 3 attempts/u,
    );
    assert.equal(counters.constructed, 3);
    assert.equal(counters.disconnected, 3);
  });
});

describe("package-root refusal", () => {
  it("refuses a cwd equal to an absolute package root without throwing", () => {
    const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-package-root-")));
    try {
      const context = resolveRepositoryContext({ OMP_SPEC_KIT_PACKAGE_ROOT: dir }, dir);
      assert.equal(context.rootMode, "refused");
      assert.equal(context.refused, PACKAGE_ROOT_REFUSED);
      assert.equal(context.resolvedRoot, null);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  it("does not refuse a relative package root such as '.'", () => {
    const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-package-root-rel-")));
    try {
      const context = resolveRepositoryContext({ OMP_SPEC_KIT_PACKAGE_ROOT: "." }, dir);
      assert.notEqual(context.rootMode, "refused");
      assert.equal(context.refused, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});

describe("candidate file modes", () => {
  it("returns 0644 for a safe relative path and refuses escapes and absolute paths", () => {
    assert.equal(candidateFileMode("plugins/omp-spec-kit/.mcp.json"), 0o644);
    assert.throws(() => candidateFileMode("../escape"));
    assert.throws(() => candidateFileMode("/abs/path"));
  });
});

describe("release manager tool count", () => {
  it("pins the released surface to ten tools and leaves an unlisted version on the fallback", () => {
    assert.equal(expectedManagerToolCount(PLUGIN_VERSION), 10);
    assert.equal(expectedManagerToolCount("2.9.1"), 10);
    assert.equal(expectedManagerToolCount("9.9.9"), 8);
  });
});

describe("version identity across the built payload", () => {
  it("keeps the dist manifest, plugin manifest, plugin-version module, and build script on one version", () => {
    const dist = JSON.parse(readFileSync(path.join(PLUGIN_ROOT, "dist", "manifest.json"), "utf8"));
    const plugin = JSON.parse(readFileSync(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"));
    const pluginVersionModule = readFileSync(path.join(repositoryRoot, "src", "adapters", "plugin-version.js"), "utf8");
    const buildScript = readFileSync(path.join(repositoryRoot, "scripts", "build-plugin.mjs"), "utf8");
    const escaped = PLUGIN_VERSION.replaceAll(".", "\\.");
    assert.equal(dist.pluginVersion, PLUGIN_VERSION);
    assert.equal(plugin.version, PLUGIN_VERSION);
    assert.match(pluginVersionModule, new RegExp(`export const PLUGIN_VERSION = "${escaped}";`, "u"));
    // The builder reads the constant instead of keeping a second literal, so
    // a version bump cannot leave the dist manifest on the old number.
    assert.match(buildScript, /import \{ PLUGIN_VERSION \} from "\.\.\/src\/adapters\/plugin-version\.js";/u);
    assert.doesNotMatch(buildScript, /const PLUGIN_VERSION = "/u);
  });
});

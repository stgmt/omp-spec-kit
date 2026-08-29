# `omp-manager-handoff-probe@2` — historical manager-handoff baseline

- **Captured:** 2026-08-24
- **Package under test:** `omp-spec-kit@0.3.1`, built and verified in this repository, then copied to a disposable package root.
- **Runtime:** a disposable Bun host whose sole declared dependency was `@oh-my-pi/pi-coding-agent@17.3.7`.
- **Isolation:** fresh `HOME`, `USERPROFILE`, `PI_CODING_AGENT_DIR`, `OMP_PROFILE=bounded-probe`, and project directory. No persistent credentials, plugin registry, settings, or user MCP configuration were used.
- **Bound:** every probe phase had a 30,000 ms deadline. All phases completed; no model prompt or model call was made.
- **Status:** the JSON below predates the strengthened BDD contract and is retained only as a baseline. It does not prove the now-required manager-owned query or external payload binding; a new Docker receipt must replace it after `SCEN-mri-active-project-manager-receipt` passes.

## Receipt

```json
{
  "schema": "omp-manager-handoff-probe@2",
  "result": "completed",
  "phaseMode": {
    "mode": "bounded",
    "timeoutMs": 30000,
    "terminalPhase": null,
    "checkpoints": {
      "payload": { "status": "completed", "elapsedMs": 3 },
      "imports": { "status": "completed", "elapsedMs": 1723 },
      "enrollment": { "status": "completed", "elapsedMs": 18 },
      "capability-config-load": { "status": "completed", "elapsedMs": 25 },
      "manager-construction": { "status": "completed", "elapsedMs": 0 },
      "target-only-connection": { "status": "completed", "elapsedMs": 107 },
      "disconnect": { "status": "completed", "elapsedMs": 3 },
      "receipt": { "status": "completed", "elapsedMs": 0 }
    }
  },
  "provenance": {
    "harness": { "path": "scripts/probe-omp-discovery-v17.3.7.mjs", "sha256": "33c05fd1fc1a49398482cc6660c91de1ffae7833f0e2662386c61bcc78b2a7d0" },
    "runtime": { "name": "@oh-my-pi/pi-coding-agent", "version": "17.3.7", "packageJsonSha256": "3885c6acb406d4eebf9ffbb8a59aab65ba46cff34fca70bf28c8daa0b40d988c" },
    "package": {
      "name": "omp-spec-kit",
      "version": "0.3.1",
      "packageJsonSha256": "15224065658c03bb41f918e53ba19574cc1c05feeb4d23d93459da6144138384",
      "mcpJsonSha256": "e4d23d9f2f5f076257e0d21f1f24df12b7d4a6e7a633b63f1e5dfd8493e17b32",
      "payload": [
        { "relative": "bin/omp-spec-kit-mcp", "bytes": 220, "sha256": "e17436c64f353fa62fd7f378b9d44c550523b5dd3be4ff69f6485f3837b20f14" },
        { "relative": "dist/extension.js", "bytes": 2431, "sha256": "b8265427c18172e3b45c1e9206b5e9d4d7dd464b268449efd4ca838c7b748bdb" },
        { "relative": "dist/mcp/server.js", "bytes": 6149, "sha256": "f834de07510110a31b904ef1230584bef5ffc92bb9fb7af6412d6c41e8d06cea" }
      ]
    }
  },
  "enrollment": {
    "method": "new PluginManager(cwd).link(packageRoot)",
    "result": { "name": "omp-spec-kit", "version": "0.3.1", "path": "<package-copy>", "enabledFeatures": null, "enabled": true },
    "lockfile": {
      "path": "<home>/.omp/profiles/bounded-probe/plugins/omp-plugins.lock.json",
      "sha256": "abde7f13754dcaa481acde7980e89229a294ed4ade7403f360f5c3301a290831",
      "contents": { "plugins": { "omp-spec-kit": { "version": "0.3.1", "enabledFeatures": null, "enabled": true } }, "settings": {} }
    },
    "link": { "path": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit", "packageJsonSha256": "15224065658c03bb41f918e53ba19574cc1c05feeb4d23d93459da6144138384" }
  },
  "capability": {
    "id": "mcps",
    "providers": ["omp-plugins"],
    "warnings": ["[VS Code] Failed to read <project>/.vscode/mcp.json"],
    "items": [{
      "name": "omp-spec-kit",
      "command": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit/bin/omp-spec-kit-mcp",
      "transport": "stdio",
      "_source": { "provider": "omp-plugins", "providerName": "OMP Extension Packages", "path": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit/.mcp.json", "level": "user" }
    }]
  },
  "configLoad": {
    "options": { "enableProjectConfig": true, "filterExa": true, "filterBrowser": false },
    "inspection": {
      "targetName": "omp-spec-kit",
      "loadedNames": ["omp-spec-kit"],
      "targetConfigs": { "omp-spec-kit": { "type": "stdio", "command": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit/bin/omp-spec-kit-mcp" } },
      "targetSources": { "omp-spec-kit": { "provider": "omp-plugins", "providerName": "OMP Extension Packages", "path": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit/.mcp.json", "level": "user" } },
      "excludedNames": []
    }
  },
  "manager": {
    "construction": "new MCPManager(cwd)",
    "statusEvents": [{ "type": "connecting", "serverNames": ["omp-spec-kit"] }, { "type": "connected", "serverName": "omp-spec-kit" }],
    "connectionResult": { "connectedServers": ["omp-spec-kit"], "errors": {}, "exaApiKeysCount": 0, "toolCount": 8 },
    "disconnect": {
      "before": { "serverNames": ["omp-spec-kit"], "servers": { "omp-spec-kit": { "status": "connected" } } },
      "after": { "serverNames": [], "servers": {} }
    }
  }
}
```

## Reproduction

```sh
npm run build && npm run verify
mkdir -p <tmp>/host <tmp>/project/.omp <tmp>/home <tmp>/agent <tmp>/package-copy
cp -R plugins/omp-spec-kit/. <tmp>/package-copy/
cp scripts/probe-omp-discovery-v17.3.7.mjs <tmp>/host/
cp tests/fixtures/omp-discovery-runtime/package.json tests/fixtures/omp-discovery-runtime/bun.lock <tmp>/host/
(cd <tmp>/host && bun install --frozen-lockfile --ignore-scripts --no-progress)
HOME=<tmp>/home USERPROFILE=<tmp>/home PI_CODING_AGENT_DIR=<tmp>/agent OMP_PROFILE=bounded-probe \
  bun <tmp>/host/probe-omp-discovery-v17.3.7.mjs \
  --runtime-root <tmp>/host/node_modules/@oh-my-pi/pi-coding-agent \
  --cwd <tmp>/project --package-root <tmp>/package-copy \
  --expected-dist-manifest-sha256 "$(sha256sum plugins/omp-spec-kit/dist/manifest.json | cut -d' ' -f1)" \
  --expected-launcher-sha256 "$(sha256sum plugins/omp-spec-kit/bin/omp-spec-kit-mcp | cut -d' ' -f1)" \
  --phase-mode bounded --phase-timeout-ms 30000
```

The probe passes only `configLoad.inspection.targetConfigs` and `targetSources`—each containing the sole key `omp-spec-kit`—to `MCPManager.connectServers`. Before enrollment it binds the copied `dist/manifest.json` digest to the verified build input, verifies every manifest-listed copy hash and the POSIX launcher digest, and rejects a malformed MCP declaration. After connection it selects the `MCPManager.getTools()` wrapper for `omp-spec-kit/spec_inventory`, executes it with project-a inventory arguments, and records the bridge-projected text `inventory ok, returned=<returned>/<observed>` together with those parsed counts, the omitted config `cwd`, process root, and `pi-utils` project root. It does not claim that MCP `structuredContent` crosses the OMP tool bridge.

## Repeatable BDD gate

`SCEN-mri-active-project-manager-receipt` replays this manager-level path from the Docker BDD image. Its Bun host installs only the exact committed fixture lock for `@oh-my-pi/pi-coding-agent@17.3.7`; the scenario copies the already-built plugin package, supplies a fresh `HOME`, `USERPROFILE`, `PI_CODING_AGENT_DIR`, and `OMP_PROFILE=bounded-probe`, and consumes the emitted `omp-manager-handoff-probe@2` JSON receipt. It asserts the completed phases, pre-enrollment copy-to-manifest/launcher binding, provider, sole config/source, zero connection errors, eight tools, and the actual manager-owned `spec_inventory` text plus returned/observed counts exactly matching the direct project-a inventory oracle. The project-a and package-decoy fixtures must have distinct inventory cardinalities, so that exact match proves decoy exclusion; it also proves the omitted target `cwd`, process and `pi-utils` roots, and an empty manager state after disconnect without asserting elapsed timings. `SCEN-mri-missing-payload-refusal` removes the copied `.mcp.json` and proves the payload phase fails before enrollment.

Run only this gate with `npm run test:bdd:omp-discovery`; the Docker wrapper forwards the tag expression to Cucumber while retaining the ordinary full-suite `npm run test:bdd` command. The image has a positive source/test/package `COPY` allowlist, secret/config exclusions in `.dockerignore`, and immutable Bun/Node base-image digests in `tests/distribution/Dockerfile`.

The earlier interactive `/mcp list` omission and `/mcp test` failure remain recorded in the review history, but are unreliable as a manager-handoff verdict: the completed deterministic path invokes `PluginManager.link`, `loadCapability`, `loadAllMCPConfigs`, `MCPManager.connectServers`, and the manager-owned `MCPTool.execute` wrapper. It supersedes that interactive CLI observation only for this manager-level discovery claim; it does not create public-release, upgrade, rollback, or lifecycle proof.

## Source-backed interpretation

`loadAllMCPConfigs()` loads capability items, converts each surviving item into `configs[name]`, preserves `sources[name]`, and returns both (`@oh-my-pi/pi-coding-agent@17.3.7`, `src/mcp/config.ts:99-157`). `MCPManager.connectServers(configs, sources, onStatus)` accepts precisely those two maps (`src/mcp/manager.ts:423-449`); `getTools()` exposes the `MCPTool` wrappers (`src/mcp/manager.ts:795-797`), and `MCPTool.execute(toolCallId, params, onUpdate, ctx, signal)` calls the connected server (`src/mcp/tool-bridge.ts:488-521`). `MCPTool.buildResult()` formats the MCP content into `CustomToolResult.content` text and retains only raw content and `_meta` in details; it does not project MCP `structuredContent` (`src/mcp/tool-bridge.ts:220-244`). `StdioTransport.connect()` resolves the omitted `config.cwd` as `getProjectDir()` and passes that root to `Bun.spawn` (`src/mcp/transports/stdio.ts:578-609`); `getProjectDir()` returns the initialized project directory (`@oh-my-pi/pi-utils/src/dirs.ts:181-191`). `getSource`, `getServerConfig`, `getConnectionStatus`, and `getAllServerNames` expose the manager-side state inspected by the probe (`src/mcp/manager.ts:809-877`). `disconnectAll()` clears connections, pending work, sources, configs, and tools (`src/mcp/manager.ts:944-960`).

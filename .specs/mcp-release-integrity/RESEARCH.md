# Research

## Контекст

v0.3.0 добавил восьмиинструментный read-only MCP adapter, но package `.mcp.json` фиксирует `cwd: "."`. Пиненный OMP provider перепривязывает относительный `cwd` к package directory, поэтому нормальный installed launch читает package folder вместо активного проекта. Одновременно release evidence не связывает publish с exact artifact/tag/lifecycle, а текущая MCP BDD проверяет только два из восьми tool calls. [VERIFIED]

## Источники

- OMP v17.3.7 `omp-plugins` discovery source: relative `command` and `cwd` resolve against the extension package root; raw `args`/`env` are preserved. [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/discovery/omp-plugins.ts#L274-L344]
- OMP v17.3.7 `StdioTransport`: process cwd is `config.cwd ?? getProjectDir()`. [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/mcp/transports/stdio.ts#L578-L609]
- OMP MCP configuration guide: unresolved env indirection remains literal; a bare env-name is copied only when that variable is non-empty. [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md#L377-L425]
- Current package configuration and server resolver. [ref:plugins/omp-spec-kit/.mcp.json:4-11] [ref:src/adapters/query-service.js:15-31] [ref:src/mcp/server.js:89-149]
- Current release evaluator and real Docker BDD harness. [ref:scripts/verify-release.mjs:42-80] [ref:scripts/docker-bdd.sh:1-31]

## Технические находки

### OMP root selection

[VERIFIED] `cwd: "."` in `plugins/omp-spec-kit/.mcp.json` becomes the installed package directory. The documented active-project mechanism is to omit `cwd`, because `StdioTransport` then uses `getProjectDir()`. A static relative `node` argument cannot both locate the packaged server and retain active project cwd, because the provider roots `command` but preserves `args`; a package-relative launcher command solves that split. [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/discovery/omp-plugins.ts#L274-L344] [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/mcp/transports/stdio.ts#L578-L609]

### Environment override behavior

[VERIFIED] Current `OMP_SPEC_KIT_ROOT` uses the documented name-indirection spelling. If the variable is absent, OMP passes the literal string `OMP_SPEC_KIT_ROOT`; current service code recognizes it as a sentinel and falls back to process cwd. v0.3.1 keeps only an explicit validated override; ordinary correctness must not depend on this variable. [src:https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md#L377-L425] [ref:src/adapters/query-service.js:15-31]

### Protocol and test gaps

[VERIFIED] The server currently returns without a response when `message.jsonrpc !== "2.0"`. The existing BDD parity scenario calls only `spec_get_node` and `spec_trace`, compares a fixture graph without per-file manifest hash assertion, and starts `dist/mcp/server.js` from the repository rather than the installed package launcher. [ref:src/mcp/server.js:89-149] [ref:tests/features/spec-mcp.feature:14-49] [ref:tests/helpers/mcp-world.mjs:50-153]

### Release evidence gap

[VERIFIED] `verify-release.mjs` currently accepts a 40-hex receipt commit without comparing it to the supplied `RELEASE_COMMIT`, and v0.3 lifecycle evidence defers mandatory 0.2→0.3 upgrade/rollback proof. Existing FR-13 already makes post-0.1 upgrade and rollback mandatory, so v0.3.1 must implement—not weaken—that contract. [ref:scripts/verify-release.mjs:70-79] [ref:.specs/plugin-distribution/FR.md:101-107]

## Где лежит реализация

- Package MCP config: `plugins/omp-spec-kit/.mcp.json`
- Package launchers: `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` and `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` (new)
- MCP transport: `src/mcp/server.js`
- Shared root/service composition: `src/adapters/query-service.js`
- Package build/validation: `scripts/build-plugin.mjs`, `scripts/verify-package.mjs`
- Candidate/release evaluation: `scripts/create-release-candidate.mjs`, `scripts/verify-public-tree.mjs`, `scripts/verify-release.mjs`, `.github/workflows/verify.yml`, `.github/workflows/release.yml`
- Behavioral proof: `tests/features/spec-mcp.feature`, `tests/step-definitions/spec-mcp.steps.mjs`, `tests/helpers/mcp-world.mjs`, `tests/helpers/extension-probe.mjs`

## Выводы

v0.3.1 is a corrective patch that preserves the read-only scope. The safe path is one package-relative launcher with OMP-selected active-project cwd, one shared service/root decision, all-eight installed-artifact parity BDD, and one candidate archive consumed by publish. The release workflow must fail closed; it must never infer proof from a stage name, stale receipt, static note, or unbound tag. [VERIFIED]

## Project Context & Constraints

### Relevant Rules

| Rule | Path | Summary | Triggered By | Impacts |
|------|------|---------|--------------|---------|
| Docker-only BDD harness | `scripts/docker-bdd.sh` | BDD builds and runs in the image; host fallbacks re-exec into WSL where available. | Any Cucumber verification | FR-3, FR-4, NFR-Reliability |
| Package allowlist | `scripts/verify-package.mjs` | Child package must contain only declared distributable paths and work without source/ambient dependencies. | Launcher/package change | FR-1, FR-3, NFR-Security |
| Existing release eligibility | `scripts/verify-release.mjs` | Release evidence is evaluated before publication and must be extended, not bypassed. | Release workflow change | FR-4, FR-5 |

### Existing Patterns & Extensions

| Source | Path | What It Provides | Relevance |
|--------|------|-------------------|-----------|
| Shared query service | `src/adapters/query-service.js` | One root and one lazy graph per service, returning canonical query envelopes. | Both OMP extension and MCP server must use it. |
| Tool contract registry | `src/adapters/tool-contracts.js` | Exact eight-name SCHEMA-11 mapping and input schema projection. | Tests derive cardinality and valid operation coverage from it. |
| MCP world helper | `tests/helpers/mcp-world.mjs` | Spawned JSON-RPC client, real fixture corpus, extension probe. | Extend rather than replace for installed-package proof. |
| Docker BDD harness | `tests/distribution/Dockerfile` | Builds plugin and runs Cucumber in an isolated image. | Required final behavior gate. |

### Architectural Constraints Summary

The package remains dependency-free and read-only. There is one marketplace, one child package, one extension, and one MCP server. The launcher may resolve only its own packaged server; the server may read only the active project or an explicit validated root. Candidate publication must consume a verified archive and must not rebuild in the publishing job.

## Proof of Concept

**PoC Required:** no

This is a corrective use of the existing Node, OMP, Docker, package, MCP and GitHub Actions mechanisms. The actual installed-package Docker BDD scenario is the release-blocking proof rather than a separate throwaway PoC.

## Cost Estimate

**Runtime/CI:** Docker BDD already builds an image; added installed-package and candidate-negative scenarios add bounded Node subprocesses and archive hashing, not a service dependency.
**Maintenance:** New launcher variants and candidate receipt schema must stay aligned with the pinned OMP v17.3.7 launch contract and exact package allowlist.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OMP differs across POSIX and Windows when launching a package-relative command | Medium | High | Ship POSIX and `.cmd` launchers, run the installed-artifact Docker path, and retain a manual Windows fresh-session receipt before public release. |
| Candidate receipt logic marks an incomplete lifecycle as eligible | Medium | High | Require closed v2 fields, explicit mandatory FR matrix, exact tag/archive digest comparison, and one negative BDD case per missing identity. |
| Tests still bypass the installed package and validate the repository tree | Medium | High | Launch only a copied allowlisted package for root-discovery scenarios; remove source checkout and ambient node_modules ancestry. |
| v0.3.0 users do not learn that its MCP root is broken | Medium | Medium | Add a reversible v0.3.0 advisory and v0.3.1 migration link before promoting the patch. |

## Reality Review Note

`0eccfb81044827b8f358954801bfc1520a7e8972` introduced the original v0.3 MCP surface, so a git pickaxe associates it with FR-1 terminology. It is not evidence that FR-1 is satisfied: the released configuration still sets package `cwd`, which is the defect this v0.3.1 remediation corrects. [ref:plugins/omp-spec-kit/.mcp.json:4-11]

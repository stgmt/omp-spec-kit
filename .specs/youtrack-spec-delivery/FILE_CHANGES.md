# File Changes

## Planned files

| Area | Planned path |
|---|---|
| App manifest/settings | `tools/spec-graph-app/manifest.json`, `settings.json` |
| App widgets | `tools/spec-graph-app/widgets/spec-app`, `spec-board`, `spec-panel`, `spec-service-panel` |
| App bridge | `tools/spec-graph-app/spec-handler.js` |
| Dashboard provisioning | `scripts/spec-dashboard-setup.mjs` (new), `skills/spec-stack-setup/setup.mjs` |
| Demo fixture | `skills/spec-stack-setup/template/demo-full/**` (new) |
| Authoring delete | `src/adapters/tool-contracts.js`, `src/authoring/proposals.js`, `src/authoring/service.js` |
| Service branch delete | `src/service/spec-branches.js`, `src/service/dispatch.js` |
| Projection cleanup | `src/adapters/youtrack-store.js`, `src/adapters/youtrack-projection.js` |
| Agent warning | `plugins/omp-spec-kit/hooks/hooks.json`, new `hooks/sessionstart.mjs`, `src/enforcement/adapter.js` |
| Tests | `tests/features/app-install-live.feature`, `tests/e2e/*`, `tests/*/hook.test.mjs`, authoring/service tests |
| Docs | `README.md`, `skills/spec-stack-setup/SKILL.md`, `CHANGELOG.md` |

No new registry, graph, or projection engine is introduced.

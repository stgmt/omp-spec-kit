# Changelog

## Unreleased — DRAFT

- Initial specification of the centralized spec registry service: dedicated `specs` branch per project, service-only write path, multi-project mounts, remote MCP for agents, YouTrack entry for humans, compose deployment, claims, publish ledger, spec pins.
- **2026-09-13 — model revision**: canonical store changed from per-repo `specs` branches to **one dedicated specs repository** with `<owner>/<project>/.specs/<slug>/` layout (multi-tenant: users → projects → specs). Consumers hold zero repo access; human entry = operator's YouTrack in v1, external YouTrack binding post-v1 via automated onboarding API; metadata store decided as `node:sqlite`; remote MCP transport verified against pinned OMP schema (`type: "http"` + `url` + `headers` + `auth`); omp-spec-kit corpus migration deferred to post-first-release (TASK-14).

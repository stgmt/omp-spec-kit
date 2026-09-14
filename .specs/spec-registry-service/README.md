# Spec Registry Service

Status: DRAFT

Centralized, multi-tenant specification registry hosted by the operator: all canonical `.specs/` content lives in **one dedicated specs repository** (a separate GitHub repo the stack owns — never a branch of a product repo), laid out as `<owner>/<project>/.specs/<slug>/` — many users, many projects per user, many specs per project. Consumers get **no repository access at all** — not even read clones. All access is centralized through two remote surfaces: HTTPS MCP for AI agents, and the YouTrack app for humans and non-developer agents (either the operator's YouTrack, or a consumer's own YouTrack running the extension bound to this backend). Writes go only through the service, which wraps the existing kernel. Deployment is a docker-compose stack.

This specification owns: the dedicated-specs-branch model, the centralized write path and its exclusivity rules, multi-project mounting, the remote agent surface, the YouTrack entry point, claim/ownership semantics, and the compose deployment shape.

It does not own: kernel document semantics (inherited), the plugin's OMP host-side access gate (owned by `spec-mcp-access-gate`), or YouTrack projection internals (`spec-mcp-operations` / youtrack adapters own the sync mechanics; this spec owns only the service's use of them).

## Public states

- **DONE (phase 1 + TASK-11 + TASK-12):** service core (mount manager, `POST /mcp` on the official MCP SDK, write path with bot-pushed commits, `node:sqlite` store, `/registry` + `/drift`, coalescing sync), compose stack (self-contained git/YouTrack/proxy profiles), YouTrack-backed verified identity with owner/writer/reader roles (live E2E: `tests/e2e/`, compose project `spec-auth-e2e`).
- **NEXT:** plugin remote `.mcp.json` (TASK-7), YouTrack app surface completion + agent onboarding (TASK-8), publish pipeline (TASK-9).
- **LATER:** external-YouTrack binding (TASK-13), omp-spec-kit corpus import (TASK-14), consumer pins (TASK-15), external-consumer spec packs (registry Option B/OCI).

## Documents

[Stories](USER_STORIES.md) · [Use cases](USE_CASES.md) · [Research](RESEARCH.md) · [Requirements](REQUIREMENTS.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-registry-service.feature) · [Fixtures](FIXTURES.md) · [Schemas](spec-registry-service_SCHEMA.md)

Local IDs become qualified outside this directory, for example `spec-registry-service:FR-3`.

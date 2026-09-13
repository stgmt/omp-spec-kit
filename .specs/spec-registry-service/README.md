# Spec Registry Service

Status: DRAFT

Centralized, multi-project specification registry hosted by the operator: `.specs/` content lives exclusively on dedicated `specs` branches in the operator's git repositories. Consumers get **no repository access at all** — not even read clones. All access is centralized through two remote surfaces: HTTPS MCP for AI agents, and the YouTrack app for humans and non-developer agents (either the operator's YouTrack, or a consumer's own YouTrack running the extension bound to this backend). Writes go only through the service, which wraps the existing kernel. Deployment is a docker-compose stack.

This specification owns: the dedicated-specs-branch model, the centralized write path and its exclusivity rules, multi-project mounting, the remote agent surface, the YouTrack entry point, claim/ownership semantics, and the compose deployment shape.

It does not own: kernel document semantics (inherited), the plugin's OMP host-side access gate (owned by `spec-mcp-access-gate`), or YouTrack projection internals (`spec-mcp-operations` / youtrack adapters own the sync mechanics; this spec owns only the service's use of them).

## Public states

- **NEXT:** multi-user centralized registry on dedicated per-repo specs branches with service-only writes.
- **LATER:** full YouTrack Hub authN/authZ, publish ledger hardening, external-consumer spec packs (registry Option B/OCI), specs-repo migration if an out-of-repo consumer appears (backlog RISK-4).

## Documents

[Stories](USER_STORIES.md) · [Use cases](USE_CASES.md) · [Research](RESEARCH.md) · [Requirements](REQUIREMENTS.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-registry-service.feature) · [Fixtures](FIXTURES.md) · [Schemas](spec-registry-service_SCHEMA.md)

Local IDs become qualified outside this directory, for example `spec-registry-service:FR-3`.

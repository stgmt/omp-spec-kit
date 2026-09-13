# Spec Registry Service

Status: DRAFT

Centralized, multi-project specification registry: `.specs/` content lives exclusively on a dedicated per-project git branch (`specs`), writes go only through a hosted service that wraps the existing kernel, AI agents consume it via remote MCP, humans and non-developer agents via the YouTrack app. Deployment is a docker-compose stack.

This specification owns: the dedicated-specs-branch model, the centralized write path and its exclusivity rules, multi-project mounting, the remote agent surface, the YouTrack entry point, claim/ownership semantics, and the compose deployment shape.

It does not own: kernel document semantics (inherited), the plugin's OMP host-side access gate (owned by `spec-mcp-access-gate`), or YouTrack projection internals (`spec-mcp-operations` / youtrack adapters own the sync mechanics; this spec owns only the service's use of them).

## Public states

- **NEXT:** multi-user centralized registry on dedicated per-repo specs branches with service-only writes.
- **LATER:** full YouTrack Hub authN/authZ, publish ledger hardening, external-consumer spec packs (registry Option B/OCI), specs-repo migration if an out-of-repo consumer appears (backlog RISK-4).

## Documents

[Stories](USER_STORIES.md) · [Use cases](USE_CASES.md) · [Research](RESEARCH.md) · [Requirements](REQUIREMENTS.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-registry-service.feature) · [Fixtures](FIXTURES.md) · [Schemas](spec-registry-service_SCHEMA.md)

Local IDs become qualified outside this directory, for example `spec-registry-service:FR-3`.

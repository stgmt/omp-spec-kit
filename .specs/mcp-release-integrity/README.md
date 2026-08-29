# MCP Release Integrity

## Current status

The current public MRI baseline is v0.3.2. Tag, commit, candidate/package/archive digests, lifecycle receipt identities, release URL and GitHub asset-attestation identity are summarized in [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json). v0.3.1 is historical corrective evidence; v0.3.0 remains publicly tagged with the active-project-root advisory.

## Goal

Preserve the released active-project-root and protocol corrections, prove exact candidate/lifecycle/release identity, and keep the eight read-only SCHEMA-11 MCP names as the v0.3 first slice / candidate identity rather than a permanent registry ceiling.

## Scope

- Installed MCP starts from the active OMP project, not package cwd.
- Invalid JSON-RPC receives a terminal standards-compliant error.
- The eight v0.3 first-slice names are proven through an isolated copied package and remain registered when later gated names arrive.
- Candidate archive, tag, receipts, lifecycle, release assets, public notes and attestation are identity-bound.
- Upgrade and rollback use the real v0.3.0 public predecessor; history/advisory remain reversible and intact.

## Out of scope

Authoring/mutation APIs, upstream OMP changes, tag/history rewrites, and creating a new runtime release as part of this specification-only corpus repair. Later generator/evidence/authoring names have their own capability gates and do not rewrite v0.3.2 receipts.

## Primary evidence

- [Current public release status](../../docs/validation/release-status-v0.3.2.json)
- [Research](RESEARCH.md)
- [Requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Design](DESIGN.md)
- `mcp-release-integrity.feature` — specification text; only a bound Cucumber Message execution is evidence

`.progress.json` records completion of the four spec-authoring phases only. Runtime v0.3.2 is public; the amended contract checks and task board remain the authority for current revalidation state.
- [Task board](TASKS.md)

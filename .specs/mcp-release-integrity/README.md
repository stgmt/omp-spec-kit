# MCP Release Integrity

## Goal

Correct the released v0.3.0 MCP root and release-proof defects without adding mutation tools, runtime dependencies, or a second plugin package.

## Scope

- Installed MCP starts from the active OMP project, not package cwd.
- Invalid JSON-RPC receives a terminal standards-compliant error.
- All eight read-only MCP tools are proven through an isolated copied package.
- Candidate archive, tag, receipts, lifecycle, release assets, and public notes are identity-bound.
- v0.3.0 history remains intact with a reversible advisory.

## Out of Scope

Authoring/mutation APIs, upstream OMP changes, tag/history rewrites, and actual public publication in this implementation cycle.

## Primary Evidence

- [Research](RESEARCH.md)
- [Requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Design](DESIGN.md)
- [BDD specification](mcp-release-integrity.feature)
- [Task board](TASKS.md)

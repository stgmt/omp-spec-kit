# Changelog

## 2026-08-23 — Specification init

- Created the `spec-enforcement` specification: 11 functional requirements, 12 acceptance criteria, 11 scenarios, 12 contract checks, 10 planned tasks.
- Scope: native OMP spec-discipline enforcement through hook events (`tool_call`, `tool_result`, `context`, `session_start`); planned port of the upstream FR-39 spec-access concept onto pinned OMP v17.3.7 extension surfaces, without Claude hooks, without MCP-only audit, and without any external dependency.
- Sibling to `plan-gate`: reuses the same provenance posture, OMP event surfaces, and self-contained distribution discipline; differs in interception target (`.specs/**` writes vs. `xd://propose`), decision contract (redirect-to-door vs. content-validation), and activation gate (authoring cumulative gate vs. plan-mode signal).
- Research grounded in installed `pi-coding-agent@17.3.7` source paths; every cited runtime contract carries a TASK-1 live probe obligation. Upstream FR-39 is research input only.
- Release boundary: SPEC_ONLY; informational mode may not ship before kernel v0.2; enforcement mode belongs to the roadmap authoring/mutation stage class and cannot ship in v0.1.0/v0.2/v0.3.

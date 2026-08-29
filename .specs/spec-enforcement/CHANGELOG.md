# Changelog


## Unreleased

- Corrected the pinned-host boundary to `DEFERRED_HOST_ABI`: v17.3.7 lacks provider/server/schema fields on tool_call. Added future authenticated host ABI, installed registry, canonical digest formulas and attested producer check receipts. — Contract repair

- Versioned the design as `spec-enforcement@2` and replaced the write/edit/bash shortlist with a closed all-tool effect registry.
- Split pure classification from filesystem-backed realpath/reparse/symlink containment; unknown, incomplete, dynamic, authority-mismatched and indeterminate targets now block conservatively in enforcement mode.
- Restricted mutation authority to the same-candidate `omp-spec-kit` authoring MCP manifest; removed arbitrary door/API and standalone extension plans.
- Added `spec-enforcement-release@2`, AC-10.2/CHK-FR10-02 ownership, existing-factory/build wiring, and product `SPEC_ENFORCEMENT` gate binding.
- Clarified source FR-39 remains DEFER because persistent audit is not delivered.

## 2026-08-23 — Specification init

- Created the `spec-enforcement` specification: 11 functional requirements, 12 acceptance criteria, 11 scenarios, 12 contract checks, 10 planned tasks.
- Scope: native OMP spec-discipline enforcement through hook events (`tool_call`, `tool_result`, `context`, `session_start`); planned port of the upstream FR-39 spec-access concept onto pinned OMP v17.3.7 extension surfaces, without Claude hooks, without MCP-only audit, and without any external dependency.
- Sibling to `plan-gate`: reuses the same provenance posture, OMP event surfaces, and self-contained distribution discipline; differs in interception target (`.specs/**` writes vs. `xd://propose`), decision contract (redirect-to-door vs. content-validation), and activation gate (authoring cumulative gate vs. plan-mode signal).
- Research grounded in installed `pi-coding-agent@17.3.7` source paths; every cited runtime contract carries a TASK-1 live probe obligation. Upstream FR-39 is research input only.
- Release boundary: SPEC_ONLY; informational mode may not ship before kernel v0.2; enforcement mode belongs to the roadmap authoring/mutation stage class and cannot ship in v0.1.0/v0.2/v0.3.

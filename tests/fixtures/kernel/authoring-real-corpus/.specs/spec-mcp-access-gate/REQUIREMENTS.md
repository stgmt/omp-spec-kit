# Requirements Matrix

## Functional traceability

| Requirement | Acceptance criterion | Scenario | Contract check | Delivery task | State |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-current-tool-call-registration) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-only-tool-call-is-registered) | `@feature1`, `SCEN-current-tool-call-registration` | CHK-FR1-01 | TASK-3 | Specified |
| [FR-2](FR.md#fr-2-exact-authoring-allowlist) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-only-the-exact-authoring-allowlist-bypasses-path-denial) | `@feature2`, `SCEN-exact-authoring-allowlist` | CHK-FR2-01 | TASK-1, TASK-4 | Specified |
| [FR-3](FR.md#fr-3-filesystem-backed-containment) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-containment-covers-path-and-filesystem-boundaries) | `@feature3`, `SCEN-filesystem-containment` | CHK-FR3-01 | TASK-2, TASK-4 | Specified |
| [FR-4](FR.md#fr-4-closed-path-policy-decision) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-path-policy-matrix-is-closed) | `@feature4`, `SCEN-closed-path-policy` | CHK-FR4-01 | TASK-1, TASK-2, TASK-4 | Specified |
| [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-blocks-are-bounded-visible-and-stateless) | `@feature5`, `SCEN-bounded-stateless-block` | CHK-FR5-01 | TASK-1, TASK-3, TASK-4 | Specified |
| [FR-6](FR.md#fr-6-single-factory-installed-delivery) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-artifact-uses-one-factory) | @feature6, SCEN-single-factory-installed-policy | CHK-FR6-01 | TASK-3, TASK-4 | Specified |
| [FR-7](FR.md#fr-7-non-mcp-read-and-execution-denial) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-non-mcp-specification-access-is-blocked) | @feature7, SCEN-mcp-access-gate-non-mcp-spec-access | CHK-FR7-01, CHK-FR7-02 | TASK-5, TASK-6 | Specified |
| [FR-8](FR.md#fr-8-windows-read-selector-support) | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-windows-read-selectors) | SCEN-read-selectors | CHK-FR8-01 | TASK-6 | Specified |
| [FR-9](FR.md#fr-9-execution-payload-specification-guard-with-stated-limits) | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-execution-guard-limits) | SCEN-execution-edges | CHK-FR9-01 | TASK-6 | Specified |

## Contract checks

| CHK-ID | Requirement | Traces To | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | Existing factory registers one tool_call handler and no other enforcement event | FR-1, AC-1.1, @feature1 | BDD scenario | Draft | Installed registration receipt |
| CHK-FR2-01 | Exact two names allow; case/prefix/suffix/qualified/embedded near misses do not | FR-2, AC-2.1, @feature2 | BDD scenario | Draft | Real call and one-fault name matrix |
| CHK-FR3-01 | Separator, case, component boundary, dot segment, realpath, symlink, reparse, and new-target cases classify correctly | FR-3, AC-3.1, @feature3 | Integration test | Draft | POSIX and Windows containment matrix |
| CHK-FR4-01 | Closed decision precedence is indeterminate, then spec, then all-outside allow | FR-4, AC-4.1, @feature4 | Unit test | Draft | Exhaustive path-policy matrix |
| CHK-FR5-01 | Block output is bounded, redacted, actionable, and execution creates no hidden state | FR-5, AC-5.1, @feature5 | Unit test | Draft | Golden output and side-effect audit |
| CHK-FR6-01 | Installed bundle runs dependency-absent through one extension factory | FR-6, AC-6.1, @feature6 | Integration test | Draft | Installed artifact smoke |
| CHK-FR7-01 | FR-7 | Registered omp-spec-kit MCP authority reaches the MCP adapter | Integration test | Draft | Positive authority path |
| CHK-FR7-02 | FR-7 | Non-MCP, same-name, unknown-target, special-path, and empty-target calls block | Unit/integration test | Draft | Negative cross-surface matrix |
## Non-functional traceability

| NFR | Related requirements | Delivery task | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-handler-deadline) | FR-3, FR-4 | TASK-2, TASK-4 | Deadline boundary blocks rather than allows |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment-and-redaction) | FR-3, FR-5 | TASK-2, TASK-4 | Cross-platform containment and leak matrix |
| [NFR-REL-1](NFR.md#nfr-rel-1-deterministic-closed-results) | FR-2, FR-4, FR-5 | TASK-1, TASK-4 | Repeated byte-identical decisions |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-reason) | FR-5 | TASK-1, TASK-4 | Golden 512-byte redirect output |
| [NFR-USE-2](NFR.md#nfr-use-2-cross-surface-agent-denial) | FR-7 | TASK-5, TASK-6 | Cross-surface denial, fail-closed unknown extraction, timeout, exception, and unsupported metadata |

## Global invariants

1. Public authoring allowlist is exactly `spec_patch`.
2. Exact-name allowance precedes containment.
3. Non-allowlisted direct `.specs` mutation blocks.
4. Proven non-spec mutation passes.
5. Indeterminate containment blocks.
6. Path comparison uses canonical components, not string prefixes.
7. The capability registers only `tool_call` in the existing extension and keeps no hidden state.
8. Scenario text is not execution evidence.
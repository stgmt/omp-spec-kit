# Changelog


## Unreleased — Contract repair

- Versioned the contract as `plan-gate@2` with implementable `plan-gate-manual@1` and `plan-gate-automatic@1` in `DEFERRED_HOST_ABI`.
- Removed title-only propose interception, guessed temp-root selection, and directory scanning from the automatic design; added the exact post-native-resolver host event contract.
- Set the internal deadline to at most 20 seconds under the 30-second host fail-closed boundary; made unreadable/containment/partial-input branches explicit ALLOW diagnostics.
- Closed explicit candidate, prompt, spec-index, paging, release-record, task, and CHK schemas; added separate host ABI delivery TASK-11 and `CHK-HOST-ABI-01`.

## 2026-08-23 — Specification init

- Created the `plan-gate` specification: 13 functional requirements, 13 acceptance criteria, 13 scenarios, 13 contract checks, 10 planned tasks.
- Scope: native OMP plan-approval content gate; planned port of the upstream `dev-pomogator` plan discipline onto pinned OMP v17.3.7 extension surfaces (`tool_call` on model-issued `write` to `xd://propose`, session-local plan directory, `context` event), without Claude hooks, daemon, or external dependencies.
- Research grounded in installed `pi-coding-agent@17.3.7` source paths and the upstream working tree; every cited runtime contract carries a TASK-1 live probe obligation.
- Release boundary: SPEC_ONLY; the gate belongs to the roadmap authoring/mutation stage class and cannot ship in v0.1.0/v0.2/v0.3.

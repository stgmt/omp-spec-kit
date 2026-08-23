# spec-enforcement

One standalone specification for native OMP spec-discipline enforcement through hook events: the planned port of the upstream spec-access discipline concept (dropped as `MIGRATION_MATRIX.md` FR-39 pending a later adapter/policy stage) onto OMP v17.3.7 extension surfaces, redesigned without Claude hooks, without MCP-only audit, and without any external process or network dependency. This spec is a sibling to `plan-gate`: it reuses the same provenance posture, the same OMP event surfaces, and the same fail-honest doctrine, but targets spec-corpus write interception and diagnostic injection rather than plan approval.

## Status

SPEC_ONLY. All tasks are `Planned`; every Gherkin scenario is specification text with no executed status. The capability belongs to the roadmap "Later — authoring and mutation" stage class: enforcement mode intercepts and can block agent writes to `.specs/**`, so it requires the separate safety review and evidence gates that class demands before any release. Informational mode may not ship before kernel v0.2.

## Why a separate spec

`MIGRATION_MATRIX.md` drops the upstream Claude hook families (source FR-5, FR-6, FR-19, FR-22, FR-24, FR-25, FR-28) because Claude hook lifecycle is outside the OMP-only product boundary, and drops FR-39 (MCP-only spec access + audit) pending a later adapter/policy stage. The enforcement *concept* nevertheless survives on OMP-native surfaces: hook events `tool_call` (pre-execution, may return `{block, reason}` or rewritten `{input}`), `tool_result` (post-execution, may add `{content, details, isError}`), `context` (message injection), and session events (`session_start`, `turn_start`, `agent_end`). `plan-gate` proved this pattern for plan approval; this spec ports the spec-access discipline onto the same surfaces. A separate spec is warranted because the interception target (`.specs/**` writes vs. `xd://propose` writes), the decision contract (redirect-to-door vs. content-validation), and the activation gate (authoring-stage cumulative gate vs. plan-mode signal) differ materially from `plan-gate`.

## Provenance and evidence

- OMP-side contracts are cited from the installed `pi-coding-agent@17.3.7` source paths (see `RESEARCH.md`) against the pinned runtime of `docs/omp-v17.3.7-contract.md` (v17.3.7, commit `8500092296621a6826b7136e840f8a59ea338958`); the pinned-commit [extensions guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md) is the documentation authority — mutable `main` documentation is not. Each cited claim must be re-proven live by TASK-1 probes before implementation.
- Upstream FR-39 (MCP-only spec access + audit log) is research input only. Its concept of centralized spec-access control and audit informs the enforcement surface design, but no MCP server, audit log, or centralized access policy is specified here; those remain deferred per `MIGRATION_MATRIX.md`.
- The `plan-gate` specification is the design sibling and provenance anchor for OMP event-surface usage, fail-honest doctrine, and self-contained distribution posture. Cross-references use qualified form (`plan-gate:FR-N`).
- The `spec-authoring-workflow` specification (when accepted) provides the authoring door contract that enforcement mode redirects to. Cross-references use qualified form (`spec-authoring-workflow:FR-N`).

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | Personas and independent tests |
| [USE_CASES.md](USE_CASES.md) | Interaction flows |
| [RESEARCH.md](RESEARCH.md) | Findings, risks, evidence |
| [FR.md](FR.md) | Functional requirements |
| [NFR.md](NFR.md) | Budgets and non-functional requirements |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Traceability matrix, contract checks, invariants |
| [DESIGN.md](DESIGN.md) | Components, algorithms, decisions |
| [TASKS.md](TASKS.md) | Planned task DAG |
| [spec-enforcement.feature](spec-enforcement.feature) | Gherkin specification scenarios |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned file surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [spec-enforcement_SCHEMA.md](spec-enforcement_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification change log |

## Release boundary

Informational mode may not ship before kernel v0.2 (`spec-kernel:FR-14` eligible for `v0.2`). Enforcement mode belongs to the "Later — authoring and mutation" stage class, whose cumulative gate per `product:FR-6` requires accepted current-candidate `plugin-distribution:FR-13`, `spec-kernel:FR-14` for both `v0.2` and `v0.3` with the typed predecessor linkage, and `spec-authoring-workflow:FR-13` before any authoring/mutation capability registers; this spec adds its own release conjunction (FR-11) on top of that cumulative gate and SHALL NOT be read as loosening it. Entry additionally requires: accepted TASK-1 live ABI probes, the dependency-absent self-contained runtime proof of this spec, an independent adversarial review, and an explicit release-stage decision recorded in `ROADMAP.md`.

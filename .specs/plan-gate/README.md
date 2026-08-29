# plan-gate

This specification defines deterministic plan-content validation plus a future automatic approval gate. Manual/advisory validation can consume an explicitly supplied plan today; automatic blocking requires the exact post-native-resolver host event in `docs/omp-plan-approval-event-contract.md`.

## Status

SPEC_ONLY. Automatic mode is `DEFERRED_HOST_ABI` on pinned OMP v17.3.7 because that runtime exposes no selected-plan approval event. Scenario text is not execution evidence; the spec must not simulate automatic support with guessed paths.

## Why a separate spec

The portable capability is deterministic plan validation. Native OMP currently owns plan fallback selection and local/session transitions. The future automatic adapter receives the already selected plan URL/content/hash through a new host event; it does not intercept a model write and reimplement resolution. Claude hooks, daemon dispatch and harness state remain excluded.

## Provenance and evidence

- OMP-side contracts are cited from the installed `pi-coding-agent@17.3.7` source paths (see `RESEARCH.md`) against the pinned runtime of `docs/omp-v17.3.7-contract.md` (v17.3.7, commit `8500092296621a6826b7136e840f8a59ea338958`); the pinned-commit [extensions guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md) is the documentation authority — mutable `main` documentation is not. Each cited claim must be re-proven live by TASK-1 probes before implementation.
- Upstream plan-gate facts (section skeleton, phase semantics, thresholds, deny format) are cited from the live `E:\repos\dev-pomogator` working tree as research evidence only. They are **not** an `IMPORT_MANIFEST.yaml` snapshot import; any byte import still requires its own provenance, SHA-256, and license disposition decision per repository policy.
- The design analysis produced on 2026-08-23 in the upstream repository (`audit-reports/omp-plan-mode-analysis-2026-08-23.md`, `audit-reports/omp-plan-gate-design-2026-08-23.md`) is prior-art research input, not target authority.

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
| [plan-gate.feature](plan-gate.feature) | Gherkin specification scenarios |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned file surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [plan-gate_SCHEMA.md](plan-gate_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification change log |

## Release boundary

Manual/advisory validation is an independent specified capability. Automatic plan approval remains `DEFERRED_HOST_ABI` until a pinned OMP release satisfies `docs/omp-plan-approval-event-contract.md`; then it additionally requires the complete `plan-gate:FR-13` aggregate. It neither depends on authoring mutation delivery nor loosens another product gate.

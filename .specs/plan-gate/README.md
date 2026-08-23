# plan-gate

One standalone specification for a native OMP plan-approval content gate: the planned port of the upstream `dev-pomogator` plan discipline (`tools/plan-pomogator/plan-gate.ts` + `validate-plan.ts`) onto OMP v17.3.7 extension surfaces, redesigned without Claude hooks, without the upstream hook-service daemon, and without any external process or network dependency.

## Status

SPEC_ONLY. All tasks are `Planned`; every Gherkin scenario is specification text with no executed status. The capability belongs to the roadmap "Later — authoring and mutation" stage class: it intercepts and can block plan approval, so it requires the separate safety review and evidence gates that class demands before any release.

## Why a separate spec

`MIGRATION_MATRIX.md` drops the upstream Claude hook families (source FR-5, FR-6, FR-19, FR-22, FR-24, FR-25, FR-28) because Claude hook lifecycle is outside the OMP-only product boundary. The plan-approval content gate is nevertheless a portable *validation concept*: deterministic structure, duplicate, grounding, cross-reference, and spec-reference checks over a plan document. This specification rewrites that concept as OMP-native behavior on pinned v17.3.7 surfaces: the `tool_call` hook event on the model-issued `write` targeting `xd://propose`, the session-local plan directory, and the `context` event. No Claude surface, daemon dispatch, or harness state is carried over.

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

The gate may not ship in v0.1.0/v0.2/v0.3. It belongs to the "Later — authoring and mutation" stage class, whose cumulative gate per `product:FR-6` requires accepted current-candidate `plugin-distribution:FR-13`, `spec-kernel:FR-14` for both `v0.2` and `v0.3` with the typed predecessor linkage, and `spec-authoring-workflow:FR-13` before any authoring/mutation capability registers; this spec adds its own release conjunction (FR-13) on top of that cumulative gate and SHALL NOT be read as loosening it. Entry additionally requires: accepted TASK-1 live ABI probes, the dependency-absent self-contained runtime proof of this spec, an independent adversarial review, and an explicit release-stage decision recorded in `ROADMAP.md`. Spec-reference enforcement uses the repository `.specs` tree directly (slug directories and GLFM headings) and does not depend on the spec-kernel query service; it may be strengthened by the kernel only after v0.2 exists.

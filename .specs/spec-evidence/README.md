# spec-evidence

One standalone specification for the evidence and honesty evaluation layer: a pure function that consumes an immutable spec-kernel graph and immutable execution-artifact bytes, then produces artifact-level ingestion state, scenario-result joins, freshness/staleness verdicts, fail-closed task status truth, waiver honesty, coverage census with conservation equations, and release-eligibility contributions. This layer exists because `spec-kernel:FR-6` explicitly forbids the kernel from converting structural parsing into readiness or passing-test claims; evidence evaluation is therefore a separate specification with its own boundary, inputs, and invariants.

## Status

SPEC_ONLY. All tasks are `Planned`; every Gherkin scenario is specification text with no executed status. The capability belongs to a roadmap stage after kernel v0.2 and requires an explicit release-stage decision recorded in `ROADMAP.md`.

## Why a separate spec

`spec-kernel:FR-6` states that diagnostics "never convert a structural parse into a readiness or passing-test claim." The kernel parses definitions, references, headings, and links; it does not evaluate whether a test passed, whether evidence is fresh, or whether a task is verified. The evidence/honesty layer consumes the kernel's immutable graph as one input and adds execution-artifact evaluation as a second input, producing verdicts the kernel is architecturally forbidden from producing. `MIGRATION_MATRIX.md` dispositions upstream FR-32 (Evidence-derived task status, REWRITE), FR-56 (Canonical coverage + freshness overlay, ADOPT), FR-35 (Test-quality honesty gate, ADOPT), FR-9 (Language-neutral Cucumber Messages input, ADOPT), FR-31 (Real multi-language NDJSON fixtures, ADOPT), FR-46 (Task↔scenario↔requirement trace, ADOPT), and FR-50 (Refuse fake-close of waived tasks, ADOPT) all land here rather than in the kernel.

## Provenance and evidence

- Upstream research provenance lives in `docs/upstream/dev-pomogator/spec-generator-v4/` (`FR.md`, `DESIGN.md`). These documents are cited as research evidence only and are never target authority.
- The spec-kernel graph contract (`spec-kernel:FR-1` through `spec-kernel:FR-14`) is the authoritative input shape; this spec adapts to it without modifying it.
- Real fixture admission follows `spec-kernel:FR-11` discipline: real producer bytes, SHA-256, provenance, reviewed ground truth.
- No upstream byte is imported without its own provenance, SHA-256, and license disposition decision per repository policy.

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
| [spec-evidence.feature](spec-evidence.feature) | Gherkin specification scenarios |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned file surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [spec-evidence_SCHEMA.md](spec-evidence_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification change log |

## Release boundary

This specification belongs to a stage after kernel v0.2. It requires an explicit release-stage decision recorded in `ROADMAP.md` before any implementation may ship. Its release-eligibility contribution (FR-13) plugs the future stage's all-not-any conjunction like `spec-kernel:FR-14` but SHALL NOT loosen the `product:FR-6` cumulative gate. Entry additionally requires: accepted kernel v0.2 graph as input, real-producer fixture corpus with reviewed ground truth, budget evidence per NFR, and an independent adversarial review record. Structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence.

When this layer exists, MCP SHALL expose `get_test_result` and `get_scenario_trace` as read-only projections of evaluator output ([FR-14](FR.md#fr-14-mcp-projection-of-get_test_result-and-get_scenario_trace)). That projection is not a v0.2/v0.3 kernel required check. `spec-kernel:FR-6` remains forbidden from pass/fail claims. Until this FR exists, `spec-lsp` hover SHALL NOT invent run results.

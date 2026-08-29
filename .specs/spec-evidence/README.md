# spec-evidence

This specification defines a pure, hash-bound evidence evaluator plus two later read-only MCP projections. It consumes kernel definition hashes and immutable producer bytes; it outputs ingestion, producer result/join/freshness records, fail-closed task truth, split conservation census, diagnostics and a candidate-bound release aggregate. It never adds pass/fail semantics to the kernel.

## Status

SPEC_ONLY. `spec-evidence@2` is the current implementable contract; no runtime or accepted evidence aggregate exists. The capability is independent of LSP/generator-read siblings and requires the delivered v0.3 baseline plus its exact `spec-evidence-mcp@1` aggregate.

## Why a separate spec

`spec-kernel:FR-6` states that diagnostics "never convert a structural parse into a readiness or passing-test claim." The kernel parses definitions, references, headings, and links; it does not evaluate whether a test passed, whether evidence is fresh, or whether a task is verified. The evidence/honesty layer consumes the kernel's immutable graph as one input and adds execution-artifact evaluation as a second input, producing verdicts the kernel is architecturally forbidden from producing. `MIGRATION_MATRIX.md` dispositions upstream FR-32 (Evidence-derived task status, REWRITE), FR-56 (Canonical coverage + freshness overlay, ADOPT), FR-35 (Test-quality honesty gate, ADOPT), FR-9 (Language-neutral Cucumber Messages input, ADOPT), FR-31 (Real multi-language NDJSON fixtures, ADOPT), FR-46 (Task↔scenario↔requirement trace, ADOPT), and FR-50 (Refuse fake-close of waived tasks, ADOPT) all land here rather than in the kernel.

## Provenance and evidence

- Upstream research provenance lives in `docs/upstream/dev-pomogator/spec-generator-v4/` (`FR.md`, `DESIGN.md`). These documents are cited as research evidence only and are never target authority.
- Historical kernel@1 and future kernel@2 snapshots provide graph/scenario content hashes; step-binding hashes are required when applicable.
- Real fixture admission follows `spec-kernel:FR-11`: real producer bytes, immutable hashes, provenance and reviewed ground truth.
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

This capability requires the delivered v0.3 baseline and one exact `spec-evidence-mcp@1` aggregate containing current PASS records for CHK-FR1-01 through CHK-FR14-01. Real multi-producer fixtures, budget evidence and independent review are mandatory. It contributes to, but never loosens, `product:FR-6`.

After that aggregate passes, MCP may expose `get_test_result` and `get_scenario_trace` as exact read-only projections of evaluator output ([FR-14](FR.md#fr-14-mcp-projection-of-gettestresult-and-getscenariotrace)). They never enter historical kernel-v0.3. Until the projection is delivered, LSP hover exposes kernel-stored fields only.

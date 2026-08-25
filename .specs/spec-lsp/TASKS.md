# Tasks

All tasks are `Planned`. No task has executed status in this specification-only state.

## TASK-1: Live OMP LSP ABI probes

**Status:** Planned

Probe the pinned OMP runtime to confirm every cited LSP contract before implementation: `lsp.diagnosticsOnWrite` trigger semantics, `lspServers` → `.lsp.json` registration, `lsp.lazy` cold-start behavior, `lsp.shared` broker compatibility, `textDocument/didSave` → diagnostic publication timing, and agent prompt routing for symbol-aware work. Record probe results as gating evidence for FR-1, FR-9, FR-10, FR-11.

**Depends on:** Pinned OMP runtime version.

**Refs:** [FR-1](FR.md#fr-1-one-server-semantic-free-read-projection), [FR-9](FR.md#fr-9-incremental-re-evaluation-budget-and-lazy-start), [FR-10](FR.md#fr-10-scope-containment-and-honest-absence), [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)

## TASK-2: Spec-layer diagnostic mapping implementation

**Status:** Planned

Implement the kernel-finding-to-LSP-diagnostic mapping pipeline. Map code, file, line, message, and severity. Verify 1:1 correspondence on shared fixtures. Produce CHK-FR3-01 evidence for [FR-3](FR.md#fr-3-spec-layer-diagnostics-mapped-from-kernel-conformance-findings) and honor the read-only posture of [FR-2](FR.md#fr-2-read-only-posture-with-proposal-only-code-actions).

**Depends on:** TASK-1, `spec-kernel:FR-6` accepted.

**Refs:** [FR-3](FR.md#fr-3-spec-layer-diagnostics-mapped-from-kernel-conformance-findings)

## TASK-3: Definition and references via kernel anchor registry

**Status:** Planned

Implement `textDocument/definition` and `textDocument/references` handlers using kernel `getNode` and `getEdges`. Handle ambiguity per `spec-kernel:FR-4`. Produce CHK-FR4-01 evidence.

**Depends on:** TASK-1, `spec-kernel:FR-4`, `spec-kernel:FR-5` accepted.

**Refs:** [FR-4](FR.md#fr-4-definition-and-references-through-the-kernel-anchor-registry)

## TASK-4: Completion and documentSymbol implementation

**Status:** Planned

Implement `textDocument/completion` over registered aliases and `textDocument/documentSymbol` outline from kernel node inventory. Produce CHK-FR5-01 evidence.

**Depends on:** TASK-1, `spec-kernel:FR-2` accepted.

**Refs:** [FR-5](FR.md#fr-5-completion-over-registered-aliases-and-documentsymbol-outline)

## TASK-5: Hover for node body and scenario provenance

**Status:** Planned

Implement `textDocument/hover` returning kernel node body/status for spec definitions and result/provenance/freshness for scenario tags. Handle absent-graph empty response. Produce CHK-FR6-01 evidence.

**Depends on:** TASK-1, `spec-kernel:FR-8` accepted.

**Refs:** [FR-6](FR.md#fr-6-hover-surfaces-node-body-and-scenario-provenance)

## TASK-6: Step layer with bundled libraries

**Status:** Planned

Integrate `@cucumber/gherkin` and `@cucumber/cucumber-expressions` as bundled dependencies. Implement step parsing, matching against kernel graph `StepBinding` nodes, and verdict emission (defined/undefined/ambiguous). Support pytest-bdd files. Produce CHK-FR7-01 evidence.

**Depends on:** TASK-1, `spec-kernel:FR-2` (step-binding nodes) accepted.

**Refs:** [FR-7](FR.md#fr-7-step-layer-centralization-with-bundled-libraries)

## TASK-7: Adapter-to-service parity harness

**Status:** Planned

Build the CHK-FR8-01 parity harness comparing LSP definition/references/diagnostics responses to kernel query service responses on fingerprint-bound shared fixtures. Produce pass/fail evidence record.

**Depends on:** TASK-2, TASK-3, TASK-4.

**Refs:** [FR-8](FR.md#fr-8-adapter-to-service-parity-check)

## TASK-8: Oracle parity harness for step verdicts

**Status:** Planned

Build the CHK-FR12-01 oracle harness running `@cucumber/language-server` in test infrastructure only. Compare step verdicts on shared cucumber-runner fixtures. Verify pytest-bdd equivalent quality. Produce evidence record.

**Depends on:** TASK-6.

**Refs:** [FR-12](FR.md#fr-12-oracle-parity-for-cucumber-runner-step-verdicts)

## TASK-9: Self-contained bundle and distribution proof

**Status:** Planned

Produce the dependency-absent installed artifact smoke proving the server executes without source checkout, root `node_modules`, or third-party binaries. Verify Marksman DROP is honored. Register through `lspServers` manifest. Produce CHK-FR11-01 evidence.

**Depends on:** TASK-6 (step libraries bundled).

**Refs:** [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)

## TASK-10: Budget measurement and benchmark report

**Status:** Planned

Measure incremental re-evaluation latency (≤150ms p95), cold-start latency, navigation operation latency, and step-layer latency on the reference benchmark corpus. Produce NFR-PERF-1 evidence report with all required metadata.

**Depends on:** TASK-2, TASK-3, TASK-4, TASK-5, TASK-6.

**Refs:** [FR-9](FR.md#fr-9-incremental-re-evaluation-budget-and-lazy-start)

## TASK-11: Scope containment and honest absence verification

**Status:** Planned

Verify external root/symlink/traversal refusal. Verify absent-graph explanatory diagnostics. Produce CHK-FR10-01 evidence.

**Depends on:** TASK-1.

**Refs:** [FR-10](FR.md#fr-10-scope-containment-and-honest-absence)

## TASK-12: Real fixture capture and provenance for step layer

**Status:** Planned

Capture real-producer `.feature` and step-definition fixtures with complete provenance per `spec-kernel:FR-11` posture. Review ground truth for step verdicts. Produce CHK-FR12-01 fixture manifest.

**Depends on:** Fixture producer identification.

**Refs:** [FR-12](FR.md#fr-12-oracle-parity-for-cucumber-runner-step-verdicts)

# Tasks

All tasks are `Planned` unless marked `Blocked`. No task has executed status in this specification-only state.

## TASK-1: Live OMP LSP ABI probes

**Status:** Planned

Probe the pinned OMP runtime to confirm every cited LSP contract before implementation: `lsp.diagnosticsOnWrite` trigger semantics, `lspServers` → `.lsp.json` registration, `lsp.lazy` cold-start behavior, `lsp.shared` broker compatibility, `textDocument/didSave` timing, fileType routing for `.md` outside `.specs/**`, and whether the host agent prompt still mandates `lsp` for **code** (not specs). Record that observation; spec work MUST still go through MCP. Do not treat "agent must use lsp for specs" as a desired outcome. Record probe results as gating evidence for FR-1, FR-2, FR-9, FR-10, FR-11.

**Depends on:** Pinned OMP runtime version.

**Refs:** [FR-1](FR.md#fr-1-semantic-free-lsp-used-by-mcp-invisible-to-the-agent), [FR-2](FR.md#fr-2-read-only-posture-no-agent-visible-codeaction), [FR-9](FR.md#fr-9-honest-rebuild-on-save-150-ms-incremental-is-not-this-stages-gate), [FR-10](FR.md#fr-10-scope-containment-out-of-scope-no-op-and-honest-absence), [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)



## TASK-2: Spec-layer diagnostic mapping implementation

**Status:** Planned

Implement the kernel-finding-to-LSP-diagnostic mapping pipeline. Map code, file, line, message, and severity. Verify 1:1 correspondence on shared fixtures. Produce CHK-FR3-01 evidence.

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

## TASK-5: Hover for kernel-stored fields only

**Status:** Planned

Implement `textDocument/hover` returning kernel node title/kind/body/status and kernel `SCENARIO` attributes. Do not surface run result, provenance, or freshness. Produce CHK-FR6-01 evidence.

**Depends on:** TASK-1, `spec-kernel:FR-8` accepted.

**Refs:** [FR-6](FR.md#fr-6-hover-surfaces-only-fields-the-kernel-actually-stores)

## TASK-6: Prove step-layer absence

**Status:** Planned

CHK-FR7-01: production `lspServers` does not register `@cucumber/language-server`; a `.feature` with unbound steps produces no step-binding diagnostics; the adapter does not scan `tests/step-definitions/**`.

**Depends on:** TASK-1.

**Refs:** [FR-7](FR.md#fr-7-step-diagnostics-only-after-kernel-step-bindings-exist)


## TASK-7: Adapter-to-service parity harness

**Status:** Planned

Build the CHK-FR8-01 parity harness comparing LSP definition/references/diagnostics responses to kernel query service responses on fingerprint-bound shared fixtures.

**Depends on:** TASK-2, TASK-3, TASK-4.

**Refs:** [FR-8](FR.md#fr-8-adapter-to-service-parity-check)

## TASK-8: Prove oracle parity is not a release member

**Status:** Planned

CHK-FR12-01: evidence manifest for this stage does not require oracle match; production config has no cucumber language-server; no step diagnostics.

**Depends on:** TASK-6.

**Refs:** [FR-12](FR.md#fr-12-this-stages-release-proves-step-layer-absence-not-oracle-parity)

## TASK-9: Self-contained bundle and distribution proof

**Status:** Planned

Produce the dependency-absent installed artifact smoke proving the server executes without source checkout, root `node_modules`, cucumber libraries, or third-party binaries. Register through `lspServers`. Sources at `src/lsp/*.js`. Produce CHK-FR11-01 evidence.

**Depends on:** TASK-2.

**Refs:** [FR-11](FR.md#fr-11-self-contained-dependency-safe-distribution)

## TASK-10: Measure didSave rebuild; do not gate on 150 ms

**Status:** Planned

Measure didSave rebuild p95, cold-start, and navigation latency. Record 150 ms as informational only. CHK-FR9-01 proves lazy start and records the measurement.

**Depends on:** TASK-2, TASK-3, TASK-4, TASK-5.

**Refs:** [FR-9](FR.md#fr-9-honest-rebuild-on-save-150-ms-incremental-is-not-this-stages-gate)

## TASK-11: Scope containment, out-of-scope no-op, honest absence

**Status:** Planned

Verify external root/symlink/traversal refusal. Verify `.md` outside `.specs/**` is an empty no-op. Verify absent-graph explanatory diagnostics. Produce CHK-FR10-01 evidence.

## TASK-12: Map kernel step diagnostics after CHK-FR15-01

**Status:** Blocked

Blocked on [spec-kernel TASK-12](../spec-kernel/TASKS.md#task-12-contained-step-binding-index) / [FR-15](../spec-kernel/FR.md#fr-15-contained-step-binding-index-not-a-v02v03-release-member) / `CHK-FR15-01` PASS.

When unblocked: publish kernel `STEP_UNDEFINED`/`STEP_AMBIGUOUS` one-to-one; `definition` on a bound step follows `BINDS_STEP`; do not parse `tests/step-definitions` in this adapter; do not register `@cucumber/language-server`.

**Depends on:** `spec-kernel:CHK-FR15-01` PASS, this spec TASK-2 (diagnostic mapping).

**Refs:** [FR-7](FR.md#fr-7-step-diagnostics-only-after-kernel-step-bindings-exist)


# Functional Requirements

All runtime identities in this specification use `spec-enforcement:<local-id>`. The linked Gherkin scenarios are specifications only and have no executed status. The enforcement hooks target pinned OMP v17.3.7 extension surfaces; every cited runtime contract carries a probe obligation in [TASKS.md](TASKS.md) before implementation.

## FR-1: Event-surface selection and pinning

The enforcement capability SHALL subscribe only to `tool_call` for pre-execution effect classification, `tool_result` for post-execution kernel-finding additions, `context` for one bounded corpus message, and `session_start` for kernel/product-gate and candidate-bundled manifest initialization. Pinned v17.3.7 exposes no provider/server/schema identity on `tool_call`; accepted enforcement SHALL remain `DEFERRED_HOST_ABI` until a later pinned host emits `tool-call-authority-abi@1`. Every `tool_call`, not only known write/edit/bash names, SHALL enter the closed tool-effect classifier. Every cited event/result/input contract SHALL be re-proven by TASK-1 on the exact pinned OMP runtime; mutable `main` documentation is not evidence.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-event-subscriptions-match-the-pinned-claim-set)

**Scenario:** `@feature1` / `SCEN-event-surface-selection`

**Sources:** installed `src/extensibility/hooks/types.ts` `ToolCallEvent`; `src/extensibility/shared-events.ts` `ContextEvent`, `ToolCallEventResult`; `docs/hooks.md` event catalog; `plan-gate:FR-1` provenance posture for pinned-commit citation.

## FR-2: Informational mode diagnostic injection

While informational mode is active (stages before any authoring door exists), the hooks SHALL inject spec-kernel findings and corpus census summaries into `tool_result` content and `context` messages. The hooks SHALL NEVER block any tool execution in informational mode. The hooks SHALL NEVER mutate repository state. Diagnostic injections SHALL be bounded (≤2 KiB per `tool_result` addition, ≤4 KiB per `context` message). Kernel diagnostics SHALL contain only findings produced by `spec-kernel:FR-6`; no private rule set SHALL be introduced. When the kernel is unavailable, informational summaries SHALL be absent with an explicit stated reason per FR-4.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-diagnostics-are-injected-only-in-informational-mode), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-corpus-census-is-injected-on-session-start)

**Scenarios:** `@feature2` / `SCEN-informational-mode-diagnostic-injection`; `@feature2` / `SCEN-corpus-census-session-start`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts` post-execution emission; `src/extensibility/shared-events.ts` `ContextEvent`; `spec-kernel:FR-6` diagnostics contract; `plan-gate:FR-3` injection precedent.

## FR-3: Enforcement mode write interception

While enforcement mode is active, every `tool_call` SHALL be classified by the closed `ToolEffectRegistry`. A registry-bound `SPEC_AUTHORING_AUTHORITY` call whose server/profile/tool/candidate identity matches the accepted `spec-authoring-workflow@1` authority or separately accepted additive `spec-authoring-workflow@2` authority SHALL pass, but only when the host-authenticated provider/server/schema envelope matches the candidate-bundled registry. A known `READ_ONLY` call SHALL pass. A `MAY_WRITE_TARGETS` call SHALL pass only when its exhaustive extractor and the filesystem-backed resolver prove every target is outside `.specs/**`; any target contained by `.specs/**` SHALL BLOCK with a redirect to the qualified authoring MCP authority. `UNKNOWN`, incomplete extraction, dynamic target, containment ambiguity, or resolver failure SHALL BLOCK in enforcement mode with a bounded visible reason. Pure classification SHALL not claim filesystem containment; realpath, Windows reparse-point, POSIX symlink, nearest-existing-ancestor, and project-root checks belong to the I/O resolver.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-spec-writes-are-blocked-or-redirected-in-enforcement-mode)

**Scenario:** `@feature3` / `SCEN-enforcement-mode-write-interception`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts:42–74` block semantics; `docs/skills/authoring-hooks.md` lines 82–101 pre-tool blocking contract; `plan-gate:FR-10` deny format discipline; `spec-authoring-workflow:FR-12` no-bypass invariant.

## FR-4: Fail-honest policy

Every internal fault SHALL be explicit. Informational-mode kernel/render faults SHALL produce one bounded visible diagnostic and SHALL never block. In enforcement mode, failures unrelated to write-effect safety MAY degrade visibly, but a registry/extractor/authority/containment fault SHALL return a conservative BLOCK with code `TARGET_INDETERMINATE`; it SHALL never silently pass a potentially mutating call. Handler exceptions SHALL be caught inside the adapter and translated before the OMP wrapper's outer fail-closed boundary. No path may report fake success, fake conformance, or an enforcement decision without its reason/code.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-hook-errors-produce-explicit-visible-messages)

**Scenario:** `@feature4` / `SCEN-fail-honest-policy`

**Sources:** installed `src/extensibility/hooks/tool-wrapper.ts:43` fail-closed default; `spec-kernel:FR-6` anti-fake-green lineage; `plan-gate:FR-2` fault compensation precedent (adapted from fail-open to fail-honest).

## FR-5: No hidden state

The enforcement capability SHALL keep no private persistent logs, counters, audit trails, or alternate query tool. Observable state SHALL surface through event-visible results/messages and bounded session-local diagnostic records only. No files SHALL be created outside the session-local temporary directory; no network, credential access, or subprocess is permitted. Full FR-39 audit logging remains `DEFER` in `MIGRATION_MATRIX.md`; this capability does not claim to deliver it.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-no-state-exists-outside-event-visible-records)

**Scenario:** `@feature5` / `SCEN-no-hidden-state`

**Sources:** `MIGRATION_MATRIX.md` row FR-39 DEFER rationale; `spec-kernel:FR-1` pure read-only boundary; `plan-gate:FR-11` self-contained runtime precedent.

## FR-6: Dependency-safe distribution

Hook modules SHALL ship inside the bundled `omp-spec-kit` plugin artifact with no ambient `node_modules`, no dynamic post-install downloads, no native addons, and no unresolved dynamic imports. The runtime SHALL either use no third-party dependencies or fully bundle every non-OMP dependency and required data/license. Hook absence (module not found, factory throws at load time) SHALL degrade honestly per FR-4 and FR-8: an explicit diagnostic message SHALL be produced, and the session SHALL continue without enforcement or informational behavior. This posture mirrors `spec-kernel:FR-10` and `plan-gate:FR-11`.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-hooks-execute-dependency-absent)

**Scenario:** `@feature6` / `SCEN-dependency-safe-distribution`

**Sources:** `spec-kernel:FR-10` self-contained runtime distribution; `plan-gate:FR-11` self-contained in-process runtime; `docs/marketplace.md` plugin installation model.

## FR-7: No bypass paths

The installed artifact SHALL carry a closed `ToolEffectRegistryEntry {toolName,effect,targetExtractor,authority}` for every host-visible tool in its supported pin and SHALL compare that manifest to the live tool registry at session start. Only the exact accepted authoring MCP server/profile/tool/candidate identities are `SPEC_AUTHORING_AUTHORITY`. Raw or indirect writers use exhaustive target extraction plus the I/O resolver. A newly registered, renamed, unclassified, dynamically targeted, or incompletely extracted tool is `UNKNOWN` and SHALL BLOCK in enforcement mode unless a closed registry update proves it `READ_ONLY` or proves all targets non-spec. No config, environment variable, caller exception, raw edit endpoint, or alternate tool may bypass this rule.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-all-write-surfaces-to-specs-are-intercepted)

**Scenario:** `@feature7` / `SCEN-no-bypass-paths`

**Sources:** `spec-authoring-workflow:FR-12` no-bypass invariant; installed `src/extensibility/extensions/wrapper.ts` tool wrapping for all registered tools; `docs/extensions.md` line 44 — every tool execution is wrapped with extension interception.

## FR-8: Degradation ladder

Before product acceptance, missing kernel or authoring/product evidence yields explicit informational/degraded state and no enforcement claim. After same-candidate `SPEC_ENFORCEMENT` acceptance, kernel query failure disables only kernel finding/census projection; the independent registry/authority/resolver write gate SHALL remain active so failure cannot open a bypass. Every degradation records the missing component and behavior change.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-enforcement-is-inert-before-cumulative-gate-acceptance)

**Scenario:** `@feature8` / `SCEN-degradation-ladder`

**Sources:** `spec-kernel:FR-10` honest degradation posture; `plan-gate:FR-2` fault inventory precedent; RESEARCH RF-5 fail-honest distinction.

## FR-9: Stage-gated activation

Enforcement mode SHALL activate only when the current product evaluator reports `SPEC_ENFORCEMENT` accepted for the same candidate artifact. That capability gate requires the delivered v0.3 baseline, accepted `AUTHORING_MCP` capability (including evidence plus `spec-authoring-workflow:FR-13`/`FR-14`), and accepted `spec-enforcement:FR-11`. Before acceptance or while `tool-call-authority-abi@1` is unavailable, behavior is informational/degraded only regardless of local configuration. `session_start` SHALL re-hash and cache product/candidate/authoring-authority/installed-registry digests plus the accepted host-ABI receipt; it SHALL NOT claim to enumerate a live registry on v17.3.7. Missing, stale, different-candidate, or ambiguous product/authority evidence prevents activation; an installed-registry/host-envelope mismatch does not create a bypass — known authenticated entries keep policy and new/changed tools become `UNKNOWN` and block conservatively with a visible pin-mismatch diagnostic.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-enforcement-activates-only-after-cumulative-gate)

**Scenario:** `@feature9` / `SCEN-stage-gated-activation`

**Sources:** `product:FR-6` cumulative gate; `spec-authoring-workflow:FR-13` authoring door acceptance; `ROADMAP.md` lines 46–50 authoring/mutation entry gates.

## FR-10: Diagnostics are spec-kernel findings only

Every spec-conformance finding injected after a read SHALL originate from `spec-kernel:FR-6`; the extension SHALL contain no private rule catalog, parser, or independent conformance producer. Enforcement-policy diagnostics (registry, authority, containment, mode, and adapter fault codes) are a separate closed record kind and SHALL never be labeled as kernel findings or spec conformance. A successful kernel query with no findings SHALL state `no findings`; an unavailable kernel SHALL state unavailable, never success.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-diagnostics-originate-from-spec-kernel-only), [AC-10.2](ACCEPTANCE_CRITERIA.md#ac-102-no-independent-conformance-path-exists-in-the-extension)

**Scenario:** `@feature10` / `SCEN-diagnostics-are-kernel-findings-only`

**Sources:** `spec-kernel:FR-6` invariants and diagnostics contract; `spec-kernel_SCHEMA.md` diagnostic record shape.

## FR-11: Release eligibility conjunction

The pure evaluator SHALL consume caller-supplied evidence bytes, product baseline/authoring authority manifests, candidate-bundled installed tool-registry/authority manifests, an accepted host-authority ABI receipt, role-typed producer evidence plus offline-verifiable Sigstore bundle and pinned trust-root bytes, and exactly the 12 candidate checks for FR-1..FR-10 defined in the schema. It SHALL re-hash every input and return closed candidate-bound eligibility/blockers. `CHK-FR11-01` tests the evaluator and SHALL NOT appear as a candidate record. Each check is derived from a typed candidate/host/registry-bound producer receipt with observations, validity/revocation and verified attestation; missing/extra/duplicate/failed/stale/revoked/mismatched/unverifiable/unbound or registry/ABI inputs fail closed; product owns delivery.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-release-gate-is-a-closed-conjunction)

**Scenario:** `@feature11` / `SCEN-spec-enforcement-release-conjunction-fails-closed`

**Sources:** `plugin-distribution:FR-13`, `spec-kernel:FR-14` house standard; [README.md](README.md) release boundary; `plan-gate:FR-13` release conjunction precedent.

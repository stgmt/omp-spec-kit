# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Event subscriptions match the pinned claim set

**EARS:** WHEN the enforcement capability loads THEN it SHALL subscribe only to `tool_call`, `tool_result`, `context`, and `session_start`; every `tool_call` SHALL enter the effect classifier rather than a write/edit/bash-only filter; pinned v17.3.7 calls lacking provider/server/schema identity SHALL keep enforcement `DEFERRED_HOST_ABI`; AND a future activation SHALL have a TASK-1 source/behavior receipt for `tool-call-authority-abi@1`.

**Requirement:** [FR-1](FR.md#fr-1-event-surface-selection-and-pinning)

**Scenario:** `@feature1`, `@id:SCEN-event-surface-selection`

## AC-2.1: Diagnostics are injected only in informational mode

**EARS:** WHILE informational mode is active AND a tool call targets a path under `.specs/**` THEN the `tool_result` handler SHALL append at most 2 KiB of spec-kernel findings to the result content; AND the handler SHALL NOT block execution; AND the handler SHALL NOT mutate repository state; AND kernel diagnostics SHALL contain only `spec-kernel:FR-6` findings.

**Requirement:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection)

**Scenario:** `@feature2`, `@id:SCEN-informational-mode-diagnostic-injection`

## AC-2.2: Corpus census is injected on session start

**EARS:** WHEN `session_start` fires AND informational mode is active AND the kernel is available THEN the handler SHALL compute a corpus census and store it for injection; AND the next `context` event SHALL receive at most one bounded census message ≤4 KiB appended to the outgoing messages; AND the injection SHALL modify only the event deep copy; AND session-stored messages and repository bytes SHALL be unchanged.

**Requirement:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection)

**Scenario:** `@feature2`, `@id:SCEN-corpus-census-session-start`

## AC-3.1: Spec writes are blocked or redirected in enforcement mode

**EARS:** WHILE enforcement mode is active WHEN any tool is called THEN exact accepted `SPEC_AUTHORING_AUTHORITY` and known `READ_ONLY` calls SHALL pass; a raw writer SHALL pass only if exhaustive extraction plus the filesystem resolver prove every target non-spec; any `.specs/**` target SHALL block with a qualified authoring MCP redirect; AND unknown/incomplete/dynamic/authority-mismatched/containment-indeterminate inputs SHALL block visibly; AND a pure classifier SHALL make no symlink/reparse/realpath claim.

**Requirement:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception)

**Scenario:** `@feature3`, `@id:SCEN-enforcement-mode-write-interception`

## AC-4.1: Hook errors produce explicit visible messages

**EARS:** IF an informational kernel/render fault occurs THEN one bounded visible diagnostic SHALL be emitted without blocking; IF enforcement safety classification, authority, extraction, containment, or resolver fails THEN the call SHALL block visibly with `TARGET_INDETERMINATE`; AND handler exceptions SHALL be caught before the OMP wrapper; silent pass-through, fake success, and fake conformance SHALL not occur.

**Requirement:** [FR-4](FR.md#fr-4-fail-honest-policy)

**Scenario:** `@feature4`, `@id:SCEN-fail-honest-policy`

## AC-5.1: No state exists outside event-visible records

**EARS:** WHEN handlers execute across sessions THEN no files outside session temp, persistent logs/counters/audit, network, subprocess, credential access, or alternate query/agent tool SHALL exist; every observable record SHALL surface only through declared event output/session diagnostics.

**Requirement:** [FR-5](FR.md#fr-5-no-hidden-state)

**Scenario:** `@feature5`, `@id:SCEN-no-hidden-state`

## AC-6.1: Installed hooks execute dependency-absent

**EARS:** WHEN the plugin artifact is installed with source checkout and root `node_modules` absent THEN the enforcement hook module SHALL load and execute from the bundled artifact; AND no ambient dependencies dynamic downloads native addons or unresolved imports SHALL be required; AND hook absence SHALL degrade honestly with an explicit diagnostic per FR-4.

**Requirement:** [FR-6](FR.md#fr-6-dependency-safe-distribution)

**Scenario:** `@feature6`, `@id:SCEN-dependency-safe-distribution`

## AC-7.1: All write surfaces to specs are intercepted

**EARS:** WHILE enforcement mode is active WHEN each live built-in MCP or extension tool is invoked THEN it SHALL resolve through one closed `ToolEffectRegistryEntry`; exact accepted authoring authority may pass, raw writers require exhaustive targets and I/O containment, and absent renamed changed dynamically targeted or incompletely extracted tools SHALL be `UNKNOWN` and block; AND no config environment caller exception raw endpoint or alternate tool SHALL disable interception.

**Requirement:** [FR-7](FR.md#fr-7-no-bypass-paths)

**Scenario:** `@feature7`, `@id:SCEN-no-bypass-paths`

## AC-8.1: Enforcement is inert before cumulative gate acceptance

**EARS:** WHEN product/authoring acceptance is absent THEN enforcement SHALL remain inactive with explicit degraded/informational state; WHEN accepted enforcement later loses the kernel THEN kernel finding/census projection SHALL report unavailable but registry/authority/resolver write enforcement SHALL remain active; every behavior change SHALL be visible.

**Requirement:** [FR-8](FR.md#fr-8-degradation-ladder)

**Scenario:** `@feature8`, `@id:SCEN-degradation-ladder`

## AC-9.1: Enforcement activates only after cumulative gate

**EARS:** WHEN the product evaluator accepts `SPEC_ENFORCEMENT` for the same candidate after the v0.3 baseline and `AUTHORING_MCP` capability AND an accepted `tool-call-authority-abi@1` receipt exists THEN enforcement mode SHALL activate at `session_start`; before acceptance it SHALL remain informational/degraded regardless of configuration; product/candidate/authority mismatch SHALL prevent activation; AND installed-registry/host-envelope mismatch SHALL remain visible while new/changed tools block as `UNKNOWN` rather than downgrading enforcement.

**Requirement:** [FR-9](FR.md#fr-9-stage-gated-activation)

**Scenario:** `@feature9`, `@id:SCEN-stage-gated-activation`

## AC-10.1: Diagnostics originate from spec-kernel only

**EARS:** WHEN spec-conformance content is injected THEN every finding SHALL originate from `spec-kernel:FR-6`; enforcement registry/authority/containment/mode faults SHALL use a separate policy-diagnostic kind and SHALL never be labeled kernel findings; AND no private rule set parser validator or independent conformance producer SHALL appear; a successful empty kernel result SHALL state `no findings`, while unavailability SHALL state unavailable.

**Requirement:** [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Scenario:** `@feature10`, `@id:SCEN-diagnostics-are-kernel-findings-only`

## AC-10.2: No independent conformance path exists in the extension

**Requirement:** [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**EARS:** WHEN the installed extension bundle is inspected THEN it SHALL contain no private rule catalog, spec parser, validator, or finding producer beyond the `spec-kernel:FR-6` consumer; the tool-effect classifier and containment resolver MAY enforce access policy but SHALL NOT emit spec-conformance findings; AND every injected conformance finding SHALL trace to a runtime kernel record.

**Scenario:** `@feature10`, `@id:SCEN-diagnostics-are-kernel-findings-only`

## AC-11.1: Release gate is a closed conjunction

**EARS:** WHEN `spec-enforcement-release@2` is evaluated THEN exact candidate baseline/authoring authority, installed registry, host-authority ABI, role-typed producer bytes and an offline-verified Sigstore DSSE/Fulcio/Rekor bundle under the exact repository/workflow/ref/subject trust policy and the 12 FR-1..FR-10 candidate checks SHALL be re-hashed and required; `CHK-FR11-01` SHALL be excluded from candidate input and test the evaluator separately; every missing extra duplicate failed stale revoked mismatched unverifiable unbound self-attested ABI or registry-drift variant SHALL return a closed blocker; eligibility SHALL NOT mark product delivery.

**Requirement:** [FR-11](FR.md#fr-11-release-eligibility-conjunction)

**Scenario:** `@feature11`, `@id:SCEN-spec-enforcement-release-conjunction-fails-closed`

# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Event subscriptions match the pinned claim set

**EARS:** WHEN the enforcement hooks are loaded THEN the extension SHALL subscribe to exactly `tool_call`, `tool_result`, `context`, and `session_start` events; AND no other event subscriptions SHALL exist; AND every cited event contract SHALL have a corresponding TASK-1 probe receipt bound to the pinned v17.3.7 runtime.

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

**EARS:** WHILE enforcement mode is active AND a `write`, `edit`, or `bash` tool call targets a path resolving under `.specs/**` THEN the `tool_call` handler SHALL return `{block: true, reason}` with an actionable redirect to the authoring door; AND non-matching tool calls SHALL return nothing; AND path matching SHALL normalize separators reject traversal and symlinks and stay inside the project root.

**Requirement:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception)

**Scenario:** `@feature3`, `@id:SCEN-enforcement-mode-write-interception`

## AC-4.1: Hook errors produce explicit visible messages

**EARS:** IF any of handler exception, missing kernel, unparseable artifact, or internal fault occurs THEN the handler SHALL produce an explicit visible diagnostic message through `tool_result` content addition or `context` message injection; AND silent pass-through SHALL NOT occur; AND fake success indicators SHALL NOT be reported; AND handler exceptions SHALL be caught within the handler and SHALL NOT propagate to the OMP tool wrapper.

**Requirement:** [FR-4](FR.md#fr-4-fail-honest-policy)

**Scenario:** `@feature4`, `@id:SCEN-fail-honest-policy`

## AC-5.1: No state exists outside event-visible records

**EARS:** WHEN the enforcement hooks execute across multiple sessions THEN no files SHALL be created outside the session-local temporary directory; AND no persistent logs counters or audit trails SHALL exist; AND all observable state SHALL surface through `tool_result` content `context` messages or session-local diagnostic records; AND no network calls or credential access SHALL occur.

**Requirement:** [FR-5](FR.md#fr-5-no-hidden-state)

**Scenario:** `@feature5`, `@id:SCEN-no-hidden-state`

## AC-6.1: Installed hooks execute dependency-absent

**EARS:** WHEN the plugin artifact is installed with source checkout and root `node_modules` absent THEN the enforcement hook module SHALL load and execute from the bundled artifact; AND no ambient dependencies dynamic downloads native addons or unresolved imports SHALL be required; AND hook absence SHALL degrade honestly with an explicit diagnostic per FR-4.

**Requirement:** [FR-6](FR.md#fr-6-dependency-safe-distribution)

**Scenario:** `@feature6`, `@id:SCEN-dependency-safe-distribution`

## AC-7.1: All write surfaces to specs are intercepted

**EARS:** WHILE enforcement mode is active AND a tool capable of writing to `.specs/**` is invoked (at minimum `write` `edit` `bash` with file redirection and any extension-registered tool targeting `.specs/`) THEN the `tool_call` handler SHALL match and block or redirect; AND no configuration option environment variable or API SHALL disable interception for specific callers or paths.

**Requirement:** [FR-7](FR.md#fr-7-no-bypass-paths)

**Scenario:** `@feature7`, `@id:SCEN-no-bypass-paths`

## AC-8.1: Enforcement is inert before cumulative gate acceptance

**EARS:** WHEN the kernel is unavailable THEN informational summaries SHALL be absent with an explicit stated reason AND enforcement mode SHALL NOT activate; AND WHEN the authoring door is absent THEN enforcement mode SHALL be disabled by stage not by error AND informational mode SHALL continue if the kernel is available; AND each degradation step SHALL produce one bounded diagnostic record.

**Requirement:** [FR-8](FR.md#fr-8-degradation-ladder)

**Scenario:** `@feature8`, `@id:SCEN-degradation-ladder`

## AC-9.1: Enforcement activates only after cumulative gate

**EARS:** WHEN the authoring stage cumulative gate (`product:FR-6` plus `spec-authoring-workflow:FR-13`) is accepted THEN enforcement mode SHALL activate automatically at `session_start`; AND before acceptance the hooks SHALL operate in informational mode only regardless of configuration; AND gate status SHALL be cached for the session duration and SHALL NOT be re-evaluated mid-session.

**Requirement:** [FR-9](FR.md#fr-9-stage-gated-activation)

**Scenario:** `@feature9`, `@id:SCEN-stage-gated-activation`

## AC-10.1: Diagnostics originate from spec-kernel only

**EARS:** WHEN diagnostic content is injected THEN every finding SHALL originate from `spec-kernel:FR-6`; AND no private rule set custom validation or independent conformance check SHALL appear; AND when the kernel produces no findings the injection SHALL state "no findings"; AND diagnostic format SHALL follow the kernel bounded diagnostic record contract.

**Requirement:** [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Scenario:** `@feature10`, `@id:SCEN-diagnostics-are-kernel-findings-only`

## AC-11.1: Release gate is a closed conjunction

**EARS:** WHEN the release evaluator processes `spec-enforcement-release@1` THEN eligibility SHALL require exactly one passing hash-bound record per mandatory check for FR-1 through FR-10 including TASK-1 probe records dependency-absent smoke budget evidence and adversarial review; AND missing extra duplicate failed stale mismatched or unbound records SHALL fail closed; AND structural specification text and unexecuted Gherkin SHALL NOT satisfy evidence; AND eligibility SHALL NOT imply authorization to ship.

**Requirement:** [FR-11](FR.md#fr-11-release-eligibility-conjunction)

**Scenario:** `@feature11`, `@id:SCEN-spec-enforcement-release-conjunction-fails-closed`

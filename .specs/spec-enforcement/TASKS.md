# Tasks

All tasks are future implementation work. Status `Planned` means not started and does not imply runtime evidence. The shared kernel model preserves both `planned` and `todo`, but the external authoring reducer operates only on `todo | ready | in-progress | blocked | done`; `planned` is non-mutable until a future accepted proposal defines normalization.

## TASK-1: Record live ABI probe receipts on the pinned runtime

**Status:** Planned

**Estimate:** 2 days

**Owner:** OMP adapter maintainer

**Depends On:** none

**Requirements:** [FR-1](FR.md#fr-1-event-surface-selection-and-pinning), [FR-3](FR.md#fr-3-enforcement-mode-write-interception)

**Done When:**
- A disposable OMP project records, for the pinned v17.3.7 runtime: (a) the exact `tool_call` payload for `write`, `edit`, and `bash` tool calls, confirming the target path field name and shape; (b) confirmation that `tool_result` fires post-execution with override support for content/details; (c) confirmation that `context` supplies a deep copy of outgoing messages modifiable by return value; (d) confirmation that `session_start` fires once per session load; (e) confirmation that extension-registered tools also emit `tool_call`; (f) the exact mechanism for querying cumulative gate status from within an extension handler.
- Each probe receipt names runtime version/commit, date, capture command, and artifact hash; receipts are stored under `docs/validation/` and bound to CHK-FR1-01.
- Any deviation from the RESEARCH citations produces a spec correction before TASK-2 starts.

## TASK-2: Implement pure path match predicate

**Status:** Planned

**Estimate:** 2 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-1

**Requirements:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [FR-7](FR.md#fr-7-no-bypass-paths)

**Done When:**
- `match.js` is a pure function of `toolName`, `input`, and `projectRoot`; it imports no OMP, clock, or network module.
- Path normalization handles `/` and `\` separators, rejects `..` traversal, rejects absolute paths outside project root, and rejects symlinks.
- Match/non-match decisions for the fixture corpus reconcile with reviewed ground truth on Windows and POSIX with byte-identical serialization.
- Bash command pattern matching covers redirection operators, `tee`, `cp`, `mv` with `.specs/` arguments.

## TASK-3: Implement mode determination and gate cache

**Status:** Planned

**Estimate:** 2 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-1

**Requirements:** [FR-8](FR.md#fr-8-degradation-ladder), [FR-9](FR.md#fr-9-stage-gated-activation)

**Done When:**
- `mode.js` queries cumulative gate status at `session_start` and caches the result.
- Mode returns `informational | enforcement | degraded` based on gate acceptance and kernel availability.
- Gate status query failure produces explicit degraded mode with diagnostic.
- Mode is immutable for the session duration.

## TASK-4: Implement kernel diagnostic adapter

**Status:** Planned

**Estimate:** 3 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-1, `spec-kernel:FR-14` eligible for `v0.2`

**Requirements:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection), [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Done When:**
- `diagnostics.js` queries kernel for spec-slug findings and renders bounded ≤2 KiB content additions.
- All diagnostic content traces to `spec-kernel:FR-6` findings; no private rules.
- Kernel absence or error produces explicit "kernel unavailable" diagnostic.
- Diagnostic format follows kernel bounded diagnostic record contract.

## TASK-5: Implement corpus census adapter

**Status:** Planned

**Estimate:** 2 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-1, `spec-kernel:FR-14` eligible for `v0.2`

**Requirements:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection)

**Done When:**
- `census.js` queries kernel overview and renders bounded ≤4 KiB context messages.
- Census is computed at `session_start` and injected once on the next `context` event.
- Kernel absence produces explicit "corpus census unavailable" message.
- Injection modifies only the event deep copy; session-stored messages unchanged.

## TASK-6: Implement enforcement block renderer

**Status:** Planned

**Estimate:** 2 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-2, TASK-3

**Requirements:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception)

**Done When:**
- `block.js` renders bounded ≤4 KiB `{block: true, reason}` with actionable redirect to authoring door.
- Reason names matched tool, target path, and redirect destination.
- No stack traces, absolute paths, or environment values in reason text.
- Deny format mirrors `plan-gate:FR-10` discipline.

## TASK-7: Implement fail-honest fault barrier

**Status:** Planned

**Estimate:** 1 day

**Owner:** Enforcement maintainer

**Depends On:** TASK-4, TASK-5, TASK-6

**Requirements:** [FR-4](FR.md#fr-4-fail-honest-policy)

**Done When:**
- `fail-honest.js` wraps all handler bodies; every exception is caught and translated to explicit diagnostic content.
- No handler exception propagates to the OMP tool wrapper.
- Silent pass-through and fake success are impossible by construction.
- Each fault class maps to one bounded diagnostic record with closed code.

## TASK-8: Implement OMP event adapter and extension factory

**Status:** Planned

**Estimate:** 2 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-2, TASK-3, TASK-4, TASK-5, TASK-6, TASK-7

**Requirements:** [FR-1](FR.md#fr-1-event-surface-selection-and-pinning), [FR-6](FR.md#fr-6-dependency-safe-distribution)

**Done When:**
- `adapter.js` subscribes to exactly `tool_call`, `tool_result`, `context`, `session_start`; no other events.
- Extension factory default-exports a function compatible with `ExtensionAPI`.
- Module ships inside bundled plugin artifact with no ambient dependencies.
- Hook absence degrades honestly with explicit diagnostic.

## TASK-9: Real fixtures and provenance

**Status:** Planned

**Estimate:** 3 days

**Owner:** Fixture maintainer

**Depends On:** TASK-2, TASK-4, TASK-5

**Requirements:** [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Done When:**
- Executable fixtures are real spec documents with recorded provenance per `spec-kernel:FR-11` posture.
- Fixture manifest includes ID, capture method, producer/version, source path, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed ground truth.
- Synthetic fixtures labeled synthetic and used only for scale or minimal negative variants.

## TASK-10: Release conjunction evaluator

**Status:** Planned

**Estimate:** 2 days

**Owner:** Release maintainer

**Depends On:** TASK-8, TASK-9

**Requirements:** [FR-11](FR.md#fr-11-release-eligibility-conjunction)

**Done When:**
- `release.js` evaluates `spec-enforcement-release@1` as a pure function of evidence manifest.
- Mandatory checks map to FR-1 through FR-10 including TASK-1 probes.
- Missing, extra, duplicate, failed, stale, mismatched, or unbound records fail closed.
- Structural specification and unexecuted Gherkin do not satisfy evidence.

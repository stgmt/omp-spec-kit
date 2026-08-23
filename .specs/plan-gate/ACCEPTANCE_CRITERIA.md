# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Interception and resolution are deterministic

**EARS:** WHEN the model issues `write` targeting an `xd://propose` URL THEN the gate SHALL match exactly that model-issued `tool_call` event, resolve the plan file from `os.tmpdir()/omp-local/<session-identity>/<slug>-plan.md` using runner session identity and documented slug normalization, and proceed to validation; AND nested device dispatches, other tools, other `xd://` targets, absent files, unreadable files, and over-budget files SHALL NOT match or SHALL take the allow path without location guessing.

**Requirement:** [FR-1](FR.md#fr-1-approval-interception-and-deterministic-plan-resolution)

**Scenario:** `@feature1`, `@id:SCEN-approval-interception-and-plan-resolution`

## AC-2.1: Every gate fault path allows

**EARS:** IF any of handler exception, absent plan file, over-budget bytes, malformed or unreadable prompt cache, subsystem failure, missing template, or deadline expiry occurs THEN the handler SHALL return no blocking result, append one bounded diagnostic record, and the approval flow SHALL continue; AND blocking SHALL be observed only after a complete successful validation returning one or more blocking errors.

**Requirement:** [FR-2](FR.md#fr-2-fail-open-bridge-policy)

**Scenario:** `@feature2`, `@id:SCEN-every-gate-fault-allows`

## AC-3.1: Injection is plan-mode scoped and bounded

**EARS:** WHILE plan mode is active THEN each `context` event SHALL receive at most one injection message ≤2 KiB containing skeleton names in order, spec-reference obligation, and template pointer, applied only to the event's deep copy; AND outside plan mode, on duplicate injection within one event, on injection failure, or on repository/session-stored message modification the gate SHALL inject nothing or take the non-fatal skip path.

**Requirement:** [FR-3](FR.md#fr-3-preventive-contract-injection)

**Scenario:** `@feature3`, `@id:SCEN-plan-mode-contract-injection`

## AC-4.1: Mandatory skeleton failures block with line hints

**EARS:** WHEN a plan missing any of the ten sections, misordering them, carrying an empty human summary, an Existing-Spec Inventory lacking its four subsections, Requirements lacking FR/EARS-AC/NFR/Assumptions subsections, malformed Todos blocks, a commandless Verification Plan, a File Changes table with absolute paths or invalid actions or empty Reason, or destructive actions without Impact Analysis is validated THEN each violation SHALL produce exactly one bounded error with 1-based line, closed message, and remediation hint, and the run SHALL block.

**Requirement:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation)

**Scenario:** `@feature4`, `@id:SCEN-skeleton-structure-validation-blocks`

## AC-5.1: Byte-duplicate plans are detected deterministically

**EARS:** WHEN the submitted plan's SHA-256 equals another `*-plan.md` in the same session directory whose size differs by at most 10 bytes THEN validation SHALL block naming the duplicate by session-relative name; AND size-differing candidates SHALL not be read, unreadable candidates SHALL be skipped, and identical content submitted twice in one directory SHALL always block while re-submission after the original's removal SHALL NOT.

**Requirement:** [FR-5](FR.md#fr-5-duplicate-plan-detection)

**Scenario:** `@feature5`, `@id:SCEN-duplicate-plan-blocked`

## AC-6.1: Grounding is deterministic and cache degrades open

**EARS:** WHEN the relevance score of the plan against the cached prompt window is at or below the deny threshold THEN validation SHALL block with the prompt window excerpt embedded in the reason; AND the same plan/cache pair SHALL yield identical score and decision on every run; AND an empty, absent, or malformed cache SHALL skip grounding without blocking.

**Requirement:** [FR-6](FR.md#fr-6-prompt-cache-and-deterministic-grounding)

**Scenario:** `@feature6`, `@id:SCEN-grounding-blocks-and-cache-degrades-open`

## AC-7.1: Contaminated file changes are refused

**EARS:** WHEN more than half of File Changes paths are unmentioned in the plan body outside the File Changes section THEN validation SHALL block naming up to five unmentioned paths; AND at or below the 0.5 threshold the plan SHALL pass this phase; AND path matching SHALL be separator-normalized and case-sensitive.

**Requirement:** [FR-7](FR.md#fr-7-file-change-cross-reference-validation)

**Scenario:** `@feature7`, `@id:SCEN-file-change-cross-reference-blocks`

## AC-8.1: Extracted requirements are mandatory

**EARS:** WHEN the Context section lacks an `Extracted Requirements` block or contains fewer than two numbered items THEN validation SHALL block with the prompt excerpt embedded; AND two or more numbered items SHALL satisfy the phase.

**Requirement:** [FR-8](FR.md#fr-8-extracted-requirements-obligation)

**Scenario:** `@feature8`, `@id:SCEN-extracted-requirements-enforced`

## AC-9.1: Spec-touching plans require existing qualified references

**EARS:** IF File Changes or guarded detection touches `.specs/**` or guarded paths THEN the plan SHALL cite at least one `.specs/<slug>:FR-N` or `.specs/<slug>:AC-N.M` reference whose slug directory exists under `<project-root>/.specs/` and whose ID exists as a canonical heading in `FR.md`/`ACCEPTANCE_CRITERIA.md`; AND missing slug, missing ID, zero references, symlinked spec directories, and traversal attempts SHALL block or take the containment-refusal path; AND plans not touching spec/guarded paths SHALL skip the phase entirely.

**Requirement:** [FR-9](FR.md#fr-9-spec-reference-enforcement)

**Scenario:** `@feature9`, `@id:SCEN-spec-references-enforced-against-disk`

## AC-10.1: Deny reason is actionable and bounded

**EARS:** WHEN validation blocks with N errors THEN the reason SHALL render N complete `line N: message` + hint entries, then a template excerpt ≤8 KiB, then the last five prompt excerpts, within 16 KiB total with explicit truncation preserving error completeness first; AND advisory-phase findings SHALL appear only in diagnostic state, never in the blocking decision.

**Requirement:** [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)

**Scenario:** `@feature10`, `@id:SCEN-deny-format-is-actionable`

## AC-11.1: Installed gate executes dependency-absent

**EARS:** WHEN the exact candidate artifact is installed outside the source checkout with root and external `node_modules` unavailable THEN the extension SHALL match a simulated propose event and run the complete validation pipeline using only bundled code and resources, with zero daemon/network/subprocess/credential activity; AND the child tree SHALL contain no undeclared runtime dependency, and template/section-model resources SHALL match their shipped hash inventory.

**Requirement:** [FR-11](FR.md#fr-11-self-contained-in-process-runtime)

**Scenario:** `@feature11`, `@id:SCEN-self-contained-gate-artifact`

## AC-12.1: Fixtures are real, hashed, and reconciled

**EARS:** WHEN an executable fixture is admitted THEN its manifest SHALL carry capture method, producer, source, date, SHA-256, byte count, license disposition, trimming, and reviewed ground truth listing expected blocking errors per phase with lines and codes; AND recomputed hashes and sizes SHALL match and observed validation results SHALL reconcile with ground truth; AND synthetic-only fixtures SHALL be labeled and SHALL NOT satisfy the real-fixture obligation.

**Requirement:** [FR-12](FR.md#fr-12-real-fixtures-and-provenance)

**Scenario:** `@feature12`, `@id:SCEN-plan-gate-real-fixture-provenance`

## AC-13.1: Release gate is a closed conjunction

**EARS:** WHEN the release evaluator receives one candidate manifest THEN it SHALL fail closed unless stage/profile values are a known matching pair and SHALL return `eligible=true` only with exactly one passing hash-bound record per mandatory check FR-1 through FR-12 including live ABI probe records, dependency-absent smoke, budget evidence, and the adversarial review record, all bound to the same artifact; AND missing, extra, duplicate, failed, stale, mismatched, or unbound records, structural-only claims, and unexecuted scenarios SHALL each yield deterministic blockers and `eligible=false`; AND eligibility SHALL NOT authorize release in v0.1.0/v0.2/v0.3.

**Requirement:** [FR-13](FR.md#fr-13-release-eligibility-conjunction)

**Scenario:** `@feature13`, `@id:SCEN-plan-gate-release-conjunction-fails-closed`

# Acceptance Criteria

These criteria define future verification obligations. The linked Gherkin scenarios are specification text and are not recorded as executed.

## AC-1.1: Interception and resolution are deterministic

**EARS:** WHEN MANUAL input is supplied THEN the validator SHALL use exactly its URL/content/hash/title/slug; WHEN AUTOMATIC input is supplied THEN it SHALL come only from the selected-plan host event after native resolution; AND no mode SHALL scan directories or guess fallback files; pinned v17.3.7 automatic admission SHALL return HOST_ABI_UNSUPPORTED.

**Requirement:** [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event)

**Scenario:** `@feature1`, `@id:SCEN-approval-interception-and-plan-resolution`

## AC-1.2: Session identity and slug normalization are pinned

**Requirement:** [FR-1](FR.md#fr-1-exact-plan-input-and-future-automatic-approval-event)

**EARS:** WHEN selected plan input crosses a host approval-session transition THEN `selectionSessionId`, `approvalSessionId`, `transitionKind`, and `transitionPlanSha256` SHALL form the closed SAME_SESSION or HOST_APPROVAL_FORK relation and bind the exact plan hash; inconsistent/foreign IDs or copied-plan hash SHALL produce `PLAN_IDENTITY_MISMATCH` without fallback scanning.

**Scenario:** `@feature1`, `@id:SCEN-session-transition-plan-resolution`

## AC-2.1: Every gate fault path allows

**EARS:** IF validator exception subsystem/resource/containment failure or the ≤20-second internal deadline occurs THEN the adapter SHALL return allow plus one bounded diagnostic; AND a complete successful pipeline with ERROR findings SHALL block; AND an outer host timeout remains fail-closed and is reported as an implementation defect.

**Requirement:** [FR-2](FR.md#fr-2-fail-open-bridge-policy)

**Scenario:** `@feature2`, `@id:SCEN-every-gate-fault-allows`

## AC-3.1: Injection is plan-mode scoped and bounded

**EARS:** WHEN MANUAL mode is used THEN the contract SHALL be returned as advisory output; WHEN future AUTOMATIC input carries `planMode:true` THEN at most one bounded deep-copy context injection MAY occur; AND no prompt-text/filesystem inference, stored-message mutation, duplicate injection, or blocking-on-injection-failure is permitted.

**Requirement:** [FR-3](FR.md#fr-3-mode-scoped-preventive-contract)

**Scenario:** `@feature3`, `@id:SCEN-plan-mode-contract-injection`

## AC-4.1: Mandatory skeleton failures block with line hints

**EARS:** WHEN a plan missing any of the ten sections, misordering them, carrying an empty human summary, an Existing-Spec Inventory lacking its four subsections, Requirements lacking FR/EARS-AC/NFR/Assumptions subsections, malformed Todos blocks, a commandless Verification Plan, a File Changes table with absolute paths or invalid actions or empty Reason, or destructive actions without Impact Analysis is validated THEN each violation SHALL produce exactly one bounded error with 1-based line, closed message, and remediation hint, and the run SHALL block.

**Requirement:** [FR-4](FR.md#fr-4-plan-content-model-and-structure-validation)

**Scenario:** `@feature4`, `@id:SCEN-skeleton-structure-validation-blocks`

## AC-5.1: Byte-duplicate plans are detected deterministically

**EARS:** WHEN a submitted plan's SHA-256 equals one of at most 20 explicitly supplied candidates within 8 MiB THEN validation SHALL block naming its URL; a candidate over the ±10-byte size window SHALL not be hashed; the validator SHALL perform no directory scan; and a manual adapter unable to read any declared candidate before complete input construction SHALL return ALLOW plus `DUPLICATE_INPUT_UNAVAILABLE`.

**Requirement:** [FR-5](FR.md#fr-5-duplicate-plan-detection)

**Scenario:** `@feature5`, `@id:SCEN-duplicate-plan-blocked`

## AC-6.1: Grounding is deterministic and cache degrades open

**EARS:** WHEN the relevance score of the plan against the explicitly supplied prompt excerpts is at or below the exact default threshold `-20` THEN validation SHALL block with the selected excerpt embedded in the reason; AND the same plan/cache pair SHALL yield identical score and decision on every run; AND an empty cache SHALL skip grounding; AND malformed or over-budget cache input SHALL return ALLOW plus a bounded bridge diagnostic.

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

**EARS:** IF File Changes or guarded detection touches `.specs/**` or guarded paths THEN the plan SHALL cite at least one `.specs/<slug>:FR-N` or `.specs/<slug>:AC-N.M` reference present in the complete supplied index; AND invalid syntax, missing slug, missing ID, or zero references SHALL block; AND a manual adapter's unreadable document, realpath/reparse/symlink containment refusal, absent index, or byte-budget exhaustion SHALL return ALLOW plus `SPEC_INDEX_UNAVAILABLE` without validating a partial index; AND plans not touching spec/guarded paths SHALL skip the phase.

**Requirement:** [FR-9](FR.md#fr-9-spec-reference-enforcement)

**Scenario:** `@feature9`, `@id:SCEN-spec-references-enforced-against-disk`

## AC-10.1: Deny reason is actionable and bounded

**EARS:** WHEN validation blocks with N errors THEN the result SHALL expose total count and cursor-paged complete findings; the ≤16 KiB host reason SHALL contain only complete error+hint rows that fit, exact omitted count/cursor, then bounded template/prompt excerpts; AND warnings SHALL never block.

**Requirement:** [FR-10](FR.md#fr-10-bounded-deny-format-and-diagnostics)

**Scenario:** `@feature10`, `@id:SCEN-deny-format-is-actionable`

## AC-11.1: Installed gate executes dependency-absent

**EARS:** WHEN the exact candidate artifact is installed outside the source checkout with root and external `node_modules` unavailable THEN MANUAL validation SHALL run from one explicit request through the complete pipeline using only bundled code and resources, with zero daemon/network/subprocess/credential activity; AND an AUTOMATIC smoke SHALL use a captured `selected-plan-event@1` receipt rather than a simulated propose write; AND the child tree SHALL contain no undeclared runtime dependency, and template/section-model resources SHALL match their shipped hash inventory.

**Requirement:** [FR-11](FR.md#fr-11-self-contained-in-process-runtime)

**Scenario:** `@feature11`, `@id:SCEN-self-contained-gate-artifact`

## AC-12.1: Fixtures are real, hashed, and reconciled

**EARS:** WHEN an executable fixture is admitted THEN its manifest SHALL carry capture method, producer, source, date, SHA-256, byte count, license disposition, trimming, and reviewed ground truth listing expected blocking errors per phase with lines and codes; AND recomputed hashes and sizes SHALL match and observed validation results SHALL reconcile with ground truth; AND synthetic-only fixtures SHALL be labeled and SHALL NOT satisfy the real-fixture obligation.

**Requirement:** [FR-12](FR.md#fr-12-real-fixtures-and-provenance)

**Scenario:** `@feature12`, `@id:SCEN-plan-gate-real-fixture-provenance`

## AC-13.1: Release gate is a closed conjunction

**EARS:** WHEN the release evaluator receives one candidate manifest THEN it SHALL fail closed unless profile and host contract form a known pair; `plan-gate-manual@1` SHALL require exactly one passing hash-bound record for every manual FR-1..FR-12 branch including unreadable/containment fail-open, dependency-absent, budget, fixture, and adversarial checks; `plan-gate-automatic@1` SHALL additionally require all automatic FR-1/FR-3 branches and a source-and-behavior receipt proving `selected-plan-event@1` on the exact host pin; AND missing, extra, duplicate, failed, stale, mismatched, or unbound records, structural-only claims, and unexecuted scenarios SHALL yield deterministic blockers and `eligible=false`.

**Requirement:** [FR-13](FR.md#fr-13-release-eligibility-conjunction)

**Scenario:** `@feature13`, `@id:SCEN-plan-gate-release-conjunction-fails-closed`

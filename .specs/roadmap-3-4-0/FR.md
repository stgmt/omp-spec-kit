# Functional Requirements

## FR-1: Phase 1 — the registration path exists

The release SHALL replace the bare refusal of an unknown project with a diagnosis carrying one actionable registration step, SHALL let an owner or writer register a project through the tool, and SHALL keep registration mandatory: no corpus is served for an unregistered project.

**Refs:** `spec-project-registration:FR-1`, `spec-project-registration:FR-2`, `spec-project-registration:FR-3`, `spec-project-registration:FR-5`

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-phase-1-the-registration-path-exists)

**Scenario:** `@feature1` / `SCEN-phase-registration`

**Task:** [TASK-1](TASKS.md#task-1-deliver-the-registration-path)

## FR-2: Phase 2 — one bundle, one diff

One call SHALL carry a whole authoring change and SHALL return a unified diff with hunks, context, ordered operations on one document and an explicit truncation flag.

**Refs:** `spec-patch-bundle:FR-1`, `spec-patch-bundle:FR-3`, `spec-patch-bundle:FR-4`

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-phase-2-one-bundle-one-diff)

**Scenario:** `@feature2` / `SCEN-phase-patch-bundle`

**Task:** [TASK-2](TASKS.md#task-2-deliver-the-patch-bundle)

## FR-3: Phase 3 — decisions and open questions

A decision SHALL be a checked entity and an open question SHALL be a blocking entity, and validation SHALL fail when one decided value is stated differently elsewhere in the corpus.

**Refs:** `spec-decision-drift:FR-1`, `spec-decision-drift:FR-3`, `spec-decision-drift:FR-4`

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-phase-3-decisions-and-open-questions)

**Scenario:** `@feature3` / `SCEN-phase-decision-drift`

**Task:** [TASK-3](TASKS.md#task-3-deliver-decision-drift)

## FR-4: Phase 4 — executable verification

A declared check SHALL run under an allowlist and a timeout, its result SHALL be recorded with the commit, and completion SHALL require a fresh green record unless an override reason is recorded.

**Refs:** `spec-verify-runner:FR-2`, `spec-verify-runner:FR-3`, `spec-verify-runner:FR-4`

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-phase-4-executable-verification)

**Scenario:** `@feature4` / `SCEN-phase-verify-runner`

**Task:** [TASK-4](TASKS.md#task-4-deliver-the-verify-runner)

## FR-5: Phase 5 — release hygiene from issue #51

The release SHALL close the defects named in issue #51 that are not capabilities: the guard SHALL accept the `proc` and `out` internal schemes, the type catalog SHALL state the real kind and edge counts, an unfiltered task listing SHALL include completed tasks, the first-write gate SHALL be recorded instead of living only in process memory, the product roadmap SHALL carry its marker region, and the roadmap intents SHALL not overwrite an existing roadmap or fail on a missing branch without saying so.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-phase-5-release-hygiene)

**Scenario:** `@feature5` / `SCEN-phase-hygiene`

**Task:** [TASK-5](TASKS.md#task-5-close-release-hygiene-and-declare-later-waves)

## FR-6: Phase 5b — later waves declared and gated

The coverage matrix and the commit-time zone guard SHALL be declared with their acceptance headlines and SHALL NOT be reported as shipped before their own specifications exist with recorded evidence.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-phase-5b-later-waves-declared-and-gated)

**Scenario:** `@feature6` / `SCEN-phase-later-waves`

**Task:** [TASK-5](TASKS.md#task-5-close-release-hygiene-and-declare-later-waves)

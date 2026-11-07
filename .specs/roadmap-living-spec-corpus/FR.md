# Functional Requirements

## FR-1: Phase 1 — a corpus opens without a registry

The release SHALL let a specification corpus open, read and write on a working tree whose project the registry does not know, and SHALL report in one object why a corpus is unavailable when it is. The internal URI allowlist SHALL cover the schemes the agent host can emit.

**Refs:** `spec-local-corpus-mode:FR-1`, `spec-local-corpus-mode:FR-2`, `spec-local-corpus-mode:FR-4`, `spec-local-corpus-mode:FR-5`

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-phase-1-a-corpus-opens-without-a-registry)

**Scenario:** `@feature1` / `SCEN-phase-local-mode`

**Task:** [TASK-1](TASKS.md#task-1-deliver-local-corpus-mode)

## FR-2: Phase 2 — one bundle, one diff

The release SHALL let one call carry a whole authoring change and SHALL return a unified diff with hunks, context, ordered operations on one document and an explicit truncation flag.

**Refs:** `spec-patch-bundle:FR-1`, `spec-patch-bundle:FR-3`, `spec-patch-bundle:FR-4`

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-phase-2-one-bundle-one-diff)

**Scenario:** `@feature2` / `SCEN-phase-patch-bundle`

**Task:** [TASK-2](TASKS.md#task-2-deliver-the-patch-bundle)

## FR-3: Phase 3 — decisions and open questions

The release SHALL make an owner decision a checked entity and an open question a blocking entity, and SHALL fail validation when one decided value is stated differently elsewhere in the corpus.

**Refs:** `spec-decision-drift:FR-1`, `spec-decision-drift:FR-3`, `spec-decision-drift:FR-4`

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-phase-3-decisions-and-open-questions)

**Scenario:** `@feature3` / `SCEN-phase-decision-drift`

**Task:** [TASK-3](TASKS.md#task-3-deliver-decision-drift)

## FR-4: Phase 4 — executable verification

The release SHALL execute each task's declared check under an allowlist and a timeout, record the result with its commit, and SHALL refuse completion without a fresh green record unless an override reason is recorded.

**Refs:** `spec-verify-runner:FR-2`, `spec-verify-runner:FR-3`, `spec-verify-runner:FR-4`

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-phase-4-executable-verification)

**Scenario:** `@feature4` / `SCEN-phase-verify-runner`

**Task:** [TASK-4](TASKS.md#task-4-deliver-the-verify-runner)

## FR-5: Phase 5 — later waves declared and gated

The roadmap SHALL declare the coverage matrix and the zone guard as their own specifications with their acceptance headlines, and SHALL NOT report either as shipped before its specification exists and its evidence is recorded.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-phase-5-later-waves-declared-and-gated)

**Scenario:** `@feature5` / `SCEN-phase-later-waves`

**Task:** [TASK-5](TASKS.md#task-5-declare-the-later-waves)

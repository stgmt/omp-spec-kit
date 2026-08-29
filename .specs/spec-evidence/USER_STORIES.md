# User Stories

## US-1: Release owner who trusts evidence verdicts

**Priority:** Must

As a release owner, I want the exact derived status `done-verified` to require fresh execution bytes joined to canonical scenarios, so stale/fabricated results remain `done-unverified` or `not-done`.

**Why:** Upstream incident class "526 stale results reported as passed while execution lane claimed GREEN" demonstrates that without an explicit honesty boundary, stale or misjoined results silently satisfy completion.

**Independent Test:** Supply three tasks with fresh green, stale green, and absent evidence; observe exactly one `done-verified`, one `done-unverified`, and one `not-done`.

**Acceptance Scenarios:** `@feature1`, `@feature6`, `@feature7`

## US-2: Specification author whose waived work stays honest

**Priority:** Must

As a specification author, I want a waived open task to remain visibly open and never counted as satisfied by evidence, so that waiver is an explicit named state rather than a silent completion path.

**Why:** Waiver without an honesty gate becomes indistinguishable from completion in rollups and coverage reports.

**Independent Test:** Mark a task as waived; supply passing evidence for its scenario; observe the task remains open-waived and is excluded from satisfied counts.

**Acceptance Scenarios:** `@feature8`

## US-3: Engineer diagnosing unmatched execution results

**Priority:** Must

As an engineer reviewing a coverage census, I want every producer row accounted for as joined, unmatched, ambiguous, or malformed while authored scenarios conserve separately, so no result is silently dropped or mixed across cardinality domains.

**Why:** Silent drops and authored/producer count mixing hide broken traceability.

**Independent Test:** Supply two joined rows, one unmatched row, one ambiguous row and one malformed source record; observe producer collection/membership equations and the independent authored-scenario equation both hold exactly.

**Acceptance Scenarios:** `@feature4`, `@feature9`

## US-4: Integrator plugging evidence into release gates

**Priority:** Must

As an integrator building a future release stage, I want this spec's evaluation output to contribute one closed conjunction member to the all-not-any release gate, so that evidence absence or failure blocks release deterministically.

**Why:** Release gates must be compositional; each layer contributes its own mandatory checks without weakening others.

**Independent Test:** Produce a release-eligibility evaluation with one missing evidence record; observe the conjunction fails closed with the missing check named.

**Acceptance Scenarios:** `@feature13`

## US-5: Multi-language team using canonical NDJSON

**Priority:** Must

As a team running tests in multiple languages, I want Cucumber Messages NDJSON accepted as the canonical artifact format with language-neutral ingestion, so that evidence evaluation does not depend on any single test runner.

**Why:** Product neutrality requires evidence ingestion to be runner-agnostic; upstream FR-9 established this as a portable contract.

**Independent Test:** Supply NDJSON from Cucumber-JS, Reqnroll, and behave producers; observe identical ingestion-state shapes and join outcomes modulo producer metadata.

**Acceptance Scenarios:** `@feature2`, `@feature11`

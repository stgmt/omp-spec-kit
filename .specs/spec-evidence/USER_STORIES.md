# User Stories

## US-1: Release owner who trusts evidence

**Priority:** Must

As a release owner, I want verification to require fresh passed FULL-scope evidence for every required scenario, so one green row, a partial run, or stale bytes cannot approve a task.

**Why:** A known upstream incident reported stale passing results while the execution lane appeared green.

**Independent Test:** Require three scenarios; provide valid evidence for two; observe BLOCKED until all three satisfy PASSED/FRESH/FULL.

**Acceptance Scenarios:** `@feature3`, `@feature5`, `@feature6`, `@feature7`, `@feature10`, `@feature13`

## US-2: Engineer diagnosing evidence

**Priority:** Must

As an engineer, I want every producer row and required scenario to have one visible outcome and one evidence reference, so unmatched, ambiguous, stale, failed, or partial evidence is easy to locate.

**Why:** Silent drops and duplicate result/trace identities hide the cause of a blocked task.

**Independent Test:** Capture joined, unmatched, ambiguous, stale, and partial rows; observe one outcome per row and scenario-specific blockers with trace lookup by evidence reference.

**Acceptance Scenarios:** `@feature4`, `@feature6`, `@feature9`, `@feature12`, `@feature14`

## US-3: Author whose waiver stays open

**Priority:** Must

As a specification author, I want a waived task to remain visibly open even when passing evidence exists, so waiver is never confused with completion.

**Why:** Waiver is a scope decision, not proof.

**Independent Test:** Mark a task waived and provide fresh passed full evidence; observe WAIVED_OPEN and not VERIFIED.

**Acceptance Scenarios:** `@feature8`

## US-4: Multi-runner team

**Priority:** Must

As a team using different BDD runners, I want actual producer bytes captured into one common envelope, so evaluation does not depend on a custom overlay or hand-built fixture shape.

**Why:** Real producer fixtures catch parser assumptions that synthetic fixtures hide.

**Independent Test:** Capture real outputs from two identified producers and observe the same normalized evidence model with preserved provenance.

**Acceptance Scenarios:** `@feature2`, `@feature11`

# USER STORIES

## Read / Core

## US-1: Maintainer graph

**Priority:** Must

As an `omp-spec-kit` maintainer, I want one pure occurrence-first graph core, so that host adapters cannot fork graph semantics.

**Independent Test:** Permute the same normalized source values and compare canonical graph bytes.

**Acceptance Scenarios:** `@feature1`, `@feature3`, `@feature7`

## US-2: Safe bounded reader

**Priority:** Must

As a repository owner, I want one explicit root, link rejection, cancellation, and hard limits, so that reads cannot escape or exhaust the host.

**Independent Test:** Exercise contained, traversal, link, and over-budget inputs.

**Acceptance Scenarios:** `@feature5`

## US-3: Honest graph consumer

**Priority:** Must

As a specification author, I want duplicates and broken references preserved as explicit outcomes, so that graph validity cannot hide input loss.

**Independent Test:** Plant duplicate, missing, ambiguous, and forbidden references.

**Acceptance Scenarios:** `@feature2`, `@feature3`, `@feature4`

## US-4: Compatibility user

**Priority:** Must

As an OMP/MCP user, I want the shipped eight names to project one bounded result, so that the runtime remains compatible while the core is simplified.

**Independent Test:** Compare adapter results after removing transport metadata.

**Acceptance Scenarios:** `@feature6`

## US-5: Evidence reviewer

**Priority:** Must

As a reviewer, I want real hashes, independent oracles, and measurable budgets, so that structural validity is not mistaken for release evidence.

**Independent Test:** Recompute fixture hashes and inspect retained receipt-bound measurements.

**Acceptance Scenarios:** `@feature8`

## Read / Evidence

## US-6: Release owner who trusts evidence

**Priority:** Must

As a release owner, I want verification to require fresh passed FULL-scope evidence for every required scenario, so one green row, a partial run, or stale bytes cannot approve a task.

**Why:** A known upstream incident reported stale passing results while the execution lane appeared green.

**Independent Test:** Require three scenarios; provide valid evidence for two; observe BLOCKED until all three satisfy PASSED/FRESH/FULL.

**Acceptance Scenarios:** `@feature11`, `@feature13`, `@feature14`, `@feature15`, `@feature18`, `@feature21`

## US-7: Engineer diagnosing evidence

**Priority:** Must

As an engineer, I want every producer row and required scenario to have one visible outcome and one evidence reference, so unmatched, ambiguous, stale, failed, or partial evidence is easy to locate.

**Why:** Silent drops and duplicate result/trace identities hide the cause of a blocked task.

**Independent Test:** Capture joined, unmatched, ambiguous, stale, and partial rows; observe one outcome per row and scenario-specific blockers with trace lookup by evidence reference.

**Acceptance Scenarios:** `@feature12`, `@feature14`, `@feature17`, `@feature20`, `@feature22`

## US-8: Author whose waiver stays open

**Priority:** Must

As a specification author, I want a waived task to remain visibly open even when passing evidence exists, so waiver is never confused with completion.

**Why:** Waiver is a scope decision, not proof.

**Independent Test:** Mark a task waived and provide fresh passed full evidence; observe WAIVED_OPEN and not VERIFIED.

**Acceptance Scenarios:** `@feature16`

## US-9: Multi-runner team

**Priority:** Must

As a team using different BDD runners, I want actual producer bytes captured into one common envelope, so evaluation does not depend on a custom overlay or hand-built fixture shape.

**Why:** Real producer fixtures catch parser assumptions that synthetic fixtures hide.

**Independent Test:** Capture real outputs from two identified producers and observe the same normalized evidence model with preserved provenance.

**Acceptance Scenarios:** `@feature10`, `@feature19`

## Write

## US-10: Review exact changes before mutation

**Priority:** P0  
As a spec author, I want a deterministic complete preview so that I can inspect the exact resulting bytes and findings before any write.

**Independent test:** Propose a valid multi-document edit and prove every target hash is unchanged.

## US-11: Reject stale edits

**Priority:** P0  
As a concurrent editor, I want expected-hash comparison so that another accepted change is never overwritten.

**Independent test:** Race two applies from the same base and observe one winner plus one `CONFLICT` without lost bytes.

## US-12: Commit related documents together

**Priority:** P0  
As a maintainer, I want one-spec changes to become visible all at once so that FR, AC, scenario, check, and task traces cannot be partially installed.

**Independent test:** Inject a fault at each writer boundary and observe only a complete old or complete new generation.

## US-13: Contain the write boundary

**Priority:** P0  
As a repository owner, I want canonical path and reparse checks plus a host path policy so that raw tools cannot mutate `.specs/**`.

**Independent test:** Exercise traversal, absolute, UNC/device, symlink, junction, and non-allowlisted writer cases before content mutation.

## US-14: Preserve anchors and bytes

**Priority:** P0  
As a Markdown author, I want anchor-aware edits that conserve untouched bytes and EOLs so that links and unrelated text do not drift.

**Independent test:** Rename a heading through the proposal compiler and reconcile all same-spec inbound links and hashes.

## US-15: Receive a useful private receipt

**Priority:** P1  
As an operator, I want a compact outcome with document hashes, findings, and next action so that I can reconcile a mutation without leaking content or credentials.

**Independent test:** Plant secrets and document text, then prove neither appears in proposal errors or apply receipts.

## US-16: Recover without another public repair API

**Priority:** P0  
As an operator, I want deterministic internal rollback and clear manual restore instructions if storage is unrecoverable so that a failed commit does not invent a risky automated repair path.

**Independent test:** Destroy the staged and retained recovery candidates in a fault fixture and observe `RECOVERY_REQUIRED`, no further writes, and a bounded VCS/backup restore instruction.
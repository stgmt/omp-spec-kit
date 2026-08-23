# User Stories

## US-1: Spec corpus owner protected from uncontrolled writes

**Priority:** Must

As an owner of `.specs/`, I want agent writes to specification documents intercepted and either redirected through the authoring door or blocked with a reason, so that spec mutations follow the accepted workflow and no write bypasses the door.

**Why:** Without enforcement, any agent tool call can create, edit, or delete spec files directly, circumventing the authoring workflow's validation, traceability, and approval contracts.

**Independent Test:** Attempt a direct `write` to `.specs/product/FR.md` while enforcement mode is active; observe block with redirect reason. Attempt the same write through the authoring door; observe allowance.

**Acceptance Scenarios:** `@feature3`, `@feature7`

## US-2: Agent receiving diagnostic context about spec corpus state

**Priority:** Must

As an agent working in a repository with specs, I want kernel diagnostics and corpus census summaries injected into my tool results and context, so that I understand the current spec state without running separate queries.

**Why:** Agents lack ambient awareness of spec-corpus health; injecting findings at natural event boundaries provides situational awareness without requiring explicit query actions.

**Independent Test:** Execute a `read` on a spec file while informational mode is active; observe a `tool_result` content addition containing kernel diagnostics. Start a session; observe a `context` injection with corpus census summary.

**Acceptance Scenarios:** `@feature2`, `@feature10`

## US-3: Session owner whose workflow never breaks on hook failure

**Priority:** Must

As an OMP user, I want every hook-internal fault (kernel unavailable, unparseable artifact, missing door, handler exception) to produce an explicit visible message rather than silent pass-through or fake success, so that I always know the enforcement state.

**Why:** Silent failures create false confidence; fake-green indicators are worse than no indicator at all (anti-fake-green lineage from `spec-kernel:FR-6`).

**Independent Test:** Remove the kernel module and start a session; observe an explicit diagnostic message stating kernel absence. Inject a handler exception; observe a visible error message, not silence.

**Acceptance Scenarios:** `@feature4`, `@feature8`

## US-4: Release owner verifying self-contained distribution

**Priority:** Must

As a release owner, I want the enforcement hooks shipped inside the bundled plugin artifact with no ambient dependencies, no dynamic downloads, and honest degradation when components are absent, so that the installed artifact behaves predictably in isolation.

**Why:** A hook module inside a marketplace plugin is a security surface; it must satisfy the same dependency-absent, evidence-first discipline as the read-only stages (`spec-kernel:FR-10`, `plan-gate:FR-11`).

**Independent Test:** Build the candidate artifact, hide root/source dependencies, load the extension from the installed artifact, and verify informational-mode diagnostics execute; remove the kernel and verify honest degradation.

**Acceptance Scenarios:** `@feature6`, `@feature11`

## US-5: Privacy-conscious operator with no hidden state

**Priority:** Must

As an operator concerned with data minimization, I want enforcement hooks to keep no private logs, counters, or audit trails outside event-visible records, so that all observable state surfaces through tool results and context injections.

**Why:** Hidden state creates unverifiable behavior and privacy risk; the MIGRATION_MATRIX defers audit-log policy (FR-39) to a later stage, so this spec must not preemptively introduce hidden persistence.

**Independent Test:** Run multiple sessions with enforcement active; inspect the filesystem for any new files outside event-visible records; find none. Verify all diagnostic output appears in `tool_result` content or `context` messages.

**Acceptance Scenarios:** `@feature5`

## US-6: Stage-gated activation observer

**Priority:** Must

As a product integrator, I want enforcement mode inert until the authoring stage's cumulative gate is accepted, so that pre-authoring releases carry only informational behavior and cannot accidentally block legitimate work.

**Why:** Enforcement before the authoring door exists would block all spec writes with no valid redirect target, breaking workflows that predate the door.

**Independent Test:** Load the plugin before `spec-authoring-workflow:FR-13` acceptance; attempt a spec write; observe no block. Accept the cumulative gate; repeat; observe enforcement active.

**Acceptance Scenarios:** `@feature9`

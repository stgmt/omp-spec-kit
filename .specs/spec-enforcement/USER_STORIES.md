# User Stories

## US-1: Spec corpus owner protected from uncontrolled writes

**Priority:** Must

As an owner of `.specs/`, I want every host-visible tool classified and raw spec mutation blocked unless it is the exact accepted `omp-spec-kit` authoring MCP authority, so that new, indirect, or dynamically targeted tools cannot bypass proposal/review/CAS enforcement.

**Why:** A write/edit/bash shortlist and name-only redirect leave future tools, shell indirection, and authority spoofing uncontrolled.

**Independent Test:** Drive the full live tool census plus a new tool, dynamic shell target, raw spec write, non-spec write, and exact authoring facade; only read-only/non-spec/qualified-authority controls pass.

**Acceptance Scenarios:** `@feature3`, `@feature7`

## US-2: Agent receiving diagnostic context about spec corpus state

**Priority:** Must

As an agent working in a repository with specs, I want kernel diagnostics and corpus census summaries injected into my tool results and context, so that I understand the current spec state without running separate queries.

**Why:** Agents lack ambient awareness of spec-corpus health; injecting findings at natural event boundaries provides situational awareness without requiring explicit query actions.

**Independent Test:** Execute a `read` on a spec file while informational mode is active; observe a `tool_result` content addition containing kernel diagnostics. Start a session; observe a `context` injection with corpus census summary.

**Acceptance Scenarios:** `@feature2`, `@feature10`

## US-3: Session owner whose workflow never breaks on hook failure

**Priority:** Must

As an OMP user, I want every internal fault visible and safety-critical uncertainty conservative, so that informational failures never fake health and classification/containment failures never become raw-write bypasses.

**Why:** Uniform silent allow undermines enforcement; unhandled outer errors produce opaque host fail-closed behavior.

**Independent Test:** Inject kernel/render faults and observe visible non-blocking diagnostics; inject registry/extractor/authority/resolver faults in enforcement mode and observe `TARGET_INDETERMINATE` BLOCK.

**Acceptance Scenarios:** `@feature4`, `@feature8`

## US-4: Release owner verifying self-contained distribution

**Priority:** Must

As a release owner, I want enforcement integrated into the existing bundled extension with exact registry/authority manifests, no ambient dependencies, and no private conformance producer, so that installed behavior matches the reviewed candidate.

**Why:** A standalone factory can be unreachable or form a second control plane; an ambient parser can silently diverge from the kernel.

**Independent Test:** Hide source/root modules, run the installed extension, verify registry/authority/dist hashes, and audit exports/dependencies for any second factory, private spec validator, network, subprocess, or credential access.

**Acceptance Scenarios:** `@feature6`, `@feature11`

## US-5: Privacy-conscious operator with no hidden state

**Priority:** Must

As an operator concerned with data minimization, I want enforcement hooks to keep no private logs, counters, or audit trails outside event-visible records, so that all observable state surfaces through tool results and context injections.

**Why:** Hidden state creates unverifiable behavior and privacy risk; the MIGRATION_MATRIX defers audit-log policy (FR-39) to a later stage, so this spec must not preemptively introduce hidden persistence.

**Independent Test:** Run multiple sessions with enforcement active; inspect the filesystem for any new files outside event-visible records; find none. Verify all diagnostic output appears in `tool_result` content or `context` messages.

**Acceptance Scenarios:** `@feature5`

## US-6: Stage-gated activation observer

**Priority:** Must

As a product integrator, I want enforcement active only after the same-candidate `SPEC_ENFORCEMENT` capability is accepted, so that local settings cannot claim or activate a partial security feature.

**Why:** The valid redirect exists only after accepted `AUTHORING_MCP`, and enforcement itself needs its independent aggregate; live registry drift must block unknown tools rather than disable the gate.

**Independent Test:** Exercise absent, mismatched, and accepted product/authority evidence plus one new live tool; only the accepted candidate activates, and the new tool remains `UNKNOWN`/blocked.

**Acceptance Scenarios:** `@feature9`

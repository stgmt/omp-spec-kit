# User Stories

## US-1: Approver protected from ungrounded plans

**Priority:** Must

As a maintainer reviewing approved work, I want plan approval mechanically blocked when the plan is a copy of another plan, lacks the agreed skeleton, or is not grounded in the session's own prompts, so that approvals reach me only with reviewable, task-specific plans.

**Why:** Native OMP v17.3.7 validates only plan-file existence and title normalization; content quality is prompt-only and the approval popup opens for any structurally absent plan.

**Independent Test:** Submit a byte-duplicate plan, a skeleton-missing plan, and a copied-from-another-task plan; observe three blocked approvals with typed reasons and one allowed valid plan.

**Acceptance Scenarios:** `@feature4`, `@feature5`, `@feature6`, `@feature7`

## US-2: Agent that receives actionable repair guidance

**Priority:** Must

As an agent whose plan was blocked, I want the block reason to name exact failing lines with per-error hints plus the plan template and my recent prompts, so that the next plan draft can be repaired without guessing the contract.

**Why:** A bare "blocked" error invites trial-and-error rewrites and repeated failures.

**Independent Test:** Block a plan with two planted defects and verify the reason contains one `line N` entry with a hint per defect, the bounded template excerpt, and the cached prompt excerpt, all within the reason byte budget.

**Acceptance Scenarios:** `@feature10`

## US-3: Session owner whose workflow never breaks on gate failure

**Priority:** Must

As an OMP user, I want every gate-internal fault (validator exception, missing plan file, unreadable cache, oversized input) to allow the approval flow to continue, so that a defective gate cannot wedge my session.

**Why:** OMP blocks tool execution by default when a hook handler errors; without explicit compensation a buggy gate converts into session-wide denial.

**Independent Test:** Inject each fault class one at a time and observe allowance; observe blocking only after a complete successful validation that returns errors.

**Acceptance Scenarios:** `@feature2`

## US-4: Spec corpus owner

**Priority:** Must

As an owner of `.specs/`, I want plans that touch specification documents or guarded paths to be blocked unless they reference existing `<slug>:FR-N`/`<slug>:AC-N.M` identities, so that spec work stays traceable from the moment of planning.

**Why:** The upstream gate invented this requirement (S-2 in the 2026-08-23 port analysis); it does not exist in the upstream implementation either.

**Independent Test:** Submit a plan whose File Changes include `.specs/plan-gate/FR.md` with a fabricated reference; observe block. Repeat with a reference to a slug and ID that exist on disk; observe allowance.

**Acceptance Scenarios:** `@feature9`

## US-5: Release owner

**Priority:** Must

As a release owner, I want the gate shipped only inside the single self-contained child artifact with measured budgets and one conjunctive evidence gate, so that the interception capability cannot release on structural specification alone.

**Why:** A blocking hook inside a marketplace plugin is a security surface; it needs the same dependency-absent, evidence-first discipline as the read-only stages.

**Independent Test:** Build the candidate artifact, hide root/source dependencies, execute one validation from the installed extension, and evaluate the `plan-gate-release@1` conjunction; remove one record and observe ineligibility.

**Acceptance Scenarios:** `@feature11`, `@feature12`, `@feature13`

## US-6: Plan author working in native plan mode

**Priority:** Should

As an agent writing a plan under the native OMP plan prompt, I want the repository's plan skeleton and spec-reference obligation injected into the LLM context while plan mode is active, so that first drafts already satisfy the gate instead of being rejected by it.

**Why:** Prevention reduces block loops; the upstream analysis (decision D-3) concluded the gate without injection becomes a wall of refusals.

**Independent Test:** Enable plan mode and inspect the `context` event's outgoing messages for exactly one bounded injection message; verify it does not appear outside plan mode and never alters repository bytes.

**Acceptance Scenarios:** `@feature3`

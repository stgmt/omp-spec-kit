# User Stories

## US-1: Approver protected from ungrounded plans

**Priority:** Must

As a maintainer reviewing a plan, I want one deterministic validator over exact supplied bytes so that duplicate, malformed, or ungrounded plans receive a reproducible decision before I approve them.

**Why:** Native OMP v17.3.7 validates only plan-file existence/title and exposes no post-resolver blocking event. Manual validation is useful now; automatic approval blocking remains deferred until the host ABI exists.

**Independent Test:** Validate an explicit byte-duplicate plan, skeleton-missing plan, copied-from-another-task plan, and valid plan; observe three BLOCK decisions and one ALLOW with no directory scan.

**Acceptance Scenarios:** `@feature4`, `@feature5`, `@feature6`, `@feature7`

## US-2: Agent that receives actionable repair guidance

**Priority:** Must

As a caller whose plan failed validation, I want structured paged findings plus a bounded reason, so that I can repair every issue without the reason claiming hidden findings fit.

**Why:** A bare refusal or truncated half-row invites trial-and-error and false completeness.

**Independent Test:** Validate a plan with more findings than fit in 16 KiB and reconcile total count, complete rows, omitted count, and cursor across all pages.

**Acceptance Scenarios:** `@feature10`

## US-3: Session owner whose workflow never breaks on gate failure

**Priority:** Must

As an OMP user, I want every gate-internal fault (unreadable exact input/candidate/index, containment refusal, malformed cache, validator exception, internal deadline) to return ALLOW before the outer timeout, so that a defective gate cannot wedge my session.

**Why:** OMP fails closed on an outer handler error/timeout; the adapter must return its fail-open result within 20 seconds.

**Independent Test:** Inject each fault one at a time and observe ALLOW plus one diagnostic before 20 seconds; observe BLOCK only after complete validation returns errors.

**Acceptance Scenarios:** `@feature2`

## US-4: Spec corpus owner

**Priority:** Must

As an owner of `.specs/`, I want guarded plans validated against a complete contained index of existing qualified IDs, so that missing references block while unreadable or unsafe filesystem state never masquerades as absence.

**Why:** The pure validator cannot inspect realpath/reparse/symlink state; a manual I/O adapter must establish a complete trusted input first.

**Independent Test:** Validate existing/missing IDs in a complete index, then inject unreadable and escaping reparse/symlink variants; observe BLOCK for missing IDs and ALLOW plus `SPEC_INDEX_UNAVAILABLE` for adapter faults.

**Acceptance Scenarios:** `@feature9`

## US-5: Release owner

**Priority:** Must

As a release owner, I want separate manual and automatic evidence profiles inside the single self-contained child artifact, so that manual validation cannot be relabeled automatic without a supported-host receipt.

**Why:** A blocking approval adapter is a security surface and the current OMP pin lacks its required lifecycle event.

**Independent Test:** Evaluate a complete `plan-gate-manual@1` manifest, then attempt `plan-gate-automatic@1` without `CHK-HOST-ABI-01`; the first may pass and the second must fail.

**Acceptance Scenarios:** `@feature11`, `@feature12`, `@feature13`

## US-6: Plan author working in native plan mode

**Priority:** Should

As a plan author, I want bounded contract guidance in manual validation and, after host support exists, optional plan-mode context guidance from the selected-plan event, so that prevention never depends on guessed plan state.

**Why:** Guidance is useful, but current prompt/file heuristics cannot prove that the native resolver selected a particular plan.

**Independent Test:** Verify manual advisory output for explicit input; on a future supported host, verify at most one deep-copy message for `planMode:true`, no stored-message mutation, and no decision change on injection failure.

**Acceptance Scenarios:** `@feature3`

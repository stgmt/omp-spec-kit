# Functional Requirements

Runtime identities are qualified as `spec-authoring-workflow:FR-N`. Product state is `NEXT` under `product:FR-4`; no paragraph claims runtime delivery.

## FR-1: Two-tool public boundary

The future MCP authoring surface SHALL contain exactly `propose_patch` and `apply_proposed_patch`. Domain helpers SHALL compile internally to the same edit-operation representation and SHALL NOT register public tools. The current-host `tool_call` policy SHALL compare the exact two-name allowlist first; every other mutating call whose resolved target is under canonical `.specs/**` SHALL be denied before execution. Calls outside that path remain subject to normal host policy.

**Contract card:** kind `boundary`; subject `authoring-public-surface`; observables: exact tools/list names, path-policy decision, handler route; negative cases: helper registration, alternate writer, non-allowlisted `.specs/**` target; verification: installed MCP inventory and tool-call policy integration tests, pending.
**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11), [AC-1.2](ACCEPTANCE_CRITERIA.md#ac-12)
**Scenario:** `@feature1`
**Story / use case:** [US-1](USER_STORIES.md#us-1-review-exact-changes-before-mutation), [US-4](USER_STORIES.md#us-4-contain-the-write-boundary), [UC-4](USE_CASES.md#uc-4-reject-an-escaping-or-raw-write)

## FR-2: Pure deterministic proposal

`propose_patch` SHALL accept canonical operations for exactly one spec, resolve them against one immutable kernel snapshot, apply them only in memory, and return a complete deterministic Proposal containing proposal identity/hash, spec identity, base snapshot hash, normalized operations, per-document before/after hashes, bounded unified diffs, affected node IDs, and ordered findings. Proposal creation SHALL write no repository, journal, review, or transaction state. Incomplete or truncated previews SHALL be invalid and unappliable.

**Contract card:** kind `api`; subject `pure-proposal`; observables: Proposal and unchanged tree hashes; negative cases: mixed specs, duplicate target, invalid operation, exceeded preview bound; verification: deterministic no-write tests, pending.
**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22)
**Scenario:** `@feature2`
**Story / use case:** [US-1](USER_STORIES.md#us-1-review-exact-changes-before-mutation), [UC-1](USE_CASES.md#uc-1-propose-one-traced-change)

## FR-3: Containment, anchors, and resulting-spec validation

Both public tools SHALL require one explicit canonical repository root and root-relative targets inside one ordinary `.specs/<slug>/` directory. Before reading or writing target content, the resolver SHALL reject traversal, absolute, drive-relative, UNC/device, alternate-data-stream, NUL, normalization-collision, symlink, junction, mount/reparse, unsupported-document, and cross-spec targets; existing ancestors and the target SHALL be checked with platform filesystem metadata. Proposal and apply SHALL reuse the kernel's parser, canonical IDs, form rules, anchor inventory, inbound-link closure, and FR↔AC↔Scenario↔CHK↔TASK conformance over the complete resulting spec. Anchor-addressed edits SHALL refuse ambiguity, incomplete inventory, cross-spec inbound rewrites, or stale section identity.

**Contract card:** kind `filesystem`; subject `contained-valid-result`; observables: canonical targets and ordered findings; negative cases: path escape, linked component, broken anchor, trace loss, unavailable validator; verification: real platform and corpus fixtures, pending.
**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32)
**Scenario:** `@feature3`
**Story / use case:** [US-4](USER_STORIES.md#us-4-contain-the-write-boundary), [US-5](USER_STORIES.md#us-5-preserve-anchors-and-bytes), [UC-4](USE_CASES.md#uc-4-reject-an-escaping-or-raw-write), [UC-5](USE_CASES.md#uc-5-rename-a-heading-safely)

## FR-4: Exact-proposal apply with CAS and revalidation

`apply_proposed_patch` SHALL accept only an existing complete Proposal identity/hash, the expected current hash of every changed document, and a non-empty reason. It SHALL accept no raw operations or replacement bytes. Under one spec-scoped exclusive lock it SHALL re-resolve containment, verify the Proposal hash and document set, compare current hashes, rebuild the exact in-memory result, rerun every mandatory validator, compare hashes again immediately before commit, and refuse on any mismatch. It SHALL never auto-rebase. Replaying the same request identity and content SHALL not create a second commit.

**Contract card:** kind `behavior`; subject `cas-apply`; observables: one exact result or structured refusal; negative cases: missing/extra hash, stale base, proposal mismatch, concurrent change, request reuse with different content; verification: two-writer and replay tests, pending.
**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42)
**Scenario:** `@feature4`
**Story / use case:** [US-2](USER_STORIES.md#us-2-reject-stale-edits), [UC-2](USE_CASES.md#uc-2-apply-the-exact-proposal), [UC-3](USE_CASES.md#uc-3-resolve-a-concurrent-edit)

## FR-5: Atomic one-spec commit and internal rollback

After successful revalidation, the writer SHALL stage a complete result generation on the same filesystem, synchronize files/directories where supported, and replace the spec generation while the exclusive lock prevents mixed reader observations. Any failure before committed visibility SHALL preserve or restore the complete old generation. If swap completion is uncertain, internal recovery SHALL select only a fully hashed valid old or new generation and converge to one complete state. If neither can be proven complete, the service SHALL stop with `RECOVERY_REQUIRED`, perform no further mutation, preserve bounded diagnostics, and instruct manual restoration of the one spec through ordinary VCS or backup. No public recovery, rebaseline, transaction, or overwrite API SHALL exist.

**Contract card:** kind `filesystem`; subject `atomic-generation`; atomicity: one spec generation; rollback: internal old/new hash selection; terminal failure: `RECOVERY_REQUIRED` plus manual restore; verification: fault injection and concurrent reader tests, pending.
**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51), [AC-5.2](ACCEPTANCE_CRITERIA.md#ac-52)
**Scenario:** `@feature5`
**Story / use case:** [US-3](USER_STORIES.md#us-3-commit-related-documents-together), [US-7](USER_STORIES.md#us-7-recover-without-another-public-repair-api), [UC-6](USE_CASES.md#uc-6-survive-a-writer-fault), [UC-7](USE_CASES.md#uc-7-stop-at-unrecoverable-storage)

## FR-6: Byte conservation and compact redacted outcomes

Every accepted edit SHALL preserve untouched bytes, source EOL style, encoding, and final-newline state; changed documents SHALL equal the Proposal after-hashes byte-for-byte. Proposal and Apply responses SHALL use the compact schema and seven error families defined in [spec-authoring-workflow_SCHEMA.md](spec-authoring-workflow_SCHEMA.md). A successful apply SHALL return one redacted MutationReceipt with request/proposal identity, outcome, reason and actor reference when available, changed relative document paths with before/after hashes, and findings. Responses SHALL exclude document bodies, full diffs from apply, credentials, environment values, authorization material, retained bytes, and unrelated paths.

**Contract card:** kind `data`; subject `conservation-and-receipt`; observables: byte hashes, EOL/final-newline state, compact receipt; negative cases: accidental normalization, secret/body leak, stack trace; verification: byte corpus and redaction tests, pending.
**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61), [AC-6.2](ACCEPTANCE_CRITERIA.md#ac-62)
**Scenario:** `@feature6`
**Story / use case:** [US-5](USER_STORIES.md#us-5-preserve-anchors-and-bytes), [US-6](USER_STORIES.md#us-6-receive-a-useful-private-receipt), [UC-2](USE_CASES.md#uc-2-apply-the-exact-proposal)

## FR-7: Real correctness evidence

Implementation SHALL be verified with provenance-recorded real kernel corpus captures, real Windows and POSIX containment observations, real multi-process races, and the real generation writer under deterministic fault injection. Tests SHALL plant omissions in containment, CAS, validation, anchor rewrite, atomic rollback, and redaction and prove each test fails when its protected check is disabled. Fixture and test results SHALL be release evidence owned by normal verification; they SHALL NOT create a separate runtime lifecycle, mutation-quality gate, eligibility tuple, registry manifest, or public API.

**Contract card:** kind `verification`; subject `authoring-correctness`; observables: producer provenance, reconciled hashes, race/fault outcomes; negative cases: synthetic producer shape, source-text assertion, zero-scenario pass, disabled guard surviving; verification: integration and targeted fault/mutation tests, pending.
**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72)
**Scenario:** `@feature7`
**Story / use case:** [US-2](USER_STORIES.md#us-2-reject-stale-edits), [US-3](USER_STORIES.md#us-3-commit-related-documents-together), [UC-3](USE_CASES.md#uc-3-resolve-a-concurrent-edit), [UC-6](USE_CASES.md#uc-6-survive-a-writer-fault)

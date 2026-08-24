# Non-Functional Requirements

All NFRs are planned with a `DEFERRED`, unregistered release. Implementation and isolated evidence production may proceed without exposing authoring actions or mutating user specifications.

## NFR-1 — Safety and fail-closed behavior

Any uncertainty in aggregate eligibility, proposal/review identity, expiry, root identity, linked-path containment, expected current/journal/candidate hashes, no-survivor assessment, validation/link closure, transaction state, recovery authorization/selection, audit-history continuity, lease ownership, status evidence, or mutation evidence SHALL refuse mutation. A refusal SHALL conserve the blocked current generation and all recovery/history material, expose no candidate bytes/path, and keep coordinated access blocked.

## NFR-2 — Atomicity and durability

Within one specification, coordinated readers SHALL observe one complete generation. Before a success response, written bytes and required directory metadata SHALL be durably synchronized where the platform exposes that capability. Unsupported durability primitives SHALL be reported and SHALL block release on that platform rather than be silently ignored.

## NFR-3 — Determinism

Given identical request bytes, root fingerprint, kernel snapshot, policy version, current/journal/assessment/candidate hashes, document bytes, and authenticated review identity, proposal normalization, complete-preview hash, diff ordering, findings, affected-node ordering, and proposal hash SHALL be identical. Time-dependent fields are excluded from content digests but review and recovery authorization expiry are validated as state guards.

## NFR-4 — Concurrency and bounded waiting

Mutation leases SHALL be root-scoped, exclusive, owned, and bounded by a configured timeout. Readers SHALL use the paired shared snapshot coordinator. Lease timeout returns a retryable typed error; lease expiry alone SHALL not permit takeover while the owner process is proven alive. Concurrency tests SHALL cover two writers, a reader during swap, replay, crash, retained recovery, and rebaseline proposal/apply races.

## NFR-5 — Performance and resource bounds

Proposal previews SHALL enforce configurable maximum changed documents, operations, diff bytes, diff lines, and validation findings. Exceeding a bound makes the proposal inapplicable and reports the exact bound. Retained recovery and no-survivor rebaseline SHALL accept at most the canonical 15 unique documents and one unexpired host authorization bound to one transaction/root/mode and exact hash inventory; requests accept no document bytes. Rebaseline candidates use only the fixed root-contained ordinary directory grammar. No fixed latency target is asserted before installed-artifact baselines exist. No operation SHALL perform a semantic/model call.

## NFR-6 — Portability

Containment, hashing, EOL preservation, staging, rename/swap, synchronization, and reparse-point checks SHALL be proven on every supported OMP host platform. Windows drive, UNC, junction, and reparse semantics and POSIX symlink/mount semantics SHALL have explicit fixtures. Linked roots/spec directories/targets are unsupported for both reading and mutation on every platform. A platform without a proven implementation remains unsupported for mutation; its read-only behavior, if any, remains limited to ordinary unlinked roots under kernel policy.

## NFR-7 — Privacy and redaction

Responses, errors, metrics, and audit envelopes SHALL not expose credentials, environment values, document bodies, unrelated paths, backup contents, candidate paths/bytes, or recovery authorization material. Complete diff preview is returned only to the authorized caller and is not copied into audit evidence; review stores only content-addressed identity and actor/time metadata. Rebaseline audit records fingerprints and full pre/post hashes while preserving the prior digest chain. Transient staged/preimage material SHALL use restrictive permissions where supported; ordinary cleanup occurs only after commit/rollback/retained-recovery proof, while rebaseline SHALL NOT erase the failed transaction, journal, recovery assessment/material, candidate source, or audit history.

## NFR-8 — Compatibility and byte conservation

Untouched documents and untouched regions SHALL remain byte-identical. Edited documents SHALL preserve their original EOL convention and final-newline policy unless the requested operation explicitly changes the full document. The contract SHALL reject unsupported schema versions rather than guess compatibility.

## NFR-9 — Observability without hidden state

Every operation SHALL return enough identifiers, hashes, state transitions, findings, and next action to reconcile its outcome. Persistent audit export is opt-in to an explicit sink. The authoring service SHALL not create durable logs, caches, ledgers, `.progress.json`, or other workflow state inside the target repository.

## NFR-10 — Test strength

Behavioral tests SHALL assert deferred implementation without registration, proposal review separation, raw/same-call apply refusal, document hashes, linked-path pre-read refusal, visible generations, exact recovery/rebaseline state transitions, retained/no-survivor branching, operator authorization, current/journal/candidate hash binding, full validation, atomicity, history preservation, fail-closed leak/link/concurrency errors, all-of registration eligibility, and audit redaction. Source-text assertions, mocked filesystem-only proofs, or a passing command with zero scenarios SHALL not satisfy release evidence. Safety-critical mutation score is 100% killed by family, not an aggregate percentage.

## NFR-11 — Maintainability

One schema, one validator composition, one root resolver, one transaction authority, and one task transition table SHALL serve extension and any later MCP adapter. Duplicate implementations or compatibility shims are prohibited.

## NFR-12 — Honest readiness

Documentation, status results, releases, and user guidance SHALL distinguish `DEFERRED`, `ELIGIBLE`, `IMPLEMENTED`, and `PROVEN`, plus implementation evidence from registration state. Specification scenarios are never execution evidence. FR-13 SHALL enumerate exact all-of mandatory evidence for FR-1..FR-12, current distribution, and both separately qualified kernel target-stage aggregates, including their v0.2 artifact, v0.3 artifact, v0.3 parent, product revision, and artifact-lineage identities; legitimate linked predecessor/current hashes SHALL not be rejected merely because they differ. Missing, stale, revoked, red, ambiguous, filtered-only, count-only, any-of, source-tree-only, unqualified, duplicate-stage, substituted-stage, cross-lineage, or parent-mismatched proof SHALL not advance readiness.

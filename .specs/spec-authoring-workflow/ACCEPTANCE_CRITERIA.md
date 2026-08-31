# Acceptance Criteria

These EARS criteria are specification text, not execution evidence.

## AC-1.1

**Requirement:** [FR-1](FR.md#fr-1-two-tool-public-boundary)

**WHEN** the installed MCP inventory is listed **THEN** its public mutation names SHALL be exactly `propose_patch` and `apply_proposed_patch`, internal helpers SHALL be absent, and the historical v0.3.2 read-only inventory SHALL remain historical evidence rather than a mutable authoring registry.

## AC-1.2

**Requirement:** [FR-1](FR.md#fr-1-two-tool-public-boundary)

**WHEN** a current-host tool call can write and its resolved target is under canonical `.specs/**` **THEN** the path policy SHALL allow it only when the tool name is in the exact authoring allowlist and SHALL deny every non-allowlisted writer before execution.

## AC-2.1

**Requirement:** [FR-2](FR.md#fr-2-pure-deterministic-proposal)

**WHEN** a valid one-spec request is proposed twice against identical bytes **THEN** both complete Proposals SHALL have equal normalized operations, finding order, diffs, before/after hashes, and Proposal hash, while all repository hashes remain unchanged.

## AC-2.2

**Requirement:** [FR-2](FR.md#fr-2-pure-deterministic-proposal)

**IF** operations target multiple specs or duplicate documents, violate a bound, or produce an invalid or incomplete preview **THEN** proposal SHALL return `INVALID_REQUEST` or `VALIDATION_FAILED`, SHALL be unappliable, and SHALL create no repository or durable review/transaction state.

## AC-3.1

**Requirement:** [FR-3](FR.md#fr-3-containment-anchors-and-resulting-spec-validation)

**IF** any root, spec, ancestor, or target is escaping, linked, reparse-backed, ambiguous, unsupported, normalization-colliding, or switched during resolution **THEN** both tools SHALL return `PATH_FORBIDDEN` before target mutation and SHALL report only bounded repository-relative diagnostics.

## AC-3.2

**Requirement:** [FR-3](FR.md#fr-3-containment-anchors-and-resulting-spec-validation)

**WHEN** the resulting in-memory spec has a broken canonical form, duplicate ID, missing FR↔AC↔Scenario↔CHK↔TASK edge, unresolved anchor, incomplete inbound rewrite, or unavailable validator **THEN** the operation SHALL return ordered `VALIDATION_FAILED` findings and zero changed bytes.

## AC-4.1

**Requirement:** [FR-4](FR.md#fr-4-exact-proposal-apply-with-cas-and-revalidation)

**WHEN** Proposal identity, every expected document hash, containment, and full resulting-spec validation still match under the lock **THEN** apply SHALL commit bytes exactly equal to the Proposal after-hashes and return one receipt; equal request replay SHALL not commit again.

## AC-4.2

**Requirement:** [FR-4](FR.md#fr-4-exact-proposal-apply-with-cas-and-revalidation)

**IF** any expected hash, Proposal hash, document set, path identity, or validation result changes before swap **THEN** apply SHALL return `CONFLICT` or `VALIDATION_FAILED`, SHALL not auto-rebase, and SHALL preserve the concurrently committed generation.

## AC-5.1

**Requirement:** [FR-5](FR.md#fr-5-atomic-one-spec-commit-and-internal-rollback)

**WHEN** deterministic faults occur before staging, during write/sync, immediately before swap, during swap, or during cleanup **THEN** every coordinated reader SHALL observe only a fully hashed old or fully hashed new generation and the final tree SHALL reconcile to one of them.

## AC-5.2

**Requirement:** [FR-5](FR.md#fr-5-atomic-one-spec-commit-and-internal-rollback)

**IF** internal rollback cannot prove a complete old or new generation **THEN** apply SHALL return `RECOVERY_REQUIRED`, perform no further authoring write, preserve bounded hashes/findings, and instruct manual restoration of the named spec from VCS or backup without exposing another public mutation operation.

## AC-6.1

**Requirement:** [FR-6](FR.md#fr-6-byte-conservation-and-compact-redacted-outcomes)

**WHEN** a section or anchor edit commits **THEN** untouched spans, encoding, EOL style, and final-newline state SHALL equal the captured preimage and every changed document SHALL equal its Proposal after-hash byte-for-byte.

## AC-6.2

**Requirement:** [FR-6](FR.md#fr-6-byte-conservation-and-compact-redacted-outcomes)

**WHEN** proposal or apply succeeds or refuses **THEN** the response SHALL match the compact Proposal, ApplyResult, MutationReceipt, or Error shape; planted document bodies, secrets, environment values, stack traces, retained bytes, and unrelated absolute paths SHALL be absent.

## AC-7.1

**Requirement:** [FR-7](FR.md#fr-7-real-correctness-evidence)

**WHEN** authoring verification runs **THEN** corpus, anchor, filesystem, concurrency, and fault fixtures SHALL identify their real producer/version/invocation/platform/source hash/trimming/ground truth and SHALL reconcile producer summaries with independent document or tree hashes.

## AC-7.2

**Requirement:** [FR-7](FR.md#fr-7-real-correctness-evidence)

**WHEN** containment, CAS, resulting-spec validation, anchor rewrite, atomic rollback, or redaction is deliberately disabled one at a time **THEN** at least one concrete behavioral test SHALL fail for each omission; these checks SHALL remain CI evidence and SHALL NOT alter runtime availability or response shape.

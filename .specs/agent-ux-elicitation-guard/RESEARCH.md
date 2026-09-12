# Research

## Findings

The findings below describe observed constraints and implementation facts; they are not additional normative requirements.

## RF-1: Silent spec with invented numbers

An incident run produced a complete multi-document specification without clarifying questions or source-backed support for its numeric claims. All kernel checks stayed green.

## RF-2: Extension owns no asking path

The authoring guard runs at the MCP authoring boundary and does not implement a user-question dialog. User questioning remains agent-side through the canonical memo.

## RF-3: Authoring is pure transaction mechanics

Proposals, service, and transactions move bytes atomically under a lock. No step reads sources, ranks gaps, or asks questions.

## RF-4: Protocol elicitation was skipped deliberately

The MCP UX adoption plan skips protocol elicitation because short-lived calls cannot negotiate client capability. The only asking path that works everywhere is the agent-side question dialog plus a memo.

## RF-5: Kernel verifies closure not meaning

The kernel proves reference conservation, unique definitions, and anchor integrity. A spec can be internally consistent, disconnected from reality, and still pass every invariant with zero errors.

## RF-6: First-write stop is checkable without a judge

Whether the first real apply against a missing canonical Markdown document was refused once, left bytes unchanged, and allowed the following attempt is observable at the public MCP boundary. Whether the following questions were smart is not machine-checkable and stays a manual qualitative review.

## RF-7: Pointer beats full-text copy

One short shared hint referenced from instructions, errors, and block reasons keeps wording single-sourced. Copying the full memo into every surface spends budget on every call and drifts.

## Decisions

D-1. Stop the first creation of a missing canonical Markdown document, never later edits.

D-2. The memo is canonical; code holds a short pointer only.

D-3. The stop error carries the memo path and retry guidance and changes zero bytes.

D-4. Automatic runs meet the same stop and pass on a valid retry; retry payload equality is irrelevant.

D-5. Ticket state is process-local and non-persistent; a restart may safely issue one new stop for a still-missing target.

## Rejected alternatives

A server-side content truth check was rejected because meaning is not machine-checkable. A permanent block until proof of questions was rejected because proof can be faked and automatic runs would wedge. Copying the memo into instructions was rejected because of budget and drift.

## RF-8: Package and corpus gates are part of the contract

The canonical memo is a package file, while runtime sources are copied to the installable distribution by scripts/build-plugin.mjs. scripts/verify-package.mjs and scripts/check-spec-corpus.mjs therefore remain admission gates rather than optional documentation checks.

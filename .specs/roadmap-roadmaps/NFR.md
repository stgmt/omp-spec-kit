# Non-Functional Requirements

## NFR-DETERMINISM-1: Deterministic assembly

Equal canonical graphs produce byte-identical generated regions: fixed grouping, code-point canonical-ID ordering, LF line endings, and no wall-clock data inside generated content. A `generatedAt` timestamp, if present, lives outside the generated region or is omitted.

## NFR-IDEMPOTENCE-1: Idempotent re-assembly

Re-assembling an unchanged graph produces an unchanged ROADMAP.md — zero-byte diff, stable corpus fingerprint. Drift between the generated region and the graph is detectable by read-only comparison.

## NFR-AUTHORED-1: Authored content integrity

Assembly never modifies, reorders, or deletes bytes outside the generated markers, including authored notes that reference generated canonical IDs. Malformed or missing markers produce a typed refusal, never a partial rewrite.

## NFR-BOUNDS-1: Bounded generated output

The generated region is complete or fails with a typed size error; it is never silently truncated. The roadmap document SHOULD remain small enough for a human-facing page.

## NFR-SEPARATION-1: Separation of concerns

Scope derivation, ordering, and status derivation are pure kernel/domain functions of the canonical graph. Marker-region merge is a pure text transform. Filesystem access, locking, and receipts live in the governed write path, not in the assembler.

## NFR-SAFETY-1: No silent mutation

Every assembly write is receipted and auditable. A re-assembly that would remove generated items reports the removals; authored-region bytes are hashed in the receipt so silent drift is detectable.

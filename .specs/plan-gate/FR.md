# Functional Requirements

The public state of this capability is LATER under `product:FR-5`. Scenario text is not execution evidence.

## FR-1: Exact manual validation contract

The implementation SHALL expose one library function `validateExactPlan(request)`. The request SHALL contain exact UTF-8 `content` and MAY contain `sourceUri`, `expectedSha256`, and `requestText`. The result SHALL contain `status`, computed `contentSha256`, bounded `findings`, and exact `omittedCount`. Status SHALL be one of `VALID`, `INVALID`, or `UNAVAILABLE`.

**Related AC:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-exact-request-produces-a-typed-result)

## FR-2: Input integrity and truthful unavailability

The validator SHALL compute SHA-256 from the supplied content before semantic checks. A mismatched `expectedSha256`, invalid request shape, exceeded hard input bound, or internal inability to finish SHALL return `UNAVAILABLE` with one diagnostic. `UNAVAILABLE` SHALL never be represented as `VALID` or as a content error.

**Related AC:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-integrity-and-runtime-failures-are-unavailable)

## FR-3: Native-compatible actionable content

The validator SHALL accept heading aliases defined in `plan-gate_SCHEMA.md` without imposing heading order. It SHALL return `INVALID` when any of these semantic fields is missing or empty: objective, approach, scoped repository-relative files paired with actions, verification, and assumptions. A file action of `delete`, `move`, `rename`, `replace`, or `overwrite` SHALL also require non-empty destructive-impact disclosure. Other headings and prose SHALL be allowed.

**Related AC:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-actionable-content-is-required-without-a-fixed-template)

## FR-4: Optional request alignment is advisory

When `requestText` is supplied, the validator SHALL compare its normalized significant words with those in the objective and approach. Zero overlap SHALL emit `REQUEST_ALIGNMENT_WARNING`. This warning SHALL not change a result from `VALID` to `INVALID`; malformed or over-budget request text SHALL be handled by FR-2.

**Related AC:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-request-alignment-never-blocks)

## FR-5: Bounded deterministic findings

Every content finding SHALL carry a closed code, severity, optional 1-based line, bounded message, and bounded repair hint. Findings SHALL be ordered by line, then code, with document-level findings first. The result SHALL return at most 50 complete findings and SHALL report the exact number omitted; it SHALL retain no validation data.

**Related AC:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-findings-are-complete-bounded-and-stable)

## FR-6: Pure and self-contained execution

`validateExactPlan` SHALL perform no filesystem access, directory discovery, writes, network calls, provider calls, credential access, subprocess execution, or persistent storage. `sourceUri` SHALL be display-only and never dereferenced. The installed artifact SHALL run without the source checkout or external `node_modules`.

**Related AC:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-the-installed-validator-has-no-side-effects)

## FR-7: Real fixture provenance

Executable positive and negative plan fixtures SHALL record capture method, producer and version, source, capture date, SHA-256, byte count, license disposition, trimming, and reviewed ground truth. Synthetic fixtures MAY cover only scale limits or a minimal planted fault and SHALL be labeled synthetic.

**Related AC:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-real-fixtures-reconcile-with-ground-truth)

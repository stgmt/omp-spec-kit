# Fixtures

Fixture admission follows the repository real-producer policy (`spec-kernel:FR-11` house standard). Every executable gate fixture must be real, immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid plan | An actually authored plan from a live repository plan directory | Positive end-to-end: every phase passes | Real; full manifest |
| Duplicate plan | Byte copy of the valid plan under a second name | Phase 0 block | Real-derived (documented trimming none) |
| Structure negatives | Real plan edited to remove/misorder exactly one construct per variant | Phase 1 one-error-per-violation census | Real-derived with reviewed ground truth lines |
| Ungrounded plan | A real plan authored for task A validated against task B's prompt cache | Phase 2.5 deny | Real pair; score recorded |
| Contaminated file changes | Real plan with File Changes rows not discussed in body | Phase 3 threshold block at >0.5 and pass at ≤0.5 | Real-derived |
| Missing extracted requirements | Real plan with Context lacking the block / one item | Phase 2 block variants | Real-derived |
| Spec-reference corpus | Snapshot of a real `.specs` tree (e.g. this repository's `product` or `plugin-distribution` spec) plus plans citing existing, fabricated-slug, and fabricated-ID references | FR-9 pass/block matrix | Real tree snapshot with hash |
| Fault fixtures | Malformed cache JSON, oversized plan (>2 MiB), unreadable sibling, symlinked spec directory | FR-2/FR-9 fault paths | Synthetic (labeled) |
| Scale fixtures | Generated large plans for budget/latency measurements | NFR evidence | Synthetic (labeled) |

## Manifest fields

Each fixture record carries: fixture ID, category, capture command or method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming note, and ground truth.

Ground truth for negative fixtures lists every expected blocking error as `{phase, line, code}` in validator output order; admission reconciliation compares observed results element-for-element.

## Provenance boundary

Upstream `dev-pomogator` plan files (e.g. `tools/plan-pomogator/fixtures/valid.plan.md`) are capture candidates only. Importing any upstream byte into this repository still requires the repository's provenance/SHA-256/license disposition decision per `SECURITY.md` and the import policy; this specification does not waive that gate.

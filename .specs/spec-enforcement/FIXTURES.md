# Fixtures

Fixture admission follows the repository real-producer policy (`spec-kernel:FR-11` house standard). Every executable enforcement fixture must be real, immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid spec document | An actual spec file from a live `.specs/` tree (e.g. this repository's `product` or `spec-kernel` spec) | Positive end-to-end: diagnostic injection produces kernel findings | Real; full manifest |
| Spec write attempt | Recorded agent tool call inputs targeting `.specs/**` paths | Enforcement-mode block/redirect verification | Real-derived; documented capture method |
| Non-spec write attempt | Recorded agent tool call inputs targeting paths outside `.specs/` | Negative: non-matching calls pass without interception | Real-derived |
| Kernel-unavailable session | Session with kernel module removed or failing | FR-4/FR-8 degradation verification | Synthetic (labeled) |
| Door-absent session | Session before authoring cumulative gate acceptance | FR-8/FR-9 stage-gate degradation | Synthetic (labeled) |
| Fault fixtures | Malformed kernel responses, handler exceptions, over-budget diagnostics | FR-4 fail-honest verification | Synthetic (labeled) |
| Bypass attempt fixtures | Tool calls using `bash` redirection, `tee`, `cp`, `mv` targeting `.specs/` | FR-7 no-bypass verification | Synthetic (labeled) |
| Scale fixtures | Large corpus census queries for budget/latency measurements | NFR evidence | Synthetic (labeled) |

## Manifest fields

Each fixture record carries: fixture ID, category, capture command or method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming note, and ground truth.

Ground truth for enforcement fixtures lists expected outcomes: `{matched: boolean, mode: string, outcome: "block" | "allow" | "diagnostic", reasonCode?: string}` in handler execution order; admission reconciliation compares observed results element-for-element.

## Provenance boundary

Real spec documents from this repository's own `.specs/` tree are preferred capture candidates because their license disposition is already established. Upstream `dev-pomogator` spec files are capture candidates only; importing any upstream byte into this repository still requires the repository's provenance/SHA-256/license disposition decision per `SECURITY.md` and the import policy; this specification does not waive that gate.

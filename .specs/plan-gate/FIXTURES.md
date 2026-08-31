# Fixtures

Fixture admission follows the repository real-producer policy. Every executable plan fixture must be immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid native plan | A plan actually authored during a real repository planning task | Positive `VALID` behavior across all semantic fields | Real; full manifest |
| Content negatives | The valid plan with exactly one semantic field or impact disclosure removed per variant | One-fault `INVALID` code, line, and hint coverage | Real-derived; derivation and ground truth recorded |
| Integrity variants | The valid plan request with malformed or mismatched expected digest and over-budget metadata | `UNAVAILABLE` request branches | Real-derived request vectors |
| Alignment pair | The valid plan paired with unrelated real request text | Advisory warning without invalidation | Real pair; both sources recorded |
| Scale and internal-failure vectors | Generated large input or injected implementation fault | Hard bounds and `VALIDATOR_FAILURE` | Synthetic; labeled and excluded from real-fixture obligation |

## Manifest fields

Each real or real-derived fixture record carries:

- fixture ID and category;
- capture command or method;
- producer and version or commit;
- source path or URL;
- capture date;
- SHA-256 and byte count;
- license disposition;
- permitted trimming or derivation note;
- reviewed expected status and ordered `{code, severity, line}` findings.

Admission recomputes hashes and sizes and compares observed results element-for-element with ground truth.

## Provenance boundary

The existing upstream `E:/repos/dev-pomogator/tools/plan-pomogator/fixtures/valid.plan.md` is a capture candidate only. Importing its bytes still requires an explicit repository provenance, SHA-256, and license-disposition decision under `SECURITY.md`; this specification grants no waiver. Synthetic fixtures may prove only limits or planted one-fault behavior and cannot replace a real positive plan.

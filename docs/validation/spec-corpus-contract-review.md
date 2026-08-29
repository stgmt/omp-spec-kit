# Specification Corpus Contract Review

- **Date:** 2026-08-29
- **Scope:** all ten live specifications, their cross-specification contracts, repository status surfaces, implementation paths changed by the repair, and the real Docker BDD evidence stream
- **Verdict:** **PASS for the requested corpus-contract repair**
- **Open severity:** **P0: 0; P1: 0**

This verdict means the reviewed contracts are internally consistent, reality-checked, mechanically guarded, and free of open P0/P1 findings. It does not promote a planned capability to delivered, make a host ABI exist, or override an individual specification's lifecycle/readiness state.

## Per-specification census

| Specification | Files reviewed | FR | AC | Scenario definitions | CHK | Tasks | NFR contract |
|---|---:|---:|---:|---:|---:|---:|---:|
| `mcp-release-integrity` | 16 | 6 | 6 | 18 | 11 | 8 | 4 sections / 9 normative clauses |
| `plan-gate` | 15 | 13 | 14 | 14 | 17 | 11 | 6 |
| `plugin-distribution` | 15 | 13 | 16 | 15 | 19 | 13 | 7 |
| `product` | 15 | 9 | 17 | 17 | 11 | 9 | 7 |
| `spec-authoring` | 15 | 14 | 51 | 45 | 26 | 14 | 12 |
| `spec-capability` | 15 | 10 | 11 | 10 | 18 | 8 | 6 |
| `spec-enforcement` | 15 | 11 | 13 | 12 | 13 | 10 | 6 |
| `spec-evidence` | 15 | 14 | 14 | 14 | 14 | 11 | 6 |
| `spec-kernel` | 15 | 17 | 17 | 17 | 18 | 15 | 7 |
| `spec-lsp` | 15 | 12 | 13 | 13 | 20 | 13 | 7 |

The MRI row includes its additional fixture contract. The canonical corpus verifier independently reported 10 specifications and 150 canonical documents.

## Independent semantic review

Ten independent bounded reviewers each owned one specification. After repair, every final review returned **PASS**:

- plan gate: symmetric task trace and one canonical CHK matrix;
- plugin distribution: exact trust, inventory limits, pinned MCP schema, and reverse trace;
- enforcement: honest `DEFERRED_HOST_ABI`, aligned authority versions, typed receipts, and closed Sigstore trust roots;
- MRI: exact evidence schemas, archive/launcher containment, JSON-RPC failures, and source-derived scenario multiplicity;
- evidence: complete ingestion outcomes, binding sidecars, cursor semantics, and release-result binding;
- LSP: generic host acknowledgement, complete hover/availability/severity semantics, Unicode position conversion, and bounded NFR checks;
- capability: constructible lifecycle source, archive defaults, overlay conservation, precedence, bounds, and role-typed baselines;
- authoring: 51/51 AC backlinks, complete CHK/scenario/task trace, seven edit operations, and MCP-only mutation;
- kernel: V1 purity plus the closed V2 schema, conservation, query errors, status, evidence profile, and dormant registration path;
- product: exact seven-capability map, historical v0.3.2 profile, mutually exclusive states, host-ABI deferrals, and generator-port destination.

No review slice retained an unresolved P0 or P1 finding.

## Mechanical corpus checks

| Check | Result |
|---|---|
| Plugin build and package verification | PASS |
| Generator-port conservation | 46/46 names source-equal |
| First-slice conservation | 8/8 entries |
| Corpus graph | 1,085 nodes / 2,246 edges |
| Markdown corpus | 150 canonical documents |
| Broken Markdown anchors | 0 |
| Spec reality checks | 10/10 completed; 0 error findings after repair |
| Negative ratchets | Census-row removal, ceiling overflow, broken anchor, invalid status, and noncanonical scenario probes were rejected |

Reality-check warnings were classified rather than suppressed: future implementation paths remain absent where the capability is `SPECIFIED` or `DEFERRED_HOST_ABI`; historical delivered files and commit metadata remain evidence for the v0.3.2 baseline. No warning is used as evidence that a future runtime exists.

## Real BDD and fixture proof

The final unfiltered Docker run passed:

```text
77 scenarios (77 passed)
720 steps (720 passed)
```

The committed Cucumber Message fixture is real producer output, not a hand-authored approximation:

- fixture SHA-256: `9bcaa12544ad81dca1fb72915a38afb26e8e0ba890ece243783bfd54063600d2`;
- capture image: `sha256:1143a064082310cc43132ce8562b233a413a8e0c625969675143c17f686647c8`;
- source-input receipt: 174 files, aggregate `cca0e38e47581e776e61eaf72cdea1dfcf9d63f317abadf29c5a1700fd9963ea`;
- source-manifest SHA-256: `194c85494af9a0380202ae665894fbd40783b1198babfb367020cb258dbfae15`;
- required MRI evidence: all 18 stable IDs and all 40 source-derived pickle executions;
- terminal evidence: one test case and one complete passing terminal chain per required pickle, plus one successful run terminator.

A second Docker run consumed the recaptured fixture and again passed 77/77 scenarios and 720/720 steps. The suite first exposed and then closed two provenance defects: a Docker-excluded source input and verification performed after an intentional package mutation.

## Test-strength assessment

The changed contract is defended at the observable boundary:

1. the suite launches the real Docker producer and candidate/release paths;
2. the primary fixture is captured from real Cucumber Messages and carries closed provenance;
3. every current source input is byte-counted and SHA-256 checked before fixture use;
4. exact scenario multiplicity is derived from the source feature, not a duplicated constant;
5. cardinality and conservation checks cover all required pickles, cases, starts, steps, finishes, and the run terminator;
6. negative cases assert named parser/error codes for malformed, incomplete, duplicated, retry-only, and failed evidence;
7. non-first outline removal proves that aggregate-only counting cannot pass;
8. physical-root, symlink-parent, artifact-identity, lifecycle, and public-safety failures are exercised through integration paths;
9. intentional in-memory mutations are proven not to alter committed fixture bytes;
10. credential mutations prove provenance checking occurs before the test deliberately changes package content;
11. no silent skip or synthetic distribution claim can create public eligibility;
12. the final full suite is green against the exact recaptured fixture.

## Product and release-state boundary

The product map now has seven exact capability rows:

- 4 capabilities are `SPECIFIED`;
- 3 capabilities are `DEFERRED_HOST_ABI` because OMP v17.3.7 does not expose the required tool-call authority identity;
- the historical v0.3.2 baseline remains `DELIVERED / CURRENT_BASELINE` without invented parent lineage;
- `PLANNED` and `SPECIFIED` are mutually exclusive;
- authoring, enforcement, and automatic plan gating share one explicit host-ABI dependency tuple.

The release contract binds candidate identity, archive digest, qualified MRI and distribution receipts, release-note body/hash/source, and exact DSSE/Fulcio/Rekor trust material. It does not reinterpret local self-attestation as public distribution proof.

## Readiness caveat

The corpus-contract repair passes, but this is not a blanket `DONE` claim. In particular, the authoritative MRI spec validator remains `NOT_READY` because its AC-satisfaction lifecycle lane is still red even though structure, traceability, and all 18 current scenarios are green. Future capabilities remain specified or host-ABI-deferred until their own delivery evidence exists.

The product validator also emits one classified external false positive: `ACCEPTANCE_DELIVERY_COVERAGE` demands payment-specific lanes (`unauthenticated`, `insufficient_balance`, `funded_success`, `settlement_idempotency`, and `artifact_readback`) from generic product capability gate `AC-6.2`. Those concepts are absent by design and were not fabricated to turn the validator green. The repository-owned product review, build, traceability, corpus, and reality checks remain green; this validator defect is not accepted as a product-corpus requirement.

## Final finding disposition

| Disposition | Open |
|---|---:|
| Confirmed P0 corpus findings | 0 |
| Confirmed P1 corpus findings | 0 |
| Classified external validator false positives | 1 |

**Final decision:** accept the corpus-contract repair. Preserve the explicit lifecycle boundaries; do not promote the deferred capabilities until the required host ABI and capability-specific evidence are present.

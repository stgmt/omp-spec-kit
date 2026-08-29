# Requirements Summary

## Product boundary

`plugin-distribution` owns one marketplace/package/extension/server topology, candidate-profile packaging/lifecycle/safety evidence, and distribution-only eligibility. Historical v0.1/v0.2/v0.3 receipts remain immutable; delivered current baseline is v0.3.2. `mcp-release-integrity` owns MRI, while `product:FR-6` alone owns baseline/capability/public delivery composition.

## Requirement index

| ID | Contract | Acceptance | Scenario | Delivery task |
|---|---|---|---|---|
| FR-1 | One root marketplace and one catalog entry | AC-1.1 | `@feature1` | TASK-1, TASK-2, TASK-3, TASK-12 |
| FR-2 | One child package/extension with versioned profile | AC-2.1 | `@feature2` | TASK-1, TASK-2, TASK-3, TASK-12 |
| FR-3 | Root-relative inventory and declared first-slice surface | AC-3.1 | `@feature3` | TASK-4, TASK-6, TASK-12 |
| FR-4 | Install/reload/fresh-session activation | AC-4.1, AC-4.2 | `@feature4` | TASK-1, TASK-6, TASK-7, TASK-12 |
| FR-5 | Clean dependency-absent extension/MCP payload | AC-5.1 | `@feature5` | TASK-5, TASK-6, TASK-12 |
| FR-6 | Read-only failure containment | AC-6.1 | `@feature6` | TASK-4, TASK-6, TASK-12 |
| FR-7 | Candidate version and upgrade from real predecessor | AC-7.1, AC-7.2 | `@feature7` | TASK-6, TASK-8, TASK-12 |
| FR-8 | Uninstall/reinstall/rollback preservation | AC-8.1, AC-8.2 | `@feature8` | TASK-6, TASK-8, TASK-12, TASK-13 |
| FR-9 | Provenance/license/secret/package gates | AC-9.1 | `@feature9` | TASK-9, TASK-12 |
| FR-10 | Attested GitHub release transaction | AC-10.1 | `@feature10` | TASK-11, TASK-12 |
| FR-11 | No claim before current evidence | AC-11.1 | `@feature11` | TASK-10, TASK-12, TASK-13 |
| FR-12 | Public schema and containment | AC-12.1 | `@feature12` | TASK-1, TASK-4, TASK-6, TASK-12 |
| FR-13 | Distribution-only eligibility under current trust root | AC-13.1 | `@feature13` | TASK-8, TASK-10, TASK-11, TASK-12, TASK-13 |

## Contract cards

### FR-1 card

- **Trigger:** Candidate topology validation.
- **Input:** Complete repository/child path inventory and catalog/package bytes.
- **Output:** Accepted single topology or blocking findings.
- **Invariant:** 1 catalog × 1 plugin × 1 child package × 1 extension × at most the profile's one MCP identity.
- **Failure:** Duplicate/nested/alternate/escaping/profile-mismatched surface blocks.

### FR-3 card

- **Trigger:** Installed inventory/declared first-slice invocation.
- **Input:** OMP context root, schema-valid bounds, candidate surface manifest.
- **Output:** Versioned bounded result.
- **Invariant:** Root-contained read-only behavior; v0.3 eight names are first slice, not ceiling.
- **Failure:** Typed bounded diagnostics; no session crash or status laundering.

### FR-4 card

- **Trigger:** Exact candidate project-scope lifecycle.
- **Input:** Marketplace, installed artifact digest, candidate/profile identity.
- **Output:** Separate discovery/install/reload/session/invocation observations.
- **Invariant:** Fresh-session invocation alone proves activation.
- **Failure:** Incomplete evidence never becomes activation.

### FR-7 card

- **Trigger:** Every candidate; predecessor branch only after first release.
- **Input:** Version/digest authorities and real prior public artifact.
- **Output:** Same candidate observed fresh plus upgrade proof when applicable.
- **Invariant:** v0.1.0 has no predecessor; v0.3.2 binds real v0.3.0.
- **Failure:** Mismatch, relabeled prior, stale session, unbound bytes block.

### FR-10 card

- **Trigger:** PR, push, or tag workflow.
- **Input:** Immutable source, producer matrix, attested evidence subject, candidate artifact.
- **Output:** Verify-only or exactly-once publication of the already verified digest.
- **Invariant:** Distribution evidence is attested by fixed repo/workflow/ref before notes/upload; published assets are separately attested.
- **Failure:** Wrong event/job/identity/trust/digest cannot publish/replace.

### FR-11 card

- **Trigger:** Any public/readiness/capability claim.
- **Input:** Current candidate-bound receipts or `release-status-v0.3.2.json` for the delivered baseline.
- **Output:** Evidence-backed claim or `SPEC_ONLY/NOT_READY`.
- **Invariant:** Gherkin/structure/stage summaries are never execution evidence.
- **Failure:** Missing/stale/foreign/inconsistent evidence denies the claim.

### FR-13 card

- **Trigger:** Distribution eligibility evaluation.
- **Input:** Complete FR-1..FR-12 matrix plus exact GitHub Artifact Attestations trust tuple.
- **Output:** `distribution-release-eligibility@2` only.
- **Invariant:** repository `stgmt/omp-spec-kit`, signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`, source ref `refs/tags/<candidate>`, exact subject hash; predicate bytes are diagnostics.
- **Failure:** Self-attested-only, verifier unavailable/failure/timeout, unpinned/wrong trust tuple, subject mismatch, or any bad matrix cell blocks.

## CHK traceability matrix

| CHK ID | Check | FR / AC | Scenario | Delivery task | Current evidence |
|---|---|---|---|---|---|
| CHK-FR1-01 | One preferred catalog and one exact entry/source. | FR-1 / AC-1.1 | `@feature1`, `SCEN-reject-marketplace-topology` | TASK-2, TASK-3 | v0.3.2 release status + repository bytes |
| CHK-FR1-02 | Duplicate/nested/escape variants fail. | FR-1 / AC-1.1 | `@feature1`, `SCEN-reject-marketplace-topology` | TASK-2, TASK-6 | candidate evidence digest |
| CHK-FR2-01 | Child matches exact v0.1/v0.3.2 profile with one extension/server identity. | FR-2 / AC-2.1 | `@feature2`, `SCEN-reject-child-package-topology` | TASK-2, TASK-3 | package/catalog/tree digest |
| CHK-FR3-01 | Inventory uses context root, lexical ordering and bounds. | FR-3 / AC-3.1 | `@feature3`, `SCEN-bound-inventory-to-project-root` | TASK-4, TASK-6 | candidate evidence digest |
| CHK-FR3-02 | Manager discovery names exactly the eight v0.3 first-slice names and does not claim a permanent ceiling. | FR-3 / AC-3.1 | `@feature3`, `SCEN-bound-inventory-to-project-root` | TASK-4, TASK-7 | `release-status-v0.3.2.json` manager discovery digest |
| CHK-FR4-01 | Discovery/install/reload/fresh session/invocation receipts are distinct. | FR-4 / AC-4.1, AC-4.2 | `@feature4`, `SCEN-distinguish-reload-from-activation` | TASK-1, TASK-7 | lifecycle/discovery digests |
| CHK-FR5-01 | Clean extension and MCP payload execute dependency-absent. | FR-5 / AC-5.1 | `@feature5`, `SCEN-run-clean-payload-without-ambient-dependencies` | TASK-5, TASK-6 | candidate/package-tree/archive digests |
| CHK-FR6-01 | Negative inventory inputs remain typed/bounded/read-only/session-safe. | FR-6 / AC-6.1 | `@feature6`, `SCEN-contain-read-only-inventory-failures` | TASK-4, TASK-6 | candidate evidence digest |
| CHK-FR7-01 | Every candidate authority agrees; v0.3.2 identity is exact. | FR-7 / AC-7.1 | `@feature7`, `SCEN-enforce-release-version-consistency` | TASK-8 | tag/candidate/package/archive fields |
| CHK-FR7-02 | v0.3.2 upgrades from real v0.3.0 with bound fresh observation. | FR-7 / AC-7.2 | `@feature7`, `SCEN-upgrade-from-prior-release-after-first-release` | TASK-8 | prior/upgrade digests |
| CHK-FR8-01 | Candidate uninstall/reinstall proves fresh absence/invocation and preservation. | FR-8 / AC-8.1 | `@feature8`, `SCEN-uninstall-and-reinstall-candidate` | TASK-8, TASK-13 | lifecycle distribution receipt digest |
| CHK-FR8-02 | v0.3.2 rolls back to bound public v0.3.0. | FR-8 / AC-8.2 | `@feature8`, `SCEN-rollback-to-prior-release-after-first-release` | TASK-8, TASK-13 | rollback digest |
| CHK-FR9-01 | Provenance/license/secret/path/package violations block. | FR-9 / AC-9.1 | `@feature9`, `SCEN-block-unsafe-public-artifacts` | TASK-9 | public-safety digest |
| CHK-FR10-01 | Fixed tag-commit distribution evidence is verified before same-digest publication. | FR-10 / AC-10.1 | `@feature10`, `SCEN-enforce-github-release-transaction` | TASK-11, TASK-12 | workflow/run/attestation identities |
| CHK-FR11-01 | Missing/stale/spec-only evidence yields not-ready; current v0.3.2 claim cites exact receipt. | FR-11 / AC-11.1 | `@feature11`, `SCEN-refuse-readiness-without-evidence` | TASK-10, TASK-12 | `release-status-v0.3.2.json` |
| CHK-FR12-01 | Unknown/unsafe/oversized public data fails closed without disclosure. | FR-12 / AC-12.1 | `@feature12`, `SCEN-fail-closed-on-unsafe-contract-data` | TASK-1, TASK-4, TASK-6 | candidate evidence digest |
| CHK-FR13-01 | Complete self-authored matrix remains blocked without independent attestation. | FR-13 / AC-13.1 | `@feature13`, `SCEN-require-complete-release-evidence` | TASK-10 | negative trust matrix |
| CHK-FR13-02 | Exact repo/workflow/ref/subject attestation verifies; each wrong/unavailable verifier variant blocks. | FR-13 / AC-13.1 | `@feature13`, `SCEN-require-complete-release-evidence` | TASK-10, TASK-11 | GitHub attestation receipt identity |
| CHK-FR13-03 | First release profile omits fictional history; every later profile includes real upgrade/rollback. | FR-13 / AC-13.1 | `@feature13`, `SCEN-require-complete-release-evidence` | TASK-8, TASK-10 | applicability/lifecycle receipts |

## Non-functional traceability

| NFR | Related requirements | Delivery tasks | Verification |
|---|---|---|---|
| [NFR-SECURITY-1](NFR.md#nfr-security-1-security-and-least-privilege) | FR-5, FR-6, FR-9, FR-10, FR-13 | TASK-5, TASK-9, TASK-11 | Zero runtime side effects/secrets; job-level least permissions; trust negative matrix |
| [NFR-PERFORMANCE-1](NFR.md#nfr-performance-1-bounded-performance) | FR-3, FR-12, FR-13 | TASK-4, TASK-10 | Input/output counts, 512 KiB @2 result and complete overflow blocker |
| [NFR-PORTABILITY-1](NFR.md#nfr-portability-1-portability) | FR-4, FR-5 | TASK-5, TASK-7 | Windows/POSIX installed launcher and dependency-absent receipts |
| [NFR-RELIABILITY-1](NFR.md#nfr-reliability-1-reliability-and-containment) | FR-4, FR-6, FR-7, FR-8 | TASK-6, TASK-7, TASK-8, TASK-13 | Repeat lifecycle, containment and preservation evidence |
| [NFR-SUPPLYCHAIN-1](NFR.md#nfr-supplychain-1-reproducibility-and-supply-chain-integrity) | FR-5, FR-9, FR-10, FR-13 | TASK-5, TASK-9, TASK-11, TASK-12 | Same-commit/digest build, evidence attestation and publish |
| [NFR-USABILITY-1](NFR.md#nfr-usability-1-usability-and-diagnostics) | FR-4, FR-7, FR-8, FR-11 | TASK-7, TASK-8, TASK-12, TASK-13 | Stable bounded codes and lifecycle wording |
| [NFR-MAINTAINABILITY-1](NFR.md#nfr-maintainability-1-maintainability-and-single-control-plane) | FR-1, FR-2, FR-3 | TASK-2, TASK-3, TASK-4 | One topology/profile and first-slice wording |

## Current evidence boundary

Current delivered baseline is v0.3.2 at tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`. Candidate/package/archive digests, lifecycle receipt digests, release URL and public asset attestation identity are in `docs/validation/release-status-v0.3.2.json`. This bounded status record supports current/historical task state; it does not prove unrelated future capability tasks.

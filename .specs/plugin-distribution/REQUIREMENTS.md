# Requirements Summary

## Product boundary

`plugin-distribution` owns how the standalone product becomes one installable OMP marketplace/plugin and how v0.1.0 distribution claims are proven. It does not own authoring semantics, graph construction, mutation, advisor behavior, dashboards, or user-global automation.

## Requirement index

| ID | Contract | Acceptance | Scenario |
|---|---|---|---|
| FR-1 | One root marketplace and one catalog entry | AC-1.1 | `@feature1` |
| FR-2 | One child package and one built extension entry | AC-2.1 | `@feature2` |
| FR-3 | Root-relative bounded inventory | AC-3.1 | `@feature3` |
| FR-4 | Install, reload, and fresh-session activation | AC-4.1, AC-4.2 | `@feature4` |
| FR-5 | Clean-build dependency-independent payload | AC-5.1 | `@feature5` |
| FR-6 | Read-only diagnostics and failure containment | AC-6.1 | `@feature6` |
| FR-7 | Version authority and release-aware upgrade | AC-7.1, AC-7.2 | `@feature7` |
| FR-8 | Release-aware uninstall/reinstall/rollback preservation | AC-8.1, AC-8.2 | `@feature8` |
| FR-9 | Provenance/license/secret/package gates | AC-9.1 | `@feature9` |
| FR-10 | GitHub Actions release transaction | AC-10.1 | `@feature10` |
| FR-11 | No claim before proof | AC-11.1 | `@feature11` |
| FR-12 | Public schema and containment | AC-12.1 | `@feature12` |
| FR-13 | Complete candidate-aware release eligibility | AC-13.1 | `@feature13` |

## Contract cards

### FR-1 card

- **Trigger:** Catalog validation.
- **Input:** Complete repository path inventory and catalog bytes.
- **Output:** Accepted single topology or blocking findings.
- **Invariant:** 1 catalog × 1 plugin × 1 child package × 1 extension.
- **Failure:** Duplicate, nesting, alternate source, or escape is release-blocking.

### FR-3 card

- **Trigger:** Installed `spec_inventory` tool call.
- **Input:** Tool context project root and schema-valid optional bounds.
- **Output:** `spec-inventory-result@1`.
- **Invariant:** Reads remain below the project root and writes remain zero.
- **Failure:** Typed bounded status/diagnostics; no session crash.

### FR-4 card

- **Trigger:** Clean project-scope installation lifecycle.
- **Input:** Added marketplace, installed plugin, exact artifact receipt.
- **Output:** Separate install, reload, session-start, and invocation observations.
- **Invariant:** Only a fresh-session invocation proves extension activation.
- **Failure:** Evidence remains incomplete, never upgraded to a success claim.

### FR-7 card

- **Trigger:** Any release candidate; upgrade branch only for a release after `0.1.0`.
- **Input:** Candidate version authorities and digests; for subsequent releases, catalog update and a real prior released installation.
- **Output:** Consistent candidate version observed in a fresh session; subsequent-release upgrade observation when applicable.
- **Invariant:** Catalog, package, artifact, installed tool, and tag authorities agree; `0.1.0` requires no nonexistent predecessor.
- **Failure:** Mismatch, partial outcome, relabeled local predecessor, or stale session blocks the applicable proof.

### FR-10 card

- **Trigger:** Pull request, push, or release tag event.
- **Input:** Immutable source plus verification artifacts.
- **Output:** Verification status; release only for a qualifying tag.
- **Invariant:** Build once, verify digest, publish same digest.
- **Failure:** Fail closed without creating/replacing a release.

### FR-11 card

- **Trigger:** Any public readiness or capability statement.
- **Input:** Same-commit evidence receipt set.
- **Output:** Proven claim or `SPEC_ONLY/NOT_READY`.
- **Invariant:** Specification text is never execution evidence.
- **Failure:** Claim and release eligibility are denied.

### FR-13 card

- **Trigger:** Any release-eligibility evaluation.
- **Input:** Current mandatory evidence mapped to every FR-1 through FR-12 for one candidate identity.
- **Output:** `eligible` only for a complete candidate-aware set; otherwise `blocked` with missing or invalid evidence.
- **Invariant:** `0.1.0` requires install/activation/invocation/uninstall/reinstall but not prior-version upgrade/rollback; subsequent releases require upgrade and rollback too.
- **Failure:** Any missing, failed, blocked, stale, mismatched, partial, or stage-summary-only evidence blocks release.

## CHK traceability matrix

| CHK ID | Check | FR | AC | Scenario/UC |
|---|---|---|---|---|
| CHK-FR1-01 | Repository scan yields one preferred catalog and one entry/source. | FR-1 | AC-1.1 | `@feature1`, UC-1 |
| CHK-FR1-02 | Planted duplicate/nested/escape variants fail. | FR-1 | AC-1.1 | `@feature1` |
| CHK-FR2-01 | Child manifest has one built JS entry and no legacy/nested surface. | FR-2 | AC-2.1 | `@feature2`, UC-1 |
| CHK-FR3-01 | Tool uses context root, lexical ordering, caller limits, and hard caps. | FR-3 | AC-3.1 | `@feature3`, UC-3 |
| CHK-FR4-01 | Install, reload, new process/session, and invocation have distinct receipts. | FR-4 | AC-4.1, AC-4.2 | `@feature4`, UC-2 |
| CHK-FR5-01 | Clean `dist` payload executes without checkout/root dependencies. | FR-5 | AC-5.1 | `@feature5`, UC-2 |
| CHK-FR6-01 | Negative inputs are bounded, typed, read-only, and session-safe. | FR-6 | AC-6.1 | `@feature6`, UC-3 |
| CHK-FR7-01 | Every version authority agrees for the candidate, including `0.1.0` without a predecessor. | FR-7 | AC-7.1 | `@feature7`, UC-1/6 |
| CHK-FR7-02 | A release after `0.1.0` upgrades from a real lower release to the exact newer version observed fresh. | FR-7 | AC-7.2 | `@feature7`, UC-4 |
| CHK-FR8-01 | Every candidate uninstall proves fresh-session absence and exact-artifact reinstall proves fresh invocation with preserved hashes, including `0.1.0` without a predecessor. | FR-8 | AC-8.1 | `@feature8`, UC-5 |
| CHK-FR8-02 | A release after `0.1.0` rolls back to a real prior release with fresh observation and preserved hashes. | FR-8 | AC-8.2 | `@feature8`, UC-5 |
| CHK-FR9-01 | Provenance/license/secret/path violations block publication. | FR-9 | AC-9.1 | `@feature9`, UC-6 |
| CHK-FR10-01 | Required CI jobs gate digest-preserving tagged publication. | FR-10 | AC-10.1 | `@feature10`, UC-6 |
| CHK-FR11-01 | Stale/missing/spec-only evidence yields `SPEC_ONLY/NOT_READY`. | FR-11 | AC-11.1 | `@feature11`, UC-2/6 |
| CHK-FR12-01 | Unknown/unsafe/oversized public data fails closed without disclosure. | FR-12 | AC-12.1 | `@feature12`, UC-3 |
| CHK-FR13-01 | Eligibility requires current passed mandatory evidence for every FR-1 through FR-12 under one candidate identity. | FR-13 | AC-13.1 | `@feature13`, UC-6 |
| CHK-FR13-02 | The `0.1.0` profile makes prior-version upgrade/rollback inapplicable while requiring candidate uninstall/reinstall; subsequent profiles retain candidate reinstall and add both prior-version proofs. | FR-13 | AC-13.1 | `@feature13`, UC-4/5/6 |

## Assumptions that require implementation-time proof

- An exact OMP release/commit will be pinned before runtime work begins.
- The current documented marketplace fields and extension loader behavior match that pin.
- The project fixture can isolate OMP user/project roots without borrowing user credentials.
- GitHub repository environment policy will allow least-privilege release attestations.

None of these assumptions constitutes release evidence.

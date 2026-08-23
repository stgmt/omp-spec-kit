# Requirements

## Delivery status

All requirements are **planned** and the authoring lifecycle/registration is `DEFERRED`; no implementation or execution is claimed here. Schema, service, fixture, recovery, evaluator, and test implementation may proceed and create candidate-bound evidence while actions remain unregistered. FR-13 gates registration/release eligibility, not implementation start.

## Functional requirement index

| Qualified ID | Requirement | Priority | Depends on | Acceptance | Scenario |
|---|---|---:|---|---|---|
| `spec-authoring-workflow:FR-1` | Deferred registration with implementation/evidence permitted | P0 | `spec-kernel:FR-14`, `plugin-distribution:FR-13` | [AC-1.1–1.4](ACCEPTANCE_CRITERIA.md#ac-11) | `@feature1` |
| `spec-authoring-workflow:FR-2` | Proposal, explicit review, and bounded diff preview | P0 | FR-1 | [AC-2.1–2.4](ACCEPTANCE_CRITERIA.md#ac-21) | `@feature2` |
| `spec-authoring-workflow:FR-3` | Expected-hash CAS and concurrency | P0 | FR-2 | [AC-3.1–3.3](ACCEPTANCE_CRITERIA.md#ac-31) | `@feature3` |
| `spec-authoring-workflow:FR-4` | Validation before write | P0 | FR-2, `spec-kernel:FR-6` | [AC-4.1–4.3](ACCEPTANCE_CRITERIA.md#ac-41) | `@feature4` |
| `spec-authoring-workflow:FR-5` | Root containment and linked-path refusal | P0 | FR-1, `spec-kernel:FR-14` | [AC-5.1–5.4](ACCEPTANCE_CRITERIA.md#ac-51) | `@feature5` |
| `spec-authoring-workflow:FR-6` | Reviewed atomic transaction, retained recovery, and no-survivor rebaseline | P0 | FR-2, FR-3, FR-4, FR-5 | [AC-6.1–6.8](ACCEPTANCE_CRITERIA.md#ac-61) | `@feature6` |
| `spec-authoring-workflow:FR-7` | Anchor-safe edits from complete kernel inventory | P0 | FR-2, FR-4, `spec-kernel:FR-13` | [AC-7.1–7.3](ACCEPTANCE_CRITERIA.md#ac-71) | `@feature7` |
| `spec-authoring-workflow:FR-8` | Guarded task/status lifecycle | P1 | FR-2, FR-6, `spec-kernel:FR-6` | [AC-8.1–8.5](ACCEPTANCE_CRITERIA.md#ac-81) | `@feature8` |
| `spec-authoring-workflow:FR-9` | Provenance and audit evidence | P1 | FR-6 | [AC-9.1–9.3](ACCEPTANCE_CRITERIA.md#ac-91) | `@feature9` |
| `spec-authoring-workflow:FR-10` | Typed request/result/error contract | P0 | FR-2–FR-9 | [AC-10.1–10.3](ACCEPTANCE_CRITERIA.md#ac-101) | `@feature10` |
| `spec-authoring-workflow:FR-11` | Mutation-resistance release gate | P0 | FR-1–FR-10 | [AC-11.1–11.4](ACCEPTANCE_CRITERIA.md#ac-111) | `@feature11` |
| `spec-authoring-workflow:FR-12` | No bypass, hidden state, or dev-pomogator integration | P0 | FR-1, FR-2, FR-6 | [AC-12.1–12.3](ACCEPTANCE_CRITERIA.md#ac-121) | `@feature12` |
| `spec-authoring-workflow:FR-13` | Aggregate registration/release eligibility with distinct linked v0.2/v0.3 kernel profiles | P0 | FR-1–FR-12, `spec-kernel:FR-14` `targetStage: "v0.2"`, `spec-kernel:FR-14` `targetStage: "v0.3"`, `plugin-distribution:FR-13` | [AC-13.1–13.3](ACCEPTANCE_CRITERIA.md#ac-131) | `@feature13` |

## Requirement invariants

1. While lifecycle is `DEFERRED`, implementation and isolated evidence production are permitted, but no authoring action may register or be exposed and no user specification may be mutated.
2. Proposal generation is read-only; review is an explicit separate transition; neither `apply_transaction` nor `apply_rebaseline_recovery` can accept raw edits or create and commit a preview in one call.
3. Every normal apply names one reviewed, unexpired proposal and current expected hashes for every target document and base snapshot.
4. Validation evaluates the in-memory resulting generation before staging and again before commit.
5. Every transaction targets exactly one ordinary, unlinked specification directory and exposes all-or-none state to coordinated readers.
6. Any stale hash, invalid anchor, validation error, containment failure, symlink/reparse component, or unresolved recovery state blocks mutation; linked spec directories and linked/reparse rebaseline candidate directories are unsupported.
7. `RECOVERY_REQUIRED` exits through deterministic/authorized retained-generation recovery when a complete retained original or result exists; only a hash-bound no-survivor assessment admits authenticated root-contained proposal-before-write rebaseline with expected current/journal/candidate hashes, separate review, full validation, atomic install, and append-only audit proof.
8. Any rebaseline authorization, proposal, hash, leak/link, validation, audit-history, or concurrency error remains `RECOVERY_REQUIRED`, exposes no candidate bytes/path, and erases no blocked-current, journal, recovery, candidate, or history bytes.
9. Task status is derived through guarded proposal/review/apply transitions; textual edits cannot bypass the state machine.
10. Success, refusal, review, rollback, retained recovery, and rebaseline produce redacted audit evidence.
11. FR-13 is an all-of registration/release gate over every mandatory FR-1..FR-12 envelope, one current distribution aggregate, and exactly two separately identified accepted kernel aggregates: v0.2 artifact `A` and v0.3 artifact `B` whose declared v0.2 parent is `A`. The linked hashes may differ, but an unqualified/duplicate-stage set, v0.3-for-v0.2 substitution, stale/revoked v0.2 result, non-eligible result, or parent mismatch is insufficient; this remains a release-registration gate, not a task-start gate.
12. Authoring eligibility does not independently authorize package publication; remaining public-init validation and fail-closed provenance/license checks for future or changed imports remain dependency-owned through `plugin-distribution:FR-13`.
13. No scenario text in this specification is executed evidence.
14. Runtime canonical identities are `<spec-slug>:<local-id>`; file-local anchors remain unqualified.

## Verification matrix

| Check | Requirement | Observable proof |
|---|---|---|
| CHK-FR1-01 | FR-1 | Deferred status keeps actions unregistered and user bytes unchanged while schema/service/fixture/evaluator implementation produces isolated candidate-bound evidence |
| CHK-FR2-01 | FR-2 | Proposal returns deterministic preview and unchanged target hashes; apply accepts only a separately reviewed exact proposal |
| CHK-FR3-01 | FR-3 | Racing reviewed applies yield one commit and one stale refusal without lost update |
| CHK-FR4-01 | FR-4 | Planted form/anchor/trace error refuses before stage creation |
| CHK-FR5-01 | FR-5 | Traversal, absolute/UNC/device, collision, and linked/reparse fixtures all refuse before content read with zero writes |
| CHK-FR6-01 | FR-6 | Fault injection preserves one generation or blocks; complete retained bytes recover by authenticated selection; proven no-survivor state rebaselines only through authorized root-contained dry-run/review/apply with exact current/journal/candidate hashes, atomic pre/post proof, and no history erasure |
| CHK-FR7-01 | FR-7 | Kernel FR-13 inventory drives complete same-spec rewrites; ambiguous, external, incomplete, or linked targets block |
| CHK-FR8-01 | FR-8 | Exhaustive transition table and evidence guards match schema and require proposal review before apply |
| CHK-FR9-01 | FR-9 | Audit envelopes reconcile hashes and contain no document body or secret value |
| CHK-FR10-01 | FR-10 | Every operation and error code round-trips through the published schema |
| CHK-FR11-01 | FR-11 | All required critical mutants are present and killed; missing/timeout/error blocks |
| CHK-FR12-01 | FR-12 | Package/runtime inventory contains one authoring authority, no raw-edit apply, and none of the excluded integrations |
| CHK-FR13-01 | FR-13 | Removing any mandatory FR-1..FR-12 or distribution envelope, removing either separately qualified kernel target-stage envelope, duplicating a stage, substituting v0.3 for v0.2, revoking/staling the v0.2 parent, or breaking `v03.v02ParentArtifactSha256 == v02.artifactSha256` keeps actions unregistered; one accepted current same-lineage v0.2→v0.3 pair plus all current-stage evidence opens registration eligibility |

## Assumptions

- The kernel exposes immutable, content-addressed snapshots, the complete FR-13 heading/anchor/link-occurrence query, and shared/exclusive snapshot coordination before authoring is implemented.
- The first mutation release supports one specification per transaction; cross-spec atomic mutation is explicitly unsupported.
- The repository uses the canonical 15-document set defined by the product specs.
- Selected repository and spec directory paths are ordinary unlinked paths; kernel containment rejects links before document reads and authoring applies the same policy.
- Callers provide an authenticated actor identity and non-empty reason; retained recovery and no-survivor rebaseline additionally require host-issued transaction/root/candidate/hash-bound authorizations. Rebaseline candidates are operator-provided under the fixed ordinary unlinked root-contained directory grammar and requests never embed their bytes.

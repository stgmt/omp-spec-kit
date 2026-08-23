# Public-Init Specification Review

- **Date:** 2026-08-23
- **Candidate state reviewed:** `SPEC_ONLY / LICENSE_RESOLVED / VALIDATION_PENDING / NON_PUBLIC`
- **Verdict:** PASS for specification content; this report is not runtime, installability, release, or publication evidence.

## Scope

Reviewed the four repository-owned specifications under `.specs/` and the root provenance/status contracts. The byte-preserved upstream snapshot was checked through its manifest and hashes, not treated as target requirements or executed evidence.

## Deterministic census

| Measure | Result |
|---|---:|
| Specification directories | 4 |
| Canonical documents | 60 / 60 |
| Functional requirements | 48 |
| Acceptance criteria | 96 |
| Gherkin scenarios | 89 |
| Globally unique scenario IDs | 89 / 89 |
| Tasks using canonical `TASK-N` IDs | 45 / 45 |
| Qualified cross-spec references inspected | 359 |
| Manifest rows | 27 = 24 copied + 3 excluded |
| Copied snapshot hashes matching manifest | 24 / 24 |

All scenarios had exactly one stable `@id`, at least one resolving `@featureN` tag, and at least one resolving `@AC-N.M` tag. Every qualified FR/AC/TASK reference resolved. No legacy `T-N` or `T01` task definition remained.

## Anchor integrity

Command, with the target repository root explicit:

```text
DEV_POMOGATOR_REPO_ROOT=<candidate-root> node <dev-pomogator-checkout>/tools/anchor-integrity/check.mjs --all
```

Result:

```text
TOTAL 0 broken anchors across 0 specs
exit 0
```

Before the final pass, the deterministic fixer corrected 81 stale anchors in five target files; it reported zero ambiguous rewrites. A source-repository diff inspection found no corresponding stale-anchor substitution in `dev-pomogator/.specs/spec-generator-v4/**`.

## Semantic review

Independent adversarial review closed these concrete cases:

- first `v0.1.0` does not require a nonexistent predecessor;
- v0.2 kernel eligibility works before MCP exists;
- v0.3 refuses missing MCP evidence and requires an exact accepted v0.2 parent;
- product stages require cumulative gates while allowing a linked predecessor artifact hash distinct from the current artifact;
- heading parsing is document-role-aware and accepts the corpus's closed colon/em-dash/bare-AC forms without treating grouping headings as definitions;
- `Foo`, `Foo`, `Foo-1` produces unique canonical anchors;
- kernel task status preserves both `planned` and `todo`, while the authoring reducer operates only on its closed todo-based lifecycle;
- authoring requires separate accepted kernel v0.2 and v0.3 envelopes;
- proposal-before-apply, linked-root refusal, CAS, rollback, and authenticated no-valid-survivor rebaseline remain fail-closed;
- no current document claims implementation, passing runtime scenarios, installability, publication, or release.

Final bounded reviewer verdict: **PASS; all five last confirmed semantic defects CLOSED**.

## Provenance and license

- Snapshot byte source: `158cd5ccfe4d08625734fc1692d8916cc5838fd6`.
- Source-owner MIT attestation: `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, PR [stgmt/dev-pomogator#232](https://github.com/stgmt/dev-pomogator/pull/232).
- Copied source and target `LICENSE` SHA-256: `8bcaa5a789720e50c513acb976965141ffee19fdcf2eaf6778c5c2d4537a4551`.
- Copied source and target `LICENSE-ATTESTATION.md` SHA-256: `0f431d35a2e1182f7360b1b596758f18e536f2c3103e0e6f38c34427f6a97062`.

## Remaining gate

Specification content is accepted for the public-init commit. Publication still requires the separate public-safety report, final candidate diff review, creation of a fresh public remote, and proof that the pushed commit matches the reviewed candidate. Runtime stages remain planned/deferred.

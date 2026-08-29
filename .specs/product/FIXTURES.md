# Product evidence fixtures

## Status

The published v0.3.2 release now has a bounded current-status evidence record at `docs/validation/release-status-v0.3.2.json`. Gherkin scenarios remain specification text unless separately tied to producer receipts; this document distinguishes captured real evidence from planned fixture families.

## Fixture policy

1. Use real producer output for evidence consumed by a parser, scanner, Git operation, OMP lifecycle, or GitHub visibility check.
2. Preserve provenance: producer/tool and version, product revision, source revision, capture time, invocation context, evidence-byte SHA-256, product-artifact SHA-256, typed artifact-binding role, artifact lineage ID, target stage/profile where applicable, exact `v02ParentArtifactSha256`, result, and `revokedAt`.
3. Trim only after capture, keeping the smallest valid subset that spans success and refusal paths.
4. Never hand-author a “passing” scanner, install, activation, or release result.
5. Never reuse mutable worktree state or user-local plugin/profile state.
6. Treat secrets used for planted negative cases as unmistakably inert detector test strings, never real credentials.

## Existing provenance input

| Artifact | Role | Ground truth |
|---|---|---|
| `IMPORT_MANIFEST.yaml` | Source-freeze inventory | Records commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`, 27 inventoried paths, 24 copied targets, 3 exclusions, and per-file hashes/status. It records expected state, not an executed verification result. |
| `docs/upstream/dev-pomogator/spec-generator-v4/` | Byte-preserved reference input | Contains the 24 copied reference documents. It is not target requirements and its scenarios are not product evidence. |
| `MIGRATION_MATRIX.md` | Disposition input | Records ADOPT/REWRITE/DEFER/DROP decisions. It is decision provenance, not delivery proof. |
| `docs/validation/release-status-v0.3.2.json` | Current public-release status | Binds public tag `v0.3.2`, commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate/package/archive digests, GitHub release workflow identity, attestation verification and bounded receipt digests. It contains identities and hashes, not copied release assets. |

## Planned source-freeze fixture capture

**Planned path:** `docs/validation/fixtures/source-freeze/`

Capture from the real Git object database:

- source repository URL and exact commit;
- sorted inventory of the allowlisted subtree;
- raw SHA-256 results for each source object and copied target;
- actual missing/mismatch/exclusion summary;
- tool/version and capture timestamp.

Required result space:

- exact byte match;
- one changed copied byte;
- one unmanifested copied path;
- one excluded state-like path accidentally copied;
- attempted mutable-worktree extraction.

## Planned license-decision fixture capture

**Planned path:** `docs/validation/fixtures/license/`

Capture the real authorized decision and the exact manifest revision it covers. The minimum valid record identifies reviewer authority, covered imported paths/hashes, evidence considered, decision, date, and remediation for uncovered items. Do not fabricate legal approval for tests. A refusal sample SHALL be explicitly historical or hypothetical—for example, a bounded fixture derived from the pre-attestation manifest revision—and SHALL NOT describe the current rows, which are MIT-attested.

## Planned public-safety fixture capture

**Planned path:** `docs/validation/fixtures/public-safety/`

Capture real output from the selected secret scanner and public-tree allowlist evaluator over the exact candidate revision. Preserve the tool/version, configured rules, complete finding identifiers, path/class summary, reviewer decisions, and final unresolved count.

Required result space:

- clean candidate with zero unresolved findings;
- prohibited user-state/log/cache path;
- inert detector test string recognized as a secret finding;
- reviewed false positive with all exception fields;
- incomplete exception that remains blocking.

## Planned stage-status fixture capture

**Planned path:** `docs/validation/fixtures/status/`

Use real stage evidence records, not handcrafted green summaries. Include:

- specification-only public init with no runtime evidence;
- hypothetical blocked publication caused by missing or insufficient license evidence for a future or changed import;
- planned v0.1.0 where selected activation evidence exists but `plugin-distribution:FR-13` rejects an incomplete mandatory evidence set;
- eligible v0.1.0 with complete current-candidate distribution evidence;
- eligible v0.2 with complete current-candidate distribution and `spec-kernel:FR-14` `targetStage: "v0.2"` evidence;
- eligible v0.3 with current-candidate artifact B for distribution and `targetStage: "v0.3"`, distinct `PREDECESSOR_V0_2` artifact A, the v0.3 result naming exact `v02ParentArtifactSha256: A`, the same product revision and lineage on both kernel results, strict v0.2/v0.3 stage-profile pairs, and null revocation timestamps;
- eligible joint authoring/enforcement candidate B with evidence FR-13/14, authoring FR-13/14, enforcement FR-11, current distribution/v0.3 kernel, and the linked active v0.2 predecessor A;
- one-fault variants for each of the seven capability maps, historical/different-lineage input, parent mismatch, wrong stage/profile, stale/revoked result, sibling substitution, or current evidence bound away from B;
- missing/member-subset variants proving no capability—including authoring or enforcement—can deliver independently of its exact map.
- Gherkin text with no executed result, contributing zero delivered evidence.

## Conservation assertions

For every captured fixture, future verification must reconcile:

- number of manifest inventory rows, copies, and exclusions with the producer summary;
- number of candidate paths by allowed/prohibited class;
- number of secret findings by unresolved/reviewed state;
- number of required stage dependencies and accepted/missing/failed results, split by `CURRENT_CANDIDATE` and `PREDECESSOR_V0_2` binding role;
- exact equality between the v0.3 result's `v02ParentArtifactSha256` and the predecessor evidence's artifact SHA-256, plus common lineage/revision and non-stale/non-revoked state;
- all canonical IDs referenced by status evidence.

A trimmed fixture is invalid if its counts no longer reconcile with the retained producer summary.

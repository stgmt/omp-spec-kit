# Risk-led research

## Research boundary

This report supports the product/publication lifecycle only. It does not specify plugin schema fields, kernel APIs, or mutation protocols. The validated [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) is a decision input, not independent evidence. Generated target specifications are not used to prove their own claims.

## Hypotheses formulated before research

| H# | Hypothesis | Expected proof | Fallback |
|---|---|---|---|
| H1 | A specification-first repository must not claim an installable OMP plugin before a catalog, child payload, activation, and invocation have evidence. | Official OMP marketplace lifecycle plus official example and target artifact inspection. | Mark runtime/installability claim unverified and keep `SPEC_ONLY`. |
| H2 | Imported specifications can be reproduced without contamination only when read from one immutable commit and checked by path/hash manifest. | Pinned manifest, copied bytes, and source-object provenance record. | Block publication and repeat export from a clean immutable source. |
| H3 | The frozen snapshot had an unresolved redistribution-license evidence gap at import time; determine whether later durable source-owner evidence resolves it without changing byte provenance. | Source license and attestation artifacts plus manifest and owner identity/scope. | Keep publication blocked or remove/replace the snapshot if evidence is insufficient. |
| H4 | A single future marketplace/plugin identity is consistent with official OMP marketplace layout. | Official marketplace reference and official mini-marketplace example. | Treat product identity as a repository decision, not an OMP requirement. |
| H5 | Repository publication is a separate act from local initialization and requires an explicit visibility decision. | GitHub repository-creation documentation and observed remote state. | Keep publication status non-public/unknown. |
| H6 | Structural spec validity, roadmap text, or imported BDD text does not prove delivery. | Evidence model decision plus executable lifecycle evidence at each release. | Fail closed to `PLANNED`, `BLOCKED`, or `SPEC_ONLY`. |

## Sources actually read

| ID | Source | Evidence used | Recency/status |
|---|---|---|---|
| S1 | [`IMPORT_MANIFEST.yaml`](../../IMPORT_MANIFEST.yaml) | Snapshot commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`, attestation commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, 27 inventoried paths, 24 MIT-attested copies, 3 exclusions, and zero expected mismatches. | Pinned local evidence; snapshot and later attestation identities recorded separately. |
| S2 | [`MIGRATION_MATRIX.md`](../../MIGRATION_MATRIX.md) | Per-requirement ADOPT/REWRITE/DEFER/DROP decisions; public-init/v0.1/v0.2/v0.3 boundary. | Repository decision record. |
| S3 | [`docs/upstream/dev-pomogator/spec-generator-v4/`](../../docs/upstream/dev-pomogator/spec-generator-v4/) | The copied reference corpus exists separately from target requirements. | Pinned snapshot; provenance reference only. |
| S4 | [Official OMP marketplace documentation](https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md) | Catalog path, `name@marketplace` identity, add/install/update/upgrade/uninstall commands, project scope, reload, and fresh-session restart boundary. Quote: “restart the session for newly installed tools, hooks, or extension modules.” | Fetched from mutable `main` on 2026-08-23; release implementation must pin an exact OMP revision. |
| S5 | [Official OMP mini-marketplace example](https://github.com/can1357/oh-my-pi/tree/main/docs/skills/examples/mini-marketplace) | One catalog, one relative-path plugin, child `package.json`, and one demonstrated install identity. Quote: “It lists one plugin (`my-plugin`) using a relative path source.” | Fetched from mutable `main` on 2026-08-23; example is illustrative, not a cardinality mandate. |
| S6 | [GitHub: Creating a new repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) | Repository owner/name/visibility are explicit creation choices; importing an existing repository should not pre-populate conflicting files. | Fetched on 2026-08-23; page exposes no trustworthy last-updated date. |
| S7 | [`docs/decisions/omp-spec-kit-public-init.md`](../../docs/decisions/omp-spec-kit-public-init.md) | Validated decisions: fresh history, spec-first init, one future plugin, source freeze, safety gates, and staged roadmap. | Repository decision input only; excluded from research triangulation. |
| S8 | [`docs/upstream/dev-pomogator/spec-generator-v4/FR.md`](../../docs/upstream/dev-pomogator/spec-generator-v4/FR.md) | Pinned upstream FR-61 requires one honest readiness contract and separates non-run evidence from coverage; FR-82 calls for bounded truthful read-side contracts; FR-85 requires traceable contract cards; FR-86 requires coherent status/evidence/remediation UX. | Pinned provenance evidence only; its dev-pomogator implementation assumptions are not target requirements. |
| S9 | [`LICENSE`](../../docs/upstream/dev-pomogator/LICENSE), [`LICENSE-ATTESTATION.md`](../../docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md), and [dev-pomogator PR #232](https://github.com/stgmt/dev-pomogator/pull/232) | Exact merged MIT license bytes plus source-owner attestation expressly covering snapshot commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6` and `.specs/spec-generator-v4/**`. | Durable merged source evidence; exact hashes recorded in the manifest and bounded receipt. |

## Verification results

| H# | Status | Finding and implication |
|---|---|---|
| H1 | `[NEEDS_CONFIRMATION: S4 + S5; target payload absent]` | Official docs distinguish catalog installation, reload, and restart for extension activation. The current tree has no payload evidence, so the only honest current claim is specification-only/non-installable. A real installed invocation is still required before v0.1.0. |
| H2 | `[NEEDS_CONFIRMATION: S1 + S3; independent re-export not yet recorded]` | The manifest records immutable Git-object extraction and hashes, and the separate snapshot exists. Publication still requires a fresh independent comparison showing actual mismatches are zero, not merely the manifest's expected count. |
| H3 | `[VERIFIED: S1 + S9]` | The later merged source-owner attestation expressly covers the frozen subtree and exact snapshot commit under MIT. The historical license-evidence gap is resolved without changing byte provenance; future or changed imports still require their own sufficient evidence. |
| H4 | `[NEEDS_CONFIRMATION: S4 + S5]` | OMP supports marketplace identity and relative child packages, and the example demonstrates one plugin. “Exactly one” is this product's deliberate architecture invariant, not a universal OMP rule. Delegate enforcement to `plugin-distribution:FR-1`. |
| H5 | `[NEEDS_CONFIRMATION: S6 + local policy; remote observation not recorded]` | GitHub creation explicitly chooses owner, name, and visibility. Local initialization must not be described as public publication until logged-out visibility is observed after gates pass. |
| H6 | `[NEEDS_CONFIRMATION: S2 + S8; target execution evidence absent]` | The migration decisions adopt/rewrite upstream honesty and bounded-read intent while rejecting source-harness status machinery. The target therefore adopts fail-closed evidence-derived status: prose and unexecuted BDD are intent; only current stage-specific execution/artifact evidence supports a delivered claim. Target execution proof does not yet exist. |

## Risk register

| Risk | Likelihood / impact | Existing evidence | Required treatment |
|---|---|---|---|
| A future or changed import lacks sufficient redistribution evidence | Low / Critical | S1 and S9 resolve the current snapshot; the manifest retains a fail-closed future-import policy. | Reject the affected bytes until an authorized decision covers their exact identity, or remove/replace them; never use the repository root license alone to relabel unknown imports. |
| Dirty-source contamination or unverifiable copies | Medium / Critical | S1 defines immutable Git-object extraction; S3 is the copied target. | Re-run independent byte/hash comparison from the pinned commit; reject worktree-derived or unmanifested bytes. |
| Secret, credential, state, log, cache, or mutable evidence enters public history | Medium / Critical | S1 excludes three state/test-state paths; repository security policy defines prohibited classes. | Allowlist the tree, scan the complete candidate, resolve every finding, and review the public diff before remote creation. |
| Readers infer installability from the repository name or roadmap | High / High | No catalog or payload evidence exists; S4 requires distinct install/activation lifecycle. | Keep the prominent “no installable plugin” statement and forbid install commands/release badges until distribution proof exists. |
| One product fragments into multiple plugins/control planes | Medium / High | S4 supports explicit marketplace/plugin identity; S5 demonstrates a simple child layout. | Enforce product decision via `plugin-distribution:FR-1`; later capabilities stay inside the same plugin and shared service. |
| Mutable OMP documentation drifts before release | Medium / High | S4 and S5 were read from `main`. | Pin the exact OMP release/commit during implementation and re-verify commands, schema, reload, and restart behavior. |
| Roadmap laundering turns planned text into delivered status | High / High | No implementation evidence exists at public init. | Require dated evidence references and the most conservative state; structural passes and scenarios are never execution proof. |
| Scope collapse imports dev-pomogator harness machinery | Medium / High | S2 drops/defers hooks, advisor, state, backlog, dashboard, persistence, repair, and judging. | Maintain read-only-first cross-spec gates; review public paths against the exclusion list. |

## Product implications

1. Public-init status is `SPEC_ONLY / LICENSE_RESOLVED / PUBLIC_INIT_VALIDATED / NON_PUBLIC`, not “released,” “available,” or “installable.”
2. Source-freeze, specification, anchor, and secret/public-tree validation are complete; creation and push of the reviewed initial commit remain the publication action.
3. Public eligibility requires two distinct safety results: clean immutable export and zero unresolved secret/prohibited-state findings.
4. The one-plugin rule is a chosen product invariant. Its packaging/lifecycle acceptance belongs to `plugin-distribution`, not this specification.
5. Stage completion uses the complete cumulative aggregate set for one exact product revision and lineage. v0.1.0 requires current-candidate `plugin-distribution:FR-13`; v0.2 adds current-candidate `spec-kernel:FR-14` `targetStage: "v0.2"`; v0.3 uses current-candidate distribution and `targetStage: "v0.3"` evidence plus a separately identified active v0.2 predecessor whose artifact SHA-256 is named exactly by the v0.3 result's `v02ParentArtifactSha256`; authoring adds current-candidate `spec-authoring-workflow:FR-13`. The predecessor and current artifact may differ, but the kernel results must share revision/lineage in strict target-stage order and remain non-stale/non-revoked. A current aggregate, smaller member subset, historical/different-lineage/unlinked predecessor, or current evidence bound to the predecessor cannot produce `DELIVERED`.
6. Re-research is mandatory when the OMP revision changes, imported bytes change, the license decision changes, or a release-stage claim is proposed.

## Open questions requiring owner decisions

- Resolved provenance decision: the source-owner attestation merged at commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` is the durable authority for the 24 copied snapshot files; exact copies and hashes are recorded locally.
- Who signs the final public-safety review and is accountable for scanner exceptions?
- Which exact OMP release/commit becomes the first distribution compatibility baseline?

# Non-functional requirements

These qualities apply to the public repository lifecycle. Runtime performance and implementation internals belong to their owning specifications.

## NFR-SECURITY-1 — Security and privacy

- Public history SHALL contain no credentials, tokens, `.env` material, user state, logs, caches, mutable evidence, or private machine paths.
- Secret scanning SHALL cover the complete candidate tree/history used for publication, not merely newly staged files.
- Scanner exceptions SHALL identify the exact finding, exact bytes/revision, reviewer, rationale, and expiration or permanence decision.
- Public documentation SHALL NOT include private contact data beyond intentionally published project contacts.

**Verification:** `product:AC-4.1`, `product:AC-4.2`; public-safety evidence for the exact candidate revision.

## NFR-PROVENANCE-1 — Provenance and reproducibility

- Every imported byte SHALL be attributable to one immutable repository commit and source path.
- Hash computation and comparison SHALL be deterministic for identical bytes.
- The target snapshot SHALL be separable from canonical target requirements.
- A reviewer SHALL be able to reconstruct the allowlisted import without the source working tree.

**Verification:** `product:AC-2.1`, `product:AC-2.2`.

## NFR-LEGAL-1 — Legal clarity

- Repository-owned MIT material and imported upstream material SHALL retain separate licensing/provenance descriptions.
- An evidence gap SHALL be visible as a blocker, not softened into an assumption or inherited license claim.
- This specification SHALL NOT substitute for an authorized legal decision.

**Verification:** `product:AC-3.1`, `product:AC-3.2`.

## NFR-RELIABILITY-1 — Truthfulness and auditability

- Every `DELIVERED` claim SHALL resolve to current evidence for the same requirement, stage, revision, and observable behavior.
- Failed, missing, stale, revoked, contradictory, unlinked, or claimed-only evidence SHALL fail closed.
- Specification and BDD documents SHALL remain clearly labeled as unexecuted intent until a separate runner result is recorded.
- Status changes SHALL be explainable from retained evidence and blocker changes.

**Verification:** `product:AC-7.1`, `product:AC-7.2`.

## NFR-USABILITY-1 — Usability

- A reader SHALL understand the current state, primary blocker, next stage, and excluded scope from the README and roadmap without needing source code.
- Product terms SHALL remain stable: `omp-spec-kit`, public init, v0.1.0, v0.2, v0.3, and later authoring/mutation.
- Cross-spec references SHALL use canonical `<spec-slug>:<local-id>` identifiers.

**Verification:** `product:AC-1.1`, `product:AC-8.1`, `product:AC-8.2`.

## NFR-MAINTAINABILITY-1 — Maintainability and scope isolation

- Product documents SHALL express externally observable gates and claims, not duplicate plugin, kernel, or authoring implementation details.
- One concern SHALL have one canonical owner; downstream documents SHALL link to that owner.
- Public-init changes SHALL not introduce runtime code, package manifests, marketplace catalogs, tests, or build machinery.

**Verification:** `product:AC-5.2`, `product:AC-8.2`.

## NFR-COMPATIBILITY-1 — Compatibility evidence freshness

- OMP behavior read from mutable documentation SHALL be re-verified against an exact OMP release/commit before the first installable release.
- A release SHALL NOT rely on mutable `main` documentation alone as compatibility evidence.
- Evidence SHALL identify the product revision and relevant OMP revision.

**Verification:** the complete cumulative stage-evidence set required by `product:FR-6`: current distribution and current target-stage/authoring results bind to the current candidate; the separately identified v0.2 predecessor for v0.3/authoring matches the later kernel result's exact `v02ParentArtifactSha256`; both kernel results share product revision/lineage in strict stage order and are neither stale nor revoked.

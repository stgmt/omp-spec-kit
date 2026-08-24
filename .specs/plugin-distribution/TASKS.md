# Tasks

All tasks are planned. No task status here is execution evidence.

## TASK-1 — Pin OMP and close schema uncertainties

- **Refs:** FR-1, FR-2, FR-4, FR-12
- **Owner:** Distribution maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Done When:** An exact OMP version/commit and marketplace schema URI are recorded; catalog/parser and tool-result compatibility questions in `plugin-distribution_SCHEMA.md` are answered from source/runtime evidence; no `[SINGLE_SOURCE]` release blocker remains.

## TASK-2 — Implement closed topology validators

- **Refs:** FR-1, FR-2, AC-1.1, AC-2.1
- **Owner:** Distribution maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Done When:** Validators accept the one catalog/entry/package/extension shape and fail planted duplicate, nested, legacy, source-entry, script, MCP, alternate-source, and path-escape cases.

## TASK-3 — Create the single marketplace and child package

- **Refs:** FR-1, FR-2
- **Owner:** Plugin maintainer
- **Status:** Planned
- **Estimate:** 0.5 day
- **Done When:** The concrete catalog and child manifest conform to the closed schemas, versions match `0.1.0`, and no nested package/catalog exists.

## TASK-4 — Implement bounded read-only inventory

- **Refs:** FR-3, FR-6, FR-12, AC-3.1, AC-6.1, AC-12.1
- **Owner:** Plugin maintainer
- **Status:** Planned
- **Estimate:** 2 days
- **Done When:** The one factory registers the one tool; request/result/entry/diagnostic schemas are implemented; root, link, bound, abort, malformed, permission, redaction, and zero-side-effect behaviors meet every referenced AC.

## TASK-5 — Build and assemble the dependency-safe payload

- **Refs:** FR-5, AC-5.1
- **Owner:** Build maintainer
- **Status:** Planned
- **Estimate:** 1.5 days
- **Done When:** A clean build creates only allowlisted `dist/` output; packaged bytes contain no forbidden/absolute/source imports; the installed artifact loads and invokes with checkout/root dependencies unavailable.

## TASK-6 — Build isolated distribution fixtures

- **Refs:** FR-3 through FR-8, FR-12
- **Owner:** Test maintainer
- **Status:** Planned
- **Estimate:** 2 days
- **Done When:** A pinned OMP fixture isolates user/project roots and credentials; real minimal, absent, malformed, excessive, unreadable, link-escape, and preservation inputs have recorded provenance and ground truth.

## TASK-7 — Prove install, reload, and fresh activation

- **Refs:** FR-4, AC-4.1, AC-4.2
- **Owner:** Test maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Done When:** Automated evidence separately records add, discovery, project install, version, reload, old-session termination, fresh-session startup, installed-entry load, tool invocation, and project hash preservation.

## TASK-8 — Prove candidate-aware uninstall, reinstall, upgrade, and rollback

- **Refs:** FR-7, FR-8, FR-13, AC-7.1, AC-7.2, AC-8.1, AC-8.2, AC-13.1
- **Owner:** Release maintainer
- **Status:** Planned
- **Estimate:** 2 days
- **Done When:** `0.1.0` proves matching version authorities, uninstall with fresh-session absence, exact-artifact reinstall with fresh-session invocation, and preserved hashes without a prior-release prerequisite; the first subsequent release additionally proves upgrade from and rollback to a real public prior release.

## TASK-9 — Implement public-safety and provenance gates

- **Refs:** FR-9, AC-9.1
- **Owner:** Security maintainer
- **Status:** Planned
- **Estimate:** 1.5 days
- **Done When:** Immutable source/hash/license checks, secret scanning, forbidden path/state checks, public diff review, and package allowlist fail planted violations and produce bounded non-secret receipts.

## TASK-10 — Implement evidence and aggregate eligibility evaluator

- **Refs:** FR-11, FR-13, AC-11.1, AC-13.1
- **Owner:** Release maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Done When:** Same-commit/version/OMP/platform/digest receipts are mapped to every FR-1 through FR-12; candidate-aware applicability and structural diagnostics are enforced; self-authored `workflow`/`runId` and observation JSON always returns `blocked` with `distribution-producer-provenance-untrusted:no-independent-trust-root`, while any future `eligible` result requires a separately implemented independently verifiable producer-attestation path.

## TASK-11 — Automate GitHub Actions verification and release

- **Refs:** FR-10, FR-13, AC-10.1, AC-13.1
- **Owner:** Release maintainer
- **Status:** Planned
- **Estimate:** 2 days
- **Done When:** Required evidence-producing jobs, least permissions, protected tag-only release, artifact digest handoff, concurrency/idempotency behavior, and no-publish PR/push behavior meet the design; the release job refuses every current self-attested FR-13 aggregate, and a failed job, partial evidence set, untrusted provenance, or mismatched existing release cannot publish/overwrite.

## TASK-12 — Publish v0.1.0 only after complete aggregate proof

- **Refs:** FR-1 through FR-13, AC-13.1
- **Owner:** Release owner
- **Status:** Planned
- **Estimate:** 0.5 day
- **Done When:** The composed public result remains blocked for all current self-attested distribution evidence, including a structurally complete matrix with matching candidate/OMP/platform-fixture/catalog/package/archive/applicability/lifecycle identity and passed observations. MRI names only `mcp-release-integrity:FR-1..FR-6`. A future eligible result requires a separately implemented independently verifiable producer-attestation path; until then the workflow blocks artifact upload, release notes, and publication.

## TASK-13 — Rehearse public recovery under the applicable release profile

- **Refs:** FR-8, FR-11, FR-13, AC-8.1, AC-8.2, AC-13.1
- **Owner:** Release owner
- **Status:** Planned
- **Estimate:** 0.5 day
- **Done When:** For `0.1.0`, public-artifact uninstall, fresh-session absence, exact-version reinstall, fresh-session invocation, and preservation are observed; beginning with the first subsequent release, public upgrade and rollback are also observed against the real prior artifact, with every receipt bound to the applicable public digests.

# Tasks

Statuses distinguish delivered baseline work from future contract changes. Current evidence is bounded by `docs/validation/release-status-v0.3.2.json`; it cannot close unrelated future capabilities.

## TASK-1 — Pin OMP and close schema uncertainties

- **Refs:** FR-1, FR-2, FR-4, FR-12; CHK-FR4-01, CHK-FR12-01
- **Owner:** Distribution maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** `docs/omp-v17.3.7-contract.md`; pinned commit `8500092296621a6826b7136e840f8a59ea338958`; delivered v0.3.2 receipt.
- **Done When:** Exact OMP version/commit, catalog/parser/copy/tool-result/MCP-launcher compatibility and supported schema profile are source/runtime evidenced with no unresolved single-source release blocker.

## TASK-2 — Implement closed topology/profile validators

- **Refs:** FR-1, FR-2, AC-1.1, AC-2.1; CHK-FR1-01, CHK-FR1-02, CHK-FR2-01; NFR-MAINTAINABILITY-1
- **Owner:** Distribution maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** existing topology/package validation scripts and v0.3.2 candidate evidence digest.
- **Done When:** Validators accept historical v0.1 and delivered v0.3.2 profiles and reject duplicate/nested/legacy/second-control-plane/source/script/evidence/dependency/profile mismatch and root escape variants.

## TASK-3 — Maintain the single marketplace and child package

- **Refs:** FR-1, FR-2; CHK-FR1-01, CHK-FR2-01; NFR-MAINTAINABILITY-1
- **Owner:** Plugin maintainer
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** `.omp-plugin/marketplace.json`; `plugins/omp-spec-kit/package.json`; v0.3.2 candidate/package-tree digests.
- **Done When:** One v0.3.2 catalog entry, package, extension and MCP identity exist with no nested package/catalog/control plane.

## TASK-4 — Deliver bounded read-only inventory and first-slice declaration

- **Refs:** FR-3, FR-6, FR-12, AC-3.1, AC-6.1, AC-12.1; CHK-FR3-01, CHK-FR3-02, CHK-FR6-01, CHK-FR12-01; NFR-PERFORMANCE-1, NFR-MAINTAINABILITY-1
- **Owner:** Plugin maintainer
- **Status:** Completed
- **Estimate:** 2 days
- **Evidence:** `src/v0.1/`, `src/adapters/`, `src/kernel/`, `src/mcp/`; manager discovery digest `5354dd55cf9bf83ad827d5a22d6aaec43278b218ef577f08ddc4f52e547cb5f0`.
- **Done When:** Baseline inventory and declared v0.3 first-slice surface are bounded/read-only/root-contained and described as a first slice, not a permanent ceiling.

## TASK-5 — Build and assemble the dependency-safe payload

- **Refs:** FR-5, AC-5.1; CHK-FR5-01; NFR-SECURITY-1, NFR-PORTABILITY-1, NFR-SUPPLYCHAIN-1
- **Owner:** Build maintainer
- **Status:** Completed
- **Estimate:** 1.5 days
- **Evidence:** `scripts/build-plugin.mjs`; candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`; package tree `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`.
- **Done When:** Clean profile output is allowlisted/hash-manifested and installed extension/MCP execution requires no checkout/root/external dependencies.

## TASK-6 — Maintain isolated real distribution fixtures

- **Refs:** FR-3 through FR-8, FR-12; CHK-FR1-02, CHK-FR3-01, CHK-FR5-01, CHK-FR6-01, CHK-FR12-01; NFR-RELIABILITY-1
- **Owner:** Test maintainer
- **Status:** Completed
- **Estimate:** 2 days
- **Evidence:** `tests/`, `scripts/docker-bdd.sh`, evidence digest `043458f1e8dd79e8573cdcc8f2808c05e33b0e6234f4d2bab97ece9ebc44776d`.
- **Done When:** Pinned fixtures isolate user/project roots and cover minimal/absent/malformed/excessive/unreadable/link/preservation/dependency cases with real provenance and ground truth.

## TASK-7 — Prove install, reload, and fresh activation

- **Refs:** FR-4, AC-4.1, AC-4.2; CHK-FR3-02, CHK-FR4-01; NFR-PORTABILITY-1, NFR-RELIABILITY-1, NFR-USABILITY-1
- **Owner:** Test maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** current distribution receipt digest `46deadb5ccb26413942bf96c046516231e1c98d217d95353b90574922365f5d7`; manager discovery digest above.
- **Done When:** Discovery, project install, exact version, reload, old-session termination, fresh-session load/invocation and preservation are distinct candidate-bound observations.

## TASK-8 — Prove candidate reinstall, upgrade, and rollback

- **Refs:** FR-7, FR-8, FR-13, AC-7.1, AC-7.2, AC-8.1, AC-8.2, AC-13.1; CHK-FR7-01, CHK-FR7-02, CHK-FR8-01, CHK-FR8-02, CHK-FR13-03; NFR-RELIABILITY-1, NFR-USABILITY-1
- **Owner:** Release maintainer
- **Status:** Completed
- **Estimate:** 2 days
- **Evidence:** v0.3.0 prior digest `a76965be487d54bd0eea31c366fb06da4874237986c6a5abf33d2191eae0c3d1`; upgrade digest `0940519e597e71d2db00e4a95eb34299f3cde9e1c77df2c52c52be584a272abc`; rollback digest `26c8b5e0481beb7375b3d39d80775a2ec9ce1b85a0d010f7368d2a1cc53893aa`.
- **Done When:** Current candidate uninstall/reinstall and post-first real-prior upgrade/rollback have fresh observations and preservation hashes bound to exact artifacts.

## TASK-9 — Enforce public safety and provenance

- **Refs:** FR-9, AC-9.1; CHK-FR9-01; NFR-SECURITY-1, NFR-SUPPLYCHAIN-1
- **Owner:** Security maintainer
- **Status:** Completed
- **Estimate:** 1.5 days
- **Evidence:** Historical public-init scope: `docs/validation/public-safety.md`. Current v0.3.2 scope: release asset `evidence.json` SHA-256 `043458f1e8dd79e8573cdcc8f2808c05e33b0e6234f4d2bab97ece9ebc44776d` and its `publicSafetyDigest` `d318eea8188962c84d19154af23bb4ad64b03080f32ac0aea1118ff19854125e`, both bound by `release-status-v0.3.2.json`.
- **Done When:** Provenance/license/secret/state/diff/package violations fail and receipts remain bounded/non-secret.

## TASK-10 — Implement forward distribution-only eligibility v2

- **Refs:** FR-11, FR-13, AC-11.1, AC-13.1; CHK-FR11-01, CHK-FR13-01, CHK-FR13-02, CHK-FR13-03; NFR-PERFORMANCE-1
- **Owner:** Release maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Depends On:** delivered historical v0.3.2 evaluator/receipts; accepted `distribution-release-eligibility@2` schema.
- **Evidence:** Historical `omp-spec-kit-release-evidence@3` and `public-release-eligibility@1` are delivered; no runtime receipt yet proves the new distribution-only result.
- **Done When:** Runtime emits only `distribution-release-eligibility@2`, validates exact GitHub trust tuple and FR-1..FR-12 matrix, and every self-attested/unavailable/wrong repo/workflow/ref/subject/matrix variant blocks; MRI/product composition is absent.

## TASK-11 — Operate attested GitHub Actions evidence and release

- **Refs:** FR-10, FR-13, AC-10.1, AC-13.1; CHK-FR10-01, CHK-FR13-02; NFR-SECURITY-1, NFR-SUPPLYCHAIN-1
- **Owner:** Release maintainer
- **Status:** Completed
- **Estimate:** 2 days
- **Evidence:** `.github/workflows/distribution-evidence.yml`; `.github/workflows/release.yml`; distribution run `33163329402` attempt 1 and release run `33163329416` attempt 2. `release-status-v0.3.2.json` binds the attested distribution subject SHA-256 `46deadb5ccb26413942bf96c046516231e1c98d217d95353b90574922365f5d7`, fixed signer/ref/repository, certificate commit and Rekor identity, plus the separately attested public assets.
- **Done When:** Fixed tag-commit evidence subject is attested/verified before notes/upload, same digest publishes once, and published assets are attested; PR/push and all trust/identity failure variants cannot publish.

## TASK-12 — Publish the exact accepted baseline candidate

- **Refs:** FR-1 through FR-13, AC-13.1; CHK-FR10-01, CHK-FR11-01; NFR-SUPPLYCHAIN-1, NFR-USABILITY-1
- **Owner:** Product release owner
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** https://github.com/stgmt/omp-spec-kit/releases/tag/v0.3.2; tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`; archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`.
- **Done When:** Product evaluator accepts the exact baseline conjunction and the public release/readback/attestation identities match the verified candidate. Future capability publication remains independently gated.

## TASK-13 — Rehearse public recovery under the applicable profile

- **Refs:** FR-8, FR-11, FR-13, AC-8.1, AC-8.2, AC-13.1; CHK-FR8-01, CHK-FR8-02; NFR-RELIABILITY-1, NFR-USABILITY-1
- **Owner:** Release owner
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** v0.3.2 prior/upgrade/rollback/distribution receipt digests in `release-status-v0.3.2.json`.
- **Done When:** Public candidate uninstall/fresh absence/exact reinstall plus real-prior upgrade/rollback are fresh, preserved, and bound to public artifact digests.

## Task summary

| Task | Status | Primary evidence/output |
|---|---|---|
| TASK-1 | Completed | Pinned OMP contract |
| TASK-2 | Completed | Closed profile validators |
| TASK-3 | Completed | One catalog/package/extension/server identity |
| TASK-4 | Completed | Read-only baseline/first-slice surface |
| TASK-5 | Completed | Clean built payload |
| TASK-6 | Completed | Isolated producer fixtures |
| TASK-7 | Completed | Fresh-session lifecycle receipts |
| TASK-8 | Completed | v0.3.0 -> v0.3.2 upgrade/rollback receipts |
| TASK-9 | Completed | Public safety/provenance |
| TASK-10 | Planned | Forward distribution-only evaluator v2 |
| TASK-11 | Completed | Current attested workflows |
| TASK-12 | Completed | Public v0.3.2 release |
| TASK-13 | Completed | Public recovery receipts |

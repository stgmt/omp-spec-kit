# Tasks

Task status describes implementation/evidence, not product capability state. SHIPPED evidence is bounded by `docs/validation/release-status-v0.3.2.json`; NEXT work must earn new evidence.

## TASK-1 — Validate the selected target

- **Refs:** FR-1, AC-1.1, CHK-FR1-01; NFR-MAINTAINABILITY-1
- **Owner:** Distribution maintainer
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** `.omp-plugin/marketplace.json`, `plugins/omp-spec-kit/package.json`, v0.3.2 catalog/package digests.
- **Done When:** The unique `omp-spec-kit` entry, child, extension, and MCP paths are contained; unrelated entries do not fail validation.

## TASK-2 — Build and run dependency-absent bytes

- **Refs:** FR-2, FR-5, AC-2.1, AC-5.1, CHK-FR2-01, CHK-FR5-01; NFR-PERFORMANCE-1, NFR-PORTABILITY-1, NFR-SUPPLYCHAIN-1
- **Owner:** Build maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** `scripts/build-plugin.mjs`; candidate SHA-256 `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`; package-tree SHA-256 `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`.
- **Done When:** Clean builds are deterministic and the installed extension/MCP launcher run without checkout or ambient dependencies.

## TASK-3 — Prove installed fresh invocation

- **Refs:** FR-3, FR-4, FR-6, AC-3.1, AC-4.1, AC-6.1, CHK-FR3-01, CHK-FR4-01, CHK-FR6-01; NFR-SECURITY-1, NFR-PORTABILITY-1, NFR-RELIABILITY-1
- **Owner:** Test maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** OMP manager discovery digest `5354dd55cf9bf83ad827d5a22d6aaec43278b218ef577f08ddc4f52e547cb5f0`; v0.3.2 lifecycle receipt.
- **Done When:** A fresh isolated session invokes the installed active-project candidate, observes its declared read-only surface, and leaves project/state untouched.

## TASK-4 — Prove recovery lifecycle

- **Refs:** FR-7, FR-8, AC-7.1, AC-8.1, CHK-FR7-01, CHK-FR8-01; NFR-RELIABILITY-1
- **Owner:** Release test maintainer
- **Status:** Completed
- **Estimate:** 1 day
- **Evidence:** public v0.3.0 digest `a76965be487d54bd0eea31c366fb06da4874237986c6a5abf33d2191eae0c3d1`; upgrade digest `0940519e597e71d2db00e4a95eb34299f3cde9e1c77df2c52c52be584a272abc`; rollback digest `26c8b5e0481beb7375b3d39d80775a2ec9ce1b85a0d010f7368d2a1cc53893aa`.
- **Done When:** Exact-candidate reinstall and real-predecessor upgrade/rollback have fresh version observations and unchanged project hashes.

## TASK-5 — Gate public safety

- **Refs:** FR-9, AC-9.1, CHK-FR9-01; NFR-SECURITY-1, NFR-SUPPLYCHAIN-1
- **Owner:** Security maintainer
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** public-safety digest `d318eea8188962c84d19154af23bb4ad64b03080f32ac0aea1118ff19854125e` in the v0.3.2 status record.
- **Done When:** Provenance, license, secret, local-state, public-diff, and payload failures stop publication without disclosure.

## TASK-6 — Preserve shipped release evidence

- **Refs:** FR-10, FR-11, AC-10.1, AC-11.1, CHK-FR10-01, CHK-FR11-01; NFR-SUPPLYCHAIN-1, NFR-USABILITY-1
- **Owner:** Release maintainer
- **Status:** Completed
- **Estimate:** 0.5 day
- **Evidence:** v0.3.2 tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`, and `docs/validation/release-status-v0.3.2.json`.
- **Done When:** Historical v0.1–v0.3.2 receipts remain readable and unchanged while explicitly excluded from the forward API.

## TASK-7 — Implement the next practical release path

- **Refs:** FR-10, FR-11, FR-12, FR-13, AC-10.1, AC-11.1, AC-12.1, AC-13.1, CHK-FR10-01, CHK-FR11-01, CHK-FR12-01, CHK-FR13-01; NFR-SECURITY-1, NFR-PERFORMANCE-1, NFR-SUPPLYCHAIN-1, NFR-MAINTAINABILITY-1
- **Owner:** Release maintainer
- **Status:** Planned
- **Estimate:** 1 day
- **Depends On:** existing deterministic build, installed/lifecycle/public-safety producers.
- **Evidence:** none yet for a post-v0.3.2 candidate.
- **Done When:** The tag workflow publishes the already verified archive, creates one final archive attestation, writes the compact distribution status, and neither invokes nor emits a secondary evaluator or intermediate attestation.

## Task summary

| Task | Status | Output |
|---|---|---|
| TASK-1 | Completed | Contained target selection |
| TASK-2 | Completed | Deterministic dependency-absent package |
| TASK-3 | Completed | Installed fresh-session smoke |
| TASK-4 | Completed | Upgrade/reinstall/rollback recovery |
| TASK-5 | Completed | Public-safety gate |
| TASK-6 | Completed | Immutable historical receipts |
| TASK-7 | Planned | Single forward release workflow |

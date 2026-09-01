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

---

## Product lifecycle domain (merged)

Task state is workflow metadata, not shipment evidence. This file has no duplicated summary table.

## TASK-8 — Keep current release status accurate

- **Status:** Completed
- **Estimate:** 0.5 day per release
- **Owner:** Product owner
- **Depends on:** Bounded current release proof.
- **Traces:** `plugin-distribution:FR-14`; `plugin-distribution:AC-14.1`; `@feature14`; `SCEN-product-current-release-proof`; `CHK-FR14-01`.
- **Evidence:** `docs/validation/release-status-v0.3.2.json`.
- **Done When:** The single SHIPPED row matches the current version, installed identity, read-only baseline, and proof link.

## TASK-9 — Preserve one product identity

- **Status:** Completed
- **Estimate:** 0.5 day per packaging change
- **Owner:** Distribution owner
- **Depends on:** Current package and extension evidence.
- **Traces:** `plugin-distribution:FR-15`; `plugin-distribution:AC-15.1`; `@feature15`; `SCEN-product-one-product-identity`; `CHK-FR15-01`.
- **Evidence:** `.omp-plugin/marketplace.json`, `plugins/omp-spec-kit/package.json`, `docs/validation/release-status-v0.3.2.json`.
- **Done When:** One marketplace entry, plugin package, extension, installed identity, and specification write surface remain.

## TASK-10 — Enforce proof-before-shipped wording

- **Status:** Completed
- **Estimate:** 0.5 day per status change
- **Owner:** Release owner
- **Depends on:** Current proof for any proposed SHIPPED row.
- **Traces:** `plugin-distribution:FR-16`; `plugin-distribution:AC-16.1`; `plugin-distribution:AC-16.2`; `@feature16`; `SCEN-product-missing-proof-is-not-shipped`; `SCEN-product-unexecuted-text-is-not-proof`; `CHK-FR16-01`.
- **Evidence:** Current public status and its cited producer receipt.
- **Done When:** Removing or mismatching current proof prevents SHIPPED and no prose-only artifact substitutes.

## TASK-11 — Deliver safe spec authoring

- **Status:** Planned
- **Estimate:** 3 days
- **Owner:** Authoring and enforcement owners
- **Depends on:** Existing v0.3.2 read-only baseline.
- **Traces:** `plugin-distribution:FR-17`; `plugin-distribution:AC-17.1`; `plugin-distribution:AC-17.2`; `@feature17`; `SCEN-product-authoring-tools-are-bounded`; `SCEN-product-direct-spec-write-is-refused`; `CHK-FR17-01`.
- **Owner contracts:** `spec-mcp-operations`, `spec-mcp-access-gate`; exact implementation paths remain theirs.
- **Done When:** One current end-to-end receipt proves the two-tool public surface, atomic contained apply, and refusal of non-MCP reads/writes, link/reparse escapes, and indeterminate targets with bounded reasons.

## TASK-12 — Keep the roadmap plain

- **Status:** Completed
- **Estimate:** 0.5 day per roadmap change
- **Owner:** Product owner
- **Depends on:** Product decision selecting at most one NEXT outcome.
- **Traces:** `plugin-distribution:FR-18`; `plugin-distribution:AC-18.1`; `@feature18`; `SCEN-product-roadmap-has-three-buckets`; `CHK-FR18-01`.
- **Evidence:** Exact-content review of product README and roadmap.
- **Done When:** Public status uses only SHIPPED, NEXT, and LATER; one NEXT row exists; later entries are plain outcomes.

---

## MCP release-integrity domain (merged)

## Board policy

Tasks describe implementation and evidence work. Public state comes only from bounded release evidence, never task or CHK counts.

## MRI001_01 — Installed active-project and eight-tool profile — id: MRI001_01

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP runtime maintainer
- **Depends on:** None
- **Traces:** FR-19, FR-21; AC-19.1, AC-21.1; CHK-FR19-01, CHK-FR21-01; Scenarios: `SCEN-mri-active-project-root`, `SCEN-mri-all-tool-parity`
- **Done When:** A pinned real OMP installation launches the copied package from project-a; responses exclude project-b and package decoys; a validated absolute override selects project-b; unsafe roots refuse; all eight historical MCP handlers return complete envelopes without source checkout or ambient dependency ancestry; corpus hashes remain unchanged. No manager/provider/server topology receipt is produced.

## MRI001_02 — Protocol recovery profile — id: MRI001_02

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** MCP runtime maintainer
- **Depends on:** MRI001_01
- **Traces:** FR-20; AC-20.1; CHK-FR20-01; Scenarios: `SCEN-mri-terminal-json-rpc`, `SCEN-mri-malformed-json-recovery`
- **Done When:** Raw invalid request, malformed JSON, unknown method, and unknown tool frames receive one standard terminal error each; the same process answers a later valid call; stdout contains protocol frames only.

## MRI001_03 — Real unfiltered run and lifecycle journey — id: MRI001_03

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Release verification maintainer
- **Depends on:** MRI001_01, MRI001_02
- **Traces:** FR-22; AC-22.1; CHK-FR22-01; Scenario: `SCEN-mri-public-eligibility-separation`
- **Done When:** One unfiltered Docker Cucumber Message run is bound to candidate/archive/feature/step/source digests and records passing named behavior groups. The same run performs fresh-session install, upgrade from the supported public predecessor, rollback, uninstall absence, and reinstall, recording observed versions and unchanged non-OMP project hashes. Failed, malformed, meta-only, tag-scoped, or name-scoped runs cannot replace the trusted run. No fixed scenario/pickle count, receipt key set, or parser-error taxonomy is evaluated.

## MRI001_04 — Deterministic candidate and same-byte publish — id: MRI001_04

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Release maintainer
- **Depends on:** MRI001_03
- **Traces:** FR-23; AC-23.1; CHK-FR23-01; Scenarios: `SCEN-mri-executable-launcher-archive`, `SCEN-mri-symlinked-evidence-refusal`, `SCEN-mri-artifact-mismatch-refusal`
- **Done When:** Clean peeled-tag assembly is lexical, regular-file-contained, executable-mode-preserving, and deterministic. Public-tree scanning reports only redacted bounded findings. Native GitHub attestation verification binds exact subject/repository/workflow/ref. Publish downloads and re-hashes the candidate archive, never builds, and mutates nothing on any identity mismatch.

## MRI001_05 — Public guidance and historical reader — id: MRI001_05

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Release documentation maintainer
- **Depends on:** MRI001_04
- **Traces:** FR-24; AC-24.1; CHK-FR24-01; Scenario: `SCEN-mri-public-communication-proof`
- **Done When:** Root/package guidance, changelog, captured v0.3.2 notes, archive identity, and v0.3.0 advisory reconcile with the immutable release-status record. Historical evidence@3 and receipt fields remain readable but cannot be regenerated or accepted as the forward MRI run.

## MRI001_06 — Candidate verification — id: MRI001_06

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Release owner
- **Depends on:** MRI001_01, MRI001_02, MRI001_03, MRI001_04, MRI001_05, MRI001_07
- **Traces:** FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25; AC-19.1, AC-20.1, AC-21.1, AC-22.1, AC-23.1, AC-24.1, AC-25.1; CHK-FR19-01, CHK-FR20-01, CHK-FR21-01, CHK-FR22-01, CHK-FR23-01, CHK-FR24-01, CHK-FR25-01
- **Done When:** The ordinary unfiltered profile passes from one candidate, the lifecycle journey is observed, the attested archive digest is unchanged through publication, public guidance matches, the trusted run retains source identity for every installed result, and no candidate identity is silently mixed with another project.

## MRI001_07 — Response provenance and one-root extension profile — id: MRI001_07

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP runtime maintainer
- **Depends on:** MRI001_01
- **Traces:** FR-25; AC-25.1; CHK-FR25-01; Scenarios: `SCEN-mri-response-provenance`, `SCEN-mri-extension-root-consistency`
- **Done When:** The shared resolver supplies one canonical root context to the stdio server and all OMP extension tools; every successful or typed read-error result contains server name, opaque resolved/active root identities, root mode, and mismatch flag without absolute path disclosure; explicit overrides are visibly marked; the two installed scenarios fail if inventory and query tools read different roots.
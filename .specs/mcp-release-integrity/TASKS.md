# Tasks

## Board policy

Tasks describe implementation and evidence work. Public state comes only from bounded release evidence, never task or CHK counts.

## MRI001_01 — Installed active-project and eight-tool profile — id: MRI001_01

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP runtime maintainer
- **Depends on:** None
- **Traces:** FR-1, FR-3; AC-1.1, AC-3.1; CHK-FR1-01, CHK-FR3-01; Scenarios: `SCEN-mri-active-project-root`, `SCEN-mri-all-tool-parity`
- **Done When:** A pinned real OMP installation launches the copied package from project-a; responses exclude project-b and package decoys; a validated absolute override selects project-b; unsafe roots refuse; all eight historical MCP handlers return complete envelopes without source checkout or ambient dependency ancestry; corpus hashes remain unchanged. No manager/provider/server topology receipt is produced.

## MRI001_02 — Protocol recovery profile — id: MRI001_02

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** MCP runtime maintainer
- **Depends on:** MRI001_01
- **Traces:** FR-2; AC-2.1; CHK-FR2-01; Scenarios: `SCEN-mri-terminal-json-rpc`, `SCEN-mri-malformed-json-recovery`
- **Done When:** Raw invalid request, malformed JSON, unknown method, and unknown tool frames receive one standard terminal error each; the same process answers a later valid call; stdout contains protocol frames only.

## MRI001_03 — Real unfiltered run and lifecycle journey — id: MRI001_03

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Release verification maintainer
- **Depends on:** MRI001_01, MRI001_02
- **Traces:** FR-4; AC-4.1; CHK-FR4-01; Scenario: `SCEN-mri-meta-only-evidence-refusal`
- **Done When:** One unfiltered Docker Cucumber Message run is bound to candidate/archive/feature/step/source digests and records passing named behavior groups. The same run performs fresh-session install, upgrade from the supported public predecessor, rollback, uninstall absence, and reinstall, recording observed versions and unchanged non-OMP project hashes. Failed, malformed, meta-only, tag-scoped, or name-scoped runs cannot replace the trusted run. No fixed scenario/pickle count, receipt key set, or parser-error taxonomy is evaluated.

## MRI001_04 — Deterministic candidate and same-byte publish — id: MRI001_04

- **Status:** todo
- **Estimate:** 3 engineering days
- **Owner:** Release maintainer
- **Depends on:** MRI001_03
- **Traces:** FR-5; AC-5.1; CHK-FR5-01; Scenarios: `SCEN-mri-executable-launcher-archive`, `SCEN-mri-symlinked-evidence-refusal`, `SCEN-mri-artifact-mismatch-refusal`
- **Done When:** Clean peeled-tag assembly is lexical, regular-file-contained, executable-mode-preserving, and deterministic. Public-tree scanning reports only redacted bounded findings. Native GitHub attestation verification binds exact subject/repository/workflow/ref. Publish downloads and re-hashes the candidate archive, never builds, and mutates nothing on any identity mismatch.

## MRI001_05 — Public guidance and historical reader — id: MRI001_05

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Release documentation maintainer
- **Depends on:** MRI001_04
- **Traces:** FR-6; AC-6.1; CHK-FR6-01; Scenario: `SCEN-mri-public-communication-proof`
- **Done When:** Root/package guidance, changelog, captured v0.3.2 notes, archive identity, and v0.3.0 advisory reconcile with the immutable release-status record. Historical evidence@3 and receipt fields remain readable but cannot be regenerated or accepted as the forward MRI run.

## MRI001_06 — Candidate verification — id: MRI001_06

- **Status:** todo
- **Estimate:** 1 engineering day
- **Owner:** Release owner
- **Depends on:** MRI001_01, MRI001_02, MRI001_03, MRI001_04, MRI001_05, MRI001_07
- **Traces:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7; AC-1.1, AC-2.1, AC-3.1, AC-4.1, AC-5.1, AC-6.1, AC-7.1; CHK-FR1-01, CHK-FR2-01, CHK-FR3-01, CHK-FR4-01, CHK-FR5-01, CHK-FR6-01, CHK-FR7-01
- **Done When:** The ordinary unfiltered profile passes from one candidate, the lifecycle journey is observed, the attested archive digest is unchanged through publication, public guidance matches, the trusted run retains source identity for every installed result, and no candidate identity is silently mixed with another project.

## MRI001_07 — Response provenance and one-root extension profile — id: MRI001_07

- **Status:** todo
- **Estimate:** 2 engineering days
- **Owner:** MCP runtime maintainer
- **Depends on:** MRI001_01
- **Traces:** FR-7; AC-7.1; CHK-FR7-01; Scenarios: `SCEN-mri-response-provenance`, `SCEN-mri-extension-root-consistency`
- **Done When:** The shared resolver supplies one canonical root context to the stdio server and all OMP extension tools; every successful or typed read-error result contains server name, opaque resolved/active root identities, root mode, and mismatch flag without absolute path disclosure; explicit overrides are visibly marked; the two installed scenarios fail if inventory and query tools read different roots.

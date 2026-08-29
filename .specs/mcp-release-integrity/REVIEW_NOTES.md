# Spec Review: mcp-release-integrity

**Phase:** post-release contract reconciliation

## Verdict

**Public v0.3.2 remains delivered and installable. Contract revalidation is in progress.** The bounded public-release authority is `docs/validation/release-status-v0.3.2.json`; this specification-only corpus repair neither retracts nor creates a runtime release. CHK/TASK rows remain `In Progress` until the amended all-scenario Docker run and final corpus review are recorded.

`.progress.json` records completion of the four document-authoring phases only. It is not implementation, CHK, task, or public-release status.

## Current bounded evidence

- Public release/tag: `v0.3.2`, peeled commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`.
- Candidate digest: `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`.
- Published archive: `omp-spec-kit-0.3.2.tar`, SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`.
- Evidence schema: `omp-spec-kit-release-evidence@3`, with separate MRI, distribution, and public eligibility result contracts.
- Distribution subject: `distribution-evidence.json`, SHA-256 `46deadb5ccb26413942bf96c046516231e1c98d217d95353b90574922365f5d7`, repository `stgmt/omp-spec-kit`, signer workflow `.github/workflows/distribution-evidence.yml@refs/tags/v0.3.2`, Rekor index `2624698726`.
- The committed real Cucumber fixture is an immutable prior full Docker stream. After any scenario/step change it must be recaptured from a new successful unfiltered Docker run before CHKs become Verified.

## Revalidation changes

- All eighteen MRI IDs and all source-derived Scenario Outline rows are mandatory `@release-evidence`; the amended set is 40 pickle executions. Six FR receipts do not replace multiplicity.
- FR-2 now verifies `-32600`, `-32700`, `-32601`, and `-32602` terminal responses.
- FR-4/FR-5/FR-6 separate local fail-closed evaluator tests from bounded historical public-release/asset/release-note readback; no fresh trusted verifier/download execution is claimed.
- Candidate/evidence/result schemas now mirror delivered evidence@3 and the distinct MRI/distribution/public result identities.
- Every CHK has a TASK backlink; all eleven CHKs have one honest `In Progress` state.

## Historical interactive CLI observation

The v0.3.1 observation where `/mcp list` omitted `omp-spec-kit` is retained as historical defect evidence only. The deterministic manager receipt and bounded public v0.3.2 status record are current authorities.

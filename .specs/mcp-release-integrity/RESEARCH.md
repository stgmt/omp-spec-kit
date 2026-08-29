# Research

## Scope and evidence classes

This record separates the historical v0.3.0 defect, delivered v0.3.2 implementation, published-release evidence, and current contract revalidation. Source inspection proves code shape; Docker Cucumber Messages prove executed behavior; GitHub release/attestation receipts prove public identity. No one class substitutes for another.

## Pinned OMP launch contract

- OMP v17.3.7 `omp-plugins` resolves path-like `command` relative to the package root and preserves raw `args`/`env`: [pinned source](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/discovery/omp-plugins.ts#L274-L344).
- `StdioTransport` uses `config.cwd ?? getProjectDir()`: [pinned source](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/mcp/transports/stdio.ts#L578-L609).
- MCP environment indirection behavior is pinned in [mcp-config.md](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md#L377-L425).

**Verified conclusion:** v0.3.0's package `cwd` selected package data. v0.3.2 omits `cwd`, uses a package-relative launcher, and lets OMP supply the active project root. Only an explicitly validated absolute `OMP_SPEC_KIT_ROOT` may override it. Current bytes: `plugins/omp-spec-kit/.mcp.json`, launchers, and `src/adapters/query-service.js`.

## Delivered protocol and package behavior

`src/mcp/server.js` implements one terminal JSON-RPC frame for invalid request, parse error, unknown method, and unknown tool (`-32600`, `-32700`, `-32601`, `-32602`). The copied-package tests execute all eight historical SCHEMA-11 tools against the real frozen corpus and direct service oracle without source checkout or ambient dependency ancestry. The eight names are v0.3.2 release identity, not the destination registry ceiling.

## Delivered release architecture

- `scripts/create-release-candidate.mjs` emits `omp-spec-kit-<version>.tar` and `omp-spec-kit-release-candidate@1` from one clean peeled-tag package tree.
- `scripts/create-release-evidence.mjs` emits `omp-spec-kit-release-evidence@3` with nested `omp-spec-kit-mri-evidence@1` and `omp-spec-kit-distribution-evidence-input@1`; MRI FR receipt keys are qualified `mcp-release-integrity:FR-1` through `FR-6`.
- `scripts/verify-release.mjs` emits separate `mri-release-eligibility@1`, `distribution-release-eligibility@1`, and `public-release-eligibility@1` results. Forward `distribution-release-eligibility@2` belongs to `plugin-distribution:FR-13` and is not redefined here.
- Cucumber evidence is a real Message NDJSON stream. The evaluator requires semantic pickle/test-case/attempt/step/final-run chains and rejects malformed, meta-only, duplicate-terminal, retry-only, incomplete, or non-passing evidence.

## Distribution trust root

Self-attested distribution matrices are always blocked. The trusted path verifies the exact copied subject bytes with GitHub Artifact Attestations and fixes all verifier identities:

- repository: `stgmt/omp-spec-kit`;
- signer workflow: `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`;
- source ref: `refs/tags/<candidate-tag>`;
- command: `gh attestation verify <subject> --repo ... --signer-workflow ... --source-ref ...`;
- timeout: 120 seconds; missing/unavailable/nonzero verifier fails closed.

Environment may confirm only that exact repository; it cannot select another trust root. Evidence: `scripts/verify-release.mjs` trust-root constants and `attestationTrustRootRepository()`.

## Current public instance

`docs/validation/release-status-v0.3.2.json` records public/installable v0.3.2, tag commit, candidate/package/archive digests, release assets, release-workflow attestation, independently verified distribution subject/workflow/ref, Rekor index, and provenance commands. The public archive is `omp-spec-kit-0.3.2.tar`; evidence schema is @3. This bounded record supersedes the pre-release claim that no live producer provenance exists.

## Current revalidation obligation

The original release gate selected scenario headings by `@release-evidence`; leaving eleven MRI scenarios untagged allowed their execution to be omitted from the mandatory set. The repaired contract marks all eighteen headings mandatory while retaining six qualified FR receipts. Because feature/step bytes changed, a fresh unfiltered Docker stream must be captured and committed before amended CHKs can become Verified. Scenario text alone remains non-evidence.

## Risks

| Risk | Control |
|---|---|
| Wrong project root returns plausible empty data | Installed manager + copied-package active-root scenarios |
| Protocol client hangs or receives mixed stdout | Exact four-code raw-frame tests and no-extra-stdout assertion |
| Synthetic Cucumber fixture hides parser drift | Real Docker stream, immutable provenance, semantic one-fault mutations |
| Self-attested producer authorizes release | Fixed GitHub attestation repository/workflow/ref and fail-closed verifier |
| Publish rebuilds or substitutes bytes | One candidate archive; download/re-hash; existing asset identity check |
| Published status and amended spec diverge | Bounded status record plus current all-scenario Docker revalidation |

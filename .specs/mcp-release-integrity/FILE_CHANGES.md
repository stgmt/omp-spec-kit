# File Changes

| Path | Action | Reason |
|------|--------|--------|
| `plugins/omp-spec-kit/.mcp.json` | edit | FR-1 replaces package cwd with a package-relative launcher command. |
| `plugins/omp-spec-kit/package.json` | edit | FR-1 allowlists package launchers. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` | edit | FR-1 supplies POSIX server launch without changing cwd. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` | edit | FR-1 supplies Windows server launch through PATHEXT. |
| `src/adapters/query-service.js` | edit | FR-1 accepts only an absolute root override. |
| `src/mcp/server.js` | edit | FR-2 returns terminal invalid-request responses. |
| `src/kernel/query/service.js` | edit | FR-3 normalizes source spans and fixes diagnostics/Markdown parity for all eight tools. |
| `src/kernel/graph/build.js` | edit | FR-3 assigns document-node source paths before projection. |
| `scripts/build-plugin.mjs` | edit | Version authority becomes v0.3.1. |
| `scripts/verify-marketplace.mjs` | edit | Version authority becomes v0.3.1. |
| `scripts/verify-package.mjs` | edit | Verifies launcher configuration, allowlist, mode, and dynamic version. |
| `scripts/release-candidate-utils.mjs` | edit | FR-4 provides lexical candidate primitives plus canonical evidence containment that rejects symlinked root/parents and realpath escape. |
| `scripts/create-release-candidate.mjs` | edit | FR-4 peels the tag and refuses a dirty/different package checkout before archiving. |
| `scripts/verify-public-tree.mjs` | edit | FR-4/FR-5 emits redacted public-safety findings and detects generic credential names with environment-variable prefixes without echoing payloads. |
| `scripts/create-release-evidence.mjs` | edit | FR-4 preserves optional distribution JSON only as explicitly `untrusted-self-attested` structural diagnostics, never release authority. |
| `scripts/verify-release.mjs` | edit | FR-4 rejects unsafe receipt/message paths, validates structural claim-matrix diagnostics, fail-closes self-attested distribution producers with the independent-trust-root blocker, and fail-closes the `github-artifact-attestation` trust root via `gh attestation verify` against the fixed signer workflow and candidate tag. |
| `scripts/create-distribution-evidence.mjs` | edit | FR-4 builds the attested-path distribution evidence bundle from real CI producer outputs, omitting lifecycle claims whose producers do not exist in CI. |
| `scripts/create-corpus-inventory.mjs` | edit | FR-4 captures a real frozen-corpus inventory through the production kernel reader as standalone distribution-evidence input. |
| `scripts/render-release-notes.mjs` | edit | FR-5/FR-6 emits notes only from an eligible candidate. |
| `scripts/docker-bdd.sh` | edit | FR-4 runs `refresh-real-corpus-manifest.mjs --check` on the git-capable host, creates and bind-mounts only `.dev-pomogator/bdd-results/`, validates a successful unfiltered Cucumber Messages file, and atomically publishes `.dev-pomogator/.last-test-run.ndjson` without clobbering it for scoped or failed runs. |
| `tests/distribution/Dockerfile` | edit | FR-3/FR-4 runs the BDD container directly for structured formatter control. |
| `cucumber.mjs` | edit | FR-4 keeps progress for ordinary BDD while an explicit message-file path adds Cucumber Messages NDJSON; release stdout capture remains pure Messages. |
| `.github/workflows/verify.yml` | edit | FR-4/FR-5 checks out full history so the Docker BDD host preflight can verify immutable corpus bytes before image build. |
| `.github/workflows/release.yml` | edit | FR-4/FR-5 verifies immutable corpus provenance on the git-capable runner, fail-closes untrusted distribution evidence, and downloads the cross-run attested evidence artifact to select the `github-artifact-attestation` trust path only when a successful distribution-evidence run exists for the tag. |
| `.github/workflows/distribution-evidence.yml` | create | FR-4 builds the real producer-output evidence bundle and attests it with `actions/attest@v4` (`id-token: write`, `attestations: write`) on release tags. |
| `tests/helpers/mcp-world.mjs` | edit | FR-2/FR-3 gains hash checks, raw frame handling, copied-package launch, and stdout enforcement. |
| `tests/helpers/release-candidate-world.mjs` | edit | FR-4/FR-5 builds placeholder, structurally complete self-attested, and structurally complete attestation-trusted distribution matrices for rejection coverage, never public eligibility. |
| `tests/step-definitions/mcp-release-integrity.steps.mjs` | edit | FR-1/FR-2/FR-3 runs active-root, protocol, and eight-tool package BDD. |
| `tests/step-definitions/release-candidate.steps.mjs` | edit | FR-4/FR-5/FR-6 drives canonical evidence rejection, structurally complete self-attestation and attestation-trusted rejection, withheld notes, and redacted real-package secret mutation BDD. |
| `.specs/mcp-release-integrity/mcp-release-integrity.feature` | edit | FR-1 through FR-6 executable BDD includes prefixed-secret, self-attested-evidence, and attestation-trusted fail-closed negative scenarios. |
| `docs/advisories/v0.3.0-mcp-root.md` | edit | FR-6 records reversible public advisory. |
| `README.md` | edit | FR-6 corrects public status without claiming v0.3.1 release. |
| `CHANGELOG.md` | edit | FR-6 records corrective patch work as unreleased. |
| `plugins/omp-spec-kit/README.md` | edit | FR-6 gives fresh-session and override guidance. |
| `.omp-plugin/marketplace.json` | edit | Version authority becomes v0.3.1. |
| `package.json` | edit | Version authority becomes v0.3.1. |
| `src/v0.1/extension.js` | edit | Version authority becomes v0.3.1. |
| `src/v0.1/inventory.js` | edit | Version authority becomes v0.3.1. |
| `plugins/omp-spec-kit/dist/` | edit | Generated package output is rebuilt from corrected sources. |
| `.specs/mcp-release-integrity/` | edit | Remediation contract, BDD, task, and evidence records are maintained. |
| `.specs/mcp-release-integrity/REVIEW_NOTES.md` | edit | Records semantic/reality review findings and evidence boundary. |

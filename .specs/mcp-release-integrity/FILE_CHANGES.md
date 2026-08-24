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
| `scripts/release-candidate-utils.mjs` | edit | FR-4 provides lexical file, mode, tar, digest, and candidate-shape primitives. |
| `scripts/create-release-candidate.mjs` | edit | FR-4 peels the tag and refuses a dirty/different package checkout before archiving. |
| `scripts/verify-public-tree.mjs` | edit | FR-4/FR-5 emits public-safety evidence over candidate bytes. |
| `scripts/create-release-evidence.mjs` | edit | FR-4 binds real Cucumber messages and external lifecycle receipts into evidence. |
| `scripts/verify-release.mjs` | edit | FR-4 rejects unbound tag, archive, message, evidence, lifecycle, and FR-to-scenario records. |
| `scripts/render-release-notes.mjs` | edit | FR-5/FR-6 emits notes only from an eligible candidate. |
| `scripts/docker-bdd.sh` | edit | FR-4 forwards Cucumber message mode through WSL/Docker. |
| `tests/distribution/Dockerfile` | edit | FR-3/FR-4 runs the BDD container directly for structured formatter control. |
| `cucumber.mjs` | edit | FR-4 includes executable spec BDD and switches between progress and message formatter. |
| `.github/workflows/verify.yml` | edit | FR-5 keeps PR/push package and Docker BDD verification non-publishing. |
| `.github/workflows/release.yml` | edit | FR-5 builds/uploads one candidate then publish rechecks and attaches only it. |
| `tests/helpers/mcp-world.mjs` | edit | FR-2/FR-3 gains hash checks, raw frame handling, copied-package launch, and stdout enforcement. |
| `tests/helpers/release-candidate-world.mjs` | edit | FR-4/FR-5 builds isolated candidate/evidence variants and extracts the tar. |
| `tests/step-definitions/mcp-release-integrity.steps.mjs` | edit | FR-1/FR-2/FR-3 runs active-root, protocol, and eight-tool package BDD. |
| `tests/step-definitions/release-candidate.steps.mjs` | edit | FR-4/FR-5/FR-6 runs candidate, tamper, archive, and note BDD. |
| `.specs/mcp-release-integrity/mcp-release-integrity.feature` | edit | FR-1 through FR-6 become executable BDD scenarios. |
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

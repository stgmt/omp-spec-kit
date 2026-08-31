# File Changes

| Path | Action | Reason |
|---|---|---|
| `plugins/omp-spec-kit/.mcp.json` | edit | Keep package-relative command with active-project cwd behavior for FR-1. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` | edit | Launch the packaged server without choosing the data root. |
| `plugins/omp-spec-kit/bin/omp-spec-kit-mcp.cmd` | edit | Preserve the same Windows installed behavior. |
| `src/adapters/query-service.js` | edit | Create the shared canonical root context, opaque root identities, provenance projection, and mismatch visibility for every query result. |
| `src/mcp/server.js` | edit | Pass one startup root context to the stdio server and retain the exact eight-tool protocol surface. |
| `src/v0.1/extension.js` | edit | Give legacy inventory and the seven query tools the same resolved root context. |
| `src/v0.1/inventory.js` | edit | Carry the shared server/root provenance in the legacy inventory result without absolute-path disclosure. |
| `src/adapters/tool-contracts.js` | edit | Keep the exact historical v0.3.2 eight-tool table while exposing the provenance-bearing result contract. |
| `scripts/docker-bdd.sh` | edit | Produce and atomically promote only successful unfiltered real Cucumber Messages. |
| `tests/helpers/mcp-world.mjs` | edit | Drive copied installed package, raw frames, provenance, corpus snapshots, and all eight handlers. |
| `tests/step-definitions/mcp-release-integrity.steps.mjs` | edit | Implement FR-1 through FR-3 and FR-7 black-box root/provenance scenarios. |
| `tests/features/spec-mcp.feature` | edit | Assert the built extension/MCP envelope contract and provenance on the real package surface. |
| `tests/helpers/release-candidate-world.mjs` | edit | Drive one compact MRI run and same-byte candidate checks. |
| `scripts/create-release-candidate.mjs` | edit | Assemble deterministic contained clean-tag bytes. |
| `scripts/verify-public-tree.mjs` | edit | Enforce no-credential outcome with redacted findings. |
| `scripts/verify-release.mjs` | edit | Consume one MRI run and native attestation result; remove nested authority lattices. |
| `.github/workflows/verify.yml` | edit | Run the candidate profile and retain its exact artifacts. |
| `.github/workflows/release.yml` | edit | Download, re-hash, and publish the verified archive without rebuild. |
| `scripts/render-release-notes.mjs` | edit | Render claims only from verified current candidate identities. |
| `docs/validation/release-status-v0.3.2.json` | edit | Keep immutable historical evidence reader compatibility; do not rewrite recorded bytes. |
| `docs/advisories/v0.3.0-mcp-root.md` | edit | Retain reversible recovery guidance. |
| `README.md` | edit | Keep current v0.3.2 and fresh-session guidance accurate. |
| `plugins/omp-spec-kit/README.md` | edit | Keep installed package guidance accurate. |
| `CHANGELOG.md` | edit | Preserve v0.3.0/v0.3.1/v0.3.2 history. |

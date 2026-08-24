# Planned File Changes

Every row is a future implementation change. Presence here does not mean the path exists or behavior is delivered.

| Planned path | Action | Requirement | Purpose |
|---|---|---|---|
| `.omp-plugin/marketplace.json` | Create (planned) | FR-1, FR-7 | One root catalog with one relative child entry and explicit `0.1.0`. |
| `plugins/omp-spec-kit/package.json` | Create (planned) | FR-2, FR-5, FR-7 | One child package, allowlisted files, matching version, one built extension. |
| `src/v0.1/extension.js` | Create (planned) | FR-2, FR-4, FR-12 | External registration-only factory for the one tool; copied byte-for-byte into generated `dist/`. |
| `src/v0.1/inventory.js` | Create (planned) | FR-3, FR-6, FR-12 | External root-relative bounded read-only inventory and public contract implementation. |
| `scripts/build-plugin.mjs` | Create (planned) | FR-5 | Repository-root clean copier and deterministic two-module hash-manifest builder. |
| `plugins/omp-spec-kit/dist/extension.js` | Create generated (planned) | FR-2, FR-5 | Verified installed runtime artifact; never hand-edited. |
| `plugins/omp-spec-kit/dist/inventory.js` | Create generated (planned) | FR-3, FR-5, FR-12 | Verified installed inventory artifact; never hand-edited. |
| `plugins/omp-spec-kit/dist/manifest.json` | Create generated (planned) | FR-5, FR-7 | Deterministic extension/inventory SHA-256 manifest. |
| `plugins/omp-spec-kit/README.md` | Create (planned) | FR-2, FR-4 | Installed package scope and fresh-session usage boundary. |
| `plugins/omp-spec-kit/LICENSE` | Create (planned) | FR-2, FR-9 | Payload copy of the approved repository license. |
| `plugins/omp-spec-kit/skills/spec-inventory/SKILL.md` | Create (planned) | FR-3, FR-11 | User guidance routed to the registered tool; no second runtime. |
| `plugins/omp-spec-kit/commands/spec-inventory.md` | Create (planned) | FR-3, FR-11 | Human invocation guidance; no duplicate inventory logic. |
| `scripts/verify-marketplace.mjs` | Create (planned) | FR-1, FR-2, FR-7 | Closed schema/cardinality/version/path validator. |
| `scripts/verify-public-tree.mjs` | Create (planned) | FR-9 | Secret/local-state/license/provenance/public-path gate. |
| `scripts/verify-package.mjs` | Create (planned) | FR-5, FR-12 | Allowlist, artifact digest, dependency and embedded-version verification. |
| `docs/omp-v17.3.7-contract.md` | Create (planned) | FR-2, FR-4, FR-5 | Immutable OMP pin, source links, recursive-copy finding, commands, and reload/fresh-session boundary. |
| `scripts/verify-release.mjs` | Edit | FR-11, FR-13 | Computes independent qualified MRI and distribution gates, validates closed record cardinality and all candidate/OMP/platform/catalog/package/archive/applicability/lifecycle/discovery dimensions, and composes public eligibility fail-closed. |
| `tests/distribution/Dockerfile` | Create (planned) | FR-4, FR-5 | Pin OMP and isolate dependency-absent lifecycle runtime. |
| `tests/distribution/compose.yaml` | Create (planned) | FR-4 through FR-9 | Isolate user/project roots, credentials, network policy, and mounts. |
| `tests/fixtures/distribution/valid-project/.specs/sample/README.md` | Create (planned) | FR-3 | Real minimal recognized fixture with provenance. |
| `tests/fixtures/distribution/valid-project/.specs/sample/FR.md` | Create (planned) | FR-3 | Real fixture requirement input. |
| `tests/fixtures/distribution/valid-project/.specs/sample/sample.feature` | Create (planned) | FR-3 | Real fixture scenario input; not execution evidence. |
| `tests/fixtures/distribution/malformed-project/.specs/broken/FR.md` | Create (planned) | FR-6 | Malformed real-derived input with documented ground truth. |
| `tests/fixtures/distribution/excess-project/.specs/` | Create generated fixture (planned) | FR-3, FR-6 | Hard-cap and truncation proof input. |
| `tests/fixtures/distribution/secret-scan-canary.txt` | Create (planned) | FR-9 | Designated synthetic scanner canary excluded from packaging. |
| `tests/features/plugin-distribution.feature` | Create (planned) | FR-1 through FR-13 | Executable lifecycle/negative/aggregate scenarios traced from this spec with stable scenario IDs and exact AC tags. |
| `tests/step-definitions/plugin-distribution.ts` | Create (planned) | FR-1 through FR-13 | Drive real OMP CLI/session and inspect candidate-aware receipts and aggregate eligibility without fake status. |
| `tests/hooks/distribution-fixture.ts` | Create (planned) | FR-4 through FR-9, FR-13 | Isolated setup, instrumentation, hashes, and bounded cleanup for first/subsequent release profiles. |
| `.github/workflows/verify.yml` | Create (planned) | FR-9, FR-10, FR-11, FR-13 | Evidence-producing verification jobs for PRs/pushes without publication. |
| `.github/workflows/release.yml` | Edit | FR-10, FR-11, FR-13 | Supplies the pinned manager-discovery receipt to assembly; without a real distribution evidence input, eligibility fails and publication cannot start. |
| `README.md` | Edit (planned) | FR-4, FR-7, FR-8, FR-11, FR-13 | Exact proven install/reload/fresh-session/uninstall/reinstall and subsequent-release upgrade/rollback guidance. |
| `CHANGELOG.md` | Edit (planned) | FR-7, FR-11, FR-13 | Record delivered v0.1.0 only after aggregate proof. |
| `SECURITY.md` | Edit (planned) | FR-9 | Public reporting and release-secret policy. |

## Explicitly absent in v0.1.0

The plan SHALL NOT create `plugins/omp-spec-kit/.mcp.json`, an MCP server, another plugin package, another marketplace catalog, another extension entry, a writer, watcher, database, lock, advisor, backlog, dashboard, hook, user-state store, or dev-pomogator runtime import. Because OMP recursively copies the catalog source directory, the child SHALL also exclude `src/`, `scripts/`, compiler configuration, tests, fixtures, evidence, nested manifests, and runtime dependencies; those repository-only inputs remain outside the payload.

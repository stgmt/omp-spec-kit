# Planned file changes

Every row is a **planned future path**, not evidence that the file exists or the behavior is delivered. Product-level paths contain policy/evidence only; plugin, kernel, and authoring internals remain owned by their sibling specifications.

## Public-init paths

| Planned path | Planned action | Externally observable purpose | Trace |
|---|---|---|---|
| `README.md` | Update before authorized publication | State specification-only/non-installable status, primary blocker, and next gate. | `product:FR-1`, `product:FR-7`, `product:FR-8` |
| `ROADMAP.md` | Update at each stage decision | Separate current, planned, deferred, and blocked states with exit evidence; v0.3 is the first slice of the generator-port MCP door. | `product:FR-6`, `product:FR-8`, `product:FR-9` |
| `IMPORT_MANIFEST.yaml` | Update only through reviewed provenance decision | Record exact immutable source paths/hashes and resolved license status. | `product:FR-2`, `product:FR-3` |
| `MIGRATION_MATRIX.md` | Update when an adoption decision changes | Preserve rationale for standalone scope without editing upstream evidence. Deferred MCP rows remain later generator-port MCP. | `product:FR-2`, `product:FR-8`, `product:FR-9` |
| `docs/decisions/spec-generator-port.md` | Maintain as census authority | Canonical 46-name owner/stage table; agent-facing MCP destination; eight SCHEMA-11 names are the v0.3 first slice. | `product:FR-9` |
| `docs/decisions/omp-spec-kit-public-init.md` | Point at generator-port census | Public-init history unchanged; one sentence names the agent-facing MCP destination. | `product:FR-9` |
| `plugins/omp-spec-kit/README.md` | Update first-slice wording | Eight-tool MCP surface is the current v0.3 first slice, not the destination door. | `product:FR-9` |
| `docs/upstream/dev-pomogator/LICENSE`, `docs/upstream/dev-pomogator/LICENSE-ATTESTATION.md`, `docs/validation/provenance/dev-pomogator-license-attestation.yaml` | Preserve/update only from merged source evidence | Record exact license/attestation bytes, hashes, covered snapshot identity, and bounded resolved status. | `product:FR-2`, `product:FR-3` |
| `docs/validation/source-freeze.md` | Create | Record independent reconstruction, per-file comparison, exclusions, and actual mismatch count for the candidate revision. | `product:FR-2` |
| `docs/validation/public-safety.md` | Create | Record license decision, allowlist, secret scan, exceptions, and public-diff review for the candidate revision. | `product:FR-3`, `product:FR-4` |
| `docs/validation/spec-review.md` | Create | Record traceability, semantic, link, and manager-readability review for all canonical specs. | `product:FR-1`, `product:FR-8` |
| `docs/validation/release-status.json` | Create when status publication is automated | Expose stage, state, revisions/timestamps, blockers, canonical evidence IDs, and next gate. | `product:FR-6`, `product:FR-7` |
| `docs/validation/product-identity.md` | Create with first distribution candidate | Record one marketplace/plugin/extension cardinality and identity evidence. | `product:FR-5` |
| `CHANGELOG.md` | Update only with delivered changes | Record actual public-init/release outcomes without planned-feature laundering. | `product:FR-7`, `product:FR-8` |
| `SECURITY.md` | Update if reporting or scan policy changes | Keep public disclosure/reporting and prohibited-content policy current. | `product:FR-4` |

## Stage-owned planned paths

The following paths are listed only to expose the product lifecycle boundary. Their content is owned elsewhere.

| Planned path | Owning contract | Product gate |
|---|---|---|
| `.omp-plugin/marketplace.json` | `plugin-distribution:FR-1` | Must be absent at public init; v0.1.0 remains non-delivered unless `plugin-distribution:FR-13` accepts the complete distribution evidence set. |
| `plugins/omp-spec-kit/package.json` | `plugin-distribution:FR-1` | Must be absent at public init; v0.1.0 remains non-delivered unless `plugin-distribution:FR-13` accepts the complete distribution evidence set. |
| `plugins/omp-spec-kit/dist/extension.js` | `plugin-distribution` member contracts | Evidence input only; `plugin-distribution:FR-13` supplies the distribution result, while `product:FR-6` still requires the proposed stage's complete cumulative gate set. |
| `plugins/omp-spec-kit/src/kernel/` | `spec-kernel` member contracts | Planned for the read-only kernel stages; v0.2 evidence binds to its current candidate, while v0.3 uses a current-candidate targetStage v0.3 result plus a separately identified targetStage v0.2 predecessor linked by exact `v02ParentArtifactSha256`, common revision/lineage, strict stage order, and active state. |
| `plugins/omp-spec-kit/dist/mcp-server.mjs` | `spec-kernel` member contracts | Planned for the v0.3 read-only MCP projection; current distribution and targetStage v0.3 evidence bind to the current candidate artifact, not the predecessor. |
| `plugins/omp-spec-kit/src/authoring/` | `spec-authoring-workflow` member contracts | Deferred; authoring evidence binds to the current candidate and is additional to current distribution/current v0.3 kernel plus the linked active v0.2 predecessor in the cumulative authoring gate set. |

## Paths prohibited from the public product

No planned change may import or create public product dependencies on:

- dev-pomogator advisor, hook, statusline, dashboard, backlog, proxy, context/memory, auto-commit, browser, or generic harness paths;
- user-local `.omp` state, credentials, `.env` files, logs, caches, temporary evidence, or workstation paths;
- inherited dev-pomogator `.git` history;
- copied runtime code whose provenance/license is unresolved;
- a second marketplace, plugin package, extension entry, or query/mutation source of truth.

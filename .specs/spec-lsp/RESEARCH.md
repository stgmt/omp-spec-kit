# Research

## RF-1: OMP is an LSP-native host

OMP's coding agent has a built-in `lsp` tool with 14 operations including diagnostics, navigation, symbols, rename, code actions, and raw requests (`docs/tools/lsp.md`). The default setting `lsp.diagnosticsOnWrite = true` triggers automatic diagnostic polling after every write/edit (`docs/settings.md`). Plugins register LSP servers through the `lspServers` manifest field, which produces `.lsp.json` at install time (`docs/marketplace.md`). Configuration uses `<project>/.omp/lsp.json` or `<project>/.lsp.json` with `{command, args, fileTypes, languageId, initOptions}` shape (`docs/lsp-config.md`). Lazy start (`lsp.lazy = true` default) and shared broker (`lsp.shared = true` default) are host-managed (`docs/settings.md`).

**Implication:** The host provides the diagnostic-push, lifecycle, and multi-session machinery. The adapter need only implement the LSP protocol correctly; no custom hook, daemon, or push mechanism is required.

**Evidence obligation:** TASK-1 live probes must confirm each cited behavior against the pinned OMP runtime before implementation.

## RF-2: Third-party Markdown LSP servers cannot serve typed spec graphs

Candidates evaluated: Marksman (F#), zk (Go), markdown-oxide (Rust), Foam/Dendron (VS Code extensions). All resolve only heading-slug wiki-links and understand none of: typed nodes (FR/AC/Scenario/Task/Evidence), typed edges (`covers`/`tested-by`/`implements`), composite IDs `<slug>:<localId>`, coverage, or evidence freshness. Upstream `dev-pomogator` recorded the dual-anchor-registry lesson: graph aliases ≠ heading slugs, requiring a validation shim (`validate_anchor`) to distinguish them. Forking introduces a foreign stack maintenance burden (upstream RESEARCH rejected F# for this reason).

**Decision:** No third-party Markdown LSP server is adopted. The custom adapter serves both layers from one kernel.

**MIGRATION_MATRIX reference:** FR-7 DROP (Marksman plugin), FR-27 DROP (Marksman binary supply chain). These decisions stand and are not reversed by this specification.

## RF-3: Step layer centralization is blocked on the kernel

The official `@cucumber/language-server` would create a second index over `.feature` files. A homegrown matcher inside this adapter would do the same unless the kernel owns `StepBinding` nodes. See RF-10. [VERIFIED]

**Decision (this stage):** Do not bundle cucumber libraries and do not emit step diagnostics. Keep `@cucumber/language-server` out of production. Revisit only after a kernel change.


## RF-4: Read-only-first posture matches kernel release stages

The kernel v0.2 and v0.3 are read-only. The LSP adapter is a sibling projection and inherits this constraint. `workspace/applyEdit` is available in OMP's LSP client (`docs/tools/lsp.md`) but its use constitutes mutation, which belongs to the future authoring door. Code actions may PROPOSE repairs (returning edit descriptions) but application requires the authoring door's audit and validation pipeline.

**Risk:** RISK-1 — Premature mutation surface. If code actions return applicable edits without the authoring door, they bypass safety gates. Mitigation: code actions return proposal descriptions only; no `WorkspaceEdit` is returned until the authoring stage explicitly opens this path.

## RF-5: Incremental re-evaluation budget

Upstream `dev-pomogator` established a ≤150ms p95 budget for incremental re-evaluation of a touched spec. This budget is adopted as the target for this adapter. Full-corpus work occurs only at startup or explicit reload. The kernel's incremental graph rebuild capability (when available) is the enabler; the adapter does not implement its own incremental parsing beyond what the kernel provides.

**Risk:** RISK-2 — Kernel incremental rebuild not yet available at spec-authoring time. If the kernel only supports cold builds, the adapter must defer to full rebuild on `didSave` until incremental support lands. This may exceed the 150ms budget on large corpora. Mitigation: document the dependency; gate the budget claim on kernel incremental support evidence.

## RF-6: Honest absence over degraded fake resolution

The upstream `dead-integration-guard` lesson: "installed ≠ integrated." When the kernel graph is unavailable (build failure, not yet loaded, corrupted), the adapter must explain why rather than returning plausible-looking but fabricated navigation or diagnostic results. This is the same posture as `spec-kernel:FR-6` fail-closed diagnostics.

## RF-7: OMP lsp.shared broker semantics

OMP's `lsp.shared` broker manages one server per project across local sessions. The adapter must be compatible with this sharing model: it must not hold exclusive locks, must handle concurrent clients, and must not assume single-session ownership. Locks for future mutation belong to the kernel, not the adapter.

**Evidence obligation:** TASK-1 probes must verify shared-broker compatibility with the pinned OMP runtime.

## RF-8: Agent prompt mandates LSP for symbol-aware work

The OMP agent prompt (`packages/coding-agent/src/prompts/tools/lsp.md`) states: "Symbol-aware work (rename, references, definition, code actions) MUST use `lsp` whenever a server is available." This means the agent will naturally route spec navigation through this server once registered, without skill-level prompting.

**Implication:** Registration quality directly affects agent behavior. Incorrect or missing capabilities cause the agent to fall back to text tools, losing precision.

## RF-9: This product's MCP surface is eight tools, not forty-six

The live `omp-spec-kit` MCP adapter maps eight SCHEMA-11 tools one-to-one onto kernel query operations (`src/mcp/server.js`). `spec-kernel:FR-9` forbids additional mutation tools. GitHub issue #7's count of 46 tools and the "~25 tool cliff" describe upstream `dev-pomogator` `tools/spec-mcp-server/tools.ts`, not this repository. [VERIFIED]

**Decision:** LSP is a sibling projection. It SHALL NOT be specified or marketed as a cut of MCP tools in this product. There is nothing in the eight-tool registry whose removal is required for an agent to stay under a 25-tool cliff.

## RF-10: Kernel cannot host a step-binding layer today

`spec-kernel_SCHEMA.md` SCHEMA-4 `NodeKind` is a closed union with no `StepBinding`. SCHEMA-5 `EdgeType` has no `step-binding`. `spec-kernel:FR-7` inspects only `.specs/<valid-slug>/` canonical documents, so `tests/step-definitions/**` is out of reader scope. [VERIFIED]

**Decision:** This stage forbids step diagnostics. A future step layer needs a separately accepted kernel change first. Implementing step matching inside the LSP adapter would create a second index — the dual-index failure already rejected for Marksman and for an external Cucumber language-server.

## RF-11: Product gates and ROADMAP had no LSP stage

`product:FR-6` ordered stages are public init, v0.1.0, v0.2 kernel, v0.3 MCP, then authoring. `ROADMAP.md` had the same list. Issue #7 asked for a sibling stage after a stable query service. [VERIFIED]

**Decision:** ROADMAP gains an explicit "one LSP adapter" sibling stage after v0.2. It does not replace v0.3 MCP evidence and does not unlock authoring.

## RF-12: 150 ms incremental rebuild has no kernel API

The pure kernel (`spec-kernel:FR-1`) has no filesystem, clock, or watchers. v0.2 builds a full snapshot from caller-supplied documents. Issue #7's ≤150 ms p95 is upstream research, not a measured kernel check. [VERIFIED]

**Decision:** This stage rebuilds through the existing kernel build on didSave and records measured p95. 150 ms is not a pass/fail member until `spec-kernel` accepts incremental rebuild evidence.

## RF-13: Scenario hover cannot show run results

Kernel `SCENARIO` attributes are `featureName`, `scenarioKeyword`, `tags`, `steps`, `examples`. Run result, provenance, and freshness belong to `spec-evidence`, which is not an input to this adapter. [VERIFIED]

**Decision:** Hover returns only stored kernel fields.

## RF-14: Advertising codeAction without apply is a dead agent path

OMP's agent prompt requires symbol-aware work, including code actions, to use `lsp` when a server is available. Returning titles without `WorkspaceEdit` trains that path to do nothing. Authoring/mutation is a later product stage. [ASSUMED] pending TASK-1 live probe of the pinned agent prompt.

**Decision:** This stage does not advertise `codeAction`. Empty list on `textDocument/codeAction`.

## RF-15: Host fileTypes `.md` is wider than `.specs/**`

Plugin `fileTypes: [".md", ".feature"]` will deliver README and other project Markdown to the server. Indexing them would violate `spec-kernel:FR-7` containment. [ASSUMED] pending TASK-1 probe of OMP fileType routing.

**Decision:** Out-of-scope `.md` is an empty no-op: no diagnostics, no fake outline.


## RF-16: Deleting MCP tools vs routing the agent

This product's MCP registry is eight query tools (`spec-kernel:FR-9`, `src/mcp/server.js`). Issue #7's 46 tools are upstream `dev-pomogator`. Neither set can be **deleted** without losing an ID-based or corpus-wide API that LSP does not provide.

Options that do **not** regress:

| Surface | Delete MCP tool? | What to do instead |
|---|---|---|
| Cursor navigation (definition, references, outline, completion) | No. `spec_get_node` / `spec_find_nodes` / `spec_get_edges` are ID queries without a buffer position. | After LSP works, the agent MUST use `lsp` for cursor work (OMP prompt already says so). Keep MCP for "look up `spec-kernel:FR-9` by id". |
| Post-write diagnostics | No. `spec_diagnostics` is whole-corpus without opening files. | Host `lsp.diagnosticsOnWrite` covers the edit loop. Keep MCP for "diagnose the corpus now". |
| Domain (`spec_trace`, `spec_overview`, `spec_inventory`, `spec_markdown_inventory`) | No. No LSP primitive. | Keep. |
| Upstream mutations (~22 tools in the 46-tool door) | No. `workspace/applyEdit` would skip the authoring door. | Not in this product. |
| Upstream extras that duplicate LSP (`find_refs`, symbol `search`) | Not in this product. If they existed here, hide from the default agent prompt after LSP proof; do not delete until an ID API remains. | N/A here. |

**Decision:** There is a path without regression: **route**, don't **delete**. This spec does not shrink the eight MCP tools. [VERIFIED] against `src/mcp/server.js` and `spec-kernel:FR-9`.


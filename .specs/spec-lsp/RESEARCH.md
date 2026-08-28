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

## RF-8: Agent-facing spec API is MCP; LSP is not an agent tool

OMP's coding agent has a built-in `lsp` tool. That is a **host** capability. This product's spec-generator port SHALL NOT put spec work on that tool. The agent SHALL call the MCP server. LSP may run so MCP (and the editor) can consume kernel diagnostics/navigation. [VERIFIED] product intent 2026-08-28; the earlier "route the agent to lsp" note is withdrawn.

**Decision:** Do not advertise spec LSP to the agent.

## RF-9: Eight MCP tools are the first slice, not the destination

`src/mcp/server.js` maps eight SCHEMA-11 tools because `spec-kernel:FR-8` froze the first kernel slice so v0.2/v0.3 could ship. The destination is the spec-generator door ported to OMP. See RF-16 and spec-kernel FR-16. [VERIFIED]

**Decision:** Do not freeze the registry at eight. Grow MCP as kernel FR-16 and authoring land. Do not delete the eight.

## RF-10: Step bindings live in the kernel (FR-15), not in LSP

`spec-kernel:FR-15` adds `STEP_BINDING` / `BINDS_STEP` over allowlisted `tests/step-definitions`. Until `CHK-FR15-01` PASS, LSP emits no step diagnostics. After PASS, LSP/MCP map kernel diagnostics only. [VERIFIED]

**Decision:** Kernel first (TASK-12), then spec-lsp TASK-12.


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


## RF-16: Why "8 tools" was the wrong ceiling

`src/mcp/server.js` currently exposes eight SCHEMA-11 tools because `spec-kernel:FR-8` froze the first kernel slice. That is an **implemented first slice**, not the product destination. The destination is the `dev-pomogator` spec-generator MCP door ported to OMP.

The canonical 46-name census (owners, stages, first-slice vs later, no silent DROP) is [`docs/decisions/spec-generator-port.md`](../../docs/decisions/spec-generator-port.md). Do not maintain a second mapping in this spec.

**v0.3 first slice (keep forever; these are not `list_specs` / full `get_spec_status`):**

| v0.3 MCP name | Closest upstream name | Note |
|---|---|---|
| `spec_inventory` | *(none of the 46)* | First-slice corpus inventory. `list_specs` is later FR-16, not this tool. |
| `spec_get_node` | `get_node` | |
| `spec_find_nodes` | `search` | |
| `spec_get_edges` | `find_refs` | |
| `spec_trace` | `get_trace` | |
| `spec_diagnostics` | `conformance_check` | |
| `spec_overview` | `get_spec_status` (partial) | Full status/coverage views are later FR-16 `get_spec_status` beside this tool. Do not delete `spec_overview`. |
| `spec_markdown_inventory` | *(none of the 46)* | Kernel-only first slice. |

Later growth (still MCP, still agent-visible) is owned by kernel FR-16, kernel FR-17, `spec-evidence`, and `spec-authoring-workflow` as tabulated in that decision. `create_spec` / `archive_spec` / backlog helpers are later-authoring-v2, not DROP.

**Decision:** Do not delete MCP tools. Grow MCP as kernel FR-16/FR-17, evidence, and authoring land. LSP never replaces MCP for the agent. [VERIFIED] against `docs/decisions/spec-generator-port.md`.


## RF-17: MCP consumes LSP; the agent does not

Issue #7 proposed moving navigation MCP tools into LSP so the **agent** would use `lsp`. That contradicts the generator port: the agent must keep one door (MCP). Navigation tools stay on MCP; their **implementation** may call LSP/kernel. [VERIFIED] user correction 2026-08-28.

**Decision:** spec-lsp FR-1 — LSP invisible to the agent.



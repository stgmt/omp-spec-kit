# Research

## RF-1: OMP is an LSP-native host

OMP's coding agent has a built-in `lsp` tool whose operation enum and lifecycle are documented at the pinned [LSP tool guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/tools/lsp.md). The pinned [settings guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/settings.md), [marketplace guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md), and [LSP configuration guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/lsp-config.md) define diagnostics-on-write, plugin `lspServers`/`.lsp.json`, configuration fields, lazy start, and shared broker behavior for the v17.3.7 implementation pin. These immutable URLs replace non-reproducible local `docs/...` shorthand. [VERIFIED against pinned bytes; runtime behavior remains a TASK-1 probe obligation]

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

The delivered baseline and current LSP profile are read-only. Advertising codeAction while returning no applicable WorkspaceEdit creates a dead host path; returning an edit would bypass the authoring MCP authority. [VERIFIED product boundary]

**Decision:** current profile advertises no codeAction and direct requests return an empty list. Any future repair suggestion belongs to authoring MCP, not LSP.

## RF-5: Incremental re-evaluation budget

The current kernel exposes a bounded full snapshot build, not an accepted incremental API. The prior 150 ms value is retained only as informational research provenance.

**Decision:** didSave uses the existing full rebuild and records p95 without a pass/fail threshold. Incremental behavior and a hard budget require a separate accepted kernel profile.

## RF-6: Honest absence over degraded fake resolution

The upstream `dead-integration-guard` lesson: "installed ≠ integrated." When the kernel graph is unavailable (build failure, not yet loaded, corrupted), the adapter must explain why rather than returning plausible-looking but fabricated navigation or diagnostic results. This is the same posture as `spec-kernel:FR-6` fail-closed diagnostics.

## RF-7: OMP lsp.shared broker semantics

OMP's `lsp.shared` broker manages one server per project across local sessions. The adapter must be compatible with this sharing model: it must not hold exclusive locks, must handle concurrent clients, and must not assume single-session ownership. Locks for future mutation belong to the kernel, not the adapter.

**Evidence obligation:** TASK-1 probes must verify shared-broker compatibility with the pinned OMP runtime.

## RF-8: Agent-facing spec API is MCP; LSP is not an agent tool

OMP's coding agent has a built-in `lsp` tool. That is a **host** capability. This product's spec-generator port SHALL NOT put spec work on that tool. The agent SHALL call the MCP server. LSP may run so MCP (and the editor) can consume kernel diagnostics/navigation. [VERIFIED] product intent 2026-08-28; the earlier "route the agent to lsp" note is withdrawn.

**Decision:** Do not advertise spec LSP to the agent.

## RF-9: Eight MCP tools are the first slice, not the destination

`src/mcp/server.js` maps eight SCHEMA-11 tools because `spec-kernel:FR-8` froze the first kernel slice so v0.2/v0.3 could ship. The destination is the spec-generator door ported to OMP. See RF-16 and the exact ownership map: kernel FR-16 graph queries, kernel FR-17 document/preflight adapter I/O, `spec-evidence` result reads, and `spec-authoring-workflow` mutations. [VERIFIED]

**Decision:** Do not freeze the registry at eight. Grow MCP only through those owners. Do not delete the eight.

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



# Research

## RF-1: OMP is an LSP-native host

OMP's coding agent has a built-in `lsp` tool with 14 operations including diagnostics, navigation, symbols, rename, code actions, and raw requests (`docs/tools/lsp.md`). The default setting `lsp.diagnosticsOnWrite = true` triggers automatic diagnostic polling after every write/edit (`docs/settings.md`). Plugins register LSP servers through the `lspServers` manifest field, which produces `.lsp.json` at install time (`docs/marketplace.md`). Configuration uses `<project>/.omp/lsp.json` or `<project>/.lsp.json` with `{command, args, fileTypes, languageId, initOptions}` shape (`docs/lsp-config.md`). Lazy start (`lsp.lazy = true` default) and shared broker (`lsp.shared = true` default) are host-managed (`docs/settings.md`).

**Implication:** The host provides the diagnostic-push, lifecycle, and multi-session machinery. The adapter need only implement the LSP protocol correctly; no custom hook, daemon, or push mechanism is required.

**Evidence obligation:** TASK-1 live probes must confirm each cited behavior against the pinned OMP runtime before implementation.

## RF-2: Third-party Markdown LSP servers cannot serve typed spec graphs

Candidates evaluated: Marksman (F#), zk (Go), markdown-oxide (Rust), Foam/Dendron (VS Code extensions). All resolve only heading-slug wiki-links and understand none of: typed nodes (FR/AC/Scenario/Task/Evidence), typed edges (`covers`/`tested-by`/`implements`), composite IDs `<slug>:<localId>`, coverage, or evidence freshness. Upstream `dev-pomogator` recorded the dual-anchor-registry lesson: graph aliases ≠ heading slugs, requiring a validation shim (`validate_anchor`) to distinguish them. Forking introduces a foreign stack maintenance burden (upstream RESEARCH rejected F# for this reason).

**Decision:** No third-party Markdown LSP server is adopted. The custom adapter serves both layers from one kernel.

**MIGRATION_MATRIX reference:** FR-7 DROP (Marksman plugin), FR-27 DROP (Marksman binary supply chain). These decisions stand and are not reversed by this specification.

## RF-3: Step layer centralization avoids dual-index divergence

The official `@cucumber/language-server` provides step-definition matching using `@cucumber/gherkin` (parser) and `@cucumber/cucumber-expressions` (matcher). Registering it as a second process alongside the custom spec server would create two indexes over the same `.feature` files with divergent answers — repeating the upstream dual-anchor-registry lesson in a new domain. Additional risks: configuration conflicts (the official server's glue-code discovery paths differ from the kernel builder's); multi-runner silence (the official server does not know pytest-bdd, producing either silence or incorrect "undefined" verdicts); and lifecycle duplication (two processes to race-test against real OMP).

**Decision:** Bundle `@cucumber/gherkin` and `@cucumber/cucumber-expressions` as JS libraries inside the custom server. Use the kernel's existing `StepBinding` nodes and `step-binding` edges for step decisions. Retain `@cucumber/language-server` only as a test-infrastructure oracle.

**Distribution note:** These are JS libraries, not binaries. No supply-chain concern analogous to the Marksman DROP applies. Standard bundle-with-dependency-check discipline per `spec-kernel:FR-10` posture suffices.

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

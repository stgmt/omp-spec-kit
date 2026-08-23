# Research

## Hypotheses formulated before research

| ID | Hypothesis | Expected proof | Fallback |
|---|---|---|---|
| H1 | OMP prefers one root `.omp-plugin/marketplace.json` and supports a relative child source. | Official marketplace guide plus official example. | `[UNVERIFIED]` and block catalog design. |
| H2 | Installed plugin extensions are declared by child `package.json#omp.extensions`. | Marketplace and extension-loading guides plus official example. | `[UNVERIFIED]` and block manifest design. |
| H3 | Installation/reload and extension activation are distinct lifecycle stages. | Official marketplace lifecycle text and loader model. | `[UNVERIFIED]` and require runtime experiment. |
| H4 | Extension factories register tools during load and runtime actions are unavailable then. | Official extensions guide and loader contract. | `[UNVERIFIED]` and forbid implementation. |
| H5 | Catalog/package schema and release update semantics are exhaustive enough in current docs for v0.1.0. | Field tables, source formats, example bytes, and loader docs. | `[SINGLE_SOURCE]`; encode a closed product profile and pin OMP before implementation. |

## Findings

### R-1 — Marketplace location, identity, and source

`[VERIFIED: official marketplace guide + official mini-marketplace layout/example]`

The marketplace guide states: “A marketplace catalog lives at `.omp-plugin/marketplace.json` in the repository root” and says to prefer this path when OMP is the only consumer. It also requires relative string sources to start with `./` and resolve inside the marketplace root. The official mini-marketplace independently demonstrates one catalog, one relative child plugin, and one child package.

Implication: this product uses only `.omp-plugin/marketplace.json`, contains one plugin entry, and fixes its source to `./plugins/omp-spec-kit`. The Claude-compatible fallback catalog is intentionally absent.

### R-2 — Catalog fields and updates

`[SINGLE_SOURCE: official marketplace guide; implementation confirmation required at pinned OMP commit]`

The marketplace guide enumerates required top-level fields (`name`, `owner.name`, `plugins`), optional `metadata.description`, `metadata.version`, `metadata.pluginRoot`, and the plugin-entry surface. It states: “`/marketplace update [name]` refreshes catalogs only; it does not reinstall plugins,” while `plugin upgrade` performs installation changes.

Implication: the product defines a closed v0.1.0 catalog profile in `plugin-distribution_SCHEMA.md`, uses an explicit entry version, and proves update and upgrade separately. Fields accepted by upstream OMP but unused here are enumerated and forbidden by the product profile rather than silently ignored.

### R-3 — Child manifest and extension discovery

`[VERIFIED: marketplace guide + extension-loading guide + official example package]`

The marketplace guide says marketplace installs load modules declared by `package.json` `omp.extensions`. The loader guide says installed-plugin extension entries come from `omp.extensions`/legacy `pi.extensions`, resolve relative to the package, and support explicit `.js` entries. The example package contains an `omp.extensions` array.

Implication: one child `package.json` declares exactly one entry, `./dist/extension.js`. The legacy `pi` key and nested package manifests are forbidden.

### R-4 — Reload is not fresh-session extension proof

`[VERIFIED: marketplace lifecycle guide + extension-loading guide + extensions runtime guide]`

The marketplace guide states that TUI mutations “do not refresh the active session,” `/reload-plugins` refreshes skills, commands, and MCP servers, and a session restart is required for tools, hooks, or extension modules. The loading guide describes installed plugin entries as startup discovery input. The extensions guide describes import/factory execution before runner initialization.

Implication: evidence records reload and fresh-session activation as different observations. A tool invoked only after reload in the pre-install session is not accepted as proof.

### R-5 — Registration-only factory

`[VERIFIED: extensions guide + extension-loading factory contract + official example architecture]`

The extensions guide states: “register first; perform runtime behavior from events/commands/tools” and documents `pi.registerTool`. The loading guide requires a default factory function and isolates per-path load errors.

Implication: the one factory may register `spec_inventory` and labels only. It must not scan `.specs`, write, spawn, call the network, call a model, or send session messages during load.

### R-6 — Public schema uncertainty

`[SINGLE_SOURCE]`

No separate OMP-owned JSON Schema for child `package.json#omp` was established from the cited documentation. The catalog example references an Anthropic marketplace schema, while OMP documents extra runtime behavior. The exact structured tool-result `details` stability across OMP versions is also not declared as a compatibility guarantee in these sources.

Implication: implementation must pin an exact OMP release/commit, validate the documented fields against that implementation, and keep `details` additive while treating textual content as human-facing. Release is blocked until this compatibility experiment is captured.

## Exhaustive researched surfaces

The complete product profiles, including every documented catalog plugin-entry field and every public inventory request/result field, are enumerated in [plugin-distribution_SCHEMA.md](plugin-distribution_SCHEMA.md). No omitted field is implicitly accepted by this specification.

## Sources and provenance

1. OMP marketplace guide: https://github.com/can1357/oh-my-pi/blob/main/docs/marketplace.md
2. Official mini-marketplace: https://github.com/can1357/oh-my-pi/tree/main/docs/skills/examples/mini-marketplace
3. OMP extensions guide: https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md
4. OMP extension-loading guide: https://github.com/can1357/oh-my-pi/blob/main/docs/extension-loading.md
5. Validated migration decisions: [repository decision record](../../docs/decisions/omp-spec-kit-public-init.md)
6. Pinned upstream provenance inputs, when populated by the repository bootstrap: `IMPORT_MANIFEST.yaml`, `MIGRATION_MATRIX.md`, and `docs/upstream/dev-pomogator/`

The plan and generated specification documents are decision/provenance inputs, not independent confirmation of OMP behavior.

## Re-research triggers

Recheck all upstream claims before implementation when OMP is pinned, when the catalog parser or extension loader changes, when a second public capability is proposed, or when the GitHub Actions release environment changes. Unresolved items remain release blockers rather than assumptions promoted to facts.

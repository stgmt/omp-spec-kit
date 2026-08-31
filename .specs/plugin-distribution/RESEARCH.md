# Research

## Findings used by this contract

### R-1 — Relative marketplace children are supported

`[VERIFIED: pinned OMP marketplace guide + mini-marketplace example]`

OMP locates a catalog at `.omp-plugin/marketplace.json` and supports relative child sources beginning with `./`. This product selects `omp-spec-kit` at `./plugins/omp-spec-kit`; OMP remains the authority for other accepted catalog fields.

### R-2 — Installed extensions come from the child manifest

`[VERIFIED: pinned marketplace guide + extension-loading guide + example package]`

Installed plugin entries are resolved from the child package's `omp.extensions`. This product checks only its candidate version and contained `./dist/extension.js`; it does not copy OMP's complete manifest grammar into this specification.

### R-3 — Reload is not activation

`[VERIFIED: pinned marketplace lifecycle + extension-loading guide]`

Catalog update, plugin installation, `/reload-plugins`, and extension activation are distinct. A fresh session invoking the installed candidate is the release proof boundary.

### R-4 — Relative child sources are recursively copied

`[VERIFIED: pinned marketplace guide + cache implementation]`

OMP v17.3.7 recursively copies the selected child. Therefore the child is a closed public payload, and source/test/evidence files or links must not enter it.

### R-5 — Host and runtime schemas have separate owners

`[VERIFIED for the v17.3.7 smoke; compatibility beyond the pin is not assumed]`

OMP owns marketplace, extension, and MCP parsing. The kernel owns read-only request/result/error semantics. Distribution validates compatibility by installing and invoking the tagged bytes against the supported OMP pin, not by maintaining parallel exhaustive schemas.

## Pinned sources

1. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md
2. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md
3. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extension-loading.md
4. https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/extensibility/plugins/marketplace/cache.ts
5. https://github.com/can1357/oh-my-pi/tree/8500092296621a6826b7136e840f8a59ea338958/docs/skills/examples/mini-marketplace
6. `docs/omp-v17.3.7-contract.md`
7. `IMPORT_MANIFEST.yaml`, `MIGRATION_MATRIX.md`, and `docs/upstream/dev-pomogator/`

Re-run the installed smoke when the OMP pin, catalog loader, extension loader, MCP manager, child entrypoints, or release workflow changes.

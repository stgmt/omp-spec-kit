# omp-spec-kit

`omp-spec-kit` v0.3.2 provides one bounded read-only OMP tool, `spec_inventory`, and an eight-tool read-only MCP surface over the active project specification corpus. That eight-tool MCP surface is the current v0.3 first slice, not the destination generator-port door. It does not write, repair, or claim a specification is complete.

## Use

Install at project scope, reload plugin metadata, then start a fresh OMP session. MCP tools read the project from which that fresh OMP session starts; the package launcher locates only its packaged server code and does not select the data root.

`OMP_SPEC_KIT_ROOT` is optional diagnostic configuration. Only an explicit absolute value is accepted; a missing, relative, placeholder, or bare variable name leaves the active project as the root.

Every MCP `QueryEnvelope` and OMP `spec_inventory` result includes `provenance` with the fixed server name, opaque resolved/active root IDs, `rootMode`, and `matchesActiveProject`. An explicit absolute override is allowed for diagnostics but is reported as `explicit-absolute-override` with `matchesActiveProject: false`; absolute paths and environment values are never returned.

The command `/spec-inventory` and skill `spec-inventory` provide guidance only. They do not implement another scanner or runtime.

## v0.3.0 advisory

v0.3.0 MCP results can use package cwd rather than active project cwd. See [the advisory](../../docs/advisories/v0.3.0-mcp-root.md). Upgrade to v0.3.2, reload plugin metadata, and start a fresh OMP session.

## Compatibility

This payload targets OMP v18.0.10 at immutable commit `33cc6b9a043a74e00a157e72ca909272796d8461`.

Update the project-scoped plugin with the marketplace lifecycle, reload plugins, and restart OMP before checking `tools/list`.

License: MIT.

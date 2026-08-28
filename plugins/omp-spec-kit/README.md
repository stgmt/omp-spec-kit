# omp-spec-kit

`omp-spec-kit` v0.3.2 provides one bounded read-only OMP tool, `spec_inventory`, and an eight-tool read-only MCP surface over the active project specification corpus. That eight-tool MCP surface is the current v0.3 first slice, not the destination generator-port door. It does not write, repair, or claim a specification is complete.

## Use

Install at project scope, reload plugin metadata, then start a fresh OMP session. MCP tools read the project from which that fresh OMP session starts; the package launcher locates only its packaged server code and does not select the data root.

`OMP_SPEC_KIT_ROOT` is optional diagnostic configuration. Only an explicit absolute value is accepted; a missing, relative, placeholder, or bare variable name leaves the active project as the root.

The command `/spec-inventory` and skill `spec-inventory` provide guidance only. They do not implement another scanner or runtime.

## v0.3.0 advisory

v0.3.0 MCP results can use package cwd rather than active project cwd. See [the advisory](../../docs/advisories/v0.3.0-mcp-root.md). Upgrade to v0.3.2, reload plugin metadata, and start a fresh OMP session.

## Compatibility

This payload targets OMP v17.3.7 at commit `8500092296621a6826b7136e840f8a59ea338958`.

License: MIT.

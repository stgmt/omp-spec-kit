# omp-spec-kit

`omp-spec-kit` v0.4.0 candidate provides one bounded read-only OMP tool, eight bounded read-only MCP tools, and exactly two proposal-first MCP authoring tools: `propose_patch` and `apply_proposed_patch`. Only an approved, hash-checked apply can write specification bytes.

## Use

Install at project scope, reload plugin metadata, then start a fresh OMP session. MCP tools read the project from which that fresh OMP session starts; the package launcher locates only its packaged server code and does not select the data root.

`OMP_SPEC_KIT_ROOT` is optional diagnostic configuration. Only an explicit absolute value is accepted; a missing, relative, placeholder, or bare variable name leaves the active project as the root.

Every MCP `QueryEnvelope` and OMP `spec_inventory` result includes `provenance` with the fixed server name, opaque resolved/active root IDs, `rootMode`, and `matchesActiveProject`. An explicit absolute override is allowed for diagnostics but is reported as `explicit-absolute-override` with `matchesActiveProject: false`; absolute paths and environment values are never returned.

The command `/spec-inventory` and skill `spec-inventory` provide guidance only. They do not implement another scanner or runtime.

## Managed (remote) mode

The shipped `.mcp.json` declares the local stdio server — the mode for **unmanaged** checkouts. In a
managed project the canonical corpus lives in the specs repository and is served by the registry, so
the client must reach the endpoint instead of spawning a local server. Add an OMP-native definition
named `omp-spec-kit` — in the project's `.omp/mcp.json` (committed, so every checkout is managed) or
in the active profile's user config — using `config/omp-managed.mcp.json.example` as the template:

```json
{
  "mcpServers": {
    "omp-spec-kit": {
      "type": "http",
      "url": "${OMP_SPEC_REGISTRY_URL}",
      "headers": { "Authorization": "Bearer ${OMP_SPEC_REGISTRY_TOKEN}" }
    }
  }
}
```

OMP resolves that definition ahead of this package's declaration (native config precedes extension
packages; the first definition wins and duplicate names are not merged), so the local server is
retired for the project without changing the shipped payload. Both variables are read from the
environment when the config is loaded; the token is the caller's verified YouTrack token — the
service issues and stores none of its own. `scripts/probe-managed-remote.mjs` asserts this
resolution and proves it behaviourally.

On hosts with a global HTTP proxy, add the endpoint host to `NO_PROXY` (`127.0.0.1,localhost` for a
local stack): the runtime routes HTTP through the proxy otherwise and the connection times out.

## v0.3.0 advisory

v0.3.0 MCP results can use package cwd rather than active project cwd. See [the advisory](../../docs/advisories/v0.3.0-mcp-root.md). Upgrade to the candidate, reload plugin metadata, and start a fresh OMP session.

## Compatibility

This payload targets OMP v18.0.11 at immutable commit `33cc6b9a043a74e00a157e72ca909272796d8461`.

Update the project-scoped plugin with the marketplace lifecycle, reload plugins, and restart OMP before checking `tools/list`.

License: MIT.

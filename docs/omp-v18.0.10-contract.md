# OMP v18.0.10 compatibility contract

Status: current compatibility baseline for `omp-spec-kit` v0.3.2.

## Immutable runtime identity

- OMP release: `18.0.10`
- Tag commit: `33cc6b9a043a74e00a157e72ca909272796d8461`
- Package engine requirement: `18.0.10`
- MCP schema URL: `https://raw.githubusercontent.com/can1357/oh-my-pi/33cc6b9a043a74e00a157e72ca909272796d8461/packages/coding-agent/src/config/mcp-schema.json`

The historical `docs/omp-v17.3.7-contract.md` remains a frozen receipt for the earlier release line. It is not evidence for this profile.

## Integration boundary

The plugin has one extension entry and one stdio MCP server. The server is launched from the packaged `bin/omp-spec-kit-mcp` path; repository data comes from the active OMP project working directory unless an explicit absolute diagnostic override is supplied.

The v18.0.10 source contract exposes the following host-owned MCP metadata before an extension event is constructed:

- `MCPToolDefinition._meta` is available on the protocol tool definition.
- `MCPServerConnection._source` retains provider, provider display name, source path, and scope metadata.
- `MCPTool` retains the registered MCP server name and original source tool name.
- `ToolCallEvent` and `ToolResultEvent` are dispatched by the extension runner before and after tool execution.

The base release does not claim an authority envelope or a selected-plan approval event. Those are separate candidate changes in the pinned upstream worktree and require their own source and behavior receipts before an authority-dependent plugin profile can be published.

## Current plugin behavior

The v0.3.2 profile preserves the eight read-only MCP names:

`spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`.

No current profile uses OMP LSP as an agent-facing spec API. No current profile permits direct specification writes.

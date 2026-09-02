# OMP v18.0.11 Extension Authority Contract & Access Gate Analysis

- **Date**: 2026-09-02
- **Target Release**: omp-spec-kit v0.6.0
- **Runtime Reference**: `@oh-my-pi/pi-coding-agent` v18.0.11 pinned in `tests/fixtures/omp-discovery-runtime` (commit `33cc6b9a043a74e00a157e72ca909272796d8461`)
- **Status**: Verified Grounded Source Contract; Replaces Synthetic ABI Speculations

---

## 1. Grounded Event Contract: ToolCallEvent

In the pinned release runtime `@oh-my-pi/pi-coding-agent` v18.0.11 (`src/extensibility/extensions/types.ts:930-978`), `tool_call` events carry only:

```typescript
interface ToolCallEventBase {
  type: "tool_call";
  toolCallId: string;
}

export type ToolCallEvent =
  | BashToolCallEvent
  | ReadToolCallEvent
  | EditToolCallEvent
  | WriteToolCallEvent
  | GrepToolCallEvent
  | GlobToolCallEvent
  | CustomToolCallEvent;
```

Each event variant provides `toolName: string` and `input: Record<string, unknown>`.

**Crucial Finding**:
There is **NO `event.authority`** object on host-emitted events in the pinned runtime. Any check in extension code expecting `event.authority` is checking a synthetic phantom property that never exists at runtime in real OMP sessions. Consequently, any code relying on `event.authority` to grant access will either fail closed (blocking legitimate calls) or require unsafe fallbacks.

---

## 2. Fail-Closed Enforcement Semantics: emitToolCall

In `src/extensibility/extensions/runner.ts:1457-1498`:

1. **Explicit Block**: If a handler returns `{ block: true, reason: string }`, tool execution halts immediately and the reason is returned to the agent loop / LLM.
2. **Handler Timeout**: If a handler exceeds `extensionHandlers.toolCallTimeoutMs`, `#runHandlerWithTimeout` returns `{ block: true, reason: "Extension ... timed out" }`.
3. **Handler Exception**: If a handler throws an unhandled error, `#runHandlerWithTimeout` returns `{ block: true, reason: "Extension ... failed: <error>" }`.
4. **Cancellation**: If `signal.aborted` fires while a handler is running, execution blocks with `{ block: true, reason: "Tool execution was cancelled..." }`.

Conclusion: The OMP extension `tool_call` hook is strictly fail-closed by construction. Any failure or rejection reliably blocks tool execution.

---

## 3. Tool Discovery and Provenance: pi.getAllTools()

In `src/extensibility/extensions/types.ts:691-705` and `src/session/session-tools.ts:542-558`:

`pi.getAllTools()` returns `ToolInfo[]`:

```typescript
export interface ToolInfo {
  name: string;
  description: string;
  parameters: TSchema;
  promptGuidelines?: string[];
  sourceInfo: SourceInfo;
}

export interface SourceInfo {
  path: string;
  source: "builtin" | "extension" | "mcp" | "sdk";
  scope: "temporary" | "permanent";
  origin: "top-level" | "delegated";
}
```

How `session-tools.ts` computes `sourceInfo`:
- `source`:
  - `"builtin"` if `#builtInToolNames.has(name)`
  - `"mcp"` if `isMCPToolName(name)` (i.e. name starts with `mcp__`)
  - `"sdk"` if `#rpcHostToolNames.has(name)`
  - `"extension"` otherwise
- `path`:
  - `registeredFilesystemSourcePath(runner, name)` if the tool is registered via an extension (`runner.getRegisteredTool(name)`)
  - Otherwise `<${source}:${name}>`, e.g. `<mcp:mcp__omp_spec_kit_spec_inventory>`

**Implication for Trust and Spoof Defense**:
1. An extension registering a tool directly with `pi.registerTool({ name: "mcp__omp_spec_kit_..." })` will have `registeredFilesystemSourcePath(...)` returning the extension file path on disk (e.g. `/path/to/extension.js`).
2. An authentic MCP tool loaded through `MCPManager` is not in `runner.getRegisteredTool(...)`, so its `sourceInfo.path` is strictly `<mcp:${toolName}>`.
3. Therefore, validating both `sourceInfo.source === "mcp"` AND `sourceInfo.path === \`<mcp:\${toolName}>\`` verifies that the tool was minted by OMP's MCP infrastructure, not registered as a spoof by a direct user extension.

---

## 4. MCP Tool Minting Namespaces

In `src/mcp/tool-bridge.ts:388-410`:

```typescript
export function createMCPToolName(serverName: string, toolName: string): string {
  const sanitizedServerName = sanitizeMCPToolNamePart(serverName, "server");
  const sanitizedToolName = sanitizeMCPToolNamePart(toolName, "tool");
  const prefixWithUnderscore = `${sanitizedServerName}_`;
  let normalizedToolName = sanitizedToolName;
  if (sanitizedToolName.startsWith(prefixWithUnderscore)) {
    normalizedToolName = sanitizedToolName.slice(prefixWithUnderscore.length);
  }
  return capMCPToolNameLength(`mcp__${sanitizedServerName}_${normalizedToolName}`);
}
```

Depending on deployment, OMP configures MCP servers in one of two canonical naming schemes:
1. **Direct project `.mcp.json` / standalone configuration**:
   - `serverName` = `"omp-spec-kit"`
   - Tool name prefix: `mcp__omp_spec_kit_<operation>`
2. **Marketplace plugin enrollment**:
   - OMP namespaces plugin MCP servers as `<pluginName>:<serverName>`, i.e. `"omp-spec-kit:omp-spec-kit"`
   - Sanitized name: `omp_spec_kit_omp_spec_kit`
   - Tool name prefix: `mcp__omp_spec_kit_omp_spec_kit_<operation>`

**Access Gate Rules for v0.6.0**:
- Build both candidate families of 49 tools using `createMCPToolName`.
- In `pi.getAllTools()`, exactly ONE complete family must be present, and ZERO members of the competing family.
- If both or neither or only a partial set is present, classification returns `AMBIGUOUS_TOOL_AUTHORITY` and fail-closes on any `.specs` access.
- Any raw short name (e.g. `spec_inventory`, `apply_proposed_patch`, `write`, `edit`, `bash`) is unconditionally denied access to `.specs/**`.

---

## 5. Summary of Architectural Decisions for v0.6.0

1. **Delete all direct tools from `src/v0.1/extension.js`**:
   The extension registers 0 tools and 1 hook (`registerSpecEnforcement`).
2. **Remove dead files**:
   - `src/v0.1/inventory.js` (854-line direct tool implementation)
   - `src/adapters/omp/register-spec-tools.js` (direct tool bridge)
3. **Purge synthetic `event.authority`**:
   Replace all occurrences in classifier and step definitions with verified `pi.getAllTools()` MCP-provenance checks.
4. **Maintain Fail-Closed Invariants**:
   Every path reaching `.specs/**` outside an authentic `mcp__omp_spec_kit_*` tool execution is blocked.

# MCP UX contract grounding (2026-09-04)

## Scope

This report grounds the two-phase MCP UX change in the repository's current server, adapter, tests, and pinned OMP runtime contracts. It is an implementation evidence record, not a second specification.

## MCP protocol contract

- `Tool` metadata: MCP schema source `Tool`/`ToolAnnotations` definitions. The implementation target is the top-level `title`, `annotations`, `description`, `inputSchema`, and `outputSchema` fields; `title` is not nested inside `annotations`.
- `ToolAnnotations`: four advisory boolean hints: `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`.
- `InitializeResult.instructions`: the optional server-provided instruction string belongs in the `initialize` result beside `protocolVersion`, `capabilities`, and `serverInfo`.
- Tool results: successful and failed calls use `content`, `structuredContent`, and `isError`; tool errors remain application-level results so the model can observe and recover.

## Pinned OMP source and runtime versions

The repository's installed/discovery source is pinned to `@oh-my-pi/pi-coding-agent` 17.3.7. The repository's discovery fixture/probe is pinned to OMP 18.0.11. The active machine executable reports OMP 18.1.6. These are distinct evidence sources: static compatibility is grounded in the pinned source; 18.0.11 compatibility is proved only by its existing pinned manager scenario; 18.1.6 compatibility requires a fresh executable end-to-end run. The pinned `probe-omp-discovery-v18.0.11.mjs` remains named for its actual version and must not be presented as an 18.1.6 test.

Relevant pinned OMP source anchors:

- `@oh-my-pi/pi-coding-agent/src/mcp/types.ts:196-201` — client-facing MCP initialize/result type contracts, including optional initialize instructions and structured tool result fields.
- `@oh-my-pi/pi-coding-agent/src/mcp/client.ts:176-178` — initialize result handling and server instructions availability.
- `@oh-my-pi/pi-coding-agent/src/mcp/manager.ts:1384-1394` — manager discovery/registration handling for tool metadata.
- `@oh-my-pi/pi-coding-agent/src/tools/xdev.ts:260-264` — external tool description budget/cap, including the 200-character first-line constraint used by the port check.

## Repository implementation anchors

- `src/adapters/tool-contracts.js:43-400` — the fixed ordered 38-tool contract table; labels, descriptions, operations, and input fields are centralized here.
- `src/adapters/tool-contracts.js:401-430` — input JSON Schema projection.
- `src/adapters/tool-contracts.js:488-490` — the sole mutating MCP tool name, `apply_proposed_patch`.
- `src/mcp/server.js:152-158` — current tool-result conversion; `spec_inventory` currently uses a lossy text summary while other tools serialize the envelope.
- `src/mcp/server.js:175-201` — current initialize and tools/list responses; initialize has no instructions and tools/list emits only `readOnlyHint`.
- `src/adapters/query-service.js:133-214` — canonical success/error envelope factories.
- `src/adapters/query-service.js:395-401` — authoring error normalization into the canonical envelope.
- `src/adapters/query-service.js:470-486` — current `summarizeEnvelope` helper, removable after all callers use the exact text mirror.
- `src/enforcement/classifier.js:142-158` — bounded, sanitized protection-gate refusal reason construction.
- `src/authoring/service.js:265-282` — apply replay identity: the same `requestId` and payload return the prior response without a second effect; a different payload yields `CONFLICT`.

## Test and release anchors

- `scripts/check-spec-port.mjs:21-32` — existing 35-row port census and 38-tool surface count.
- `scripts/dogfood-mcp.mjs` — direct candidate-server JSON-RPC dogfood.
- `tests/helpers/tool-e2e.mjs:34-83` — shared direct MCP test helper and result parsing.
- `tests/features/staged-mcp.feature` and `tests/step-definitions/staged-mcp.steps.mjs:367-416` — staged MCP behavior scenarios.
- `tests/features/safe-authoring.feature` and corresponding step definitions — protection-gate behavior.
- `scripts/smoke-release-archive.mjs:17-37,72-110` — unpacked release archive smoke path.
- `scripts/docker-bdd.sh` — Docker BDD fixture recapture/verifier entrypoint.

## Decisions fixed by this implementation

- All 38 tools publish exactly four boolean annotations. The 37 non-mutating/proposal tools use `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`. `apply_proposed_patch` uses `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`, `openWorldHint: false`; destructive is required because the proposal operations can delete, rename, or archive, while idempotence follows from replay identity.
- `title` is the top-level MCP tool title and equals the contract label.
- The initialize instructions are one fixed paragraph and carry cross-tool workflow rules; duplicated descriptions retain tool-specific purpose only.
- Recovery guidance is added once at the public MCP envelope boundary for `STALE_CURSOR` and `CONFLICT`; `TARGET_INDETERMINATE` remains a separate bounded protection-gate refusal with its own explicit recovery line.
- One shared output schema declares only stable envelope fields; heterogeneous nested payloads remain open. The text content is the exact JSON serialization of the same envelope placed in `structuredContent` for every tool, including `spec_inventory`.
- No new tool names, aliases, compatibility stages, retirement maps, client-specific metadata, or client filtering are introduced.

# Research

## Scope and method

This research combines (1) installed OMP `pi-coding-agent@17.3.7` source pinned by `docs/omp-v17.3.7-contract.md`, (2) source FR-39 as migration provenance, and (3) accepted `spec-authoring-workflow`/product contracts. OMP claims require TASK-1 live receipts. FR-39 remains DEFER: this spec may enforce access and recognize the sanctioned authoring MCP authority, but it does not import or claim the source persistent audit implementation.

## RF-1: OMP hook events provide sufficient interception surfaces

**Finding:** The OMP extension API exposes `tool_call` (pre-execution, may return `{block, reason}` or rewritten `{input}`), `tool_result` (post-execution, may add `{content, details, isError}`), `context` (message injection before each LLM call), and session lifecycle events (`session_start`, `turn_start`, `agent_end`). These surfaces are sufficient for informational injection and generic pre-call blocking, but v17.3.7 `ToolCallEvent` is insufficient to authenticate an MCP authoring authority because it exposes only `toolName` and `input`.

**Evidence:**
- `src/extensibility/hooks/types.ts:306` — `ToolCallEvent` shape with `toolName`, `input`.
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — `tool_call` emission before execution, block/reason semantics, `input` rewrite rules.
- `src/extensibility/shared-events.ts:306–332` — `ToolCallEventResult` contract: `{block?, reason?, input?}`.
- `src/extensibility/shared-events.ts:179–183` — `ContextEvent` with mutable deep copy of outgoing messages.
- `docs/hooks.md` lines 112–116 — tool event pre/post model documented.
- `docs/skills/authoring-hooks.md` lines 40–43 — event catalog table confirming `tool_call` and `tool_result` return shapes.

**Decision:** FR-1 pins the event-surface claim set to these documented events. TASK-1 probes must confirm live behavior matches documentation before implementation.

## RF-2: `tool_call` exposes every tool but names do not prove effects

**Finding:** `tool_call` carries `toolName` and input for every execution, including built-in, MCP, and extension tools. Known write/edit fields and shell command strings are examples, not a complete future-proof write census. A regex/string match cannot prove command targets, and tool names alone cannot authenticate the authoring service.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — event emission with tool name/input and block result.
- `src/extensibility/extensions/wrapper.ts` — registered tool execution passes through the wrapper.
- `docs/skills/authoring-hooks.md:82–101` — pre-tool input inspection contract.

**Decision:** FR-3/FR-7 use a candidate-bundled installed registry for expected effects, but authoring allowance requires a future non-model-controlled `tool-call-authority-abi@1` provider/server/schema envelope. Current v17.3.7 state is `DEFERRED_HOST_ABI`; tool-name equality cannot authorize. Every call enters classification; there is no three-name early return.

## RF-3: `tool_result` supports diagnostic content injection

**Finding:** After successful tool execution, `tool_result` handlers may return `{content, details}` overrides that replace what the LLM sees. This enables appending kernel diagnostics to read/edit results without modifying repository state. On tool failure, `tool_result` is still emitted with `isError: true`, allowing diagnostic injection on error paths too.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:148–163` — post-execution `tool_result` emission with override support.
- `docs/hooks.md` lines 276–296 — realistic example redacting tool output via `tool_result` content override.
- `docs/skills/authoring-hooks.md` lines 103–128 — post-tool override contract.

**Decision:** FR-2 uses `tool_result` for diagnostic injection on spec-file reads. Content additions are bounded and never replace original output entirely.

## RF-4: `context` event enables session-scoped message injection

**Finding:** The `context` event fires before each LLM API call with a deep copy of outgoing messages. Handlers may return `{messages}` to modify the list. Multiple handlers chain; each receives prior handler's output. This enables injecting corpus census summaries as system-role messages visible to the LLM without persisting them in session storage.

**Evidence:**
- `src/extensibility/shared-events.ts:179–183` — `ContextEvent` with mutable deep copy.
- `docs/hooks.md` lines 298–311 — realistic example filtering context messages.
- `docs/skills/authoring-hooks.md` lines 130–148 — context modification contract.
- `plan-gate:FR-3` — proven precedent for bounded context injection.

**Decision:** FR-2 uses `session_start` to prepare one corpus census and the next `context` event to inject it once. The bounded message modifies only the event deep copy.

## RF-5: Hook handler errors fail closed; fail-honest must preserve safety

**Finding:** OMP's outer wrapper blocks on handler error/timeout. Catching faults inside the handler is required for bounded actionable output. But uniformly allowing caught faults would open a raw-write bypass when classification or containment fails.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:43` — outer fail-safe behavior.
- `plan-gate:FR-2` — internal fail-open is capability-specific, not a universal policy.
- `spec-authoring-workflow:FR-12` — no-bypass mutation invariant.

**Decision:** Informational kernel/render faults diagnose and allow. Enforcement safety faults in registry, extraction, authority, containment, or resolution diagnose and BLOCK `TARGET_INDETERMINATE`. Both paths catch exceptions before the outer wrapper; neither is silent or fake-green.

## RF-6: Session events enable lifecycle-scoped initialization

**Finding:** `session_start` fires once per session load, providing a natural point for kernel initialization, corpus census computation, and mode determination. `agent_end` provides a cleanup boundary. These events carry no return value but enable side-effect-free initialization within the handler.

**Evidence:**
- `docs/hooks.md` lines 82–95 — session event catalog.
- `docs/skills/authoring-hooks.md` lines 46–59 — session lifecycle event table.
- `docs/extensions.md` lines 272–279 — extension session lifecycle events.

**Decision:** FR-2 uses `session_start` for corpus census initialization. FR-9 uses session events for stage-gate/static-manifest caching only; session_start does not enumerate live tools.

## RF-7: FR-39 remains deferred while authoring authority is MCP-only

**Finding:** Source FR-39 combined MCP-only spec access with persistent audit. `MIGRATION_MATRIX.md` marks the whole source feature DEFER. Separately, the target authoring contract now defines the only sanctioned proposal-first mutation authority as MCP server `omp-spec-kit`.

**Evidence:**
- `MIGRATION_MATRIX.md` FR-39 — DEFER.
- `spec-authoring-workflow:FR-12`/`FR-14` and its schema facade map — no raw writer and exact MCP facade authority.
- `product:FR-6` — AUTHORING_MCP then SPEC_ENFORCEMENT capability gates.

**Decision:** OMP `tool_call` enforces effects; exact authoring MCP calls are the sole allowed mutation authority. No persistent audit log or full FR-39 delivery is claimed.

## RF-8: Extension modules ship inside bundled plugin artifacts

**Finding:** Marketplace plugins may contain extension modules declared by `package.json` `omp.extensions`. Installation symlinks the cached plugin into the scope's `node_modules` tree. Extensions execute from the installed artifact with source checkout absent. The `plan-gate:FR-11` and `spec-kernel:FR-10` posture requires dependency-absent self-contained runtime.

**Evidence:**
- `docs/marketplace.md` line 18 — plugins may contain hooks, tools, MCP servers; installation symlinks cached plugin.
- `docs/extensions.md` lines 38–60 — extension lifecycle: import module, run factory, initialize runner.
- `plan-gate:FR-11` — self-contained in-process runtime precedent.
- `spec-kernel:FR-10` — dependency-absent distribution posture.

**Decision:** FR-6 requires hook modules to ship inside the bundled plugin artifact with no ambient dependencies. Hook absence degrades honestly per FR-8.

## Risks

### RISK-1: Mutable OMP documentation

OMP documentation on `main` is mutable. Cited contracts may change between the pinned commit and implementation time. **Mitigation:** TASK-1 live ABI probes re-prove every cited claim against the pinned runtime before implementation proceeds.

### RISK-2: Live tool registry changes across OMP versions

New built-in, MCP, or extension tools can change name/input/effect. **Mitigation:** TASK-1 is blocked until a future host emits authenticated authority fields; candidate build verification captures the installed registry/hash, and runtime compares the future host envelope to it. Drift is visible and unmatched calls become `UNKNOWN`/BLOCK rather than disabling accepted enforcement.

### RISK-3: Product or authoring authority identity is unavailable

Activating from a local boolean would bypass same-candidate evidence. **Mitigation:** FR-9 requires exact product capability and authority-manifest digests; absence/mismatch refuses activation and cannot be overridden locally.

### RISK-4: Dynamic commands and filesystem links hide targets

Shell substitution, computed paths, non-existing targets, POSIX symlinks, and Windows reparse points defeat substring matching. **Mitigation:** versioned exhaustive extraction returns incomplete for unsupported syntax, and an I/O resolver checks canonical root plus every existing ancestor. Any indeterminate result blocks in enforcement mode.

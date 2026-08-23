# Research

## Scope and method

This research combines two evidence classes: (1) the installed OMP runtime source `pi-coding-agent@17.3.7` at `C:\Users\stigm\.omp\plugins\node_modules\@oh-my-pi\pi-coding-agent\src\` (pinned per the repository contract note `docs/omp-v17.3.7-contract.md`), and (2) the upstream `dev-pomogator` FR-39 concept and the `plan-gate` sibling specification as design provenance. OMP-side findings are stated with installed source paths and must be re-proven live by TASK-1 before implementation. Upstream FR-39 is research evidence only; no MCP server, audit log, or centralized access policy is imported.

## RF-1: OMP hook events provide sufficient interception surfaces

**Finding:** The OMP extension API exposes `tool_call` (pre-execution, may return `{block, reason}` or rewritten `{input}`), `tool_result` (post-execution, may add `{content, details, isError}`), `context` (message injection before each LLM call), and session lifecycle events (`session_start`, `turn_start`, `agent_end`). These surfaces are sufficient for both informational diagnostic injection and enforcement-mode write interception without Claude hooks.

**Evidence:**
- `src/extensibility/hooks/types.ts:306` — `ToolCallEvent` shape with `toolName`, `input`.
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — `tool_call` emission before execution, block/reason semantics, `input` rewrite rules.
- `src/extensibility/shared-events.ts:306–332` — `ToolCallEventResult` contract: `{block?, reason?, input?}`.
- `src/extensibility/shared-events.ts:179–183` — `ContextEvent` with mutable deep copy of outgoing messages.
- `docs/hooks.md` lines 112–116 — tool event pre/post model documented.
- `docs/skills/authoring-hooks.md` lines 40–43 — event catalog table confirming `tool_call` and `tool_result` return shapes.

**Decision:** FR-1 pins the event-surface claim set to these documented events. TASK-1 probes must confirm live behavior matches documentation before implementation.

## RF-2: `tool_call` can match write targets touching `.specs/**`

**Finding:** The `tool_call` event carries `toolName` and `input` for every tool execution. For `write` and `edit` tools, `input` contains the file path target. For `bash`, `input.command` contains the shell command string. A handler can inspect these fields to determine whether the operation touches `.specs/**`. The `input` rewrite capability allows redirecting non-matching calls without blocking.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:42–74` — `tool_call` emission with full `input`.
- `docs/hooks.md` lines 258–273 — realistic example matching `bash` commands by inspecting `event.input.command`.
- `docs/skills/authoring-hooks.md` lines 82–101 — pre-tool blocking contract with `toolName` and `input` inspection.

**Decision:** FR-3 matches `write`/`edit` by path prefix and `bash` by command-string pattern. TASK-1 must confirm the exact `input` field names and path normalization for each tool.

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

**Decision:** FR-2 uses `context` for corpus census injection on session start and periodically. Injection is bounded and modifies only the event deep copy.

## RF-5: Hook handler errors fail closed in OMP; fail-honest requires compensation

**Finding:** The OMP tool wrapper treats a hook handler error as a block ("fail-safe"). Unlike `plan-gate` which compensates to fail-open, this spec's fail-honest policy (FR-4) requires explicit visible messages rather than silent allowance or silent blocking. Handler code must catch all internal faults and translate them into diagnostic content, not into thrown exceptions.

**Evidence:**
- `src/extensibility/hooks/tool-wrapper.ts:43` — "If hook errors/times out, block by default (fail-safe)".
- `plan-gate:RF-3` — same finding; plan-gate compensates to fail-open.
- `spec-kernel:FR-6` — anti-fake-green lineage: diagnostics must never convert structural findings into passing claims.

**Decision:** FR-4 defines the fail-honest invariant: every fault produces an explicit visible message. This differs from plan-gate's fail-open because enforcement-mode silent blocking is worse than silent allowance (it creates false negatives), while informational-mode silence is worse than honest absence (it creates false confidence).

## RF-6: Session events enable lifecycle-scoped initialization

**Finding:** `session_start` fires once per session load, providing a natural point for kernel initialization, corpus census computation, and mode determination. `agent_end` provides a cleanup boundary. These events carry no return value but enable side-effect-free initialization within the handler.

**Evidence:**
- `docs/hooks.md` lines 82–95 — session event catalog.
- `docs/skills/authoring-hooks.md` lines 46–59 — session lifecycle event table.
- `docs/extensions.md` lines 272–279 — extension session lifecycle events.

**Decision:** FR-2 uses `session_start` for corpus census initialization. FR-9 uses session events for stage-gate status caching.

## RF-7: Upstream FR-39 concept informs but does not constrain

**Finding:** Upstream FR-39 specified "MCP-only spec access and audit log" — centralized access control through MCP with persistent audit trails. `MIGRATION_MATRIX.md` defers this pending a later adapter/policy stage. The enforcement *concept* (controlled access to spec documents) survives, but the surface (MCP), the persistence (audit log), and the centralization policy are outside this spec's boundary.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-39 — DEFER decision with rationale "Central access and audit require a later adapter and privacy/state policy."
- `ROADMAP.md` lines 46–50 — "Later — authoring and mutation" entry gates include audit/privacy policy.

**Decision:** This spec enforces through OMP-native hook events, not MCP. No audit log or persistent state is introduced (FR-5). The deferred FR-39 concept remains research input for a future adapter stage.

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

### RISK-2: Tool input shape variation across OMP versions

The exact field names and path normalization in `tool_call` `input` for `write`, `edit`, and `bash` may differ from documentation. **Mitigation:** TASK-1 probes record exact shapes; spec corrections precede implementation if deviations are found.

### RISK-3: Enforcement mode activation timing

The cumulative gate acceptance signal may not be observable from within a hook handler without additional infrastructure. **Mitigation:** TASK-1 probes must confirm how stage-gate status is accessible to extension code; FR-9 may need adjustment based on probe findings.

### RISK-4: Bypass through non-standard tools

Future OMP tools or extension-registered tools may write to `.specs/**` without triggering the matched `toolName` set. **Mitigation:** FR-7 requires enumeration of all known write surfaces; the design includes a catch-all pattern for unrecognized tools targeting `.specs/` paths.

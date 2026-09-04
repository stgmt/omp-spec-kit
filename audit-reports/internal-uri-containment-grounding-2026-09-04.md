# Internal URI Containment Grounding (2026-09-04)

## Scope and Contract Evidence

This grounding report documents the contractual invariants for OMP internal device URIs (`xd://` protocol) and filesystem containment resolution within `omp-spec-kit` enforcement.

### 1. Installed Runtime Source Grounding: `@oh-my-pi/pi-coding-agent`

Location: `C:\Users\stigm\.omp\plugins\node_modules\@oh-my-pi\pi-coding-agent\src\`

#### A. Internal Device Target Parsing
In `internal-urls/xd-protocol.ts` (lines 10–16):
```typescript
export function parseXdUrl(input: string): { name: string | null } | null {
	const trimmed = input.trim();
	if (!trimmed.toLowerCase().startsWith(XD_URL_PREFIX)) return null;
	const name = trimmed.slice(XD_URL_PREFIX.length);
	if (name.length === 0) return { name: null };
	if (/[/?#]/.test(name)) return null;
	return { name };
}
```
- **Invariants:**
  1. Scheme comparison is strictly case-insensitive (`startsWith("xd://")` after `toLowerCase()`).
  2. Empty device name `xd://` is valid and returns `{ name: null }`.
  3. Non-empty device name cannot contain `/`, `?`, or `#`. If present, parsing returns `null` (malformed).
  4. Leading and trailing whitespace is trimmed.

#### B. Tool Call Event Payload Contract
In `extensibility/hooks/types.ts` (lines 303–314):
```typescript
/**
 * Event data for tool_call event.
 * Fired before a tool is executed. Hooks can block execution.
 */
export interface ToolCallEvent {
	type: "tool_call";
	/** Tool name (e.g., "bash", "edit", "write") */
	toolName: string;
	/** Tool call ID */
	toolCallId: string;
	/** Tool input parameters */
	input: Record<string, unknown>;
}
```
- **Invariants:**
  1. `tool_call` receives raw user/model input directly as `input: Record<string, unknown>`.
  2. Tools like `write` pass `{ path: "xd://propose", content: "..." }` directly in `input`.

#### C. Hook Failure and Blocking Semantics
In `extensibility/hooks/tool-wrapper.ts` (lines 35–74):
```typescript
	async execute(
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails, TParameters>,
		context?: AgentToolContext,
	) {
		// Emit tool_call event - hooks can block execution or revise the input the tool runs with.
		// If hook errors/times out, block by default (fail-safe)
		let effectiveParams = params;
		if (this.hookRunner.hasHandlers("tool_call")) {
			try {
				const callResult = (await this.hookRunner.emitToolCall({
					type: "tool_call",
					toolName: this.tool.name,
					toolCallId,
					input: normalizeToolEventInput(
						this.tool.name,
						resolveToolEventInput(this.tool, params as Record<string, unknown>),
					),
				})) as ToolCallEventResult | undefined;

				if (callResult?.block) {
					const reason = callResult.reason || "Tool execution was blocked by a hook";
					throw new Error(reason);
				}
				if (callResult?.input !== undefined && context?.toolCall?.providerMetadata?.type !== "computer") {
					effectiveParams = callResult.input as Static<TParameters>;
				}
			} catch (err) {
				if (err instanceof Error) {
					throw err;
				}
				throw new Error(`Hook failed, blocking execution: ${String(err)}`);
			}
		}
```
- **Invariants:**
  1. Hook error, throw, or timeout blocks tool execution by default (fail-closed / fail-safe).
  2. Returning `{ block: true, reason }` throws an error with `reason` which the LLM sees as the failure explanation.
  3. Non-spec targets such as `xd://propose` must NOT be blocked with `TARGET_INDETERMINATE`.

---

### 2. Current Enforcement Logic: `omp-spec-kit`

#### A. Target Resolution
In `src/enforcement/resolve-targets.js` (lines 22–64):
```javascript
function unsafeTarget(raw) {
  if (typeof raw !== "string" || raw.trim() === "" || INDETERMINATE_INPUT.test(raw)) return true;
  if (process.platform === "win32" && WINDOWS_UNSAFE_PATH.test(raw)) return true;
  return false;
}
...
export function resolveTarget(root, raw) {
  if (unsafeTarget(raw)) return { resolution: "INDETERMINATE", relativePath: null };
  try {
    const projectRoot = realpathSync.native(path.resolve(root));
    const specsRoot = realpathSync.native(path.join(projectRoot, ".specs"));
...
```
- **Problem:**
  1. `WINDOWS_UNSAFE_PATH` matches `xd://propose` because of `:` followed by non-slashes (`/.*:[^\\/]*$/`).
  2. Even if regex was bypassed, `path.resolve(projectRoot, "xd://propose")` turns it into an artificial local path, then tries to resolve against `specsRoot`.
  3. If `.specs` does not physically exist, `realpathSync.native(path.join(projectRoot, ".specs"))` throws `ENOENT`, forcing `resolveTarget()` into `catch` and returning `{ resolution: "INDETERMINATE" }`.

#### B. Classification and Decision Dispatch
In `src/enforcement/classifier.js` (lines 143–205):
```javascript
  const policy = decidePathPolicy(options.root ?? event?.cwd ?? process.cwd(), targets);
  if (policy.decision === "ALLOW") {
    return DIRECT_PATH_MUTATION_TOOLS.has(toolName)
      ? { action: "continue", code: "NON_SPEC_ALLOWED", toolName, touchesSpecs: false, mismatchField: null }
      : { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  }
  return blocked(toolName, policy.code, policy.resolutions);
```
- **Invariants:**
  1. Any `INDETERMINATE` target forces `policy.decision = "BLOCK"` with `TARGET_INDETERMINATE`.
  2. Direct mutators with all targets classified as `NON_SPEC` receive `{ action: "continue", code: "NON_SPEC_ALLOWED", touchesSpecs: false }`.
  3. Any target inside canonical `.specs` forces `RAW_SPEC_WRITE`.

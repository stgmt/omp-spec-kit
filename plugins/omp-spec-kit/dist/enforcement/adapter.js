import { classifyToolCall } from "./classifier.js";
import { projectRequiredMessage, readProjectBinding } from "./project-binding.js";

/**
 * Create the fail-closed OMP tool_call handler for specification paths.
 *
 * Scope is unchanged: the classifier decides about specification access only,
 * so a bash/read/grep call that never touches specs passes through untouched.
 *
 * What this adds is the session project. A spec MCP call either states its own
 * `project` (an explicit per-call selection, left alone) or receives the
 * project recorded for the workspace this session is in
 * (`.omp-spec-kit/project.json` under `ctx.cwd`), injected through
 * `ToolCallEventResult.input` — the replacement execution input both the agent
 * loop (`agent-session.ts:#beforeToolCall`) and nested `write xd://` dispatches
 * (`extensions/wrapper.ts`) apply before the approval gate.
 *
 * A spec call in a workspace with no record is refused with `PROJECT_REQUIRED`,
 * the dispatch vocabulary already used by `src/service/dispatch.js`.
 */
export function createSpecEnforcementHandler(options = {}) {
  return (event, ctx) => {
    const root = typeof ctx?.cwd === "string" && ctx.cwd !== "" ? ctx.cwd : options.root;
    const decision = classifyToolCall(event, { ...options, root: root ?? options.root });
    if (decision.action === "block") return { block: true, reason: decision.reason };
    if (decision.touchesSpecs !== true) return undefined;

    const explicit = event?.input?.project;
    if (typeof explicit === "string" && explicit.trim() !== "") return undefined;
    if (explicit !== undefined && explicit !== null) return undefined;

    const binding = readProjectBinding(root);
    if (binding === null) return { block: true, reason: projectRequiredMessage(root) };
    return { input: { ...(event.input ?? {}), project: binding.project } };
  };
}

/** Register the enforcement handler on an OMP extension API. */
export function registerSpecEnforcement(pi, options = {}) {
  if (typeof pi?.on !== "function") return undefined;
  const getAllTools = typeof pi.getAllTools === "function" ? () => pi.getAllTools() : undefined;
  const handler = createSpecEnforcementHandler({ ...options, pi, getAllTools });
  pi.on("tool_call", handler);
  return handler;
}

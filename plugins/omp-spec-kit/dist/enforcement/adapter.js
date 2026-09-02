import { classifyToolCall } from "./classifier.js";

/** Create the fail-closed OMP tool_call handler for specification paths. */
export function createSpecEnforcementHandler(options = {}) {
  return (event) => {
    const decision = classifyToolCall(event, options);
    if (decision.action === "block") return { block: true, reason: decision.reason };
    return undefined;
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

import { registerSpecEnforcement } from "./enforcement/adapter.js";
import { registerSetupWarning } from "./enforcement/setup-warning.js";

export const PLUGIN_VERSION = "3.5.1";
export const SCHEMA_VERSION = "1";

// OMP 18.0.11 extension contract pinned at the active release runtime
// 33cc6b9a043a74e00a157e72ca909272796d8461.
// All 10 tools are served strictly through MCP.
// This extension registers ZERO direct tools: it registers the fail-closed
// .specs access gate (which also injects this session's project) and the
// setup diagnostic.
export default function ompSpecKitExtension(pi) {
  pi.setLabel("OMP Spec Kit");
  // The gate resolves the project per call from the workspace record under the
  // handler's own `ctx.cwd` (per-session; see runner.ts `get cwd()`), never
  // from a process-global value captured here.
  registerSpecEnforcement(pi);
  // The diagnostic is evaluated against the same session workspace, so a
  // second session in another repository sees its own binding state.
  registerSetupWarning(pi, { root: () => (typeof pi?.cwd === "string" ? pi.cwd : process.cwd()), env: process.env });
}

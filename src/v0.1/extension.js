import { registerSpecEnforcement } from "../enforcement/adapter.js";

export const PLUGIN_VERSION = "1.1.0";
export const SCHEMA_VERSION = "1";

// OMP 18.0.11 extension contract pinned at the active release runtime
// 33cc6b9a043a74e00a157e72ca909272796d8461.
// All 10 tools are served strictly through MCP.
// This extension registers ZERO direct tools and only registers the
// fail-closed .specs access gate enforcement hook.
export default function ompSpecKitExtension(pi) {
  pi.setLabel("OMP Spec Kit");
  registerSpecEnforcement(pi);
}

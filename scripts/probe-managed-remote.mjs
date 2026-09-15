#!/usr/bin/env bun
/**
 * Managed (remote) mode probe for TASK-7.
 *
 * The plugin ships a local stdio server for unmanaged checkouts. Managed
 * projects must instead reach the spec registry over HTTP, and OMP resolves
 * that by priority: an OMP-native `omp-spec-kit` definition (project
 * `.omp/mcp.json` or the active profile's user config) precedes the plugin's
 * own declaration, and the first definition wins.
 *
 * This probe asserts the resolution and then proves it behaviourally: it
 * connects through the resolved definition and calls one read tool, so the
 * registry's access log records the request (the local stdio server would
 * leave no trace there). Run it under the profile that carries the managed
 * definition, with the token in the environment.
 *
 * Usage (from the project directory):
 *   OMP_PROFILE=<profile> OMP_SPEC_REGISTRY_TOKEN=<token> \
 *   bun scripts/probe-managed-remote.mjs \
 *     --runtime-root <@oh-my-pi/pi-coding-agent> \
 *     --expect-url http://127.0.0.1:8643/mcp
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

function requiredFlag(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing ${name}`);
  return path.resolve(value);
}
function optionalFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const runtimeRoot = requiredFlag("--runtime-root");
const cwd = path.resolve(optionalFlag("--cwd", process.cwd()));
const server = optionalFlag("--server", "omp-spec-kit");
const expectUrl = optionalFlag("--expect-url", "");
const toolName = optionalFlag("--tool", "spec_catalog");
const toolArgs = JSON.parse(optionalFlag("--args", '{"view":"specs"}'));
const timeoutMs = Number(optionalFlag("--timeout-ms", "60000"));

const fromRuntime = (relative) => import(pathToFileURL(path.join(runtimeRoot, relative)).href);
const [configModule, managerModule, piUtils] = await Promise.all([
  fromRuntime("src/mcp/config.ts"),
  fromRuntime("src/mcp/manager.ts"),
  import(pathToFileURL(path.join(runtimeRoot, "..", "pi-utils", "src", "index.ts")).href),
]);

if (piUtils.getProjectDir() !== cwd) {
  throw new Error(`probe must start at the project directory: process=${piUtils.getProjectDir()} expected=${cwd}`);
}

const { configs, sources } = await configModule.loadAllMCPConfigs(cwd, { enableProjectConfig: true, filterExa: true, filterBrowser: false });
const entry = configs[server];
if (!entry) throw new Error(`OMP did not resolve a server named ${server}; loaded: ${Object.keys(configs).sort().join(", ")}`);
if (entry.type !== "http") throw new Error(`${server} resolved to transport ${entry.type ?? "stdio"}; managed mode requires http`);
if (expectUrl && entry.url !== expectUrl) throw new Error(`${server} resolved to ${entry.url}; expected ${expectUrl}`);

const manager = new managerModule.MCPManager(cwd);
const connection = await manager.connectServers(
  { [server]: entry },
  { [server]: sources[server] ?? { provider: "native", providerName: "OMP", level: "user" } },
  () => {},
);

let tool;
for (let attempt = 0; attempt < 60 && !tool; attempt += 1) {
  const tools = connection.tools.length > 0 ? connection.tools : manager.getTools();
  tool = tools.find((candidate) => candidate.mcpToolName === toolName);
  if (!tool) await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!tool) throw new Error(`${server} did not expose ${toolName}`);

const result = await tool.execute("managed-remote-probe", toolArgs, undefined, {});
const text = result?.content?.[0]?.text ?? "";
let envelope = null;
try {
  envelope = JSON.parse(text);
} catch {}

const receipt = {
  schema: "omp-spec-kit-managed-remote-probe@1",
  server,
  resolved: { transport: entry.type, url: entry.url, source: sources[server] ?? null },
  tool: { name: tool.name, mcpServerName: tool.mcpServerName, mcpToolName: tool.mcpToolName },
  call: { isError: result?.isError === true, operation: envelope?.operation ?? null, ok: envelope?.ok ?? null, kind: envelope?.data?.kind ?? null },
  provenance: { cwd, runtimeRoot: "<runtime-root>" },
};
console.log(JSON.stringify(receipt, null, 2));

if (result?.isError === true || envelope?.ok !== true) {
  throw new Error(`managed call failed: ${text.slice(0, 300)}`);
}
void timeoutMs;

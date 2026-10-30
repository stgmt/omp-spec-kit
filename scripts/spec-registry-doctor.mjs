#!/usr/bin/env node
/**
 * Registry doctor — audits consumer MCP configs against the runtime manifest
 * and repairs dead/stale entries.
 *
 * Why: consumer configs (Devin mcp_config.json, Windsurf mcp_config.json,
 * project .mcp.json) are frozen snapshots. A reinstall on another port, a
 * dockerized replacement, or a revoked token silently leaves them pointing
 * at nothing — or worse, at a foreign instance answering on the same port.
 *
 * Usage:
 *   node scripts/spec-registry-doctor.mjs [--manifest <path>]
 *       [--config <path> ...] [--repair] [--token <youtrack-token>]
 *
 * Defaults: manifest = skills/spec-stack-setup/runtime/projects.json;
 * configs = ~/AppData/Roaming/devin/mcp_config.json,
 *           ~/.codeium/windsurf/mcp_config.json, ./.mcp.json
 * Without --repair this is a report-only dry run — nothing is written.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { diagnoseMcpConfig, repairMcpConfig } from "../src/tools/registry-doctor.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = path.join(REPO, "skills", "spec-stack-setup", "runtime", "projects.json");
const DEFAULT_CONFIGS = [
  path.join(homedir(), "AppData", "Roaming", "devin", "mcp_config.json"),
  path.join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
  path.join(REPO, ".mcp.json"),
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const options = (name) => {
  const out = [];
  for (let i = 0; i < args.length; i += 1) if (args[i] === name && args[i + 1]) out.push(args[i + 1]);
  return out;
};

const manifestPath = option("--manifest") ?? DEFAULT_MANIFEST;
const repair = flag("--repair");
const configPaths = options("--config").length > 0 ? options("--config") : DEFAULT_CONFIGS;

if (!existsSync(manifestPath)) {
  console.error(`[doctor] runtime manifest missing: ${manifestPath}`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const ytToken = option("--token") ?? process.env.SPEC_DOCTOR_YT_TOKEN ?? manifest?.auth?.youtrack?.serviceToken ?? null;

/** Real probe: identity via unauthenticated /health, auth via an /mcp ping. */
async function httpProbe(url, token) {
  let fingerprint = null;
  let service = null;
  try {
    const health = await fetch(`${new URL(url).origin}/health`, { signal: AbortSignal.timeout(4000) });
    if (health.ok) {
      const body = await health.json().catch(() => ({}));
      fingerprint = body?.fingerprint ?? null;
      service = body?.service ?? null;
    }
  } catch {
    return { ok: false, status: 0 };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(4000),
      headers: {
        "Content-Type": "application/json",
        // StreamableHTTP requires both; without it the endpoint answers 406
        // and a live service gets misdiagnosed as unreachable.
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "spec-registry-doctor", version: "0" } },
      }),
    });
    return { ok: response.ok, status: response.status, fingerprint, service };
  } catch {
    return { ok: false, status: 0, fingerprint, service };
  }
}

/** Re-issue through the service's own onboarding endpoint — host audience. */
async function tokenProvider({ server }) {
  if (!ytToken) throw new Error(`no YouTrack token to re-issue ${server} — pass --token or SPEC_DOCTOR_YT_TOKEN`);
  const response = await fetch(`${manifest.hostUrl}/onboarding/token`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ytToken}` },
    body: JSON.stringify({ audience: "host" }),
  });
  if (!response.ok) throw new Error(`onboarding refused the token re-issue: ${response.status} ${await response.text()}`);
  return (await response.json()).token;
}

const secrets = {};
let failures = 0;

for (const configPath of configPaths) {
  if (!existsSync(configPath)) continue;
  const configText = readFileSync(configPath, "utf8");
  for (const match of configText.matchAll(/\$\{file:([^}]+)\}/g)) {
    const file = match[1];
    if (!(file in secrets)) secrets[file] = existsSync(file) ? readFileSync(file, "utf8").trim() : null;
  }
  try {
    if (!repair) {
      const report = await diagnoseMcpConfig({ configText, probe: httpProbe, manifest, secrets });
      for (const entry of report.entries) {
        const mark = entry.status === "ok" ? "ok " : "BAD";
        console.log(`[doctor] ${mark} ${path.basename(configPath)} → ${entry.server} ${entry.url} [${entry.status}]`);
        if (entry.status !== "ok") failures += 1;
      }
      continue;
    }
    const result = await repairMcpConfig({
      configText,
      manifest,
      probe: httpProbe,
      secrets,
      tokenProvider,
    });
    if (result.changed.length === 0) {
      console.log(`[doctor] ${path.basename(configPath)} — nothing to repair`);
      continue;
    }
    writeFileSync(configPath, result.configText);
    for (const [file, token] of Object.entries(result.secretsWritten)) writeFileSync(file, token);
    console.log(`[doctor] ${path.basename(configPath)} — repaired: ${result.changed.join(", ")}`);
  } catch (error) {
    failures += 1;
    console.error(`[doctor] ${path.basename(configPath)} — FAILED: ${error?.message ?? error}`);
  }
}

if (!repair && failures > 0) console.log("[doctor] rerun with --repair to apply the fixes above");
process.exitCode = failures > 0 ? 1 : 0;
// Let pending fetch/abort handles settle instead of exit()-ing over them.
setTimeout(() => {}, 100).unref();

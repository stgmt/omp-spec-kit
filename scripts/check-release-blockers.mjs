import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CACHE_DIRS = [".dev-pomogator/.cross-spec-cache"];
const RELEASE_SCOPES = ["mcp-release-integrity", "plugin-distribution"];
const MAX_RECORDS = 512;

function parseArgs(argv) {
  const values = { cacheDir: process.env.CROSS_SPEC_CACHE_DIR ?? null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cache") values.cacheDir = argv[++index];
    else if (arg === "--help") {
      console.log("Usage: node scripts/check-release-blockers.mjs [--cache PATH]");
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return values;
}

async function resolveCacheDir(requested) {
  const candidates = requested ? [requested] : DEFAULT_CACHE_DIRS;
  for (const candidate of candidates) {
    const absolute = path.resolve(repositoryRoot, candidate);
    try {
      const entries = await readdir(absolute, { withFileTypes: true });
      if (!entries.some((entry) => entry.isFile() && entry.name.endsWith(".json"))) continue;
      return { absolute, relative: path.relative(repositoryRoot, absolute) || "." };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

const { cacheDir } = parseArgs(process.argv.slice(2));
const resolved = await resolveCacheDir(cacheDir);
if (!resolved) {
  console.log(JSON.stringify({ schema: "omp-spec-kit-release-blockers@1", status: "UNKNOWN", blocking: true, reason: "CROSS_SPEC_CACHE_MISSING", searched: cacheDir ? [cacheDir] : DEFAULT_CACHE_DIRS }, null, 2));
  process.exitCode = 2;
} else {
  const entries = (await readdir(resolved.absolute, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length > MAX_RECORDS) throw new Error(`cross-spec cache exceeds ${MAX_RECORDS} records`);
  const invalid = [];
  const blockers = [];
  const blockerScenarios = new Set();
  for (const entry of entries) {
    const relativePath = path.join(resolved.relative, entry.name).replaceAll("\\", "/");
    let record;
    try {
      record = JSON.parse(await readFile(path.join(resolved.absolute, entry.name), "utf8"));
    } catch (error) {
      invalid.push({ path: relativePath, error: error.message });
      continue;
    }
    const scope = typeof record.fr_id === "string" ? record.fr_id.split(":", 1)[0] : null;
    if (!RELEASE_SCOPES.includes(scope)) continue;
    if (record.verdict?.result === "DRIFT" && record.verdict?.severity === "error") {
      blockers.push({
        path: relativePath,
        frId: record.fr_id,
        scenarioId: record.scenario_id ?? null,
        generatedAt: record.generated_at ?? null,
        explanation: record.verdict.explanation ?? null,
      });
      if (typeof record.scenario_id === "string") blockerScenarios.add(record.scenario_id);
    }
  }
  const status = invalid.length > 0 ? "UNKNOWN" : blockers.length > 0 ? "BLOCKED" : "PASSED";
  console.log(JSON.stringify({
    schema: "omp-spec-kit-release-blockers@1",
    status,
    blocking: status !== "PASSED",
    cacheDir: resolved.relative,
    totalRecords: entries.length,
    scopes: RELEASE_SCOPES,
    blockerCount: blockers.length,
    blockerScenarioCount: blockerScenarios.size,
    invalidRecordCount: invalid.length,
    blockers,
    invalid,
  }, null, 2));
  if (status !== "PASSED") process.exitCode = status === "UNKNOWN" ? 2 : 1;
}

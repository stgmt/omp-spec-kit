import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_VERSION = "0.1.0";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(`verify-release: ${message}`);
}

async function readJson(relativePath, label) {
  const filePath = path.join(repositoryRoot, relativePath);
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink()) fail(`${label} must not be a symlink`);
  return JSON.parse(await readFile(filePath, "utf8"));
}

const tag = process.env.RELEASE_TAG ?? "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`RELEASE_TAG must look like v0.1.0, got ${JSON.stringify(tag)}`);
const expectedVersion = tag.slice(1);
if (expectedVersion !== PLUGIN_VERSION) {
  fail(`tag ${tag} does not match the verified plugin version ${PLUGIN_VERSION}`);
}

const catalog = await readJson(".omp-plugin/marketplace.json", "marketplace catalog");
if (catalog.name !== "omp-spec-kit") fail("catalog name mismatch");
if (catalog.metadata?.version !== PLUGIN_VERSION) fail("catalog metadata.version mismatch");
const entries = catalog.plugins ?? [];
if (entries.length !== 1) fail(`catalog must contain exactly one plugin entry, found ${entries.length}`);
if (entries[0].name !== "omp-spec-kit") fail("catalog plugin entry name mismatch");
if (entries[0].version !== PLUGIN_VERSION) fail("catalog plugin entry version mismatch");
if (entries[0].source !== "./plugins/omp-spec-kit") fail("catalog plugin entry source mismatch");

const pkg = await readJson("plugins/omp-spec-kit/package.json", "plugin package.json");
if (pkg.version !== PLUGIN_VERSION) fail("plugin package version mismatch");
if (pkg.name !== "omp-spec-kit") fail("plugin package name mismatch");

const distManifest = await readJson("plugins/omp-spec-kit/dist/manifest.json", "dist manifest");
if (distManifest.schema !== "omp-spec-kit-dist-manifest@1") fail("dist manifest schema mismatch");
if (distManifest.pluginVersion !== PLUGIN_VERSION) fail("dist manifest pluginVersion mismatch");

const receiptRelativePath = "docs/validation/distribution-lifecycle.md";
const receipt = await readFile(path.join(repositoryRoot, receiptRelativePath), "utf8");
const commit = process.env.RELEASE_COMMIT ?? "";
if (!/^[0-9a-f]{40}$/.test(commit)) fail("RELEASE_COMMIT must be a full commit SHA");
if (!receipt.includes(commit)) {
  fail(`${receiptRelativePath} does not bind lifecycle evidence to release commit ${commit}`);
}

for (const forbiddenClaim of [/upgrade from/i, /rollback to a prior release/i]) {
  if (receipt.match(forbiddenClaim) && !receipt.includes("inapplicable")) {
    fail("lifecycle receipt must not claim prior-release upgrade/rollback for the first release");
  }
}

console.log(`verified release ${tag} for omp-spec-kit@${PLUGIN_VERSION} at commit ${commit}`);

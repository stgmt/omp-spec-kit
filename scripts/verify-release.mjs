import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_VERSION = "0.3.0";
const EXPECTED_PAYLOAD_DIGEST = "69f0a10a0e2f3e42e8827c48919cb3a1afcc55743d05df37e184c02e51822e4e";
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

async function payloadDigest() {
  const root = path.join(repositoryRoot, "plugins", "omp-spec-kit");
  const rows = [];
  async function visit(directory, relativeDirectory = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in payload: ${relative}`);
      if (stats.isDirectory()) await visit(absolute, relative);
      else if (stats.isFile()) {
        const bytes = await readFile(absolute);
        rows.push([relative, bytes.length, createHash("sha256").update(bytes).digest("hex")]);
      } else fail(`non-regular payload entry forbidden: ${relative}`);
    }
  }
  await visit(root);
  rows.sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

const tag = process.env.RELEASE_TAG ?? "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`RELEASE_TAG must look like v0.3.0, got ${JSON.stringify(tag)}`);
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

const digest = await payloadDigest();
if (digest !== EXPECTED_PAYLOAD_DIGEST) {
  fail(`payload digest ${digest} differs from the lifecycle-proven candidate ${EXPECTED_PAYLOAD_DIGEST}`);
}

const receiptRelativePath = `docs/validation/distribution-lifecycle-v${PLUGIN_VERSION}.md`;
const receipt = await readFile(path.join(repositoryRoot, receiptRelativePath), "utf8");
if (!receipt.includes(EXPECTED_PAYLOAD_DIGEST)) {
  fail(`${receiptRelativePath} does not record the proven payload digest`);
}
const receiptCommit = receipt.match(/\b[0-9a-f]{40}\b/)?.[0];
if (!receiptCommit) fail(`${receiptRelativePath} does not bind evidence to a full commit SHA`);
if (/upgrade from a (real|prior)/i.test(receipt) && !receipt.includes("inapplicable")) {
  fail("lifecycle receipt must not claim prior-release upgrade/rollback for the first release");
}

console.log(
  `verified release ${tag} for omp-spec-kit@${PLUGIN_VERSION}: payload ${digest} bound to ${receiptCommit}`,
);

import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_VERSION = "0.1.0";
const MANIFEST_SCHEMA = "omp-spec-kit-dist-manifest@1";
const SOURCE_FILES = Object.freeze(["extension.js", "inventory.js"]);
const OUTPUT_FILES = Object.freeze([...SOURCE_FILES, "manifest.json"]);

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repositoryRoot, "src", "v0.1");
const distRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist");

function fail(message) {
  throw new Error(`build-plugin: ${message}`);
}

async function requireRegularFile(filePath, label) {
  let stats;
  try {
    stats = await lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") fail(`missing ${label}`);
    fail(`cannot inspect ${label}`);
  }
  if (stats.isSymbolicLink()) fail(`${label} must not be a symlink`);
  if (!stats.isFile()) fail(`${label} must be a regular file`);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function assertClosedOutput() {
  const distStats = await lstat(distRoot);
  if (distStats.isSymbolicLink() || !distStats.isDirectory()) {
    fail("dist must be a real directory");
  }

  const names = (await readdir(distRoot)).sort();
  const expected = [...OUTPUT_FILES].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    fail(`unexpected dist layout: ${names.join(", ") || "<empty>"}`);
  }
  for (const name of names) {
    await requireRegularFile(path.join(distRoot, name), `dist/${name}`);
  }
}

for (const name of SOURCE_FILES) {
  await requireRegularFile(path.join(sourceRoot, name), `src/v0.1/${name}`);
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

for (const name of SOURCE_FILES) {
  await copyFile(path.join(sourceRoot, name), path.join(distRoot, name));
}

const manifest = {
  schema: MANIFEST_SCHEMA,
  pluginVersion: PLUGIN_VERSION,
  files: Object.fromEntries(
    await Promise.all(
      SOURCE_FILES.map(async (name) => [name, { sha256: await sha256(path.join(distRoot, name)) }]),
    ),
  ),
};
await writeFile(path.join(distRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

await assertClosedOutput();
for (const name of SOURCE_FILES) {
  if ((await sha256(path.join(sourceRoot, name))) !== (await sha256(path.join(distRoot, name)))) {
    fail(`copied bytes differ for ${name}`);
  }
}

console.log(`built omp-spec-kit@${PLUGIN_VERSION}: ${OUTPUT_FILES.join(", ")}`);

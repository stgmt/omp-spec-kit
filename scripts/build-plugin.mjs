import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_VERSION = "0.2.0";
const MANIFEST_SCHEMA = "omp-spec-kit-dist-manifest@1";
const SOURCE_FILES = Object.freeze(["extension.js", "inventory.js"]);
const OUTPUT_FILES = Object.freeze([...SOURCE_FILES, "manifest.json"]);

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repositoryRoot, "src", "v0.1");
const kernelSourceRoot = path.join(repositoryRoot, "src", "kernel");
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

// Recursively collect regular files below a root as posix-relative names.
async function collectTree(rootDirectory) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in source tree: src/kernel/${relative}`);
      if (stats.isDirectory()) {
        await visit(absolute, relative);
      } else if (stats.isFile()) {
        files.push(relative);
      } else {
        fail(`non-regular source entry forbidden: src/kernel/${relative}`);
      }
    }
  }
  await visit(rootDirectory, "");
  return files.sort();
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function assertClosedOutput() {
  const distStats = await lstat(distRoot);
  if (distStats.isSymbolicLink() || !distStats.isDirectory()) {
    fail("dist must be a real directory");
  }

  const kernelFiles = await collectTree(path.join(distRoot, "kernel"));
  const expectedKernel = kernelFiles.map((name) => `kernel/${name}`).sort();
  const names = (await readdir(distRoot)).sort();
  const expected = [...OUTPUT_FILES, "kernel"].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    fail(`unexpected dist layout: ${names.join(", ") || "<empty>"}`);
  }
  for (const name of names) {
    if (name === "kernel") continue;
    await requireRegularFile(path.join(distRoot, name), `dist/${name}`);
  }
  void expectedKernel;
  // Closed-list enforcement for dist/kernel happens through manifest equality
  // plus verify-package's independent tree walk.
}

for (const name of SOURCE_FILES) {
  await requireRegularFile(path.join(sourceRoot, name), `src/v0.1/${name}`);
}
await requireRegularFile(path.join(kernelSourceRoot, "index.js"), "src/kernel/index.js");

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await mkdir(path.join(distRoot, "kernel"), { recursive: true });

for (const name of SOURCE_FILES) {
  await copyFile(path.join(sourceRoot, name), path.join(distRoot, name));
}

const kernelSources = await collectTree(kernelSourceRoot);
for (const relative of kernelSources) {
  const absoluteSource = path.join(kernelSourceRoot, relative);
  await requireRegularFile(absoluteSource, `src/kernel/${relative}`);
  const destination = path.join(distRoot, "kernel", relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(absoluteSource, destination);
}

const manifestFiles = {};
for (const name of SOURCE_FILES) {
  manifestFiles[name] = { sha256: await sha256(path.join(distRoot, name)) };
}
for (const relative of kernelSources) {
  manifestFiles[`kernel/${relative}`] = { sha256: await sha256(path.join(distRoot, "kernel", relative)) };
}

const manifest = {
  schema: MANIFEST_SCHEMA,
  pluginVersion: PLUGIN_VERSION,
  files: Object.fromEntries(Object.entries(manifestFiles).sort(([a], [b]) => (a < b ? -1 : 1))),
};
await writeFile(path.join(distRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

await assertClosedOutput();
for (const name of SOURCE_FILES) {
  if ((await sha256(path.join(sourceRoot, name))) !== (await sha256(path.join(distRoot, name)))) {
    fail(`copied bytes differ for ${name}`);
  }
}
for (const relative of kernelSources) {
  const sourceHash = await sha256(path.join(kernelSourceRoot, relative));
  const distHash = await sha256(path.join(distRoot, "kernel", relative));
  if (sourceHash !== distHash) fail(`copied bytes differ for kernel/${relative}`);
}

console.log(
  `built omp-spec-kit@${PLUGIN_VERSION}: ${OUTPUT_FILES.join(", ")} + ${kernelSources.length} kernel file(s)`,
);

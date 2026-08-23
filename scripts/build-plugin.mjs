import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_VERSION = "0.3.0";
const MANIFEST_SCHEMA = "omp-spec-kit-dist-manifest@1";
// Flat extension sources copied to the dist root.
const SOURCE_FILES = Object.freeze(["extension.js", "inventory.js"]);
// Source trees byte-copied into same-named dist subtrees.
const SOURCE_TREES = Object.freeze([
  { source: "src/kernel", output: "kernel" },
  { source: "src/adapters", output: "adapters" },
  { source: "src/mcp", output: "mcp" },
]);

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

// Recursively collect regular files below a root as posix-relative names.
async function collectTree(rootDirectory, label) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in source tree: ${label}/${relative}`);
      if (stats.isDirectory()) {
        await visit(absolute, relative);
      } else if (stats.isFile()) {
        files.push(relative);
      } else {
        fail(`non-regular source entry forbidden: ${label}/${relative}`);
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

  const names = (await readdir(distRoot)).sort();
  const expected = [...SOURCE_FILES, "manifest.json", ...SOURCE_TREES.map((tree) => tree.output)].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    fail(`unexpected dist layout: ${names.join(", ") || "<empty>"}`);
  }
  for (const name of names) {
    const stats = await lstat(path.join(distRoot, name));
    if (SOURCE_FILES.includes(name)) {
      if (!stats.isFile()) fail(`dist/${name} must be a regular file`);
    } else if (SOURCE_TREES.some((tree) => tree.output === name)) {
      if (!stats.isDirectory()) fail(`dist/${name} must be a directory`);
    } else if (name === "manifest.json") {
      if (!stats.isFile()) fail("dist/manifest.json must be a regular file");
    } else {
      fail(`unexpected dist entry: ${name}`);
    }
  }
}

for (const name of SOURCE_FILES) {
  await requireRegularFile(path.join(sourceRoot, name), `src/v0.1/${name}`);
}
for (const tree of SOURCE_TREES) {
  const treeStats = await lstat(path.join(repositoryRoot, tree.source));
  if (treeStats.isSymbolicLink() || !treeStats.isDirectory()) {
    fail(`${tree.source} must be a real directory`);
  }
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

const manifestFiles = {};

// Flat extension sources live one directory deeper in src (src/v0.1) than in
// dist, so exactly one deterministic rewrite is applied: adapter import
// specifiers rooted at "../adapters/" are rebased to "./adapters/". Nothing
// else is transformed; verify-package applies the same rule before comparing.
async function emitFlatSource(name) {
  const text = (await readFile(path.join(sourceRoot, name), "utf8")).replaceAll('"../adapters/', '"./adapters/');
  return Buffer.from(text, "utf8");
}

for (const name of SOURCE_FILES) {
  const bytes = await emitFlatSource(name);
  await writeFile(path.join(distRoot, name), bytes);
  manifestFiles[name] = { sha256: createHash("sha256").update(bytes).digest("hex") };
}

for (const tree of SOURCE_TREES) {
  const sourceTreeRoot = path.join(repositoryRoot, tree.source);
  const outputTreeRoot = path.join(distRoot, tree.output);
  const treeSources = await collectTree(sourceTreeRoot, tree.source);
  for (const relative of treeSources) {
    const absoluteSource = path.join(sourceTreeRoot, relative);
    await requireRegularFile(absoluteSource, `${tree.source}/${relative}`);
    const destination = path.join(outputTreeRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(absoluteSource, destination);
    manifestFiles[`${tree.output}/${relative}`] = { sha256: await sha256(destination) };
  }
}

const manifest = {
  schema: MANIFEST_SCHEMA,
  pluginVersion: PLUGIN_VERSION,
  files: Object.fromEntries(Object.entries(manifestFiles).sort(([a], [b]) => (a < b ? -1 : 1))),
};
await writeFile(path.join(distRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
for (const name of SOURCE_FILES) {
  const expected = await emitFlatSource(name);
  const actual = await readFile(path.join(distRoot, name));
  if (!actual.equals(expected)) fail(`emitted bytes differ from transformed source for ${name}`);
}
for (const [manifestKey] of Object.entries(manifestFiles)) {
  const [treeOutput, ...rest] = manifestKey.split("/");
  if (SOURCE_FILES.includes(manifestKey)) continue;
  const tree = SOURCE_TREES.find((candidate) => candidate.output === treeOutput);
  const relative = rest.join("/");
  const sourceHash = await sha256(path.join(repositoryRoot, tree.source, relative));
  const distHash = await sha256(path.join(distRoot, treeOutput, relative));
  if (sourceHash !== distHash) fail(`copied bytes differ for ${manifestKey}`);
}

console.log(
  `built omp-spec-kit@${PLUGIN_VERSION}: ${SOURCE_FILES.join(", ")}, manifest.json` +
    `, ${SOURCE_TREES.map((tree) => `${tree.output}/`).join(", ")}`,
);

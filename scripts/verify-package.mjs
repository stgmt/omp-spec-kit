import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readdir as readdirDir } from "node:fs/promises";
import path from "node:path";
import {
  PLUGIN_VERSION,
  REPOSITORY_GIT_URL,
  REPOSITORY_URL,
  assertExactKeys,
  readStrictJson,
  repositoryRoot,
} from "./verify-marketplace.mjs";

const pluginRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit");
const sourceRoot = path.join(repositoryRoot, "src", "v0.1");
const kernelSourceRoot = path.join(repositoryRoot, "src", "kernel");

// The closed dist/kernel payload mirrors src/kernel exactly; the expectation is
// derived from the source tree so it cannot drift from the build input.
async function collectKernelSources() {
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdirDir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in src/kernel: ${relative}`);
      if (!stats.isDirectory() && !stats.isFile()) fail(`non-regular source entry: src/kernel/${relative}`);
      if (stats.isDirectory()) await visit(absolute, relative);
      else if (relative.endsWith(".js")) files.push(relative);
      else fail(`unexpected non-JS source file: src/kernel/${relative}`);
    }
  }
  await visit(kernelSourceRoot, "");
  return files.sort();
}

const kernelSources = await collectKernelSources();
const kernelDistDirectories = [
  ...new Set(
    kernelSources
      .map((name) => name.split("/").slice(0, -1).join("/"))
      .filter((directory) => directory !== ""),
  ),
].sort();

const expectedDirectories = Object.freeze([
  ...new Set([
    "commands",
    "dist",
    "dist/kernel",
    "skills",
    "skills/spec-inventory",
    ...kernelDistDirectories.map((directory) => `dist/kernel/${directory}`),
  ]),
]);
const expectedFiles = Object.freeze([
  "LICENSE",
  "README.md",
  "commands/spec-inventory.md",
  "dist/extension.js",
  "dist/inventory.js",
  "dist/manifest.json",
  "package.json",
  "skills/spec-inventory/SKILL.md",
  ...kernelSources.map((name) => `dist/kernel/${name}`),
]);
const packageFiles = Object.freeze(["package.json", "README.md", "LICENSE", "dist/", "skills/", "commands/"]);

function fail(message) {
  throw new Error(`verify-package: ${message}`);
}

function sameStrings(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => typeof value === "string" && value === expected[index])
  );
}

async function collectPayloadTree() {
  const files = [];
  const directories = [];
  async function visit(directory, relativeDirectory = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name);
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in payload: ${relative}`);
      if (stats.isDirectory()) {
        directories.push(relative);
        await visit(absolute, relative);
      } else if (stats.isFile()) {
        files.push(relative);
      } else {
        fail(`non-regular payload entry forbidden: ${relative}`);
      }
    }
  }
  await visit(pluginRoot);
  return { files: files.sort(), directories: directories.sort() };
}

function assertExactList(actual, expected, label) {
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) {
    fail(`${label} must be exactly [${wanted.join(", ")}]; found [${actual.join(", ")}]`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function importedSpecifiers(source) {
  const specifiers = [];
  const staticImport = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^"'();]*?\s+from\s+)?["']([^"']+)["']/gu;
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const match of source.matchAll(staticImport)) specifiers.push(match[1]);
  for (const match of source.matchAll(dynamicImport)) specifiers.push(match[1]);
  return specifiers;
}

function assertRuntimeImports(relativePath, source) {
  if (/\brequire\s*\(/u.test(source)) fail(`${relativePath} uses CommonJS require`);
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.startsWith("node:")) continue;
    if (relativePath === "dist/extension.js" && specifier === "./inventory.js") continue;
    // Kernel modules may import sibling kernel modules only.
    if (
      relativePath.startsWith("dist/kernel/") &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      continue;
    }
    fail(`${relativePath} has forbidden runtime import: ${specifier}`);
  }
}

async function verifyPackage() {
  const rootStats = await lstat(pluginRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) fail("plugin payload root must be a real directory");

  const tree = await collectPayloadTree();
  assertExactList(tree.directories, expectedDirectories, "payload directories");
  assertExactList(tree.files, expectedFiles, "payload files");
  if (tree.files.filter((file) => path.posix.basename(file) === "package.json").length !== 1) {
    fail("payload must contain exactly one package.json");
  }

  const manifestPath = path.join(pluginRoot, "package.json");
  const manifest = await readStrictJson(manifestPath, "plugin package.json", fail);
  assertExactKeys(
    manifest,
    ["name", "version", "description", "homepage", "repository", "license", "type", "files", "engines", "omp"],
    "plugin package.json",
    fail,
  );
  if (manifest.name !== "omp-spec-kit" || manifest.version !== PLUGIN_VERSION) fail("package identity/version mismatch");
  if (typeof manifest.description !== "string" || manifest.description.trim() === "") fail("package description must be non-empty");
  if (manifest.homepage !== REPOSITORY_URL) fail("package homepage mismatch");
  assertExactKeys(manifest.repository, ["type", "url", "directory"], "package repository", fail);
  if (
    manifest.repository.type !== "git" ||
    manifest.repository.url !== REPOSITORY_GIT_URL ||
    manifest.repository.directory !== "plugins/omp-spec-kit"
  ) {
    fail("package repository mismatch");
  }
  if (manifest.license !== "MIT" || manifest.type !== "module") fail("package license/type mismatch");
  if (!sameStrings(manifest.files, packageFiles)) fail(`package files must be exactly: ${packageFiles.join(", ")}`);
  assertExactKeys(manifest.engines, ["omp"], "package engines", fail);
  if (manifest.engines.omp !== "17.3.7") fail("package must pin OMP 17.3.7");
  assertExactKeys(manifest.omp, ["extensions"], "package omp", fail);
  if (!sameStrings(manifest.omp.extensions, ["./dist/extension.js"])) fail("package must contain one extension entry");

  const distManifestPath = path.join(pluginRoot, "dist", "manifest.json");
  const distManifest = await readStrictJson(distManifestPath, "dist/manifest.json", fail);
  assertExactKeys(distManifest, ["schema", "pluginVersion", "files"], "dist manifest", fail);
  if (distManifest.schema !== "omp-spec-kit-dist-manifest@1" || distManifest.pluginVersion !== PLUGIN_VERSION) {
    fail("dist manifest schema/version mismatch");
  }
  const expectedManifestKeys = ["extension.js", "inventory.js", ...kernelSources.map((name) => `kernel/${name}`)];
  assertExactKeys(distManifest.files, expectedManifestKeys, "dist manifest files", fail);

  for (const name of ["extension.js", "inventory.js"]) {
    assertExactKeys(distManifest.files[name], ["sha256"], `dist manifest ${name}`, fail);
    const bytes = await readFile(path.join(pluginRoot, "dist", name));
    const sourceBytes = await readFile(path.join(sourceRoot, name));
    if (!bytes.equals(sourceBytes)) fail(`dist/${name} is stale against src/v0.1/${name}`);
    if (distManifest.files[name].sha256 !== sha256(bytes)) fail(`dist hash mismatch for ${name}`);
    const source = bytes.toString("utf8");
    if (!/export\s+const\s+PLUGIN_VERSION\s*=\s*["']0\.2\.0["']/u.test(source)) {
      fail(`${name} does not embed exported PLUGIN_VERSION 0.2.0`);
    }
    if (!/export\s+const\s+SCHEMA_VERSION\s*=\s*["']1["']/u.test(source)) {
      fail(`${name} does not embed exported SCHEMA_VERSION 1`);
    }
    assertRuntimeImports(`dist/${name}`, source);
  }

  // Kernel payload: byte equality against src/kernel plus manifest hashes and
  // the dependency-free runtime-import rule.
  for (const relative of kernelSources) {
    const distBytes = await readFile(path.join(pluginRoot, "dist", "kernel", relative));
    const sourceBytes = await readFile(path.join(kernelSourceRoot, relative));
    if (!distBytes.equals(sourceBytes)) fail(`dist/kernel/${relative} is stale against src/kernel/${relative}`);
    if (distManifest.files[`kernel/${relative}`].sha256 !== sha256(distBytes)) {
      fail(`dist hash mismatch for kernel/${relative}`);
    }
    assertRuntimeImports(`dist/kernel/${relative}`, distBytes.toString("utf8"));
  }

  const distManifestText = await readFile(distManifestPath, "utf8");
  if (distManifestText !== `${JSON.stringify(distManifest, null, 2)}\n`) fail("dist manifest is not canonical deterministic JSON");
  const rootLicense = await readFile(path.join(repositoryRoot, "LICENSE"));
  const payloadLicense = await readFile(path.join(pluginRoot, "LICENSE"));
  if (sha256(rootLicense) !== sha256(payloadLicense)) fail("payload LICENSE must match root LICENSE byte-for-byte");

  console.log(`verified clean payload: omp-spec-kit@${PLUGIN_VERSION}`);
}

await verifyPackage();

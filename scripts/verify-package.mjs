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
// Source trees byte-copied into same-named dist subtrees (must mirror
// scripts/build-plugin.mjs SOURCE_TREES).
const sourceTrees = Object.freeze([
  { source: path.join(repositoryRoot, "src", "kernel"), output: "kernel" },
  { source: path.join(repositoryRoot, "src", "adapters"), output: "adapters" },
  { source: path.join(repositoryRoot, "src", "mcp"), output: "mcp" },
]);

function fail(message) {
  throw new Error(`verify-package: ${message}`);
}

// The closed dist payload mirrors each src tree exactly; the expectation is
// derived from the source trees so it cannot drift from the build input.
async function collectTreeSources(rootDirectory, label) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdirDir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) fail(`symlink forbidden in ${label}: ${relative}`);
      if (!stats.isDirectory() && !stats.isFile()) fail(`non-regular source entry: ${label}/${relative}`);
      if (stats.isDirectory()) await visit(absolute, relative);
      else if (relative.endsWith(".js")) files.push(relative);
      else fail(`unexpected non-JS source file: ${label}/${relative}`);
    }
  }
  await visit(rootDirectory, "");
  return files.sort();
}

const treeSources = [];
for (const tree of sourceTrees) {
  const files = await collectTreeSources(tree.source, path.relative(repositoryRoot, tree.source));
  treeSources.push({ ...tree, files });
}

const allTreeDistDirectories = [
  ...new Set(
    treeSources.flatMap((tree) => [
      `dist/${tree.output}`,
      ...tree.files
        .map((name) => name.split("/").slice(0, -1).join("/"))
        .filter((directory) => directory !== "")
        .map((directory) => `dist/${tree.output}/${directory}`),
    ]),
  ),
].sort();

const expectedDirectories = Object.freeze([
  ...new Set(["bin", "commands", "dist", "skills", "skills/spec-inventory", ...allTreeDistDirectories]),
]);
const expectedFiles = Object.freeze([
  ".mcp.json",
  "LICENSE",
  "README.md",
  "bin/omp-spec-kit-mcp",
  "bin/omp-spec-kit-mcp.cmd",
  "commands/spec-inventory.md",
  "dist/extension.js",
  "dist/inventory.js",
  "dist/manifest.json",
  "package.json",
  "skills/spec-inventory/SKILL.md",
  ...treeSources.flatMap((tree) => tree.files.map((name) => `dist/${tree.output}/${name}`)),
]);
const packageFiles = Object.freeze([
  ".mcp.json",
  "package.json",
  "README.md",
  "LICENSE",
  "bin/",
  "dist/",
  "skills/",
  "commands/",
]);

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

// The single documented build rewrite: flat extension sources live one
// directory deeper in src than in dist, so adapter import specifiers rooted at
// "../adapters/" are rebased to "./adapters/" at emission time.
function emitTransform(text) {
  return text.replaceAll('"../adapters/', '"./adapters/');
}

function assertRuntimeImports(relativePath, source) {
  if (/\brequire\s*\(/u.test(source)) fail(`${relativePath} uses CommonJS require`);
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.startsWith("node:")) continue;
    if (relativePath === "dist/extension.js" && specifier === "./inventory.js") continue;
    // dist/extension.js may import its flat siblings and the adapters subtree.
    if (
      relativePath === "dist/extension.js" &&
      (specifier === "./inventory.js" || specifier.startsWith("./adapters/") || specifier.startsWith("./kernel/"))
    ) {
      continue;
    }
    // Tree modules may import sibling modules within their own subtree and
    // across dist subtrees (e.g. dist/mcp/server.js -> ../kernel/...), but
    // never outside the closed dist payload.
    if (
      (relativePath.startsWith("dist/kernel/") ||
        relativePath.startsWith("dist/adapters/") ||
        relativePath.startsWith("dist/mcp/")) &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      continue;
    }
    fail(`${relativePath} has forbidden runtime import: ${specifier}`);
  }
}

async function verifyMcpJson() {
  const mcpJsonPath = path.join(pluginRoot, ".mcp.json");
  const mcpJson = await readStrictJson(mcpJsonPath, ".mcp.json", fail);
  assertExactKeys(mcpJson, ["$schema", "mcpServers"], ".mcp.json", fail);
  if (
    mcpJson.$schema !==
    "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json"
  ) {
    fail(".mcp.json $schema must reference the pinned OMP mcp-schema.json");
  }
  assertExactKeys(mcpJson.mcpServers, ["omp-spec-kit"], ".mcp.json servers", fail);
  const server = mcpJson.mcpServers["omp-spec-kit"];
  assertExactKeys(server, ["type", "command"], ".mcp.json omp-spec-kit entry", fail);
  if (server.type !== "stdio") fail(".mcp.json server must be stdio");
  if (server.command !== "./bin/omp-spec-kit-mcp") {
    fail('.mcp.json command must be "./bin/omp-spec-kit-mcp"');
  }
  const serialized = JSON.stringify(mcpJson);
  for (const forbidden of ["cwd", "OMP_SPEC_KIT_ROOT", "--inspect", "--experimental-inspect"]) {
    if (serialized.includes(forbidden)) fail(`.mcp.json must not contain ${forbidden}`);
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

  await verifyMcpJson();

  const manifestPath = path.join(pluginRoot, "package.json");
  const manifest = await readStrictJson(manifestPath, "plugin package.json", fail);

  const posixLauncher = await lstat(path.join(pluginRoot, "bin", "omp-spec-kit-mcp"));
  if (!posixLauncher.isFile() || posixLauncher.isSymbolicLink()) {
    fail("POSIX MCP launcher must be a regular file");
  }
  if (process.platform !== "win32" && (posixLauncher.mode & 0o111) !== 0o111) {
    fail("POSIX MCP launcher must be executable on a POSIX package build");
  }
  const windowsLauncher = await lstat(path.join(pluginRoot, "bin", "omp-spec-kit-mcp.cmd"));
  if (!windowsLauncher.isFile() || windowsLauncher.isSymbolicLink()) {
    fail("Windows MCP launcher must be a regular file");
  }
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
  const expectedManifestKeys = [
    "extension.js",
    "inventory.js",
    ...treeSources.flatMap((entry) => entry.files.map((name) => `${entry.output}/${name}`)),
  ];
  assertExactKeys(distManifest.files, expectedManifestKeys, "dist manifest files", fail);

  // Flat extension sources: emitted with emitTransform applied.
  for (const name of ["extension.js", "inventory.js"]) {
    assertExactKeys(distManifest.files[name], ["sha256"], `dist manifest ${name}`, fail);
    const bytes = await readFile(path.join(pluginRoot, "dist", name));
    const sourceText = await readFile(path.join(sourceRoot, name), "utf8");
    if (!bytes.equals(Buffer.from(emitTransform(sourceText), "utf8"))) {
      fail(`dist/${name} is stale against src/v0.1/${name}`);
    }
    if (distManifest.files[name].sha256 !== sha256(bytes)) fail(`dist hash mismatch for ${name}`);
    const source = bytes.toString("utf8");
    if (!source.includes(`export const PLUGIN_VERSION = "${PLUGIN_VERSION}";`)) {
      fail(`${name} does not embed exported PLUGIN_VERSION ${PLUGIN_VERSION}`);
    }
    if (!/export\s+const\s+SCHEMA_VERSION\s*=\s*["']1["']/u.test(source)) {
      fail(`${name} does not embed exported SCHEMA_VERSION 1`);
    }
    assertRuntimeImports(`dist/${name}`, source);
  }

  // Tree payloads: byte equality against their src trees plus manifest hashes
  // and the dependency-free runtime-import rule.
  for (const treeEntry of treeSources) {
    for (const relative of treeEntry.files) {
      const distRelative = `dist/${treeEntry.output}/${relative}`;
      const sourceRelative = `${path.relative(repositoryRoot, treeEntry.source).split(path.sep).join("/")}/${relative}`;
      const distBytes = await readFile(path.join(pluginRoot, distRelative));
      const sourceBytes = await readFile(path.join(repositoryRoot, sourceRelative));
      if (!distBytes.equals(sourceBytes)) fail(`${distRelative} is stale against ${sourceRelative}`);
      if (distManifest.files[`${treeEntry.output}/${relative}`].sha256 !== sha256(distBytes)) {
        fail(`dist hash mismatch for ${treeEntry.output}/${relative}`);
      }
      assertRuntimeImports(distRelative, distBytes.toString("utf8"));
    }
  }

  const distManifestText = await readFile(distManifestPath, "utf8");
  if (distManifestText !== `${JSON.stringify(distManifest, null, 2)}\n`) fail("dist manifest is not canonical deterministic JSON");
  const rootLicense = await readFile(path.join(repositoryRoot, "LICENSE"));
  const payloadLicense = await readFile(path.join(pluginRoot, "LICENSE"));
  if (sha256(rootLicense) !== sha256(payloadLicense)) fail("payload LICENSE must match root LICENSE byte-for-byte");

  console.log(`verified clean payload: omp-spec-kit@${PLUGIN_VERSION}`);
}

await verifyPackage();

import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
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
  { source: path.join(repositoryRoot, "src", "evidence"), output: "evidence" },
  { source: path.join(repositoryRoot, "src", "authoring"), output: "authoring" },
  { source: path.join(repositoryRoot, "src", "enforcement"), output: "enforcement" },
  { source: path.join(repositoryRoot, "src", "gate"), output: "gate" },
]);

function fail(message) {
  throw new Error(`verify-package: ${message}`);
}

// Walk paths relative to one root, rejecting symlinks before descending.
async function walkTree(rootDirectory, onEntry) {
  async function visit(relativeDirectory = "") {
    const directory = path.join(rootDirectory, ...relativeDirectory.split("/"));
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const stats = await lstat(path.join(directory, entry.name));
      onEntry(relative, stats);
      if (stats.isDirectory()) await visit(relative);
    }
  }
  await visit();
}

// The closed dist payload mirrors each src tree exactly; the expectation is
// derived from the source trees so it cannot drift from the build input.
async function collectTreeSources(rootDirectory, label) {
  const files = [];
  await walkTree(rootDirectory, (relative, stats) => {
    if (stats.isSymbolicLink()) fail(`symlink forbidden in ${label}: ${relative}`);
    if (!stats.isDirectory() && !stats.isFile()) fail(`non-regular source entry: ${label}/${relative}`);
    if (stats.isFile() && relative.endsWith(".js")) files.push(relative);
    else if (stats.isFile()) fail(`unexpected non-JS source file: ${label}/${relative}`);
  });
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
  ...new Set([".claude-plugin", "dist", "hooks", "skills", "skills/engineering-anti-bike", "skills/spec-elicitation", "skills/spec-inventory", ...allTreeDistDirectories]),
]);
const expectedFiles = Object.freeze([
  ".claude-plugin/plugin.json",
  ".mcp.json",
  "LICENSE",
  "README.md",
  "dist/extension.js",
  "dist/manifest.json",
  "hooks/hooks.json",
  "hooks/normalize.mjs",
  "hooks/pretooluse.mjs",
  "hooks/sessionstart.mjs",
  "package.json",
  "skills/engineering-anti-bike/SKILL.md",
  "skills/spec-elicitation/SKILL.md",
  "skills/spec-inventory/SKILL.md",
  ...treeSources.flatMap((tree) => tree.files.map((name) => `dist/${tree.output}/${name}`)),
]);
const packageFiles = Object.freeze([
  ".claude-plugin/",
  ".mcp.json",
  "README.md",
  "LICENSE",
  "package.json",
  "dist/",
  "hooks/",
  "skills/",
]);
// Hosts substitute these placeholders: Claude Code natively, OMP for the
// plugin root in mcpServers command/args/env. Exactly this launch shape is
// allowed; no shell launcher ships.
const PLUGIN_ROOT_PLACEHOLDER = "${CLAUDE_PLUGIN_ROOT}";
const PROJECT_DIR_PLACEHOLDER = "${CLAUDE_PROJECT_DIR}";
const REGISTRY_URL_PLACEHOLDER = "${OMP_SPEC_REGISTRY_URL}";
const REGISTRY_TOKEN_PLACEHOLDER = "Bearer ${OMP_SPEC_REGISTRY_TOKEN}";
const HOOK_MATCHER =
  "Read|Write|Edit|MultiEdit|NotebookEdit|Glob|Grep|Bash|PowerShell|mcp__plugin_omp-spec-kit_omp-spec-kit__.*";

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
  await walkTree(pluginRoot, (relative, stats) => {
    if (stats.isSymbolicLink()) fail(`symlink forbidden in payload: ${relative}`);
    if (stats.isDirectory()) directories.push(relative);
    else if (stats.isFile()) files.push(relative);
    else fail(`non-regular payload entry forbidden: ${relative}`);
  });
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

function normalizeBuildSource(text) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

// Flat extension sources are one directory deeper in src than in dist. Keep
// the emitted sibling-tree rewrites identical to build-plugin.mjs.
function emitTransform(text) {
  return normalizeBuildSource(text)
    .replaceAll('"../adapters/', '"./adapters/')
    .replaceAll('"../enforcement/', '"./enforcement/')
    .replaceAll('"../gate/', '"./gate/');
}

function assertRuntimeImports(relativePath, source) {
  if (/\brequire\s*\(/u.test(source)) fail(`${relativePath} uses CommonJS require`);
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.startsWith("node:")) continue;
    // dist/extension.js may import its flat siblings and the adapters subtree.
    if (
      relativePath === "dist/extension.js" &&
      (specifier.startsWith("./adapters/") ||
        specifier.startsWith("./kernel/") ||
        specifier.startsWith("./evidence/") ||
        specifier.startsWith("./authoring/") ||
        specifier.startsWith("./enforcement/") ||
        specifier.startsWith("./gate/"))
    ) {
      continue;
    }
    // Tree modules may import sibling modules within their own subtree and
    // across dist subtrees, but never outside the closed dist payload.
    if (
      (relativePath.startsWith("dist/kernel/") ||
        relativePath.startsWith("dist/adapters/") ||
        relativePath.startsWith("dist/mcp/") ||
        relativePath.startsWith("dist/evidence/") ||
        relativePath.startsWith("dist/authoring/") ||
        relativePath.startsWith("dist/enforcement/") ||
        relativePath.startsWith("dist/gate/")) &&
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
  assertExactKeys(mcpJson, ["mcpServers"], ".mcp.json", fail);
  assertExactKeys(mcpJson.mcpServers, ["omp-spec-kit"], ".mcp.json servers", fail);
  const server = mcpJson.mcpServers["omp-spec-kit"];
  if (server.type !== "http") fail(".mcp.json server must be a streamable HTTP MCP server");
  assertExactKeys(server, ["type", "url", "headers"], ".mcp.json omp-spec-kit entry", fail);
  if (server.url !== REGISTRY_URL_PLACEHOLDER) {
    fail(`.mcp.json url must be exactly "${REGISTRY_URL_PLACEHOLDER}"`);
  }
  assertExactKeys(server.headers, ["Authorization"], ".mcp.json headers", fail);
  if (server.headers.Authorization !== REGISTRY_TOKEN_PLACEHOLDER) {
    fail(`.mcp.json Authorization must be exactly "${REGISTRY_TOKEN_PLACEHOLDER}"`);
  }
  // No local corpus path may survive in the shipped declaration.
  const serialized = JSON.stringify(mcpJson);
  for (const forbidden of ["command", "args", "cwd", "OMP_SPEC_KIT_ROOT", "stdio"]) {
    if (serialized.includes(forbidden)) fail(`.mcp.json must not contain ${forbidden}`);
  }
}

// The plugin manifest carries identity only: an mcpServers or hooks key here
// would override .mcp.json for OMP (or re-register hooks) on every host.
async function verifyPluginJson() {
  const pluginJson = await readStrictJson(path.join(pluginRoot, ".claude-plugin", "plugin.json"), ".claude-plugin/plugin.json", fail);
  assertExactKeys(
    pluginJson,
    ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"],
    ".claude-plugin/plugin.json",
    fail,
  );
  if (pluginJson.name !== "omp-spec-kit" || pluginJson.version !== PLUGIN_VERSION) {
    fail(".claude-plugin/plugin.json identity/version mismatch");
  }
  if (typeof pluginJson.description !== "string" || pluginJson.description.trim() === "") {
    fail(".claude-plugin/plugin.json description must be non-empty");
  }
  assertExactKeys(pluginJson.author, ["name"], ".claude-plugin/plugin.json author", fail);
  if (pluginJson.author.name !== "stgmt") fail(".claude-plugin/plugin.json author must be stgmt");
  if (pluginJson.homepage !== REPOSITORY_URL || pluginJson.repository !== REPOSITORY_URL) {
    fail(".claude-plugin/plugin.json homepage/repository mismatch");
  }
  if (pluginJson.license !== "MIT") fail(".claude-plugin/plugin.json license must be MIT");
  if (!sameStrings(pluginJson.keywords, ["specifications", "mcp", "spec-kit"])) {
    fail(".claude-plugin/plugin.json keywords mismatch");
  }
}

async function verifyHooks() {
  const hooksJson = await readStrictJson(path.join(pluginRoot, "hooks", "hooks.json"), "hooks/hooks.json", fail);
  assertExactKeys(hooksJson, ["hooks"], "hooks/hooks.json", fail);
  assertExactKeys(hooksJson.hooks, ["PreToolUse", "SessionStart"], "hooks/hooks.json hooks", fail);
  const groups = hooksJson.hooks.PreToolUse;
  if (!Array.isArray(groups) || groups.length !== 1) fail("hooks/hooks.json must declare one PreToolUse matcher group");
  assertExactKeys(groups[0], ["matcher", "hooks"], "hooks/hooks.json matcher group", fail);
  if (groups[0].matcher !== HOOK_MATCHER) fail(`hooks/hooks.json matcher must be exactly "${HOOK_MATCHER}"`);
  if (!Array.isArray(groups[0].hooks) || groups[0].hooks.length !== 1) fail("hooks/hooks.json must declare one hook command");
  const hook = groups[0].hooks[0];
  assertExactKeys(hook, ["type", "command", "timeout"], "hooks/hooks.json hook", fail);
  if (hook.type !== "command" || hook.timeout !== 10) fail("hooks/hooks.json hook must be a command with timeout 10");
  if (hook.command !== `node "${PLUGIN_ROOT_PLACEHOLDER}/hooks/pretooluse.mjs"`) {
    fail(`hooks/hooks.json command must be exactly: node "${PLUGIN_ROOT_PLACEHOLDER}/hooks/pretooluse.mjs"`);
  }
  const sessionGroups = hooksJson.hooks.SessionStart;
  if (!Array.isArray(sessionGroups) || sessionGroups.length !== 1) fail("hooks/hooks.json must declare one SessionStart group");
  assertExactKeys(sessionGroups[0], ["hooks"], "hooks/hooks.json SessionStart group", fail);
  if (!Array.isArray(sessionGroups[0].hooks) || sessionGroups[0].hooks.length !== 1) fail("hooks/hooks.json must declare one SessionStart command");
  const sessionHook = sessionGroups[0].hooks[0];
  assertExactKeys(sessionHook, ["type", "command", "timeout"], "hooks/hooks.json SessionStart hook", fail);
  if (sessionHook.type !== "command" || sessionHook.timeout !== 10) fail("hooks/hooks.json SessionStart hook must be a command with timeout 10");
  if (sessionHook.command !== `node "${PLUGIN_ROOT_PLACEHOLDER}/hooks/sessionstart.mjs"`) {
    fail(`hooks/hooks.json SessionStart command must be exactly: node "${PLUGIN_ROOT_PLACEHOLDER}/hooks/sessionstart.mjs"`);
  }

  const sessionEntry = await readFile(path.join(pluginRoot, "hooks", "sessionstart.mjs"), "utf8");
  for (const [name, source] of [["hooks/sessionstart.mjs", sessionEntry]]) {
    if (/\brequire\s*\(/u.test(source)) fail(`${name} uses CommonJS require`);
    for (const specifier of importedSpecifiers(source)) {
      if (!specifier.startsWith("node:")) fail(`${name} has forbidden runtime import: ${specifier}`);
    }
  }

  // The hook scripts are dependency-free: node builtins, each other, and the
  // shipped classifier loaded by a relative path inside the payload.
  const entry = await readFile(path.join(pluginRoot, "hooks", "pretooluse.mjs"), "utf8");
  const normalize = await readFile(path.join(pluginRoot, "hooks", "normalize.mjs"), "utf8");
  for (const [name, source, allowed] of [
    ["hooks/pretooluse.mjs", entry, new Set(["./normalize.mjs"])],
    ["hooks/normalize.mjs", normalize, new Set()],
  ]) {
    if (/\brequire\s*\(/u.test(source)) fail(`${name} uses CommonJS require`);
    for (const specifier of importedSpecifiers(source)) {
      if (!specifier.startsWith("node:") && !allowed.has(specifier)) fail(`${name} has forbidden runtime import: ${specifier}`);
    }
  }
  if (!entry.includes('"../dist/enforcement/classifier.js"')) {
    fail("hooks/pretooluse.mjs must load ../dist/enforcement/classifier.js");
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
  await verifyPluginJson();
  await verifyHooks();

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
  if (manifest.engines.omp !== "18.0.11") fail("package must pin OMP 18.0.11");
  if (!sameStrings(manifest.omp.extensions, ["./dist/extension.js"])) fail("package must contain one extension entry");

  const distManifestPath = path.join(pluginRoot, "dist", "manifest.json");
  const distManifest = await readStrictJson(distManifestPath, "dist/manifest.json", fail);
  assertExactKeys(distManifest, ["schema", "pluginVersion", "files"], "dist manifest", fail);
  if (distManifest.schema !== "omp-spec-kit-dist-manifest@1" || distManifest.pluginVersion !== PLUGIN_VERSION) {
    fail("dist manifest schema/version mismatch");
  }
  const expectedManifestKeys = [
    "extension.js",
    ...treeSources.flatMap((entry) => entry.files.map((name) => `${entry.output}/${name}`)),
  ];
  assertExactKeys(distManifest.files, expectedManifestKeys, "dist manifest files", fail);

  // Flat extension sources: emitted with emitTransform applied.
  for (const name of ["extension.js"]) {
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
      const sourceText = await readFile(path.join(repositoryRoot, sourceRelative), "utf8");
      if (!distBytes.equals(Buffer.from(normalizeBuildSource(sourceText), "utf8"))) {
        fail(`${distRelative} is stale against ${sourceRelative}`);
      }
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

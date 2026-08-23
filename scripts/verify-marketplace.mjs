import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_VERSION = "0.2.0";
export const MARKETPLACE_SCHEMA = "https://anthropic.com/claude-code/marketplace.schema.json";
export const REPOSITORY_URL = "https://github.com/stgmt/omp-spec-kit";
export const REPOSITORY_GIT_URL = `${REPOSITORY_URL}.git`;
export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function verifierError(scope, message) {
  return new Error(`${scope}: ${message}`);
}

export function assertExactKeys(value, expected, label, fail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly: ${wanted.join(", ")}`);
  }
}

function assertNoDuplicateKeys(text, fail) {
  let offset = 0;
  const whitespace = /\s/u;

  function skipWhitespace() {
    while (offset < text.length && whitespace.test(text[offset])) offset += 1;
  }

  function parseString() {
    const start = offset;
    if (text[offset] !== '"') fail("invalid JSON string");
    offset += 1;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === '"') {
        try {
          return JSON.parse(text.slice(start, offset));
        } catch {
          fail("invalid JSON string escape");
        }
      }
      if (char === "\\") {
        if (offset >= text.length) fail("unterminated JSON escape");
        if (text[offset] === "u") {
          offset += 1;
          if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(offset, offset + 4))) fail("invalid JSON unicode escape");
          offset += 4;
        } else {
          offset += 1;
        }
      } else if (char.charCodeAt(0) < 0x20) {
        fail("unescaped control character in JSON string");
      }
    }
    fail("unterminated JSON string");
  }

  function parseValue() {
    skipWhitespace();
    const char = text[offset];
    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"') return void parseString();
    const tail = text.slice(offset);
    const token = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/u.exec(tail)?.[0];
    if (!token) fail("invalid JSON value");
    offset += token.length;
  }

  function parseObject() {
    offset += 1;
    skipWhitespace();
    const keys = new Set();
    if (text[offset] === "}") {
      offset += 1;
      return;
    }
    while (offset < text.length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) fail(`duplicate JSON key: ${key}`);
      keys.add(key);
      skipWhitespace();
      if (text[offset++] !== ":") fail("missing JSON object colon");
      parseValue();
      skipWhitespace();
      const delimiter = text[offset++];
      if (delimiter === "}") return;
      if (delimiter !== ",") fail("invalid JSON object delimiter");
    }
    fail("unterminated JSON object");
  }

  function parseArray() {
    offset += 1;
    skipWhitespace();
    if (text[offset] === "]") {
      offset += 1;
      return;
    }
    while (offset < text.length) {
      parseValue();
      skipWhitespace();
      const delimiter = text[offset++];
      if (delimiter === "]") return;
      if (delimiter !== ",") fail("invalid JSON array delimiter");
    }
    fail("unterminated JSON array");
  }

  parseValue();
  skipWhitespace();
  if (offset !== text.length) fail("trailing content after JSON value");
}

export async function readStrictJson(filePath, label, fail) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    fail(`cannot read ${label}`);
  }
  assertNoDuplicateKeys(text, fail);
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

async function findCatalogs(root) {
  const found = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (
        entry.isFile() &&
        entry.name === "marketplace.json" &&
        [".omp-plugin", ".claude-plugin"].includes(path.basename(directory))
      ) {
        found.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }
  await visit(root);
  return found.sort();
}

export async function verifyMarketplace() {
  const fail = (message) => {
    throw verifierError("verify-marketplace", message);
  };
  const expectedCatalog = ".omp-plugin/marketplace.json";
  const catalogs = await findCatalogs(repositoryRoot);
  if (catalogs.length !== 1 || catalogs[0] !== expectedCatalog) {
    fail(`catalog layout must be exactly ${expectedCatalog}; found ${catalogs.join(", ") || "none"}`);
  }

  const catalogPath = path.join(repositoryRoot, ".omp-plugin", "marketplace.json");
  const catalog = await readStrictJson(catalogPath, expectedCatalog, fail);
  assertExactKeys(catalog, ["$schema", "name", "owner", "metadata", "plugins"], "catalog", fail);
  if (catalog.$schema !== MARKETPLACE_SCHEMA) fail("unexpected marketplace schema URI");
  if (catalog.name !== "omp-spec-kit") fail("catalog name must be omp-spec-kit");

  assertExactKeys(catalog.owner, ["name"], "catalog.owner", fail);
  if (catalog.owner.name !== "stgmt") fail("catalog owner must be stgmt");
  assertExactKeys(catalog.metadata, ["description", "version"], "catalog.metadata", fail);
  if (typeof catalog.metadata.description !== "string" || catalog.metadata.description.trim() === "") {
    fail("catalog metadata description must be non-empty");
  }
  if (catalog.metadata.version !== PLUGIN_VERSION) fail("catalog metadata version mismatch");

  if (!Array.isArray(catalog.plugins) || catalog.plugins.length !== 1) fail("catalog must contain one plugin");
  const plugin = catalog.plugins[0];
  assertExactKeys(
    plugin,
    ["name", "source", "description", "version", "author", "homepage", "repository", "license", "category"],
    "catalog plugin",
    fail,
  );
  if (plugin.name !== "omp-spec-kit") fail("plugin name must be omp-spec-kit");
  if (plugin.source !== "./plugins/omp-spec-kit") fail("plugin source must be ./plugins/omp-spec-kit");
  if (typeof plugin.description !== "string" || plugin.description.trim() === "") fail("plugin description must be non-empty");
  if (plugin.version !== PLUGIN_VERSION) fail("plugin version mismatch");
  assertExactKeys(plugin.author, ["name"], "catalog plugin author", fail);
  if (plugin.author.name !== "stgmt") fail("plugin author must be stgmt");
  if (plugin.homepage !== REPOSITORY_URL || plugin.repository !== REPOSITORY_GIT_URL) fail("plugin repository URLs mismatch");
  if (plugin.license !== "MIT" || plugin.category !== "development") fail("plugin license/category mismatch");

  const pluginDirectoryEntries = await readdir(path.join(repositoryRoot, "plugins"), { withFileTypes: true });
  if (
    pluginDirectoryEntries.length !== 1 ||
    pluginDirectoryEntries[0].name !== "omp-spec-kit" ||
    !pluginDirectoryEntries[0].isDirectory() ||
    pluginDirectoryEntries[0].isSymbolicLink()
  ) {
    fail("plugins/ must contain exactly one real child directory: omp-spec-kit");
  }

  const sourcePath = path.resolve(repositoryRoot, plugin.source);
  const relativeSource = path.relative(repositoryRoot, sourcePath);
  if (relativeSource.startsWith("..") || path.isAbsolute(relativeSource)) fail("plugin source escapes repository root");
  const sourceStats = await lstat(sourcePath);
  if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) fail("plugin source must be a real directory");
  const realRoot = await realpath(repositoryRoot);
  const realSource = await realpath(sourcePath);
  const realRelative = path.relative(realRoot, realSource);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) fail("plugin source resolves outside repository root");

  const child = await readStrictJson(path.join(sourcePath, "package.json"), "plugin package.json", fail);
  if (child.name !== plugin.name || child.version !== plugin.version) fail("catalog and child identity/version mismatch");
  if (!child.omp || Object.keys(child.omp).length !== 1 || !Array.isArray(child.omp.extensions)) {
    fail("child manifest must declare only omp.extensions");
  }
  if (child.omp.extensions.length !== 1 || child.omp.extensions[0] !== "./dist/extension.js") {
    fail("child manifest must declare one ./dist/extension.js entry");
  }

  console.log(`verified marketplace: omp-spec-kit@${PLUGIN_VERSION}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await verifyMarketplace();
}

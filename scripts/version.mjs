#!/usr/bin/env node
/**
 * The release version is written once and copied everywhere.
 *
 * `package.json` is the record, because npm publishes from it. Every other
 * copy exists for a consumer that reads the file directly and cannot follow a
 * pointer: the child plugin manifest, the Claude plugin manifest, the two
 * marketplace fields, the `PLUGIN_VERSION` constant hosts report, and the
 * extension entry that `dist/` is byte-compared against.
 *
 *   node scripts/version.mjs               check every copy, exit 1 on drift
 *   node scripts/version.mjs set 3.2.2     write every copy, then check
 *
 * `check` runs inside `npm run verify`, so a half-finished bump fails the
 * build instead of shipping a host that reports one version and serves another.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SEMVER = /^\d+\.\d+\.\d+$/u;

const EXTENSION_CONSTANT = /export const PLUGIN_VERSION = "([^"]+)";/u;

function jsonTarget(file, pick, apply) {
  return {
    file,
    values(root) {
      const value = JSON.parse(readFileSync(path.join(root, file), "utf8"));
      return pick(value);
    },
    write(root, version) {
      const target = path.join(root, file);
      const value = JSON.parse(readFileSync(target, "utf8"));
      apply(value, version);
      writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    },
  };
}

function constantTarget(file) {
  return {
    file,
    values(root) {
      const match = EXTENSION_CONSTANT.exec(readFileSync(path.join(root, file), "utf8"));
      return match === null ? [] : [match[1]];
    },
    write(root, version) {
      const target = path.join(root, file);
      const text = readFileSync(target, "utf8");
      if (!EXTENSION_CONSTANT.test(text)) throw new Error(`${file} does not declare PLUGIN_VERSION`);
      writeFileSync(target, text.replace(EXTENSION_CONSTANT, `export const PLUGIN_VERSION = "${version}";`));
    },
  };
}

/**
 * Every file that must carry the version literally. `package-lock.json` is
 * included only when npm already tracks the root version there.
 */
export const VERSION_TARGETS = Object.freeze([
  jsonTarget(
    "package.json",
    (value) => [value.version],
    (value, version) => {
      value.version = version;
    },
  ),
  jsonTarget(
    "plugins/omp-spec-kit/package.json",
    (value) => [value.version],
    (value, version) => {
      value.version = version;
    },
  ),
  jsonTarget(
    "plugins/omp-spec-kit/.claude-plugin/plugin.json",
    (value) => [value.version],
    (value, version) => {
      value.version = version;
    },
  ),
  jsonTarget(
    ".claude-plugin/marketplace.json",
    (value) => [value?.metadata?.version, value?.plugins?.[0]?.version].filter((entry) => entry !== undefined),
    (value, version) => {
      value.metadata.version = version;
      value.plugins[0].version = version;
    },
  ),
  constantTarget("src/adapters/plugin-version.js"),
  constantTarget("src/v0.1/extension.js"),
]);

/** Report every copy against the record, without touching anything. */
export function checkVersions(root = REPOSITORY_ROOT) {
  const record = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  const rows = [];
  for (const target of VERSION_TARGETS) {
    for (const value of target.values(root)) rows.push({ file: target.file, value, ok: value === record });
  }
  return { record, rows, ok: rows.every((row) => row.ok) };
}

/** Write the record and every copy, then report. */
export function setVersion(version, root = REPOSITORY_ROOT) {
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(`version must be a bare semver (x.y.z), received ${JSON.stringify(version)}`);
  }
  for (const target of VERSION_TARGETS) target.write(root, version);
  return checkVersions(root);
}

function report(result, out) {
  out(`version ${result.record}`);
  for (const row of result.rows) {
    out(`  ${row.ok ? "ok  " : "DRIFT"} ${row.file} = ${row.value}`);
  }
}

function main(argv, { out = console.log, err = console.error } = {}) {
  const [command, argument] = argv;
  if (command === undefined || command === "check") {
    const result = checkVersions();
    report(result, out);
    if (!result.ok) err("version: every copy must equal the package.json version");
    return result.ok ? 0 : 1;
  }
  if (command === "set") {
    const result = setVersion(argument);
    report(result, out);
    return result.ok ? 0 : 1;
  }
  err("usage: node scripts/version.mjs [check | set <x.y.z>]");
  return 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}

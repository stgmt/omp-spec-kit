/**
 * Builds the YouTrack app package (TASK-16): stages the manifest-derived file
 * set into dist/spec-graph-app/ (the directory `youtrack-app app upload`
 * consumes) and writes a deterministic dist/spec-graph-app-<version>.zip
 * for the UI upload path, the release, and the future Marketplace listing.
 *
 * Usage: node scripts/build-youtrack-app.mjs [--app <dir>] [--out <dir>] [--zip <path>]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoot } from "./verify-marketplace.mjs";
import { buildPackage } from "./app-package.mjs";

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

const appDir = path.resolve(repositoryRoot, argValue("--app", "tools/spec-graph-app"));
const manifest = JSON.parse(readFileSync(path.join(appDir, "manifest.json"), "utf8"));
const outDir = path.resolve(repositoryRoot, argValue("--out", "dist/spec-graph-app"));
const zipPath = path.resolve(
  repositoryRoot,
  argValue("--zip", `dist/spec-graph-app-${manifest.version}.zip`),
);

const result = await buildPackage(appDir, { outDir, zipPath });
console.log(`build-youtrack-app: ${result.files.length} files -> ${path.relative(repositoryRoot, outDir)}`);
console.log(
  `build-youtrack-app: ${path.relative(repositoryRoot, zipPath)} (${result.bytes} bytes, sha256 ${result.sha256})`,
);

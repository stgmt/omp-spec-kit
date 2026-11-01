/**
 * Placement gate for the YouTrack app (FR-9, AC-9.1/AC-9.2).
 *
 * The setup page must be reachable only under Administration -> Integrations,
 * which YouTrack renders from `ADMINISTRATION_MENU_ITEM`. `MAIN_MENU_ITEM`
 * renders in the main left navigation and is forbidden. The gate runs against
 * both the source app directory and the staged tree produced while assembling
 * a release candidate, so a stale package can never be published.
 *
 * Usage:
 *   node scripts/check-app-placement.mjs [--app-dir tools/spec-graph-app]
 *   node scripts/check-app-placement.mjs --manifest release-candidate/spec-graph-app/manifest.json
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN_EXTENSION_POINT = "MAIN_MENU_ITEM";
const SETUP_WIDGET_KEY = "spec-app";
const SETUP_EXTENSION_POINT = "ADMINISTRATION_MENU_ITEM";

function fail(message) {
  throw new Error(`check-app-placement: ${message}`);
}

function parseArgs(argv) {
  const values = { appDir: null, manifest: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-dir") values.appDir = argv[++index];
    else if (arg === "--manifest") values.manifest = argv[++index];
    else throw new Error(`check-app-placement: unknown argument ${arg}`);
  }
  if (values.appDir && values.manifest) fail("pass either --app-dir or --manifest, not both");
  return values;
}

const { appDir, manifest } = parseArgs(process.argv.slice(2));
const manifestPath = manifest
  ? path.resolve(repositoryRoot, manifest)
  : path.join(path.resolve(repositoryRoot, appDir ?? "tools/spec-graph-app"), "manifest.json");

let parsed;
try {
  parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`cannot read ${path.relative(repositoryRoot, manifestPath)}: ${error.message}`);
}

const widgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];
if (widgets.length === 0) fail(`${path.relative(repositoryRoot, manifestPath)} declares no widgets`);

const setup = widgets.find((widget) => widget.key === SETUP_WIDGET_KEY);
if (!setup) fail(`${SETUP_WIDGET_KEY} is missing from ${path.relative(repositoryRoot, manifestPath)}`);
if (setup.extensionPoint !== SETUP_EXTENSION_POINT) {
  fail(`${SETUP_WIDGET_KEY} must be ${SETUP_EXTENSION_POINT}, got ${setup.extensionPoint ?? "<none>"}`);
}

const straySetup = widgets.filter(
  (widget) => widget.key !== SETUP_WIDGET_KEY && widget.key === "spec-service-panel",
);
if (straySetup.length > 0) {
  fail(
    `${straySetup.map((widget) => widget.key).join(", ")} must not exist; the issue-view Spec Service card is a second setup entry point`,
  );
}
if (widgets.filter((widget) => widget.extensionPoint === SETUP_EXTENSION_POINT).length !== 1) {
  fail(`exactly one widget must use ${SETUP_EXTENSION_POINT}`);
}

const legacy = widgets.filter((widget) => widget.extensionPoint === FORBIDDEN_EXTENSION_POINT);
if (legacy.length > 0) {
  fail(
    `${FORBIDDEN_EXTENSION_POINT} is forbidden; ${legacy.map((widget) => widget.key).join(", ")} would appear in the main left navigation`,
  );
}

const version = typeof parsed.version === "string" ? parsed.version : "<no version>";
process.stdout.write(
  `check-app-placement: ok ${version} (${SETUP_WIDGET_KEY} -> ${SETUP_EXTENSION_POINT}, no ${FORBIDDEN_EXTENSION_POINT})\n`,
);

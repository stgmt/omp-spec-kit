import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import yauzl from "yauzl";
import { buildPackage, derivePackageFiles } from "../scripts/app-package.mjs";

function makeApp(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "app-package-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function baseManifest(overrides = {}) {
  return JSON.stringify({
    name: "t-app",
    version: "1.2.3",
    widgets: [{ key: "panel", indexPath: "panel/index.html" }],
    httpHandlers: [{ file: "handler" }],
    ...overrides,
  });
}

function listZipEntries(zipPath) {
  return new Promise((resolve, reject) => {
    const names = [];
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on("entry", (entry) => {
        names.push(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(names));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

test("derives the package file set from the manifest", () => {
  const dir = makeApp({
    "manifest.json": baseManifest(),
    "settings.json": "{}",
    "handler.js": "const http = require('@jetbrains/youtrack-scripting-api/http');",
    "widgets/panel/index.html": "<html></html>",
  });
  assert.deepEqual(derivePackageFiles(dir), [
    "handler.js",
    "manifest.json",
    "settings.json",
    "widgets/panel/index.html",
  ]);
});

test("rejects an app without manifest.json", () => {
  const dir = makeApp({ "readme.txt": "x" });
  assert.throws(() => derivePackageFiles(dir), /manifest\.json/);
});

test("rejects a manifest-referenced file that does not exist", () => {
  const dir = makeApp({ "manifest.json": baseManifest(), "settings.json": "{}" });
  assert.throws(() => derivePackageFiles(dir), /widgets\/panel\/index\.html/);
});

test("rejects manifest paths escaping the app root", () => {
  const dir = makeApp({
    "manifest.json": baseManifest({ widgets: [{ key: "x", indexPath: "../evil.html" }] }),
    "evil.html": "x",
  });
  assert.throws(() => derivePackageFiles(dir), /escape|outside|root/i);
});

test("follows local references from html and js, ignoring external ones", () => {
  const dir = makeApp({
    "manifest.json": baseManifest(),
    "settings.json": "{}",
    "handler.js": "const m = require('./lib/mail.js');\nconst http = require('@jetbrains/youtrack-scripting-api/http');",
    "lib/mail.js": "module.exports = {};",
    "widgets/panel/index.html": '<script src="extra.js"></script><link href="https://cdn.example.com/x.css">',
    "widgets/panel/extra.js": "console.log(1);",
  });
  assert.deepEqual(derivePackageFiles(dir), [
    "handler.js",
    "lib/mail.js",
    "manifest.json",
    "settings.json",
    "widgets/panel/extra.js",
    "widgets/panel/index.html",
  ]);
});

test("keeps dev-only files out of the package", () => {
  const dir = makeApp({
    "manifest.json": baseManifest(),
    "settings.json": "{}",
    "handler.js": "x",
    "widgets/panel/index.html": "x",
    "prototypes.html": "dev",
    "spec-graph-app.zip": "stale",
  });
  assert.deepEqual(derivePackageFiles(dir), [
    "handler.js",
    "manifest.json",
    "settings.json",
    "widgets/panel/index.html",
  ]);
});

test("buildPackage writes a staged tree and a deterministic zip", async () => {
  const dir = makeApp({
    "manifest.json": baseManifest(),
    "settings.json": "{}",
    "handler.js": "x",
    "widgets/panel/index.html": "x",
  });
  const out1 = path.join(dir, "out1");
  const zip1 = path.join(dir, "a.zip");
  const out2 = path.join(dir, "out2");
  const zip2 = path.join(dir, "b.zip");
  const r1 = await buildPackage(dir, { outDir: out1, zipPath: zip1 });
  const r2 = await buildPackage(dir, { outDir: out2, zipPath: zip2 });
  assert.deepEqual(readFileSync(zip1), readFileSync(zip2), "same inputs must produce identical zip bytes");
  assert.equal(r1.sha256, r2.sha256);
  assert.equal(readFileSync(path.join(out1, "widgets/panel/index.html"), "utf8"), "x");
  const entries = await listZipEntries(zip1);
  assert.deepEqual(entries, ["handler.js", "manifest.json", "settings.json", "widgets/panel/index.html"]);
  for (const name of entries) assert.ok(!name.includes("\\"), `backslash path in zip: ${name}`);
});

test("the Spec Service page lives in the administration menu", () => {
  const appDir = path.join(process.cwd(), "tools", "spec-graph-app");
  const manifest = JSON.parse(readFileSync(path.join(appDir, "manifest.json"), "utf8"));
  const widgets = manifest.widgets ?? [];

  const page = widgets.find((widget) => widget.key === "spec-app");
  assert.ok(page, "the spec-app widget must exist");
  assert.equal(page.extensionPoint, "ADMINISTRATION_MENU_ITEM", "the management page belongs to the administration menu");

  // The left navigation must stay free of the management page: no widget may
  // fall back to the old MAIN_MENU_ITEM placement.
  const legacy = widgets.filter((widget) => widget.extensionPoint === "MAIN_MENU_ITEM");
  assert.deepEqual(legacy, [], "MAIN_MENU_ITEM is not allowed in this app");

  // The issue-view Spec Service card was removed: the only setup entry point
  // is the administration page. A second widget named "Spec Service" would
  // surface an "Open Spec Service" gate inside every issue.
  assert.equal(
    widgets.filter((widget) => widget.key === "spec-service-panel").length,
    0,
    "spec-service-panel must not return; setup is reachable only from Administration → Integrations",
  );
  assert.equal(
    widgets.filter((widget) => widget.extensionPoint === "ADMINISTRATION_MENU_ITEM").length,
    1,
    "exactly one administration page may exist",
  );
});

test("install docs only point at the current app package", () => {
  const manifest = JSON.parse(readFileSync(path.join("tools", "spec-graph-app", "manifest.json"), "utf8"));
  const docs = [
    "README.md",
    "tools/spec-graph-app/README.md",
    "docs/specs-repo-operations.md",
    "skills/spec-stack-setup/SKILL.md",
  ];
  for (const file of docs) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/spec-graph-app-(\d+\.\d+\.\d+)\.zip/g)) {
      assert.equal(
        match[1],
        manifest.version,
        `${file} references app ${match[1]} but tools/spec-graph-app is ${manifest.version}; install docs must not pin an old package`,
      );
    }
  }
});

test("no current manifest declares MAIN_MENU_ITEM", () => {
  // Release staging is rebuilt from tools/spec-graph-app; the checked-in
  // extracted tree was removed because it kept a pre-1.0.27 manifest alive.
  const roots = ["tools/spec-graph-app", "release-candidate"];
  const offenders = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const absolute = path.join(entry.parentPath ?? entry.path, entry.name);
      const text = readFileSync(absolute, "utf8");
      if (text.includes('"MAIN_MENU_ITEM"')) offenders.push(absolute);
    }
  }
  assert.deepEqual(offenders, [], `MAIN_MENU_ITEM must not survive in a current manifest: ${offenders.join(", ")}`);
});

test("the Spec Service page ships health checks and dashboard provisioning", () => {
  const appDir = path.join("tools", "spec-graph-app");
  const html = readFileSync(path.join(appDir, "widgets", "spec-app", "index.html"), "utf8");
  const handler = readFileSync(path.join(appDir, "spec-handler.js"), "utf8");
  assert.match(html, /data-testid="health"/, "health panel must render");
  assert.match(html, /data-testid="health-next"/, "health panel must name the next action");
  assert.match(html, /data-testid="dashboard-provision"/, "dashboard provisioning must be available in the page");
  assert.match(html, /method: 'health\/app'/, "the page must probe settings before the service");
  assert.match(html, /src="dashboard\.js"/, "the page must load the testable dashboard module");
  assert.match(handler, /body\.method === 'health\/app'/, "the handler must answer health/app before rejecting missing settings");
  assert.match(handler, /serviceUrlConfigured/, "health/app reports presence, not secret values");
  assert.match(handler, /markerProject/, "health/app must report the configured marker project");
  assert.ok(!/serviceBridgeToken\s*:/.test(handler), "health/app must not echo the bridge token");
  assert.ok(
    derivePackageFiles(appDir).includes("widgets/spec-app/dashboard.js"),
    "the dashboard module must ship inside the app package",
  );
});

test("the board exposes project selection over the v7 index", () => {
  const html = readFileSync(path.join("tools", "spec-graph-app", "widgets", "spec-board", "index.html"), "utf8");
  assert.match(html, /id="project-select"/, "the board must render a project selector");
  assert.match(html, /PROJECTION_INDEX_REQUIRED/, "a v6 marker must fail closed, not render the aggregate");
  assert.match(html, /storeCache|host\.storage/, "the selection must persist through the host cache/storage");
  assert.match(html, /__unassigned__/, "an unknown selection must resolve to the unassigned bucket");
});

test("the real app derives to exactly the JetBrains launch checklist", () => {
  const appDir = path.join(process.cwd(), "tools", "spec-graph-app");
  const manifest = JSON.parse(readFileSync(path.join(appDir, "manifest.json"), "utf8"));
  const files = derivePackageFiles(appDir);
  assert.ok(files.includes("manifest.json"));
  assert.ok(files.includes("settings.json"));
  for (const widget of manifest.widgets ?? []) {
    assert.ok(files.includes(`widgets/${widget.indexPath}`), `missing widgets/${widget.indexPath}`);
  }
  for (const handler of manifest.httpHandlers ?? []) {
    const file = /\.m?js$/i.test(handler.file) ? handler.file : `${handler.file}.js`;
    assert.ok(files.includes(file), `missing handler ${file}`);
  }
  assert.ok(!files.some((f) => f.endsWith(".zip") || f.startsWith("prototypes")), "dev files must not ship");
});

test("issue panels read the Text-shaped SpecId field", () => {
  for (const widget of ["spec-panel"]) {
    const html = readFileSync(path.join("tools", "spec-graph-app", "widgets", widget, "index.html"), "utf8");
    assert.match(
      html,
      /value\(name,presentation,text\)/,
      `${widget} must request the TextIssueCustomField value`,
    );
    assert.match(
      html,
      /value\.text/,
      `${widget} must read .text; name/presentation are empty for Text fields`,
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

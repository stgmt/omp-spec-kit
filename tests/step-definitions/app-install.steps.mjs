import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import yauzl from "yauzl";
import { buildPackage, derivePackageFiles } from "../../scripts/app-package.mjs";

const APP_DIR = path.resolve(import.meta.dirname, "..", "..", "tools", "spec-graph-app");
const CLI = path.resolve(import.meta.dirname, "..", "..", "node_modules", "@jetbrains", "youtrack-apps-tools", "bin", "youtrack-app");

function zipEntries(zipPath) {
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

Given("the spec-graph-app source tree", function () {
  this.appDir = APP_DIR;
  assert.ok(readFileSync(path.join(APP_DIR, "manifest.json"), "utf8").length > 0);
});

When("the package file set is derived", function () {
  this.packageFiles = derivePackageFiles(this.appDir);
});

Then("the set contains the manifest, the settings file, the http handler, and every widget index", function () {
  const manifest = JSON.parse(readFileSync(path.join(this.appDir, "manifest.json"), "utf8"));
  for (const expected of ["manifest.json", "settings.json"]) {
    assert.ok(this.packageFiles.includes(expected), `missing ${expected}`);
  }
  for (const handler of manifest.httpHandlers ?? []) {
    const file = /\.m?js$/i.test(handler.file) ? handler.file : `${handler.file}.js`;
    assert.ok(this.packageFiles.includes(file), `missing handler ${file}`);
  }
  for (const widget of manifest.widgets ?? []) {
    const rel = `widgets/${widget.indexPath}`;
    assert.ok(this.packageFiles.includes(rel), `missing ${rel}`);
  }
});

Then("the set contains no archives and no prototype files", function () {
  assert.ok(!this.packageFiles.some((f) => f.endsWith(".zip") || f.startsWith("prototypes")));
});

When("the package is built into a staging directory and zip archive", async function () {
  const work = mkdtempSync(path.join(tmpdir(), "app-install-"));
  this.zipA = path.join(work, "a.zip");
  this.zipB = path.join(work, "b.zip");
  this.build = await buildPackage(this.appDir, { outDir: path.join(work, "staged"), zipPath: this.zipA });
  await buildPackage(this.appDir, { outDir: path.join(work, "staged-b"), zipPath: this.zipB });
  this.entries = await zipEntries(this.zipA);
});

Then("the zip contains manifest.json at its root", function () {
  assert.ok(this.entries.includes("manifest.json"));
});

Then("every widget index.html sits in its own widgets subdirectory", function () {
  const manifest = JSON.parse(readFileSync(path.join(this.appDir, "manifest.json"), "utf8"));
  for (const widget of manifest.widgets ?? []) {
    assert.ok(this.entries.includes(`widgets/${widget.indexPath}`));
  }
});

Then("every zip path uses forward slashes", function () {
  for (const name of this.entries) assert.ok(!name.includes("\\"), `backslash path: ${name}`);
});

Then("rebuilding produces identical zip bytes", function () {
  assert.deepEqual(readFileSync(this.zipA), readFileSync(this.zipB));
});

When("the official youtrack-app validator runs against it", function () {
  this.validatorOutput = execFileSync(process.execPath, [CLI, "app", "validate", "--directory", this.appDir], { encoding: "utf8" });
});

Then("validation passes", function () {
  assert.match(this.validatorOutput, /validation passed/i);
});

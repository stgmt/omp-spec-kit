import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inventorySpecs } from "../../src/v0.1/inventory.js";
import { snapshotTree } from "../support/world.mjs";

const PLUGIN_VERSION = "0.3.0";
const SCHEMA_VERSION = "1";
const TOOL_NAME = "spec_inventory";
const CANONICAL_DOCUMENTS = Object.freeze([
  "README.md", "USER_STORIES.md", "USE_CASES.md", "RESEARCH.md", "REQUIREMENTS.md",
  "FR.md", "NFR.md", "ACCEPTANCE_CRITERIA.md", "DESIGN.md", "TASKS.md",
  "FILE_CHANGES.md", "CHANGELOG.md", "<slug>.feature", "FIXTURES.md", "<slug>_SCHEMA.md",
]);
const REAL_SLUGS = Object.freeze([
  "plugin-distribution", "product", "spec-authoring-workflow", "spec-kernel",
]);

function diagnostic(code, severity, diagnosticPath, message, remediation) {
  return { code, severity, path: diagnosticPath, message, remediation };
}
function result({ status, specs = [], diagnostics = [], observedSpecs, truncated = false }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: TOOL_NAME,
    pluginVersion: PLUGIN_VERSION,
    status,
    root: ".specs",
    specs,
    diagnostics,
    counts: {
      returnedSpecs: specs.length,
      observedSpecs,
      returnedDiagnostics: diagnostics.length,
    },
    truncated,
    readOnly: true,
  };
}
function canonicalNames(slug) {
  return CANONICAL_DOCUMENTS.map((name) => name.replaceAll("<slug>", slug)).sort();
}
function recognizedSpec(slug, includeDocumentCounts = true) {
  return {
    slug,
    path: `.specs/${slug}`,
    status: "recognized",
    documentCount: includeDocumentCounts ? 15 : null,
    missingDocuments: [],
  };
}
function incompleteSpec(slug) {
  return {
    slug,
    path: `.specs/${slug}`,
    status: "incomplete",
    documentCount: 0,
    missingDocuments: canonicalNames(slug),
  };
}

const DIAGNOSTICS = Object.freeze({
  SPECS_ABSENT: diagnostic("SPECS_ABSENT", "info", ".specs", "The active project does not contain a .specs directory.", "Create specifications before requesting an inventory."),
  SPECS_NOT_DIRECTORY: diagnostic("SPECS_NOT_DIRECTORY", "error", ".specs", "The .specs path is not a directory.", "Replace it with an ordinary directory."),
  SPEC_SLUG_INVALID: diagnostic("SPEC_SLUG_INVALID", "warning", ".specs", "A specification directory has an invalid slug.", "Rename it to the documented lowercase slug grammar."),
  SPEC_ENTRY_INVALID: diagnostic("SPEC_ENTRY_INVALID", "warning", ".specs", "A direct .specs entry is not a specification directory.", "Keep only ordinary specification directories below .specs."),
  LIMIT_REACHED: diagnostic("LIMIT_REACHED", "warning", ".specs", "Additional specifications were omitted by maxSpecs.", "Increase maxSpecs within the documented hard cap."),
  DIAGNOSTIC_LIMIT_REACHED: diagnostic("DIAGNOSTIC_LIMIT_REACHED", "warning", null, "Additional diagnostics were omitted by maxDiagnostics.", "Increase maxDiagnostics within the documented hard cap."),
  REQUEST_ABORTED: diagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null),
  SYMLINK_ESCAPE_BLOCKED: diagnostic("SYMLINK_ESCAPE_BLOCKED", "error", ".specs", "A linked entry below .specs was not traversed.", "Replace linked entries with ordinary project directories."),
  PATH_ESCAPE_BLOCKED: diagnostic("PATH_ESCAPE_BLOCKED", "error", ".specs", "The .specs directory changed while it was inspected.", "Retry after the project tree is stable."),
});
function incompleteDiagnostic(slug) {
  return diagnostic("SPEC_INCOMPLETE", "warning", `.specs/${slug}`, "A specification is missing one or more canonical documents.", "Add the missing canonical documents before claiming completeness.");
}
function hardLimitExpectation() {
  const allSlugs = Array.from({ length: 201 }, (_, index) => `spec-${String(index).padStart(3, "0")}`);
  const returnedSlugs = allSlugs.slice(0, 200);
  return result({
    status: "partial",
    specs: returnedSlugs.map(incompleteSpec),
    diagnostics: [
      DIAGNOSTICS.LIMIT_REACHED,
      ...returnedSlugs.slice(0, 98).map(incompleteDiagnostic),
      DIAGNOSTICS.DIAGNOSTIC_LIMIT_REACHED,
    ],
    observedSpecs: 201,
    truncated: true,
  });
}
function failureExpectation(condition) {
  switch (condition) {
    case ".specs is absent":
      return result({ status: "absent", diagnostics: [DIAGNOSTICS.SPECS_ABSENT], observedSpecs: 0 });
    case ".specs is a regular file":
      return result({ status: "invalid", diagnostics: [DIAGNOSTICS.SPECS_NOT_DIRECTORY], observedSpecs: null });
    case "a spec slug is invalid":
      return result({ status: "partial", diagnostics: [DIAGNOSTICS.SPEC_SLUG_INVALID], observedSpecs: 0 });
    case "a direct spec entry is a file":
      return result({ status: "partial", diagnostics: [DIAGNOSTICS.SPEC_ENTRY_INVALID], observedSpecs: 0 });
    case "the hard spec cap is exceeded":
      return hardLimitExpectation();
    case "the signal is pre-aborted":
      return result({ status: "aborted", diagnostics: [DIAGNOSTICS.REQUEST_ABORTED], observedSpecs: null, truncated: true });
    case "a directory link escapes root":
      return result({ status: "partial", diagnostics: [DIAGNOSTICS.SYMLINK_ESCAPE_BLOCKED], observedSpecs: 0 });
    case "the .specs root swaps to a link":
      return result({ status: "invalid", diagnostics: [DIAGNOSTICS.PATH_ESCAPE_BLOCKED], observedSpecs: null, truncated: true });
    default:
      throw new Error(`Unknown failure producer: ${condition}`);
  }
}

const INVALID_CASES = Object.freeze({
  null: { request: null, code: "INVALID_REQUEST", label: "Request must be an object.", message: "Request must be an object.", remediation: "Pass only fields from spec-inventory-request@1." },
  "an unknown property": { request: { unexpected: true }, code: "INVALID_REQUEST", label: "Request contains unsupported properties.", message: "Request contains unsupported properties.", remediation: "Remove properties not defined by spec-inventory-request@1." },
  "schema version 2": { request: { schemaVersion: "2" }, code: "UNSUPPORTED_SCHEMA_VERSION", label: "Only schema version 1 is supported.", message: "Only spec-inventory-request schema version 1 is supported.", remediation: "Use schemaVersion 1." },
  "maxSpecs zero": { request: { maxSpecs: 0 }, code: "INVALID_REQUEST", label: "maxSpecs is below its bound.", message: "maxSpecs must be an integer from 1 through 200.", remediation: "Use an integer within the documented bound." },
  "maxSpecs above the hard cap": { request: { maxSpecs: 201 }, code: "INVALID_REQUEST", label: "maxSpecs is above its bound.", message: "maxSpecs must be an integer from 1 through 200.", remediation: "Use an integer within the documented bound." },
  "maxDiagnostics above hard cap": { request: { maxDiagnostics: 101 }, code: "INVALID_REQUEST", label: "maxDiagnostics is above its bound.", message: "maxDiagnostics must be an integer from 0 through 100.", remediation: "Use an integer within the documented bound." },
  "a non-boolean document flag": { request: { includeDocumentCounts: "yes" }, code: "INVALID_REQUEST", label: "includeDocumentCounts has the wrong type.", message: "includeDocumentCounts must be a boolean.", remediation: "Use true or false." },
});
function invalidExpectation(testCase) {
  return result({
    status: "invalid",
    diagnostics: [diagnostic(testCase.code, "error", null, testCase.message, testCase.remediation)],
    observedSpecs: null,
  });
}


Before(async function () {
  this.repositorySpecsBefore = await snapshotTree(path.join(this.repositoryRoot, ".specs"));
});
After(async function () {
  const errors = [];
  try {
    assert.deepStrictEqual(await snapshotTree(path.join(this.repositoryRoot, ".specs")), this.repositorySpecsBefore, "the real .specs tree changed");
  } catch (error) {
    errors.push(error);
  }
  if (this.tempRoot !== null && this.tempSpecsBefore !== null) {
    try {
      assert.deepStrictEqual(await snapshotTree(path.join(this.tempRoot, ".specs")), this.tempSpecsBefore, "the temporary producer changed");
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    await this.removeTemporaryProducer();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "read-only or cleanup checks failed");
});

Given("the repository root contains the actual four-spec corpus", function () {
  const directDirectories = this.repositorySpecsBefore.entries
    .filter((entry) => entry.type === "directory" && entry.path !== "." && !entry.path.includes("/"))
    .map((entry) => entry.path);
  // The corpus is whatever canonical spec directories exist on disk (an owner
  // may add specs, e.g. plan-gate); the four product specs must always be a
  // subset, and the inventory must describe exactly the on-disk set.
  for (const slug of REAL_SLUGS) {
    assert.ok(directDirectories.includes(slug), `canonical spec ${slug} must exist`);
  }
  this.expectedSlugs = directDirectories;
});
When("the production inventory reads the real corpus with default and bounded requests", async function () {
  this.defaultResult = await inventorySpecs(this.repositoryRoot, {});
  this.boundedResult = await inventorySpecs(this.repositoryRoot, { schemaVersion: "1", maxSpecs: 2, maxDiagnostics: 25, includeDocumentCounts: false });
});
Then("the default inventory exactly describes all four canonical specifications", function () {
  assert.deepStrictEqual(this.defaultResult, result({
    status: "ok",
    specs: this.expectedSlugs.map((slug) => recognizedSpec(slug, true)),
    diagnostics: [],
    observedSpecs: this.expectedSlugs.length,
  }));
});
Then("the bounded inventory returns the lexical prefix and accounts for every observed specification", function () {
  const expectedSlugs = [...REAL_SLUGS, ...this.expectedSlugs].filter((slug, index, all) => all.indexOf(slug) === index).sort().slice(0, 2);
  assert.deepStrictEqual(this.boundedResult, result({
    status: "partial",
    specs: expectedSlugs.map((slug) => recognizedSpec(slug, false)),
    diagnostics: [DIAGNOSTICS.LIMIT_REACHED],
    observedSpecs: this.expectedSlugs.length,
    truncated: true,
  }));
});
Then("the repository specification tree is byte-for-byte unchanged", async function () {
  assert.deepStrictEqual(await snapshotTree(path.join(this.repositoryRoot, ".specs")), this.repositorySpecsBefore);
});

Given("a temporary producer for {string}", async function (condition) {
  this.condition = condition;
  this.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-bdd-"));
  const specsRoot = path.join(this.tempRoot, ".specs");
  switch (condition) {
    case ".specs is absent": break;
    case ".specs is a regular file": await writeFile(specsRoot, "not a directory\n", "utf8"); break;
    case "a spec slug is invalid": await mkdir(path.join(specsRoot, "Bad Slug"), { recursive: true }); break;
    case "a direct spec entry is a file":
      await mkdir(specsRoot);
      await writeFile(path.join(specsRoot, "stray.md"), "not a specification directory\n", "utf8");
      break;
    case "the hard spec cap is exceeded":
      await mkdir(specsRoot);
      await Promise.all(Array.from({ length: 201 }, (_, index) => mkdir(path.join(specsRoot, `spec-${String(index).padStart(3, "0")}`))));
      this.request = { maxSpecs: 200, maxDiagnostics: 100 };
      break;
    case "the signal is pre-aborted": {
      await mkdir(specsRoot);
      const controller = new AbortController();
      controller.abort("deterministic BDD cancellation");
      this.signal = controller.signal;
      break;
    }
    case "a directory link escapes root": {
      await mkdir(specsRoot);
      const externalTarget = path.join(this.tempRoot, "outside-specs");
      await mkdir(externalTarget);
      await symlink(externalTarget, path.join(specsRoot, "linked-spec"), process.platform === "win32" ? "junction" : "dir");
      break;
    }
    case "the .specs root swaps to a link": {
      await mkdir(path.join(specsRoot, "safe"), { recursive: true });
      const retainedRoot = path.join(this.tempRoot, "retained-specs");
      const externalRoot = path.join(this.tempRoot, "outside-root");
      await mkdir(path.join(externalRoot, "external"), { recursive: true });
      this.swapRoot = { specsRoot, retainedRoot, externalRoot };
      this.runtimeHooks = {
        afterSpecsRootScan: async () => {
          await rename(specsRoot, retainedRoot);
          await symlink(
            externalRoot,
            specsRoot,
            process.platform === "win32" ? "junction" : "dir",
          );
        },
      };
      break;
    }
    default: throw new Error(`Unknown temporary producer: ${condition}`);
  }
  this.tempSpecsBefore = await snapshotTree(specsRoot);
});
When("the production inventory reads the temporary producer", async function () {
  try {
    this.result = await inventorySpecs(
      this.tempRoot,
      this.request,
      this.signal,
      this.runtimeHooks,
    );
  } finally {
    if (this.swapRoot) {
      await rm(this.swapRoot.specsRoot, { recursive: true, force: true });
      await rename(this.swapRoot.retainedRoot, this.swapRoot.specsRoot);
    }
  }
});
Then("the exact failure result has status {string} and diagnostic codes {string}", function (status, codes) {
  assert.equal(this.result.status, status);
  assert.deepStrictEqual([...new Set(this.result.diagnostics.map((item) => item.code))], codes.split(","));
  assert.deepStrictEqual(this.result, failureExpectation(this.condition));
});
Then("the temporary producer tree is byte-for-byte unchanged", async function () {
  assert.deepStrictEqual(await snapshotTree(path.join(this.tempRoot, ".specs")), this.tempSpecsBefore);
});

When("the production inventory receives {string}", async function (requestName) {
  const testCase = INVALID_CASES[requestName];
  assert.notEqual(testCase, undefined, `Unknown invalid request case: ${requestName}`);
  this.invalidCase = testCase;
  this.result = await inventorySpecs(this.repositoryRoot, testCase.request);
});
Then("the invalid result exactly reports {string} for {string}", function (code, label) {
  assert.equal(this.invalidCase.code, code);
  assert.equal(this.invalidCase.label, label);
  assert.deepStrictEqual(this.result, invalidExpectation(this.invalidCase));
});

Given("both real distribution verifiers accept the built package", function () {
  const expected = [
    ["scripts/verify-marketplace.mjs", `verified marketplace: omp-spec-kit@${PLUGIN_VERSION}\n`],
    ["scripts/verify-package.mjs", `verified clean payload: omp-spec-kit@${PLUGIN_VERSION}\n`],
  ];
  const receipts = expected.map(([relativeScript, expectedOutput]) => {
    const receipt = spawnSync(process.execPath, [path.join(this.repositoryRoot, relativeScript)], { cwd: this.repositoryRoot, encoding: "utf8", windowsHide: true });
    assert.equal(receipt.error, undefined, `${relativeScript} failed to start`);
    assert.equal(receipt.signal, null, `${relativeScript} was terminated`);
    assert.equal(receipt.status, 0, `${relativeScript} exited ${receipt.status}: ${receipt.stderr}`);
    assert.equal(receipt.stderr, "", `${relativeScript} wrote stderr`);
    assert.equal(receipt.stdout, expectedOutput, `${relativeScript} output drifted`);
    return [relativeScript, receipt.stdout, receipt.status];
  });
  assert.deepStrictEqual(receipts, expected.map(([script, stdout]) => [script, stdout, 0]));
});
Given("a host implementing the OMP zod chain loads the built extension", function () {
  this.extensionPath = path.join(
    this.repositoryRoot,
    "plugins",
    "omp-spec-kit",
    "dist",
    "extension.js",
  );
});
When("the registered tool executes against the repository context while process cwd differs", async function () {
  this.tempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-cwd-"));
  const probePath = path.join(this.repositoryRoot, "tests", "helpers", "extension-probe.mjs");
  const receipt = spawnSync(
    process.execPath,
    [probePath, this.extensionPath, this.repositoryRoot],
    {
      cwd: this.tempRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(receipt.error, undefined, "extension probe failed to start");
  assert.equal(receipt.signal, null, "extension probe was terminated");
  assert.equal(receipt.status, 0, `extension probe exited ${receipt.status}: ${receipt.stderr}`);
  assert.equal(receipt.stderr, "", "extension probe wrote stderr");
  this.probe = JSON.parse(receipt.stdout);
  assert.notEqual(path.resolve(this.probe.processCwd), path.resolve(this.repositoryRoot));
});
Then("exactly one read-approved inventory tool was registered with the strict public schema", function () {
  assert.deepStrictEqual(this.probe.exports, {
    pluginVersion: PLUGIN_VERSION,
    schemaVersion: SCHEMA_VERSION,
    defaultType: "function",
  });
  assert.deepStrictEqual(this.probe.labels, ["OMP Spec Kit"]);
  // v0.3: the extension registers 8 read-approved tools; this step pins the
  // v0.1 spec_inventory contract, the MCP/kernel suites pin the other 7.
  assert.strictEqual(this.probe.toolCount, 8);
  assert.deepStrictEqual(this.probe.tool, {
    keys: ["approval", "description", "execute", "label", "name", "parameters", "strict"],
    name: TOOL_NAME,
    label: "Spec Inventory",
    description:
      "Read a bounded inventory of direct specifications under the active project's .specs directory without reading document contents or writing project state.",
    approval: "read",
    strict: true,
    executeType: "function",
    parameters: {
      kind: "object",
      shape: {
        schemaVersion: { kind: "literal", value: "1", optional: true },
        maxSpecs: { kind: "number", int: true, min: 1, max: 200, optional: true },
        maxDiagnostics: { kind: "number", int: true, min: 0, max: 100, optional: true },
        includeDocumentCounts: { kind: "boolean", optional: true },
      },
      strict: true,
    },
  });
  assert.equal(this.probe.updates, 0);
});
Then("its content and structured details exactly describe the real four-spec corpus", function () {
  // This scenario has its own Given chain and never runs the corpus Given, so
  // derive the on-disk corpus from the Before-hook snapshot.
  const expectedSlugs = this.expectedSlugs ?? this.repositorySpecsBefore.entries
    .filter((entry) => entry.type === "directory" && entry.path !== "." && !entry.path.includes("/"))
    .map((entry) => entry.path);
  const details = result({
    status: "ok",
    specs: expectedSlugs.map((slug) => recognizedSpec(slug, true)),
    diagnostics: [],
    observedSpecs: expectedSlugs.length,
  });
  assert.deepStrictEqual(this.probe.execution, {
    content: [
      {
        type: "text",
        text: `spec_inventory ok: returned ${expectedSlugs.length} of ${expectedSlugs.length} observed specs; 0 diagnostics.`,
      },
    ],
    details,
  });
});

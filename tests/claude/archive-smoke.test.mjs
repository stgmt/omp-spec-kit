import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { runToolE2E } from "../helpers/tool-e2e.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const script = path.join(root, "scripts", "smoke-release-archive.mjs");
let scratch;
let archive;

function runSmoke(stage) {
  return spawnSync(process.execPath, [script, "--archive", archive, ...stage], {
    cwd: root,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
}

function passedReport(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.result, "passed");
  assert.equal(report.toolCount, 10);
  const apply = report.matrix.calls.find((row) => row.requestId === "v08-apply-valid");
  assert.equal(apply?.tool, "spec_patch", "the archive must exercise canonical apply");
  assert.equal(apply.ok, true);
  assert.equal(apply.outcome, "APPLIED");
  const secret = report.matrix.calls.find((row) => row.requestId === "v08-secret-proposal");
  assert.equal(secret?.tool, "spec_patch", "the archive must exercise secret rejection");
  assert.equal(secret.ok, false);
  assert.equal(secret.errorCode, "VALIDATION_FAILED");
  assert.ok(report.matrix.calls.some((row) => row.requestId === "v08-proposal-cat"), "the proposal phase must run");
  return report;
}

before(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), "omp-archive-stage-test-"));
  archive = path.join(scratch, "plugin.tar");
  // A drive-qualified -f argument is parsed as a remote host by GNU tar on
  // Windows. Use the basename from the scratch directory, as extraction does.
  const result = spawnSync("tar", ["-cf", path.basename(archive), "-C", path.join(root, "plugins", "omp-spec-kit"), "."], {
    cwd: scratch, encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

after(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
});

describe("real archive smoke stage selection", () => {
  it("runs all default matrix phases against the extracted server", () => {
    const report = passedReport(runSmoke([]));
    assert.equal(report.stage, "default");
    assert.deepEqual(report.matrix.completedPhases, ["inventory", "queries", "proposals", "apply", "secrets"]);
    assert.ok(report.matrix.calls.some((row) => row.requestId === "v08-cat-overview"), "the query phase must run");
  });

  it("runs all safe-authoring phases with semantic apply and secret-refusal witnesses", () => {
    const report = passedReport(runSmoke(["--stage", "safe-authoring"]));
    assert.equal(report.stage, "safe-authoring");
    assert.deepEqual(report.matrix.completedPhases, ["inventory", "proposals", "apply", "secrets"]);
  });

  it("refuses an unknown stage instead of falling through to a passing matrix", () => {
    const result = runSmoke(["--stage", "bogus"]);
    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsupported smoke stage: bogus/u);
  });

  it("refuses misspelled matrix phases before any RPC call", async () => {
    const unexpected = () => { assert.fail("an unknown phase must not make an RPC call"); };
    for (const phase of ["proposal", "al"]) {
      await assert.rejects(runToolE2E({ phase, listTools: unexpected, callTool: unexpected }), /unknown tool E2E phase/u);
    }
  });
});

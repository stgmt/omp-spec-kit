import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root));
}

describe("Definition-integrity write gate", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-write-gate-"));
    const fixtureSpecs = path.join(
      repositoryRoot,
      "tests",
      "fixtures",
      "kernel",
      "authoring-real-corpus",
      specsDirName,
    );
    await cp(fixtureSpecs, path.join(tempRoot, specsDirName), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("rejects a proposal introducing a malformed definition heading", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-malformed-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        { kind: "insert_at_eof", document: "TASKS.md", text: "\n### TASK-99: Wrong level heading\n" },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "VALIDATION_FAILED");
    assert.match(result.error?.message ?? "", /malformed definition headings/u);
    const finding = result.error?.findings?.find((entry) => entry.code === "MALFORMED_HEADING");
    assert.ok(finding, "expected a MALFORMED_HEADING finding");
    assert.match(finding.path ?? "", /TASKS\.md$/u);
  });

  it("accepts a proposal adding a well-formed definition heading", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-canonical-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        { kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-99: Well formed heading\n" },
      ],
    });
    assert.equal(result.ok, true);
  });

  it("does not block unrelated edits to a document with pre-existing violations", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-preexisting-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        {
          kind: "append_to_section",
          document: "DESIGN.md",
          heading: "Decisions",
          text: "\nAdditional decision prose that introduces no new definition heading.\n",
        },
      ],
    });
    assert.equal(result.ok, true);
  });

  it("rejects a proposal introducing a duplicate definition id", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-duplicate-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        { kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-1: Duplicate identity\n" },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "VALIDATION_FAILED");
    const finding = result.error?.findings?.find((entry) => entry.code === "DUPLICATE_DEFINITION");
    assert.ok(finding, "expected a DUPLICATE_DEFINITION finding");
  });

  it("rejects a swap that introduces a new violation while reducing the count", async () => {
    // Fixture DESIGN.md contains pre-existing violations; replacing them with
    // a different malformed heading reduces the count but changes the
    // violation set — the gate must compare identity, not counts.
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-count-swap-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        {
          kind: "replace_document",
          document: "DESIGN.md",
          content: "# Design\n\nStatus: DRAFT\n\n## Decisions\n\n### DEC-9: New wrong level heading\n\nRationale text.\n",
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "VALIDATION_FAILED");
    const finding = result.error?.findings?.find((entry) => entry.code === "MALFORMED_HEADING");
    assert.ok(finding, "expected a MALFORMED_HEADING finding");
  });

  it("does not fire on a pure rename of a document with violations", async () => {
    // rename_document re-keys diagnostics; a pure rename must not turn
    // pre-existing violations into a false VALIDATION_FAILED. A minimal spec
    // is used because every canonical document name is already occupied in
    // the shared fixture.
    const specDir = path.join(tempRoot, specsDirName, "rename-probe");
    await mkdir(specDir, { recursive: true });
    await writeFile(
      path.join(specDir, "DESIGN.md"),
      "# Design\n\nStatus: DRAFT\n\n## Decisions\n\n### DEC-1: Wrong level\n\nText.\n",
    );
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-rename-1",
      intent: "patch",
      spec: "rename-probe",
      reason: "gate test",
      dryRun: true,
      operations: [
        { kind: "rename_document", document: "DESIGN.md", newDocument: "TASKS.md" },
      ],
    });
    assert.equal(result.ok, true);
  });

  it("accepts a proposal that repairs existing violations", async () => {
    const result = await serviceAt(tempRoot).execute({
      requestId: "gate-repair-1",
      intent: "patch",
      spec: "spec-mcp-access-gate",
      reason: "gate test",
      dryRun: true,
      operations: [
        {
          kind: "replace_document",
          document: "DESIGN.md",
          content: "# Design\n\nStatus: DRAFT\n\n## DEC-1: Conforming decision\n\nRationale text.\n",
        },
      ],
    });
    assert.equal(result.ok, true);
  });
});

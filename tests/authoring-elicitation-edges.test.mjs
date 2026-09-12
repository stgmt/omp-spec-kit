import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ELICITATION_REQUIRED,
  ELICITATION_SKILL_URI,
  FirstWriteElicitationGuard,
} from "../src/authoring/elicitation-guard.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { SpecPatchService } from "../src/authoring/service.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root, options = {}) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root), options);
}
describe("FirstWriteElicitationGuard unit edges", () => {
  it("handles null, undefined, and empty changes safely", () => {
    const guard = new FirstWriteElicitationGuard();
    assert.deepEqual(guard.checkAndRecord("spec-a", null), { ok: true });
    assert.deepEqual(guard.checkAndRecord("spec-a", undefined), { ok: true });
    assert.deepEqual(guard.checkAndRecord("spec-a", []), { ok: true });
  });

  it("ignores existing, deleted, and non-Markdown changes", () => {
    const guard = new FirstWriteElicitationGuard();
    assert.deepEqual(
      guard.checkAndRecord("spec-a", [
        { document: "README.md", beforeMissing: false, deleteAfter: false },
        { document: "FR.md", beforeMissing: undefined, deleteAfter: false },
        { document: "OLD.md", beforeMissing: true, deleteAfter: true },
        { document: "spec-a.feature", beforeMissing: true, deleteAfter: false },
        { document: "notes.md", beforeMissing: true, deleteAfter: false },
      ]),
      { ok: true },
    );
  });

  it("returns sorted candidate documents on first refusal", () => {
    const guard = new FirstWriteElicitationGuard();
    const result = guard.checkAndRecord("spec-a", [
      { document: "USER_STORIES.md", beforeMissing: true, deleteAfter: false },
      { document: "ACCEPTANCE_CRITERIA.md", beforeMissing: true, deleteAfter: false },
      { document: "FR.md", beforeMissing: true, deleteAfter: false },
    ]);
    assert.equal(result.ok, false);
    assert.deepEqual(result.documents, [
      "ACCEPTANCE_CRITERIA.md",
      "FR.md",
      "USER_STORIES.md",
    ]);
  });

  it("uses locale-independent code-point ordering", () => {
    const guard = new FirstWriteElicitationGuard();
    const result = guard.checkAndRecord("spec-a", [
      { document: "spec-a_SCHEMA.md", beforeMissing: true, deleteAfter: false },
      { document: "README.md", beforeMissing: true, deleteAfter: false },
    ]);
    assert.deepEqual(result.documents, ["README.md", "spec-a_SCHEMA.md"]);
  });

  it("allows recorded retries but refuses a newly introduced document", () => {
    const guard = new FirstWriteElicitationGuard();
    const first = [{ document: "README.md", beforeMissing: true, deleteAfter: false }];
    assert.equal(guard.checkAndRecord("spec-a", first).ok, false);
    assert.equal(guard.checkAndRecord("spec-a", first).ok, true);
    assert.equal(
      guard.checkAndRecord("spec-a", [
        ...first,
        { document: "NFR.md", beforeMissing: true, deleteAfter: false },
      ]).ok,
      false,
    );
    assert.equal(
      guard.checkAndRecord("spec-a", [
        { document: "NFR.md", beforeMissing: true, deleteAfter: false },
      ]).ok,
      true,
    );
  });

  it("isolates tickets by specification", () => {
    const guard = new FirstWriteElicitationGuard();
    const change = [{ document: "README.md", beforeMissing: true, deleteAfter: false }];
    assert.equal(guard.checkAndRecord("spec-a", change).ok, false);
    assert.equal(guard.checkAndRecord("spec-a", change).ok, true);
    assert.equal(guard.checkAndRecord("spec-b", change).ok, false);
    assert.equal(guard.checkAndRecord("spec-b", change).ok, true);
  });

  it("keeps long distinct keys and old tickets without eviction", () => {
    const guard = new FirstWriteElicitationGuard();
    const change = [{ document: "README.md", beforeMissing: true, deleteAfter: false }];
    const prefix = "spec-" + "x".repeat(600);
    const firstSpec = prefix + "-a";
    const secondSpec = prefix + "-b";

    assert.equal(guard.checkAndRecord(firstSpec, change).ok, false);
    assert.equal(guard.checkAndRecord(secondSpec, change).ok, false);
    assert.equal(guard.checkAndRecord(firstSpec, change).ok, true);
    assert.equal(guard.checkAndRecord(secondSpec, change).ok, true);

    for (let index = 0; index < 10_001; index += 1) {
      guard.checkAndRecord("load-" + index, change);
    }
    assert.equal(guard.checkAndRecord(firstSpec, change).ok, true);
  });
});

describe("Authoring pipeline edge cases", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "omp-authoring-edges-"));
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

  it("rejects secret content before elicitation guard evaluation", async () => {
    const service = serviceAt(tempRoot);
    const secret = "ghp_" + "A".repeat(36);
    const result = await service.execute({
      requestId: "edge-secret-1",
      intent: "patch",
      spec: "secret-spec",
      reason: "secret test",
      dryRun: false,
      operations: [{ kind: "replace_document", document: "README.md", content: secret }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "VALIDATION_FAILED");
    assert.match(result.error?.message ?? "", /secret-like content/u);
  });

  it("does not consume an elicitation ticket during preview", async () => {
    const guard = new FirstWriteElicitationGuard();
    const service = serviceAt(tempRoot, { elicitationGuard: guard });
    const input = {
      intent: "createSpec",
      spec: "preview-spec-x",
      title: "Preview Spec X",
      reason: "preview",
    };
    assert.equal((await service.execute({ ...input, requestId: "edge-preview-1", dryRun: true })).data?.outcome, "PREVIEW");
    assert.equal((await service.execute({ ...input, requestId: "edge-preview-2", dryRun: true })).data?.outcome, "PREVIEW");

    const apply = await service.execute({ ...input, requestId: "edge-apply-1", dryRun: false });
    assert.equal(apply.data?.outcome, "REFUSED");
    assert.equal(apply.data?.error?.code, ELICITATION_REQUIRED);
    assert.equal(apply.data?.error?.skill, ELICITATION_SKILL_URI);
  });

  it("reissues one stop after a service restart while the target is missing", async () => {
    const input = {
      intent: "createSpec",
      spec: "restart-spec-x",
      title: "Restart Spec X",
      reason: "restart",
      dryRun: false,
    };
    const first = await serviceAt(tempRoot).execute({ ...input, requestId: "edge-restart-1" });
    assert.equal(first.data?.outcome, "REFUSED");
    assert.equal(first.data?.error?.code, ELICITATION_REQUIRED);

    const restartedService = serviceAt(tempRoot);
    const restarted = await restartedService.execute({ ...input, requestId: "edge-restart-2" });
    assert.equal(restarted.data?.outcome, "REFUSED");
    assert.equal(restarted.data?.error?.code, ELICITATION_REQUIRED);

    const retry = await restartedService.execute({ ...input, requestId: "edge-restart-3" });
    assert.equal(retry.data?.outcome, "APPLIED");
  });

  it("keeps first-write refusal atomic", async () => {
    const service = serviceAt(tempRoot);
    const result = await service.execute({
      requestId: "edge-atomic-1",
      intent: "createSpec",
      spec: "atomic-spec-test",
      title: "Atomic Spec",
      reason: "atomic test",
      dryRun: false,
    });
    assert.equal(result.data?.outcome, "REFUSED");

    await assert.rejects(
      readdir(path.join(tempRoot, specsDirName, "atomic-spec-test")),
      { code: "ENOENT" },
    );
  });

  it("stops once for a missing canonical rename target and applies the retry", async () => {
    const service = serviceAt(tempRoot);
    const designPath = path.join(tempRoot, specsDirName, "plugin-distribution", "DESIGN.md");
    const design = await readFile(designPath, "utf8");
    await writeFile(designPath, design.replace("[README.md](README.md)", "README.md"), "utf8");

    const deleteTarget = await service.execute({
      requestId: "rename-delete-target",
      intent: "patch",
      spec: "plugin-distribution",
      reason: "prepare missing canonical target",
      dryRun: false,
      operations: [{ kind: "delete_document", document: "FILE_CHANGES.md" }],
    });
    assert.equal(deleteTarget.data?.outcome, "APPLIED");

    const renameInput = {
      intent: "patch",
      spec: "plugin-distribution",
      reason: "rename into missing canonical document",
      dryRun: false,
      operations: [{ kind: "rename_document", document: "README.md", newDocument: "FILE_CHANGES.md" }],
    };
    const first = await service.execute({ ...renameInput, requestId: "rename-run-1" });
    assert.equal(first.data?.outcome, "REFUSED");
    assert.equal(first.data?.error?.code, ELICITATION_REQUIRED);
    assert.deepEqual(first.data?.error?.documents, ["FILE_CHANGES.md"]);

    const retry = await service.execute({ ...renameInput, requestId: "rename-run-2" });
    assert.equal(retry.data?.outcome, "APPLIED");
    const files = await readdir(path.join(tempRoot, specsDirName, "plugin-distribution"));
    assert.ok(files.includes("FILE_CHANGES.md"));
    assert.ok(!files.includes("README.md"));
  });
});

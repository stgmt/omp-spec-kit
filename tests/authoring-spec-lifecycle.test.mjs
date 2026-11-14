import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createSpecService } from "../src/adapters/query-service.js";

const specsDirectory = "." + "specs";
const spec = "first-launch-lifecycle";

describe("first specification authoring lifecycle", () => {
  let root;
  let service;
  let requestSequence;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "spec-first-lifecycle-"));
    await cp(
      path.resolve("tests/fixtures/kernel/authoring-real-corpus", specsDirectory),
      path.join(root, specsDirectory),
      { recursive: true },
    );
    service = createSpecService(root);
    requestSequence = 0;
    const creation = {
      intent: "createSpec",
      spec,
      title: "Retain the permitted project after restart",
      reason: "exercise first-spec lifecycle",
      dryRun: false,
    };
    const elicitation = await patch(creation);
    assert.equal(elicitation.data?.outcome, "REFUSED", JSON.stringify(elicitation));
    assert.equal(elicitation.data?.error?.code, "ELICITATION_REQUIRED");
    const created = await patch(creation);
    assert.equal(created.data?.outcome, "APPLIED", JSON.stringify(created));
  });

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  });

  function patch(arguments_) {
    return service.runQuery("specPatch", arguments_, { requestId: `first-lifecycle-${++requestSequence}` });
  }

  async function readLifecycleDocument() {
    const result = await service.runQuery("documents", { action: "read", spec, doc: "README.md" });
    assert.equal(result.ok, true, JSON.stringify(result));
    const states = result.data.content.split(/\r?\n/u).flatMap((line) => {
      const field = /^\s*(?:-\s+)?(?:\*\*)?Status:(?:\*\*)?\s*(.*?)\s*$/iu.exec(line);
      return field ? [field[1].toLowerCase()] : [];
    });
    return { document: result.data, states };
  }

  it("changes a newly created specification's lifecycle without a hand-written status section", async () => {
    for (const status of ["active", "backlog", "active"]) {
      const changed = await patch({
        intent: "setSpecStatus",
        spec,
        status,
        reason: "change declared lifecycle state",
        dryRun: false,
      });
      assert.equal(changed.ok, true, JSON.stringify(changed));
      assert.equal(changed.data?.outcome, "APPLIED", JSON.stringify(changed));
      const { states } = await readLifecycleDocument();
      assert.deepEqual(states, [status], "the published document must have one authoritative lifecycle state, not conflicting old and new states");
    }
  });

  it("sets lifecycle metadata without requiring a pre-existing field and preserves other content", async () => {
    const context = "The team must retain its allowed project across a restart.";
    const prepared = await patch({
      intent: "patch",
      spec,
      reason: "author context before declaring lifecycle",
      dryRun: false,
      operations: [{ kind: "replace_document", document: "README.md", content: `# Restart scope\n\n${context}\n` }],
    });
    assert.equal(prepared.data?.outcome, "APPLIED", JSON.stringify(prepared));
    const changed = await patch({ intent: "setSpecStatus", spec, status: "active", reason: "declare lifecycle", dryRun: false });
    assert.equal(changed.data?.outcome, "APPLIED", JSON.stringify(changed));
    const { document, states } = await readLifecycleDocument();
    assert.deepEqual(states, ["active"]);
    assert.ok(document.content.includes(context), "changing lifecycle must not discard the authored context");
  });

  it("refuses ambiguous lifecycle metadata without changing the specification", async () => {
    const prepared = await patch({
      intent: "patch",
      spec,
      reason: "exercise conflicting lifecycle metadata",
      dryRun: false,
      operations: [{ kind: "replace_document", document: "README.md", content: "# Restart scope\n\nStatus: active\n\n## Public states\n\n- **Status:** backlog\n" }],
    });
    assert.equal(prepared.data?.outcome, "APPLIED", JSON.stringify(prepared));
    const before = await readLifecycleDocument();
    const changed = await patch({ intent: "setSpecStatus", spec, status: "active", reason: "refuse ambiguous state", dryRun: false });
    assert.equal(changed.ok, false, JSON.stringify(changed));
    assert.equal(changed.error?.code, "VALIDATION_FAILED");
    const after = await readLifecycleDocument();
    assert.equal(after.document.sha256, before.document.sha256);
    assert.deepEqual(after.states, before.states);
  });

  it("lists an authored task before the new specification is activated", async () => {
    const requirement = await patch({
      intent: "patch",
      spec,
      reason: "define the work before creating its task",
      dryRun: false,
      operations: [{
        kind: "insert_at_eof",
        document: "FR.md",
        text: "\n## FR-1 — Retain the permitted project\n\nAfter restart, the team continues work only within its saved project.\n",
      }],
    });
    assert.equal(requirement.data?.outcome, "APPLIED", JSON.stringify(requirement));
    const task = await patch({
      intent: "confirmTaskCreation",
      spec,
      entity: "TASK-1",
      subject: "Verify retained project scope",
      requirements: ["FR-1"],
      reason: "verify draft task visibility",
      dryRun: false,
    });
    assert.equal(task.data?.outcome, "APPLIED", JSON.stringify(task));
    const listed = await service.runQuery("tasks", { spec, statuses: ["todo"] });
    assert.equal(listed.ok, true, JSON.stringify(listed));
    const entry = listed.data.tasks.find((candidate) => candidate.localId === "TASK-1");
    assert.ok(entry, "the created task must be readable without an unrelated lifecycle transition");
    assert.equal(entry.status, "todo");
    assert.ok(entry.requirements.some((id) => id.endsWith(":FR-1")));
  });
});

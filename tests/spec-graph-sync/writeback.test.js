import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUTTON_TRANSITIONS,
  REVERSE_STATUS_MAP,
  specStatusForTrackerState,
  validateWritebackEvent,
} from "../../src/adapters/youtrack-projection.js";

describe("YouTrack status writeback", () => {
  it("accepts a complete event and rejects malformed events", () => {
    assert.equal(validateWritebackEvent({ specId: "demo:TASK-1", toState: "Fixed", issueId: "3-99" }), null);
    assert.equal(validateWritebackEvent(null), "not an object");
    assert.equal(validateWritebackEvent({ specId: "TASK-1", toState: "Fixed", issueId: "3-99" }), "bad specId");
    assert.equal(validateWritebackEvent({ specId: "demo:TASK-1", toState: "", issueId: "3-99" }), "bad toState");
    assert.equal(validateWritebackEvent({ specId: "demo:TASK-1", toState: "Fixed", issueId: "" }), "bad issueId");
  });

  it("maps every Default-template state to an explicit specification status", () => {
    assert.deepEqual(Object.keys(REVERSE_STATUS_MAP).sort(), [
      "Fixed", "In Progress", "Open", "Reopened", "Submitted", "To be discussed", "Verified",
    ].sort());
    assert.equal(specStatusForTrackerState("Submitted"), "planned");
    assert.equal(specStatusForTrackerState("Open"), "todo");
    assert.equal(specStatusForTrackerState("In Progress"), "todo");
    assert.equal(specStatusForTrackerState("Fixed"), "done");
    assert.equal(specStatusForTrackerState("Verified"), "done");
    assert.equal(specStatusForTrackerState("unknown"), null);
    assert.equal(specStatusForTrackerState("Won't fix"), null);
    assert.equal(specStatusForTrackerState("Duplicate"), null);
    assert.equal(specStatusForTrackerState("Can't reproduce"), null);
    assert.equal(specStatusForTrackerState(""), null);
  });

  it("keeps button transitions explicit", () => {
    assert.deepEqual(BUTTON_TRANSITIONS, [
      { button: "Approve", from: "Open", to: "Fixed", specTo: "done" },
      { button: "Verify", from: "Fixed", to: "Verified", specTo: "done" },
      { button: "Reopen", from: "*", to: "Reopened", specTo: "todo" },
    ]);
  });
});

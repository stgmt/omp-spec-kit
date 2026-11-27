import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectionOutcome } from "./helpers/projection-outcome.mjs";

describe("projection sync outcome", () => {
  it("accepts every committed outcome", () => {
    for (const outcome of ["SYNCED", "SKIPPED", "PARTIAL"]) {
      const result = { outcome, fingerprint: "abc", writeCalls: 1 };
      assert.equal(projectionOutcome(result), result);
    }
  });

  it("keeps the server error in the refusal instead of an opaque assertion", () => {
    assert.throws(
      () => projectionOutcome({ ok: false, error: "project not found" }),
      /projection sync did not reach a committed outcome: \{"ok":false,"error":"project not found"\}/u,
    );
    assert.throws(() => projectionOutcome(undefined), /committed outcome: undefined/u);
  });
});

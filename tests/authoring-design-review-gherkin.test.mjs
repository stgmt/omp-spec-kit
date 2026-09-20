import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDesignReviewForChanges } from "../src/authoring/design-review.js";
import { classifyToolCall } from "../src/enforcement/classifier.js";

const SCENARIO_FORMS = [
  ["Scenario", "  Scenario: plain"],
  ["Scenario Outline", "  Scenario Outline: outline"],
  ["Example", "\tExample: example"],
  ["Scenario Template", "\tScenario Template: template"],
  ["tab Scenario", "\tScenario: tabbed"],
];

function change(afterText) {
  return {
    document: "dupe-lab.feature",
    beforeBytes: Buffer.from(["Feature: F", ""].join(String.fromCharCode(10))),
    afterBytes: Buffer.from(afterText),
    preview: { afterSha256: "after-sha" },
  };
}

describe("Gherkin design-review gate parity", () => {
  it("requires design review for every executable scenario header form", () => {
    for (const [label, header] of SCENARIO_FORMS) {
      const result = validateDesignReviewForChanges(undefined, [change(["Feature: F", header, ""].join(String.fromCharCode(10)))]);
      assert.equal(result.required, true, label);
      assert.equal(result.ok, false, label);
      assert.equal(result.code, "DESIGN_REVIEW_REQUIRED", label);
    }
  });

  it("does not require review for scenario-looking text in a tab docstring", () => {
    const tab = String.fromCharCode(9);
    const content = ["Feature: F", tab + "\"\"\"", tab + "Scenario: quoted", tab + "\"\"\""].join(String.fromCharCode(10));
    const result = validateDesignReviewForChanges(undefined, [change(content)]);
    assert.equal(result.required, false);
    assert.equal(result.ok, true);
  });

  it("preflight blocks every executable scenario header form", () => {
    for (const [label, header] of SCENARIO_FORMS) {
      const result = classifyToolCall(
        {
          toolName: "mcp__omp_spec_kit_spec_patch",
          input: {
            intent: "patch",
            spec: "dupe-lab",
            operations: [{ kind: "replace_document", document: "dupe-lab.feature", content: ["Feature: F", header, ""].join(String.fromCharCode(10)) }],
          },
        },
        { root: process.cwd() },
      );
      assert.equal(result.action, "block", label);
      assert.equal(result.code, "DESIGN_REVIEW_REQUIRED", label);
    }
  });
});

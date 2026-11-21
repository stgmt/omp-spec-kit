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
const doc = "dupe-lab-user-stories.feature";
const preamble = ["Feature: F", "@story:US-1", "Rule: Preview", "Actor: Author", "Goal: Preview", "Benefit: See the impact"];
function source(header, ready = true, withQuote = false) {
  const lines = [
    ...preamble,
    `@id:SCEN-review @feature1${ready ? " @spec-ready" : ""}`,
    header,
    "  Given a proposal",
  ];
  if (withQuote) lines.push('\t"""', "\t@spec-ready\n\tScenario: quoted", '\t"""');
  lines.push("  When previewed", "  Then a diff is returned");
  if (/Template:|Outline:/u.test(header)) lines.push("  Examples:", "    | example_id |", "    | first |");
  return lines.join("\n") + "\n";
}

function change(afterText) {
  return {
    spec: "dupe-lab",
    document: doc,
    beforeBytes: Buffer.from(["Feature: F", ""].join(String.fromCharCode(10))),
    afterBytes: Buffer.from(afterText),
    preview: { afterSha256: "after-sha" },
  };
}

describe("Gherkin design-review gate parity", () => {
  it("requires design review for every executable scenario header form", () => {
    for (const [label, header] of SCENARIO_FORMS) {
      const result = validateDesignReviewForChanges(undefined, [change(source(header))]);
      assert.equal(result.required, true, label);
      assert.equal(result.ok, false, label);
      assert.equal(result.code, "DESIGN_REVIEW_REQUIRED", label);
    }
  });

  it("does not require review for scenario-looking text in a tab docstring", () => {
    const content = source("\tScenario: draft", false, true);
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
            operations: [{ kind: "replace_document", document: doc, content: source(header) }],
          },
        },
        { root: process.cwd() },
      );
      assert.equal(result.action, "block", label);
      assert.equal(result.code, "DESIGN_REVIEW_REQUIRED", label);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGherkinDocument } from "../src/kernel/parsers/gherkin.js";

const rule = [
  "@f1", "Feature: F", "  @story:US-1", "  Rule: One story",
  "    Actor: Author", "    Goal: Preview", "    Benefit: See the impact",
].join("\n");
const boundSteps = ["      Given a step", "      When it happens", "      Then the result is known"];
function parse(source) {
  return parseGherkinDocument({ path: "dupe-lab-user-stories.feature", specSlug: "dupe-lab", text: `${rule}\n${source}\n` });
}

describe("native Gherkin inside canonical story Rules", () => {
  for (const [keyword, indent] of [
    ["Scenario", "    "], ["Scenario Outline", "    "], ["Example", "\t"], ["Scenario Template", "\t"], ["Scenario", "\t"],
  ]) {
    it(`indexes ${JSON.stringify(indent)}-indented ${keyword} and its inherited tags`, () => {
      const outline = keyword.endsWith("Outline") || keyword.endsWith("Template");
      const lines = [indent + "@feature1 @id:SCEN-x-001", `${indent}${keyword}: Example title`, ...boundSteps];
      if (outline) lines.push("\tExamples:", "\t  | example_id | a |", "\t  | first | 1 |");
      const doc = parse(lines.join("\n"));
      assert.deepEqual(doc.diagnostics, []);
      assert.equal(doc.scenarios.length, 1);
      const [scenario] = doc.scenarios;
      assert.equal(scenario.keyword, keyword);
      assert.equal(scenario.name, "Example title");
      assert.equal(scenario.localId, "SCEN-x-001");
      assert.deepEqual(scenario.tags.map(({ tag }) => tag), ["f1", "story:US-1", "feature1", "id:SCEN-x-001"]);
      assert.deepEqual(scenario.steps.map(({ keyword: step }) => step), ["Given", "When", "Then"]);
      if (outline) {
        assert.deepEqual(scenario.examples, [{ headers: ["example_id", "a"], rows: [["first", "1"]] }]);
        assert.equal(scenario.pickles[0].rowId, "first");
      }
    });
  }

  it("keeps scenario-looking text inside tab-indented docstrings out of the graph", () => {
    const source = [
      "\t@id:SCEN-doc-001", "\tScenario: doc", boundSteps[0],
      '\t"""', "\t  Scenario: quoted", '\t"""', ...boundSteps.slice(1),
    ].join("\n");
    const doc = parse(source);
    assert.deepEqual(doc.diagnostics, []);
    assert.deepEqual(doc.scenarios.map(({ localId }) => localId), ["SCEN-doc-001"]);
    assert.equal(doc.scenarios[0].steps[0].text, "a step");
    const changed = parse(source.replace("Scenario: quoted", "Scenario: changed"));
    assert.notEqual(doc.scenarios[0].pickles[0].sha256, changed.scenarios[0].pickles[0].sha256);
  });
});

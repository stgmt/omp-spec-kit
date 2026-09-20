import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGherkinDocument } from "../src/kernel/parsers/gherkin.js";

function parse(text) {
  return parseGherkinDocument({ path: "spec.feature", specSlug: "dupe-lab", text });
}

describe("gherkin scenario keyword forms", () => {
  it("indexes plain space-indented Scenario", () => {
    const doc = parse("Feature: F\n  Scenario: plain\n    Given a step\n");
    assert.equal(doc.scenarios.length, 1);
    assert.equal(doc.scenarios[0].keyword, "Scenario");
    assert.equal(doc.scenarios[0].name, "plain");
    assert.equal(doc.scenarios[0].steps.length, 1);
  });

  it("indexes Scenario Outline and preserves its name", () => {
    const doc = parse("Feature: F\n  Scenario Outline: outline\n    Given a step\n");
    assert.equal(doc.scenarios.length, 1);
    assert.equal(doc.scenarios[0].keyword, "Scenario Outline");
    assert.equal(doc.scenarios[0].name, "outline");
  });

  it("indexes Example: with tab indent", () => {
    const doc = parse("Feature: F\n\tExample: quick\n    Given a step\n");
    assert.equal(doc.scenarios.length, 1);
    assert.equal(doc.scenarios[0].keyword, "Example");
    assert.equal(doc.scenarios[0].name, "quick");
  });

  it("indexes Scenario Template: and preserves its name", () => {
    const doc = parse("Feature: F\n  Scenario Template: templ\n    Given a step\n");
    assert.equal(doc.scenarios.length, 1);
    assert.equal(doc.scenarios[0].keyword, "Scenario Template");
    assert.equal(doc.scenarios[0].name, "templ");
  });

  it("indexes tab-indented Scenario: (cucumber parity with the design-review gate)", () => {
    const doc = parse("Feature: F\n\tScenario: tabbed\n    Given a step\n");
    assert.equal(doc.scenarios.length, 1);
    assert.equal(doc.scenarios[0].keyword, "Scenario");
    assert.equal(doc.scenarios[0].steps.length, 1);
  });

  it("keeps docstring-quoted scenario headers un-indexed", () => {
    const doc = parse('Feature: F\n  """\n  Scenario: quoted\n  """\n');
    assert.equal(doc.scenarios.length, 0);
  });

  it("inherits feature-level and local tags on Example", () => {
    const doc = parse("Feature: F\n  @f1\n  @id:SCEN-x-001\n  Example: tagged\n    Given a step\n");
    const tags = doc.scenarios[0].tags.map((t) => t.tag);
    assert.ok(tags.includes("id:SCEN-x-001"));
    assert.ok(tags.includes("f1"));
  });

  it("parses Examples rows on Scenario Template", () => {
    const doc = parse(
      "Feature: F\n  Scenario Template: templ\n    Given <a>\n    Examples:\n      | a |\n      | 1 |\n",
    );
    const scenario = doc.scenarios[0];
    assert.equal(scenario.keyword, "Scenario Template");
    assert.equal(scenario.examples.length, 1);
    assert.deepEqual(scenario.examples[0].headers, ["a"]);
    assert.deepEqual(scenario.examples[0].rows, [["1"]]);
  });
});

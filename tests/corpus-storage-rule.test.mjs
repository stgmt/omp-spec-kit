import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STORAGE_RULE_MARKER,
  findUnmarkedStorageMentions,
  hasCanonicalStorageRule,
} from "../scripts/lib/storage-rule.mjs";

const doc = (content, docName = "FR.md", spec = "spec-registry-service") => [
  { spec, doc: docName, content },
];

describe("corpus storage rule", () => {
  it("accepts the canonical rule text", () => {
    const content = `# Spec\n\n> **Single source of truth — storage location.** A spec lives only in its project repository.\n`;

    assert.equal(hasCanonicalStorageRule(content), true);
    assert.equal(hasCanonicalStorageRule("no rule here"), false);
  });

  it("allows retired-store mentions with an explicit historical marker", () => {
    const content = [
      "- **2026-09-13 — model revision (SUPERSEDED 2026-10-31)**: one dedicated specs repository was used.",
      "1. **Dedicated specs repo — SUPERSEDED 2026-10-31.** The shared store is archived.",
      "- **Migration (historical)**: the old `<owner>/<project>/.specs/<slug>/` layout was retired.",
      "- **Status:** done (historical transition) — the project left the specs repo.",
    ].join("\n");

    assert.deepEqual(findUnmarkedStorageMentions(doc(content)), []);
  });

  it("rejects every retired-store shape, including the angle-bracket layout and the bare phrase", () => {
    const lines = [
      "one canonical store: the dedicated specs repo",
      "Rejected alternatives: one shared specs repository",
      "the corpus lived in stgmt/spec-database",
      "it created owner/project/.specs skeletons",
      "the 2.x `<owner>/<project>/.specs/<slug>/` layout",
      "the operator clones the specs repo",
    ];

    const findings = findUnmarkedStorageMentions(doc(lines.join("\n"), "SAMPLE.md"));

    assert.equal(findings.length, lines.length);
    assert.deepEqual(findings.map((f) => f.line), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(findings.map((f) => f.doc), Array(lines.length).fill("SAMPLE.md"));
  });

  it("does not treat an incidental 'archived' as a marker (mutation of the marker rule)", () => {
    const content = "the archived snapshot still points to stgmt/spec-database as the source of truth";

    const findings = findUnmarkedStorageMentions(doc(content));

    assert.equal(findings.length, 1);
    assert.match(findings[0].text, /stgmt\/spec-database/);
  });

  it("reports the exact spec, document and line of an unmarked mention", () => {
    const content = `# Title\n\nfirst line\n\n  <owner>/<project>/.specs/<slug>/ is canonical\n`;
    const findings = findUnmarkedStorageMentions(doc(content, "DESIGN.md", "other-spec"));

    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0], {
      spec: "other-spec",
      doc: "DESIGN.md",
      line: 5,
      text: "<owner>/<project>/.specs/<slug>/ is canonical",
    });
  });

  it("scans every supplied spec, not only the rule owner", () => {
    const documents = [
      { spec: "spec-registry-service", doc: "README.md", content: STORAGE_RULE_MARKER },
      { spec: "other-spec", doc: "FR.md", content: "the dedicated specs repo is canonical" },
    ];

    const findings = findUnmarkedStorageMentions(documents);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].spec, "other-spec");
  });
});

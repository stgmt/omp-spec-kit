import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const moduleUrl = pathToFileURL(path.join(repositoryRoot, "src", "hosts", "skills.mjs")).href;
const { installSkills } = await import(moduleUrl);

let root;
let source;
let target;

before(() => {
  root = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-skills-"));
  source = path.join(root, "source");
  target = path.join(root, "target");
  for (const name of ["spec-elicitation", "spec-inventory"]) {
    mkdirSync(path.join(source, name), { recursive: true });
    writeFileSync(path.join(source, name, "SKILL.md"), `# ${name}\n`);
  }
  mkdirSync(path.join(target, "unrelated"), { recursive: true });
  writeFileSync(path.join(target, "unrelated", "SKILL.md"), "# keep\n");
  mkdirSync(path.join(target, "spec-inventory"), { recursive: true });
  writeFileSync(path.join(target, "spec-inventory", "SKILL.md"), "# stale\n");
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("host skills installer", () => {
  it("copies product skills, replaces stale ones, and keeps unrelated skills", () => {
    const installed = installSkills({ sourceRoot: source, targetSkillsDir: target });
    assert.deepEqual(installed.sort(), ["spec-elicitation", "spec-inventory"]);
    assert.equal(readFileSync(path.join(target, "spec-inventory", "SKILL.md"), "utf8"), "# spec-inventory\n");
    assert.equal(readFileSync(path.join(target, "unrelated", "SKILL.md"), "utf8"), "# keep\n");
  });

  it("refuses a missing or empty source", () => {
    assert.throws(() => installSkills({ sourceRoot: path.join(root, "absent"), targetSkillsDir: target }), /missing/u);
    const empty = path.join(root, "empty");
    mkdirSync(empty, { recursive: true });
    assert.throws(() => installSkills({ sourceRoot: empty, targetSkillsDir: target }), /empty/u);
  });
});

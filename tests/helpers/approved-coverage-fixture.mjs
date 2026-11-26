import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { approvedCoverageMap, replaceCoverageRegion } from "../../src/authoring/bdd-coverage.js";
import { readRepositorySpecs } from "../../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../../src/kernel/graph/build.js";

/**
 * A minimal L3 corpus with one approved contract example. Converted fixtures
 * carry no Outcome/ScenarioRef or contract Rule, so they cannot approve an
 * example; task-creation positive controls must use a corpus like this one.
 */
export async function writeCoveredSpec(root, spec) {
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  const detail = "Assembled specification context that clears the scaffold threshold. ".repeat(5);
  const files = {
    "README.md": `# ${spec}\n\n${detail}\n`,
    "REQUIREMENTS.md": `# Requirements\n\n${detail}\n`,
    "FR.md": "# Functional requirements\n\n## FR-1 — Read\n\nA read is available to the caller.\n",
    "NFR.md": "# Non-functional requirements\n\n## NFR-PERF-1 — Budget\n\nA read stays inside its budget.\n",
    "ACCEPTANCE_CRITERIA.md": "# Acceptance criteria\n\n## AC-1.1 — Read\n\nGiven a read, when it completes, then it is bounded.\n",
    "DESIGN.md": `# Design\n\n${detail}\n`,
    [`${spec}_SCHEMA.md`]: `# Schema\n\n${detail}\n`,
    "TASKS.md": "# Tasks\n\nStatus: DRAFT\n",
    [`${spec}-user-stories.feature`]: `Feature: User stories
  @contract
  Rule: Read behavior
    @id:SCEN-read @feature1 @AC-1.1
    Scenario: Read completes
      Given a read
      When it completes
      Then it is bounded
`,
    [`${spec}-use-cases.feature`]: "Feature: Use cases\n",
  };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(dir, name), content)));
  const graph = (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
  const approved = approvedCoverageMap({
    schema: "omp-spec-kit/bdd-coverage@1",
    outcomes: { read: { requirements: ["FR-1"], criteria: ["AC-1.1"], scenario: "SCEN-read" } },
    scopes: {},
  }, graph, spec);
  if (approved.problem) throw new Error(`cannot approve the coverage fixture: ${approved.problem}`);
  const criteriaPath = path.join(dir, "ACCEPTANCE_CRITERIA.md");
  await writeFile(criteriaPath, replaceCoverageRegion(await readFile(criteriaPath, "utf8"), approved.map));
  return { dir, spec };
}

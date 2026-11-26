import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { criterionId, criterionParent } from "../src/kernel/identity.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { specReadiness, taskAdmissionFixSteps } from "../src/kernel/readiness.js";
import { operationForFacade } from "../src/authoring/proposals.js";

describe("acceptance criterion identity", () => {
  it("parses and allocates both canonical parent forms", () => {
    assert.deepEqual(criterionParent("AC-2.3"), { parentLocalId: "FR-2", index: 3 });
    assert.deepEqual(criterionParent("AC-NFR-PERF-12.4"), { parentLocalId: "NFR-PERF-12", index: 4 });
    assert.equal(criterionParent("AC-PERF-1"), null);
    assert.equal(criterionId("FR-2", 1), "AC-2.1");
    assert.equal(criterionId("NFR-PERF-12", 4), "AC-NFR-PERF-12.4");
    assert.equal(criterionId("UNKNOWN-1", 1), null);
  });

  it("attaches an NFR criterion to its NFR and clears the criteria rung", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-criterion-id-"));
    try {
      const dir = path.join(root, ".specs", "nfr-lab");
      await mkdir(dir, { recursive: true });
      const detail = "Assembled specification context. ".repeat(8);
      const put = (name, text) => writeFile(path.join(dir, name), new TextEncoder().encode(text));
      await put("README.md", "# NFR lab\n\nStatus: DRAFT\n");
      await put("FR.md", "# Functional requirements\n\nStatus: DRAFT\n");
      await put("NFR.md", "# Non-functional requirements\n\n## NFR-PERF-1 — Budget\n\nReads stay bounded.\n");
      await put("ACCEPTANCE_CRITERIA.md", "# Criteria\n\n## AC-NFR-PERF-1.1 — Budget\n\nGiven a read, when it completes, then it is inside the budget.\n");
      await put("DESIGN.md", `# Design\n\n${detail}\n`);
      await put("TASKS.md", "# Tasks\n\nStatus: DRAFT\n");
      await put("nfr-lab-user-stories.feature", "Feature: NFR lab\n");
      const { graph } = await buildKernelGraph(await readRepositorySpecs({ root }));
      const criteria = graph.nodes.filter((node) => node.specSlug === "nfr-lab" && node.kind === "ACCEPTANCE_CRITERION");
      assert.deepEqual(criteria.map((node) => [node.localId, node.attributes.parentLocalId]),
        [["AC-NFR-PERF-1.1", "NFR-PERF-1"]]);
      assert.equal(graph.diagnostics.filter((diagnostic) => diagnostic.code === "INVALID_AC_PARENT").length, 0);
      const readiness = specReadiness(graph, "nfr-lab");
      assert.equal(readiness.level, "L2", JSON.stringify(readiness.blockers));
      assert.equal(readiness.reached.criteria, 1);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("allocates the next free suffix instead of a magic AC-9000 id", () => {
    const plan = operationForFacade("addAcceptanceCriterion", {
      spec: "nfr-lab", requirement: "NFR-PERF-1", criterion: "Another budget criterion",
    }, { criterionIds: ["AC-NFR-PERF-1.1", "AC-NFR-PERF-1.2"] });
    assert.notEqual(plan.ok, false, JSON.stringify(plan));
    assert.match(plan.operations[0].text, /## AC-NFR-PERF-1\.3 — NFR-PERF-1/u);
    assert.doesNotMatch(plan.operations[0].text, /AC-9000/u);
    const frPlan = operationForFacade("addAcceptanceCriterion", {
      spec: "nfr-lab", requirement: "FR-2", criterion: "Functional criterion",
    }, { criterionIds: ["AC-2.1"] });
    assert.match(frPlan.operations[0].text, /## AC-2\.2 — FR-2/u);
    const unknown = operationForFacade("addAcceptanceCriterion", {
      spec: "nfr-lab", requirement: "GHOST-1", criterion: "Unknown parent",
    });
    assert.equal(unknown.ok, false);
  });

  it("offers an NFR criterion as the readiness fix when no FR exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-criterion-fix-"));
    try {
      const dir = path.join(root, ".specs", "nfr-fix");
      await mkdir(dir, { recursive: true });
      const put = (name, text) => writeFile(path.join(dir, name), new TextEncoder().encode(text));
      await put("README.md", "# NFR fix\n\nStatus: DRAFT\n");
      await put("FR.md", "# Functional requirements\n\nStatus: DRAFT\n");
      await put("NFR.md", "# NFR\n\n## NFR-PERF-1 — Budget\n\nReads stay bounded.\n");
      await put("ACCEPTANCE_CRITERIA.md", "# Criteria\n");
      await put("DESIGN.md", "# Design\n\nStatus: DRAFT\n");
      await put("TASKS.md", "# Tasks\n\nStatus: DRAFT\n");
      await put("nfr-fix-user-stories.feature", "Feature: NFR fix\n");
      const graph = (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
      const readiness = specReadiness(graph, "nfr-fix");
      const step = taskAdmissionFixSteps("nfr-fix", readiness).find((entry) =>
        entry.arguments.operations[0].document === "ACCEPTANCE_CRITERIA.md");
      assert.ok(step);
      assert.match(step.arguments.operations[0].text, /## AC-NFR-PERF-1\.1 — NFR-PERF-1/u);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });
});

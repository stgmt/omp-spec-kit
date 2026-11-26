import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { extractReferenceTarget } from "../src/kernel/identity.js";
import { buildKernelGraph, findReferenceTargetInText } from "../src/kernel/graph/build.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { approvedCoverageMap, changedTaskCoverageFindings } from "../src/authoring/bdd-coverage.js";
import { SpecPatchService } from "../src/authoring/service.js";

const spec = "nfr-reference-lab";
const detail = "Assembled specification context that clears the scaffold threshold. ".repeat(5);

async function corpus(root, { withTask = false } = {}) {
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  const put = (name, text) => writeFile(path.join(dir, name), new TextEncoder().encode(text));
  await put("README.md", `# NFR lab\n\n${detail}\n`);
  await put("REQUIREMENTS.md", `# Requirements\n\n${detail}\n`);
  await put("FR.md", `# Functional requirements\n\n## FR-1 — Read\n\nA read is available.\n\n**Refs:** AC-NFR-PERF-1.1\n\n[see the criterion](ACCEPTANCE_CRITERIA.md#ac-nfr-perf-11)\n`);
  await put("NFR.md", "# Non-functional requirements\n\n## NFR-PERF-1 — Budget\n\nReads stay bounded.\n");
  await put("ACCEPTANCE_CRITERIA.md", "# Acceptance criteria\n\n## AC-1.1 — Read\n\nGiven a read, when it completes, then it is available.\n\n## AC-NFR-PERF-1.1 — Budget\n\nGiven a read, when it completes, then it is bounded.\n");
  await put("DESIGN.md", `# Design\n\n${detail}\n`);
  await put(`${spec}_SCHEMA.md`, `# Schema\n\n${detail}\n`);
  await put("TASKS.md", withTask
    ? "# Tasks\n\n## TASK-1: Budget check\n\nImplements: AC-NFR-PERF-1.1\n"
    : "# Tasks\n\nStatus: DRAFT\n");
  await put(`${spec}-user-stories.feature`, `Feature: User stories
  @contract
  Rule: Read budget
    @id:SCEN-perf-read @AC-NFR-PERF-1.1
    Scenario: Read stays bounded
      Given a read
      When it completes
      Then it is bounded
`);
  await put(`${spec}-use-cases.feature`, "Feature: Use cases\n");
  return dir;
}

const graphAt = async (root) => (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
const map = {
  schema: "omp-spec-kit/bdd-coverage@1",
  outcomes: {
    "perf-read": { requirements: ["NFR-PERF-1"], criteria: ["AC-NFR-PERF-1.1"], scenario: "SCEN-perf-read" },
  },
  scopes: {},
};

describe("NFR criterion reference surfaces", () => {
  it("extracts and resolves an NFR criterion id from prose fields and link text", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-nfr-refs-"));
    try {
      await corpus(root);
      assert.deepEqual(extractReferenceTarget("**Refs:** AC-NFR-PERF-1.1"),
        { target: "AC-NFR-PERF-1.1", index: 10 });
      assert.equal(findReferenceTargetInText("covers AC-NFR-PERF-1.1"), "AC-NFR-PERF-1.1");
      const graph = await graphAt(root);
      assert.ok(graph.edges.some((edge) => edge.type === "REFS" &&
        edge.from === `${spec}:FR-1` && edge.to === `${spec}:AC-NFR-PERF-1.1`),
        JSON.stringify(graph.diagnostics));
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("approves a coverage map whose criterion is an NFR criterion", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-nfr-approval-"));
    try {
      await corpus(root);
      const graph = await graphAt(root);
      const approved = approvedCoverageMap(map, graph, spec);
      assert.equal(approved.problem, undefined, JSON.stringify(approved.problem));
      assert.equal(approved.map.outcomes["perf-read"].criteria[0], "AC-NFR-PERF-1.1");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("derives the NFR requirement from an IMPLEMENTS criterion link on a task", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-nfr-implements-"));
    try {
      const withoutTask = path.join(tmpdir(), `omp-nfr-base-${Date.now()}`);
      await mkdir(withoutTask, { recursive: true });
      await corpus(withoutTask);
      await corpus(root, { withTask: true });
      const baseline = await graphAt(withoutTask);
      const graph = await graphAt(root);
      const approved = approvedCoverageMap(map, graph, spec);
      assert.equal(approved.problem, undefined, JSON.stringify(approved.problem));
      const findings = changedTaskCoverageFindings({
        baseline, graph, spec, proposed: approved.map, approved: approved.map,
      });
      assert.deepEqual(findings, [], JSON.stringify(findings));
      await rm(withoutTask, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("allocates the next free criterion id through the compiler", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-nfr-allocate-"));
    try {
      const dir = await corpus(root);
      const service = new SpecPatchService(root, () => graphAt(root), () => graphAt(root));
      const result = await service.execute({
        requestId: "nfr-allocate", intent: "addAcceptanceCriterion", spec,
        reason: "allocate the next criterion", dryRun: false,
        requirement: "FR-1", criterion: "A second functional criterion",
      });
      assert.equal(result.error?.code ?? result.data?.error?.code, undefined,
        JSON.stringify(result.error ?? result.data?.error));
      const text = await readFile(path.join(dir, "ACCEPTANCE_CRITERIA.md"), "utf8");
      assert.match(text, /## AC-1\.2 — FR-1/u);
      assert.doesNotMatch(text, /## AC-1\.1 — FR-1[\s\S]*## AC-1\.1/u);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";

const scenario = (id, tags) => `Feature: User stories
  @story:US-1
  Rule: Trace probe
    Actor: Author
    Goal: Observe trace resolution.
    Benefit: Keep cross-spec links explicit.

    @id:SCEN-${id} ${tags}
    Scenario: ${id}
      Given a fact
      When it changes
      Then it changes
`;

async function corpus(tags) {
  const root = await mkdtemp(path.join(tmpdir(), "omp-qualified-trace-"));
  const put = async (slug, name, text) => {
    const dir = path.join(root, ".specs", slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), new TextEncoder().encode(text));
  };
  for (const [slug, ids] of [["spec-a", [1, 2, 3, 4, 5, 6, 7, 8, 12]], ["spec-b", [9, 10, 11]]]) {
    await put(slug, "README.md", `# ${slug}\n\nStatus: DRAFT\n`);
    await put(slug, "FR.md", `# Functional requirements\n\n${ids.map((id) => `## FR-${id}: Requirement ${id}\n\nNormative body ${id}.\n`).join("\n")}`);
    await put(slug, "ACCEPTANCE_CRITERIA.md", "# Acceptance criteria\n\nStatus: DRAFT\n");
    await put(slug, "DESIGN.md", "# Design\n\nStatus: DRAFT\n");
    await put(slug, "TASKS.md", "# Tasks\n\nStatus: DRAFT\n");
    await put(slug, `${slug}-use-cases.feature`, "Feature: Use cases\n");
  }
  await put("spec-a", "spec-a-user-stories.feature", scenario("qualified", tags));
  return { root, graph: (await buildKernelGraph(await readRepositorySpecs({ root }))).graph };
}

describe("qualified scenario trace tags", () => {
  it("resolves @ref:<slug>:<id> to a TESTED_BY edge in the owning specification", async () => {
    const { root, graph } = await corpus("@ref:spec-b:FR-9");
    try {
      const edge = graph.edges.find((entry) => entry.type === "TESTED_BY" &&
        entry.from === "spec-b:FR-9" && entry.to === "spec-a:SCEN-qualified");
      assert.ok(edge, JSON.stringify(graph.diagnostics));
      assert.equal(graph.diagnostics.filter((diagnostic) =>
        diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE").length, 0);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("refuses a bare @featureN that only exists in another specification", async () => {
    const { root, graph } = await corpus("@feature9");
    try {
      const findings = graph.diagnostics.filter((diagnostic) =>
        diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE");
      assert.equal(findings.length, 1, JSON.stringify(graph.diagnostics));
      assert.equal(findings[0].canonicalId, "spec-b:FR-9");
      assert.equal(findings[0].severity, "ERROR");
      assert.equal(graph.valid, false);
      assert.equal(graph.edges.some((edge) => edge.from === "spec-b:FR-9"), false);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("keeps @featureN local when the requirement exists in the same specification", async () => {
    const { root, graph } = await corpus("@feature1");
    try {
      assert.ok(graph.edges.some((edge) => edge.type === "TESTED_BY" &&
        edge.from === "spec-a:FR-1" && edge.to === "spec-a:SCEN-qualified"));
      assert.equal(graph.diagnostics.some((diagnostic) => diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE"), false);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("accepts every trace target kind and ignores non-trace kinds", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-qualified-kinds-"));
    try {
      const a = path.join(root, ".specs", "spec-a");
      const b = path.join(root, ".specs", "spec-b");
      await mkdir(a, { recursive: true });
      await mkdir(b, { recursive: true });
      const put = (dir, name, text) => writeFile(path.join(dir, name), new TextEncoder().encode(text));
      await put(b, "FR.md", "# FR\n\n## FR-9: Requirement\n\nBody.\n");
      await put(b, "NFR.md", "# NFR\n\n## NFR-PERF-1 — Budget\n\nBody.\n");
      await put(b, "ACCEPTANCE_CRITERIA.md", "# AC\n\n## AC-1.1 — Requirement\n\nBody.\n");
      await put(b, "spec-b-user-stories.feature", "Feature: Stories\n  @story:US-1\n  Rule: Story\n    Actor: A\n    Goal: G\n    Benefit: B\n    @id:SCEN-local\n    Scenario: Local\n      Given a\n      When b\n      Then c\n");
      await put(b, "spec-b-use-cases.feature", "Feature: Cases\n");
      await put(a, "FR.md", "# FR\n\n## FR-1: Requirement\n\nBody.\n");
      await put(a, "NFR.md", "# NFR\n\n## NFR-LOCAL-1 — Budget\n\nBody.\n");
      await put(a, "ACCEPTANCE_CRITERIA.md", "# AC\n\n## AC-NFR-LOCAL-1.1 — Budget\n\nBody.\n");
      const tagged = [
        ["fr", "@ref:spec-b:FR-9"],
        ["ac", "@ref:spec-b:AC-1.1"],
        ["nfr", "@ref:spec-b:NFR-PERF-1"],
        ["us", "@ref:spec-b:US-1"],
        ["bare-nfr-ac", "@AC-NFR-LOCAL-1.1"],
      ];
      await put(a, "spec-a-user-stories.feature", `Feature: User stories
  @story:US-1
  Rule: Trace kinds
    Actor: Author
    Goal: Cover all trace kinds.
    Benefit: Keep the grammar closed.

${tagged.map(([id, tags]) => `    @id:SCEN-${id} ${tags}\n    Scenario: ${id}\n      Given a\n      When b\n      Then c\n`).join("\n")}`);
      await put(a, "spec-a-use-cases.feature", "Feature: Cases\n");
      const graph = (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
      for (const [id, target] of [
        ["fr", "spec-b:FR-9"], ["ac", "spec-b:AC-1.1"], ["nfr", "spec-b:NFR-PERF-1"],
        ["bare-nfr-ac", "spec-a:AC-NFR-LOCAL-1.1"],
      ]) {
        assert.equal(graph.edges.filter((edge) => edge.type === "TESTED_BY" &&
          edge.from === target && edge.to === `spec-a:SCEN-${id}`).length, 1, id);
      }
      assert.equal(graph.edges.some((edge) => edge.to === "spec-a:SCEN-us"), false);
      assert.equal(graph.diagnostics.some((diagnostic) => diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE" &&
        diagnostic.span?.path?.endsWith("spec-a-user-stories.feature")), false);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("keeps historical prose/task references as warnings", async () => {
    const { root } = await corpus("@feature1");
    try {
      const dir = path.join(root, ".specs", "spec-a");
      await writeFile(path.join(dir, "FR.md"),
        "# Functional requirements\n\n## FR-1: Requirement 1\n\nNormative body.\n\n**Refs:** FR-9\n");
      const graph = (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
      const findings = graph.diagnostics.filter((diagnostic) =>
        diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE");
      assert.equal(findings.length, 1, JSON.stringify(graph.diagnostics));
      assert.equal(findings[0].severity, "WARNING");
      assert.equal(findings[0].canonicalId, "spec-b:FR-9");
      assert.equal(graph.diagnostics.some((diagnostic) =>
        diagnostic.severity === "ERROR" && diagnostic.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE"), false);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  it("refuses to write a scenario whose bare trace resolves only in another specification", async () => {
    const { root } = await corpus("@feature1");
    try {
      const graphAt = async () => (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
      const service = new SpecPatchService(root, graphAt, graphAt);
      const result = await service.execute({
        requestId: "qualified-trace-write",
        intent: "patch",
        spec: "spec-a",
        reason: "cross-spec trace guard",
        dryRun: false,
        operations: [{
          kind: "replace_document",
          document: "spec-a-user-stories.feature",
          content: scenario("qualified", "@feature9"),
        }],
      });
      const failure = result.error ?? result.data?.error;
      assert.equal(failure?.code, "VALIDATION_FAILED", JSON.stringify(failure));
      assert.ok(failure.findings.some((entry) => entry.code === "UNQUALIFIED_CROSS_SPEC_REFERENCE"),
        JSON.stringify(failure.findings));
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SpecPatchService } from "../src/authoring/service.js";
import { createStore } from "../src/service/ledger.js";
import { createSpecService } from "../src/adapters/query-service.js";
import { createDispatcher } from "../src/service/dispatch.js";
import { scopeFromContext } from "../src/service/scope.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { specReadiness, taskAdmissionFixSteps } from "../src/kernel/readiness.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";
const SPEC = "spec-mcp-access-gate";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
}

function serviceAt(root, options = {}) {
  return new SpecPatchService(root, () => graphAt(root), () => graphAt(root), options);
}

async function cpFixtureCorpus(root) {
  await cp(
    path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus", specsDirName),
    path.join(root, specsDirName),
    { recursive: true },
  );
}

async function writeStubSpec(root, slug) {
  const dir = path.join(root, specsDirName, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "README.md"), "# Stub\n\nStatus: DRAFT\n");
  await writeFile(path.join(dir, "DESIGN.md"), "# Stub\n\nStatus: DRAFT\n");
  await writeFile(path.join(dir, "FR.md"), "# Functional requirements\n\nStatus: DRAFT\n");
  await writeFile(path.join(dir, "ACCEPTANCE_CRITERIA.md"), "# Acceptance criteria\n\nStatus: DRAFT\n");
  await writeFile(path.join(dir, "TASKS.md"), "# Tasks\n\nStatus: DRAFT\n");
  await writeFile(path.join(dir, `${slug}-user-stories.feature`), "Feature: Stub stories\n");
  await writeFile(path.join(dir, `${slug}-use-cases.feature`), "Feature: Stub cases\n");
}

describe("readiness verdict", () => {
  it("reports L3, the top rung the corpus can prove, for an assembled specification", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-readiness-l2-"));
    try {
      await cpFixtureCorpus(root);
      const verdict = specReadiness(await graphAt(root), SPEC);
      assert.equal(verdict.level, "L3");
      assert.equal(verdict.nextLevel, null, "the ladder stops where the corpus stops");
      assert.equal(verdict.reached.design, true);
      assert.deepEqual(
        verdict.blockers.map((entry) => entry.code),
        [],
        "an assembled specification is not held back by a rung the corpus cannot supply",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("counts a non-functional requirement as the first rung", async () => {
    // The admission gate accepts an NFR id as a traceable parent, so a ladder
    // that only counted FRs would pin an NFR-only specification at L0 while
    // the same compiler accepted the id.
    const root = await mkdtemp(path.join(tmpdir(), "omp-readiness-nfr-"));
    try {
      const dir = path.join(root, specsDirName, "nfr-spec");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "README.md"), "# NFR spec\n\nStatus: DRAFT\n");
      await writeFile(path.join(dir, "FR.md"), "# Functional requirements\n\nStatus: DRAFT\n");
      await writeFile(
        path.join(dir, "NFR.md"),
        "# Non-functional requirements\n\n## NFR-PERF-1 — Response latency\n\nEvery read answers within the budget.\n",
      );
      await writeFile(
        path.join(dir, "ACCEPTANCE_CRITERIA.md"),
        "# Acceptance criteria\n\n## AC-PERF-1 — NFR-PERF-1\n\nGiven a read, when it completes, then it is inside the budget.\n\nImplements: NFR-PERF-1\n",
      );
      await writeFile(path.join(dir, "DESIGN.md"), `# Design\n\nStatus: DRAFT\n\n${"Assembled design context. ".repeat(20)}\n`);
      await writeFile(path.join(dir, "TASKS.md"), "# Tasks\n\nStatus: DRAFT\n");
      await writeFile(path.join(dir, "nfr-spec-user-stories.feature"), "Feature: NFR spec\n");
      const verdict = specReadiness(await graphAt(root), "nfr-spec");
      // L1 is reached: a non-functional requirement is a requirement, and the
      // admission gate accepts its id as a traceable parent.
      assert.equal(verdict.level, "L1", JSON.stringify(verdict.blockers));
      assert.equal(verdict.firstRequirement, "NFR-PERF-1");
      // A criterion is parented by AC-<n>.<m> to FR-<n>, so what is missing is
      // the functional requirement, not the requirement rung.
      assert.equal(verdict.firstFunctionalRequirement, null);
      assert.deepEqual(verdict.blockers.map((entry) => entry.code), ["NO_ACCEPTANCE_CRITERIA"]);
      // The plan starts with the document the blocker actually names.
      const step = taskAdmissionFixSteps("nfr-spec", verdict)[0];
      assert.equal(step.arguments.operations[0].document, "FR.md");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports L0 for a scaffold and names the missing requirement first", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-readiness-stub-"));
    try {
      await writeStubSpec(root, "stub-spec");
      const verdict = specReadiness(await graphAt(root), "stub-spec");
      assert.equal(verdict.level, "L0");
      assert.equal(verdict.blockers[0].code, "NO_REQUIREMENTS");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("task admission", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-gate-"));
    await writeStubSpec(root, "stub-spec");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("refuses a task on a scaffold with SPEC_NOT_READY and a fix plan", async () => {
    const result = await serviceAt(root).execute({
      requestId: "readiness-task-stub",
      intent: "confirmTaskCreation",
      spec: "stub-spec",
      reason: "admission",
      dryRun: true,
      entity: "TASK-1",
      subject: "Too early",
      requirements: ["FR-1"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SPEC_NOT_READY");
    assert.equal(result.error.retryable, false);
    assert.equal(result.error.level, "L0");
    assert.deepEqual(
      result.error.blockers.map((entry) => entry.level),
      ["L1"],
      "blockers arrive in level order",
    );
    assert.equal(result.error.fix[0].tool, "spec_patch");
    // The first step must be executable on the state that produced the
    // refusal, so it creates FR-1 rather than amending one that is not there.
    assert.equal(result.error.fix[0].arguments.intent, "patch");
    assert.equal(result.error.fix[0].arguments.operations[0].document, "FR.md");
    assert.match(result.error.fix[0].arguments.operations[0].text, /^\n## FR-1 — /u);
  });

  it("replays returned fixes until domain-authored documents are needed", async () => {
    const service = serviceAt(root);
    let refusals = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await service.execute({
        requestId: `readiness-walk-${attempt}`,
        intent: "confirmTaskCreation",
        spec: "stub-spec",
        reason: "admission",
        dryRun: true,
        entity: "TASK-1",
        subject: "Walk the ladder",
        requirements: ["FR-1"],
      });
      if (result.ok) break;
      assert.equal(result.error.code, "SPEC_NOT_READY", JSON.stringify(result.error ?? {}));
      const step = result.error.fix[0];
      if (!step) break;
      assert.equal(step.tool, "spec_patch");
      assert.ok(step.arguments.requestId);
      const file = path.join(root, specsDirName, "stub-spec", step.arguments.operations[0].document);
      const before = await readFile(file, "utf8");
      const preview = await service.execute(step.arguments);
      assert.equal(preview.ok, true, JSON.stringify(preview.error ?? {}).slice(0, 300));
      assert.equal(preview.data.outcome, "PREVIEW");
      assert.equal(await readFile(file, "utf8"), before, "replaying a suggestion must not write");
      // An explicit apply exercises the existing compiler path, not a recommendation
      // to accept the suggested scaffold as domain-authored content.
      const applied = await service.execute({ ...step.arguments, dryRun: false });
      assert.equal(applied.ok, true, JSON.stringify(applied.error ?? {}).slice(0, 300));
      assert.equal(applied.data.outcome, "APPLIED");
      refusals += 1;
    }
    // Three rungs, three calls: the plan is not advisory.
    assert.ok(refusals >= 1, "the scaffold must be refused at least once");
    const verdict = specReadiness(await graphAt(root), "stub-spec");
    assert.equal(verdict.level, "L2", JSON.stringify(verdict.blockers));
    assert.equal(verdict.firstRequirement, "FR-1");
  });

  it("refuses a functional requirement while REQUIREMENTS.md is the scaffold", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "omp-readiness-chain-"));
    try {
      await cpFixtureCorpus(root);
      const requirements = path.join(root, specsDirName, SPEC, "REQUIREMENTS.md");
      await writeFile(requirements, "# Requirements Summary\n\nStatus: DRAFT\n", "utf8");
      const attempt = await serviceAt(root).execute({
        requestId: "readiness-chain-fr-first",
        intent: "patch",
        spec: SPEC,
        reason: "add an FR before the requirement index",
        dryRun: true,
        operations: [
          {
            kind: "insert_at_eof",
            document: "FR.md",
            text: "\n## FR-77 — Ordered write\n\nA requirement written before its index.\n",
          },
        ],
      });
      assert.equal(attempt.ok, false, "an FR on a scaffold requirement index must be refused");
      assert.equal(attempt.error.code, "REQUIREMENTS_DOC_REQUIRED", JSON.stringify(attempt.error ?? {}).slice(0, 300));
      const step = attempt.error.fix.find(
        (entry) => entry.arguments?.operations?.[0]?.document === "REQUIREMENTS.md",
      );
      assert.equal(step, undefined, "an authored index must not be replaced by a generic template");
      assert.equal(await readFile(requirements, "utf8"), "# Requirements Summary\n\nStatus: DRAFT\n");
      await writeFile(requirements, `# Requirements Summary\n\n${"The owner maintains this requirement index and its traceability. ".repeat(5)}\n`);
      const retried = await serviceAt(root).execute({
        requestId: "readiness-chain-fr-after",
        intent: "patch",
        spec: SPEC,
        reason: "add an FR after the requirement index exists",
        dryRun: true,
        operations: [
          {
            kind: "insert_at_eof",
            document: "FR.md",
            text: "\n## FR-77 — Ordered write\n\nA requirement written after its index.\n",
          },
        ],
      });
      assert.equal(retried.ok, true, JSON.stringify(retried.error ?? {}).slice(0, 300));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not replace short authored indexes or schemas with placeholder content", async () => {
    await cpFixtureCorpus(root);
    const dir = path.join(root, specsDirName, SPEC);
    const index = "# Requirements\n\nBoundary: preserve the owner's payment rules.\n";
    const schema = "# Schema\n\nReceipt: signed by the owner.\n";
    await writeFile(path.join(dir, "REQUIREMENTS.md"), index);
    await writeFile(path.join(dir, `${SPEC}_SCHEMA.md`), schema);
    const service = serviceAt(root);
    const result = await service.execute({ requestId: "authored-docs", intent: "confirmTaskCreation", spec: SPEC,
      reason: "admission", dryRun: true, entity: "TASK-900", subject: "Test", requirements: ["FR-1"] });
    assert.equal(result.error.code, "SPEC_NOT_READY");
    assert.ok(result.error.blockers.some((entry) => entry.code === "NO_REQUIREMENTS_DOC"));
    assert.ok(result.error.blockers.some((entry) => entry.code === "NO_SCHEMA"));
    assert.ok(result.error.fix.every((step) => !["REQUIREMENTS.md", `${SPEC}_SCHEMA.md`].includes(step.arguments.operations[0].document)));
    assert.equal(await readFile(path.join(dir, "REQUIREMENTS.md"), "utf8"), index);
    assert.equal(await readFile(path.join(dir, `${SPEC}_SCHEMA.md`), "utf8"), schema);
  });

  it("refuses a stale returned fix without changing the author's edit", async () => {
    const file = path.join(root, specsDirName, "stub-spec", "FR.md");
    const service = serviceAt(root);
    const result = await service.execute({ requestId: "stale-plan", intent: "confirmTaskCreation", spec: "stub-spec",
      reason: "admission", dryRun: true, entity: "TASK-1", subject: "Test", requirements: ["FR-1"] });
    const step = result.error.fix[0];
    const authored = "# Functional requirements\n\nOwner's new text.\n";
    await writeFile(file, authored);
    const replay = await service.execute(step.arguments);
    assert.equal(replay.error?.code ?? replay.data?.error?.code, "CONFLICT", JSON.stringify(replay));
    assert.equal(await readFile(file, "utf8"), authored);
  });

  it("refuses a task that names no requirement of this specification", async () => {
    const assembled = await mkdtemp(path.join(tmpdir(), "omp-readiness-untraced-"));
    try {
      await cpFixtureCorpus(assembled);
      const result = await serviceAt(assembled).execute({
        requestId: "readiness-task-untraced",
        intent: "confirmTaskCreation",
        spec: SPEC,
        reason: "admission",
        dryRun: true,
        entity: "TASK-2",
        subject: "Untraced",
        requirements: ["FR-999"],
      });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "TASK_NOT_TRACEABLE");
      assert.equal(result.error.fix[0].arguments.requirements.length, 1);
    } finally {
      await rm(assembled, { recursive: true, force: true });
    }
  });

  it("sees a requirement defined in the same proposal and still requires approved task coverage", async () => {
    // A proposal may define what it references. The definition is written here
    // as a Setext heading, which the kernel reads exactly like `## FR-5`.
    const assembled = await mkdtemp(path.join(tmpdir(), "omp-readiness-batch-"));
    try {
      await cpFixtureCorpus(assembled);
      const result = await serviceAt(assembled).execute({
        requestId: "readiness-batch-setext",
        intent: "patch",
        spec: SPEC,
        reason: "define and trace in one call",
        dryRun: true,
        operations: [
          {
            kind: "insert_at_eof",
            document: "FR.md",
            text: "\nFR-99 — Latency budget\n-\n\nReads stay inside the budget.\n",
          },
          {
            kind: "create_task",
            document: "TASKS.md",
            entity: "TASK-91",
            subject: "Batch task",
            requirements: ["FR-99"],
          },
        ],
      });
      assert.equal(result.error?.code, "BDD_COVERAGE_INCOMPLETE", JSON.stringify(result.error));
    } finally {
      await rm(assembled, { recursive: true, force: true });
    }
  });

  it("gives a traced task proposal that still needs coverage approval", async () => {
    const assembled = await mkdtemp(path.join(tmpdir(), "omp-readiness-backlog-plan-"));
    try {
      await cpFixtureCorpus(assembled);
      const service = serviceAt(assembled);
      const refused = await service.execute({
        requestId: "backlog-plan-1",
        intent: "addBacklogTask",
        spec: SPEC,
        reason: "backlog",
        dryRun: true,
        title: "From the backlog",
      });
      assert.equal(refused.ok, false);
      assert.equal(refused.error.code, "BACKLOG_FORBIDDEN");
      const step = refused.error.fix[0];
      assert.equal(step.tool, "spec_patch");
      assert.equal(step.arguments.intent, "confirmTaskCreation");
      // The plan names a free id and an existing requirement. Admission also
      // requires the owner to approve examples for that requirement.
      assert.match(step.arguments.entity, /^TASK-[1-9][0-9]*$/u);
      assert.equal(step.arguments.requirements.length, 1);
      assert.ok(step.arguments.requestId);
      const applied = await service.execute(step.arguments);
      assert.equal(applied.error?.code, "BDD_COVERAGE_INCOMPLETE", JSON.stringify(applied.error));
    } finally {
      await rm(assembled, { recursive: true, force: true });
    }
  });

  it("applies a design fix step next to a decision that already exists", async () => {
    // A design can be short and still declare a decision. Hardcoding DEC-1 in
    // the plan would append a second definition of an id already in use, and
    // the replayed write would be refused as a duplicate.
    const dir = path.join(root, specsDirName, "stub-spec");
    await writeFile(path.join(dir, "FR.md"), "# Functional requirements\n\n## FR-1 — Something\n\nIt must work.\n");
    await writeFile(
      path.join(dir, "ACCEPTANCE_CRITERIA.md"),
      "# Acceptance criteria\n\n## AC-1.1 — FR-1\n\nGiven a caller, when it asks, then it works.\n",
    );
    await writeFile(
      path.join(dir, "DESIGN.md"),
      "# Design\n\nStatus: DRAFT\n\n## DEC-1 — Use SQLite\n\nContext: single-file store.\n",
    );
    const service = serviceAt(root);
    const refused = await service.execute({
      requestId: "design-fix-1",
      intent: "confirmTaskCreation",
      spec: "stub-spec",
      reason: "admission",
      dryRun: true,
      entity: "TASK-1",
      subject: "After the design step",
      requirements: ["FR-1"],
    });
    assert.equal(refused.error.code, "SPEC_NOT_READY");
    assert.deepEqual(refused.error.blockers.map((entry) => entry.code), ["NO_DESIGN"]);
    const step = refused.error.fix[0];
    assert.match(step.arguments.operations[0].text, /^\n## DEC-2 — /u);
    const preview = await service.execute(step.arguments);
    assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
    const applied = await service.execute({ ...step.arguments, dryRun: false });
    assert.equal(applied.ok, true, JSON.stringify(applied.error ?? {}).slice(0, 300));
    assert.equal(applied.data.outcome, "APPLIED");
  });

  it("gives a backlog refusal the ladder plan while the corpus cannot admit a task", async () => {
    // A requirement exists, so the refusal can name one, but the ladder still
    // stops short of L2: the plan must clear the rungs rather than hand back a
    // task call that would only be refused again.
    await writeFile(path.join(root, specsDirName, "stub-spec", "NFR.md"), "# Non-functional\n\n## NFR-PERF-1 — Latency\n\nBudgeted.\n");
    const refused = await serviceAt(root).execute({
      requestId: "backlog-nfr-l0",
      intent: "addBacklogTask",
      spec: "stub-spec",
      reason: "backlog",
      dryRun: true,
      title: "From the backlog",
    });
    assert.equal(refused.error.code, "BACKLOG_FORBIDDEN");
    assert.equal(refused.error.fix[0].arguments.intent, "patch");
    assert.equal(refused.error.fix[0].arguments.operations[0].document, "FR.md");
  });

  it("writes the refusal to the durable log with slug, code, level and blockers", async () => {
    const entries = [];
    await serviceAt(root, { audit: (entry) => entries.push(entry) }).execute({
      requestId: "readiness-audit",
      intent: "confirmTaskCreation",
      spec: "stub-spec",
      reason: "admission",
      dryRun: true,
      entity: "TASK-3",
      subject: "Audit",
      requirements: ["FR-1"],
    });
    assert.equal(entries.length, 1);
    // Both drivers keep these five columns and nothing else, so the refusal
    // has to fit them: the slug in `spec`, the rest selectable in `result`.
    assert.equal(entries[0].op, "spec_patch");
    assert.equal(entries[0].spec, "stub-spec");
    assert.equal(entries[0].result, "admission-refused:SPEC_NOT_READY:L0:NO_REQUIREMENTS");
  });

  it("keeps the refusal readable through the store's own reader", async () => {
    const store = await createStore({ file: path.join(root, "ledger.sqlite") });
    try {
      await serviceAt(root, { audit: (entry) => store.logAccess(entry) }).execute({
        requestId: "readiness-durable",
        intent: "confirmTaskCreation",
        spec: "stub-spec",
        reason: "admission",
        dryRun: true,
        entity: "TASK-4",
        subject: "Durable",
        requirements: ["FR-1"],
      });
      const rows = store.listAccess({ resultPrefix: "admission-refused:" });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].spec, "stub-spec");
      assert.match(rows[0].result, /SPEC_NOT_READY/u);
      assert.match(rows[0].result, /L0/u);
      assert.match(rows[0].result, /NO_REQUIREMENTS/u);
    } finally {
      store.close();
    }
  });
});

describe("bypass closure", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-bypass-"));
    await writeStubSpec(root, "stub-spec");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("allows an annotation inside an existing task definition", async () => {
    await cpFixtureCorpus(root);
    const file = path.join(root, specsDirName, SPEC, "TASKS.md");
    const lines = (await readFile(file, "utf8")).split("\n");
    const heading = lines.findIndex((line) => /^##\s+TASK-[0-9]+/u.test(line));
    assert.ok(heading >= 0, "the fixture must define a task");
    lines.splice(heading + 1, 0, "Note: annotation written by a document operation");
    const result = await serviceAt(root).execute({
      requestId: "readiness-annotation",
      intent: "patch",
      spec: SPEC,
      reason: "annotation",
      dryRun: true,
      operations: [{ kind: "replace_document", document: "TASKS.md", content: lines.join("\n") }],
    });
    // AC-3.1 refuses an inserted heading; the body of an existing definition
    // stays writable, so an annotation is not a bypass.
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}));
  });

  it("allows a task heading that is a fenced sample", async () => {
    // The corpus never registers a fenced line as a definition, so the gate
    // must not refuse a document whose example is not a definition either.
    await cpFixtureCorpus(root);
    const result = await serviceAt(root).execute({
      requestId: "readiness-fenced-task",
      intent: "patch",
      spec: SPEC,
      reason: "documentation sample",
      dryRun: true,
      operations: [
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: "\n## Task template\n\n```markdown\n## TASK-7 — Subject\n- **Status:** todo\n```\n",
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}).slice(0, 300));
  });

  it("refuses a raw task heading inserted into TASKS.md", async () => {
    const result = await serviceAt(root).execute({
      requestId: "readiness-raw-task",
      intent: "patch",
      spec: "stub-spec",
      reason: "bypass",
      dryRun: true,
      operations: [{ kind: "insert_at_eof", document: "TASKS.md", text: "\n## TASK-9 — Raw\n\n- **Status:** todo\n" }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-9"]);
    assert.equal(result.error.fix[0].arguments.operations[0].kind, "create_task");
  });

  it("refuses a task heading smuggled inside a canonical comment", async () => {
    // The pre-resolution gate skips canonical task operations, so the body of
    // an allowed comment is the one path a heading can still arrive by: it is
    // spliced after the comment prefix, and a multi-line body starts a line.
    await cpFixtureCorpus(root);
    const result = await serviceAt(root).execute({
      requestId: "readiness-comment-heading",
      intent: "patch",
      spec: SPEC,
      reason: "bypass in a comment",
      dryRun: true,
      operations: [
        {
          kind: "append_task_comment",
          document: "TASKS.md",
          entity: "TASK-1",
          text: "first line\n## TASK-99 — Raw\n- **Status:** todo",
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-99"]);
  });

  it("refuses a rename that brings task headings into TASKS.md", async () => {
    // A rename onto a missing TASKS.md is the other route the pre-resolution
    // gate cannot see: there is no before-bytes to compare, so the headings
    // arrive as the after-state of a document that did not exist.
    // The layout gate refuses writes to a spec that still needs migration, so
    // the fixture must already carry the canonical Gherkin pair — otherwise
    // the migration refusal fires first and the bypass gate is never reached.
    const dir = path.join(root, specsDirName, "rename-probe");
    await mkdir(dir, { recursive: true });
    for (const [name, content] of [
      ["README.md", "# Rename probe\n\nStatus: DRAFT\n"],
      ["DESIGN.md", "# Design\n\nStatus: DRAFT\n"],
      ["FR.md", "# Functional requirements\n\n## FR-1 — Something\n\nIt must work.\n"],
      ["ACCEPTANCE_CRITERIA.md", "# Acceptance criteria\n\n## AC-1.1 — FR-1\n\nGiven a caller, when it asks, then it works.\n"],
      ["FIXTURES.md", "# Fixtures\n\n## TASK-98 — Raw fixture\n\n- **Status:** todo\n"],
      ["rename-probe-user-stories.feature", "Feature: Rename probe stories\n"],
      ["rename-probe-use-cases.feature", "Feature: Rename probe cases\n"],
    ]) {
      await writeFile(path.join(dir, name), content);
    }
    const result = await serviceAt(root).execute({
      requestId: "readiness-rename-heading",
      intent: "patch",
      spec: "rename-probe",
      reason: "bypass by rename",
      dryRun: true,
      operations: [{ kind: "rename_document", document: "FIXTURES.md", newDocument: "TASKS.md" }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-98"]);
  });

  it("refuses a task heading smuggled into a CRLF document", async () => {
    // The kernel normalizes CRLF to LF before parsing, so a `\r` must not make
    // the gate blind to the definitions it is guarding.
    await cpFixtureCorpus(root);
    const file = path.join(root, specsDirName, SPEC, "TASKS.md");
    const crlf = (await readFile(file, "utf8")).replace(/\r?\n/gu, "\r\n");
    await writeFile(file, crlf);
    const result = await serviceAt(root).execute({
      requestId: "readiness-crlf-heading",
      intent: "patch",
      spec: SPEC,
      reason: "bypass in a CRLF document",
      dryRun: true,
      operations: [
        {
          kind: "append_task_comment",
          document: "TASKS.md",
          entity: "TASK-1",
          text: "first line\n## TASK-98 — Raw\n- **Status:** todo",
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-98"]);
  });

  it("refuses a task heading smuggled into a lone-CR document", async () => {
    // The kernel collapses every line ending, not just CRLF. A document that uses
    // a bare `\r` must be read as the parser reads it, or the definitions the gate
    // guards would sit on different line numbers than the ones it slices.
    await cpFixtureCorpus(root);
    const file = path.join(root, specsDirName, SPEC, "TASKS.md");
    const cr = (await readFile(file, "utf8")).replace(/\r?\n/gu, "\r");
    await writeFile(file, cr);
    // A canonical task operation cannot locate an entity in a lone-CR document
    // (its own scans split on `\r?\n`), so the heading arrives as raw document
    // text: the gate must still see the definition it is adding.
    const result = await serviceAt(root).execute({
      requestId: "readiness-cr-heading",
      intent: "patch",
      spec: SPEC,
      reason: "bypass in a lone-CR document",
      dryRun: true,
      operations: [
        {
          kind: "replace_document",
          document: "TASKS.md",
          text: `${cr}\r## TASK-97 — Raw\r- **Status:** todo\r`,
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-97"]);
  });

  it("refuses a task definition written as a Setext heading", async () => {
    // The kernel reads `## TASK-1` and `TASK-1` over a `-` underline as the
    // same definition, so a gate that matched only the ATX form would let the
    // underline form through and admit an untraced task.
    const result = await serviceAt(root).execute({
      requestId: "readiness-setext-task",
      intent: "patch",
      spec: "stub-spec",
      reason: "bypass by setext",
      dryRun: true,
      operations: [
        {
          kind: "insert_at_eof",
          document: "TASKS.md",
          text: "\nTASK-77 — Raw bypass\n-\n\n- **Status:** todo\n",
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "TASK_DOCUMENT_BYPASS");
    assert.deepEqual(result.error.tasks, ["TASK-77"]);
  });

  it("refuses both backlog intents", async () => {
    for (const [requestId, intent, extra] of [
      ["readiness-backlog", "addBacklogTask", { title: "Backlog" }],
      ["readiness-incident", "registerIncidentBacklog", { summary: "Incident" }],
    ]) {
      const result = await serviceAt(root).execute({
        requestId,
        intent,
        spec: "stub-spec",
        reason: "bypass",
        dryRun: true,
        ...extra,
      });
      assert.equal(result.ok, false, `${intent} must be refused`);
      assert.equal(result.error.code, "BACKLOG_FORBIDDEN", `${intent} refusal code`);
      assert.match(result.error.message, /requires a requirement/u);
    }
  });
});

describe("scenario traceability", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-scenario-"));
    await cpFixtureCorpus(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const contract = (tag = "") => ({
    kind: "insert_at_eof",
    document: `${SPEC}-user-stories.feature`,
    text: `\n  @contract\n  Rule: Traceable contract\n    @id:SCEN-contract ${tag}\n    Scenario: Traceable result\n      Given a request\n      When the caller submits it\n      Then the result is visible\n`,
  });

  for (const tag of ["", "@other-spec:FR-1"]) {
    it(`refuses a contract with only "${tag}" as its trace`, async () => {
      const result = await serviceAt(root).execute({
        requestId: "readiness-contract-refused", intent: "patch", spec: SPEC,
        reason: "Verify local trace", dryRun: true, operations: [contract(tag)],
      });
      assert.equal(result.error?.code, "VALIDATION_FAILED");
      assert.match(JSON.stringify(result.error.findings), /requires an FR or AC trace tag/u);
    });
  }

  it("accepts a draft contract that carries a local criterion tag", async () => {
    const result = await serviceAt(root).execute({
      requestId: "readiness-contract-linked", intent: "patch", spec: SPEC,
      reason: "Verify local trace", dryRun: true, operations: [contract("@AC-1.1")],
    });
    assert.equal(result.ok, true, JSON.stringify(result.error));
  });
});

describe("transport parity", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-parity-"));
    await writeStubSpec(root, "stub-spec");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const ARGS = {
    schemaVersion: "spec-kernel@2",
    requestId: "readiness-parity-1",
    dryRun: true,
    intent: "confirmTaskCreation",
    spec: "stub-spec",
    entity: "TASK-1",
    subject: "Parity",
    requirements: ["FR-1"],
    reason: "parity",
  };

  function runStdio(calls) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(repositoryRoot, "src", "mcp", "server.js")], {
        cwd: root,
        env: { ...process.env, OMP_SPEC_KIT_ROOT: root },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", () => {
        const messages = stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .filter((message) => message.id !== undefined);
        resolve({ messages, stderr });
      });
      child.stdin.write(
        [
          JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
          ...calls.map((call, index) => JSON.stringify({ jsonrpc: "2.0", id: index + 2, method: "tools/call", params: call })),
        ].join("\n") + "\n",
      );
      child.stdin.end();
    });
  }

  it("answers the same refusal through stdio and through the hosted dispatcher", async () => {
    const stdio = await runStdio([{ name: "spec_patch", arguments: ARGS }]);
    const stdioEnvelope = stdio.messages.find((message) => message.id === 2)?.result?.structuredContent;
    assert.ok(stdioEnvelope, `stdio must answer: ${stdio.stderr}`);

    const service = createSpecService(root);
    const dispatcher = createDispatcher({
      mounts: {
        requireConfigured: () => {},
        requireRepoReady: () => {},
        serviceFor: () => service,
      },
    });
    const ctx = {
      role: "writer",
      scopes: ["stgmt/alpha"],
      identity: { login: "alice" },
      defaultScope: "stgmt/alpha",
    };
    const hosted = await dispatcher.callTool({
      tool: "spec_patch",
      args: { ...ARGS, project: "stgmt/alpha" },
      ctx: { ...ctx, scope: scopeFromContext(ctx) },
    });

    assert.equal(stdioEnvelope.ok, false);
    assert.equal(hosted.envelope.ok, false);
    const left = stdioEnvelope.error;
    const right = hosted.envelope.error;
    assert.equal(right.code, left.code);
    assert.deepEqual(right.blockers, left.blockers);
    assert.deepEqual(right.fix, left.fix);
  });
});

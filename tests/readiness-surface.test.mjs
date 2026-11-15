// The readiness verdict has three entrances — the kernel query, the adapter
// mapping and the authoring preview — and one durable exit. Each is exercised
// here so a regression in one surface cannot hide behind the other two.
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createSpecService } from "../src/adapters/query-service.js";
import { MountManager, parseProjectsConfig } from "../src/service/mounts.js";
import { executeExtendedQuery } from "../src/kernel/query/extended.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";

const repositoryRoot = process.cwd();
const specsDirName = "." + "specs";
const SPEC = "spec-mcp-access-gate";
const SCHEMA = "spec-kernel@2";

async function graphAt(root) {
  return (await buildKernelGraph(await readRepositorySpecs({ root }))).graph;
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
  for (const [name, content] of [
    ["README.md", "# Stub\n\nStatus: DRAFT\n"],
    ["DESIGN.md", "# Stub\n\nStatus: DRAFT\n"],
    ["FR.md", "# Functional requirements\n\nStatus: DRAFT\n"],
    ["ACCEPTANCE_CRITERIA.md", "# Acceptance criteria\n\nStatus: DRAFT\n"],
    ["TASKS.md", "# Tasks\n\nStatus: DRAFT\n"],
    [`${slug}.feature`, "Feature: Stub\n"],
  ]) {
    await writeFile(path.join(dir, name), content);
  }
}

describe("readiness through the kernel query", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-query-"));
    await cpFixtureCorpus(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("answers a readiness verdict for an assembled specification", async () => {
    const result = executeExtendedQuery(await graphAt(root), "getSpecReadiness", { spec: SPEC });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? {}));
    assert.equal(result.data.kind, "readiness");
    assert.equal(result.data.level, "L2");
    assert.deepEqual(
      result.data.blockers.map((entry) => entry.code),
      [],
      "an assembled specification has no rung left to block",
    );
    assert.equal(result.data.nextLevel, null);
  });

  it("names an invalid slug and an absent specification apart", async () => {
    const graph = await graphAt(root);
    const invalid = executeExtendedQuery(graph, "getSpecReadiness", { spec: "Bad Slug" });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, "INVALID_PARAMETER");
    const absent = executeExtendedQuery(graph, "getSpecReadiness", { spec: "absent-spec" });
    assert.equal(absent.ok, false);
    assert.equal(absent.error.code, "NOT_FOUND");
    assert.equal(absent.error.specSlug, "absent-spec");
  });
});

describe("readiness through spec_inspect", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-inspect-"));
    await cpFixtureCorpus(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("serves check:readiness from the same verdict", async () => {
    const service = createSpecService(root);
    const envelope = await service.runQuery("inspect", { check: "readiness", spec: SPEC }, { schemaVersion: SCHEMA });
    assert.equal(envelope.ok, true, JSON.stringify(envelope.error ?? {}));
    assert.equal(envelope.data.kind, "readiness");
    assert.equal(envelope.data.level, "L2");
    assert.deepEqual(envelope.data.blockers.map((entry) => entry.code), []);
  });

  it("refuses an absent specification instead of inventing a verdict", async () => {
    const service = createSpecService(root);
    const envelope = await service.runQuery("inspect", { check: "readiness", spec: "absent-spec" }, { schemaVersion: SCHEMA });
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "NOT_FOUND");
  });
});

describe("readiness in the spec_patch preview", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-preview-"));
    await cpFixtureCorpus(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("carries the verdict on an assembled corpus", async () => {
    const service = createSpecService(root);
    const envelope = await service.runQuery(
      "specPatch",
      {
        intent: "patch",
        spec: SPEC,
        reason: "preview readiness",
        dryRun: true,
        operations: [{ kind: "insert_at_eof", document: "README.md", text: "\npreview probe\n" }],
        requestId: "readiness-preview-l2",
      },
      { schemaVersion: SCHEMA },
    );
    assert.equal(envelope.ok, true, JSON.stringify(envelope.error ?? {}));
    assert.equal(envelope.data.outcome, "PREVIEW");
    assert.equal(envelope.data.readiness.level, "L2");
    assert.deepEqual(envelope.data.readiness.blockers.map((entry) => entry.code), []);
  });

  it("reports L0 for a scaffold", async () => {
    const stubRoot = await mkdtemp(path.join(tmpdir(), "omp-readiness-preview-stub-"));
    try {
      await writeStubSpec(stubRoot, "stub-spec");
      const service = createSpecService(stubRoot);
      const envelope = await service.runQuery(
        "specPatch",
        {
          intent: "patch",
          spec: "stub-spec",
          reason: "preview readiness",
          dryRun: true,
          operations: [{ kind: "insert_at_eof", document: "README.md", text: "\npreview probe\n" }],
          requestId: "readiness-preview-l0",
        },
        { schemaVersion: SCHEMA },
      );
      assert.equal(envelope.ok, true, JSON.stringify(envelope.error ?? {}));
      assert.equal(envelope.data.readiness.level, "L0");
      assert.deepEqual(envelope.data.readiness.blockers.map((entry) => entry.code), ["NO_REQUIREMENTS"]);
    } finally {
      await rm(stubRoot, { recursive: true, force: true });
    }
  });
});

describe("the durable log through the adapter", () => {
  let root;
  let entries;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-audit-"));
    await writeStubSpec(root, "stub-spec");
    entries = [];
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("forwards an admission refusal to the host log", async () => {
    const service = createSpecService(root, { audit: (entry) => entries.push(entry) });
    const envelope = await service.runQuery(
      "specPatch",
      {
        intent: "confirmTaskCreation",
        spec: "stub-spec",
        reason: "admission",
        dryRun: true,
        entity: "TASK-1",
        subject: "Too early",
        requirements: ["FR-1"],
        requestId: "readiness-adapter-audit",
      },
      { schemaVersion: SCHEMA },
    );
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "SPEC_NOT_READY");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].spec, "stub-spec");
    assert.match(entries[0].result, /^admission-refused:SPEC_NOT_READY:L0:/u);
  });

  it("logs an admission refusal once and leaves a lost race out of the log", async () => {
    const assembled = await mkdtemp(path.join(tmpdir(), "omp-readiness-audit-l2-"));
    try {
      await cpFixtureCorpus(assembled);
      const service = createSpecService(assembled, { audit: (entry) => entries.push(entry) });
      const patch = (text, requestId) =>
        service.runQuery(
          "specPatch",
          {
            intent: "patch",
            spec: SPEC,
            reason: "audit probe",
            dryRun: false,
            operations: [{ kind: "insert_at_eof", document: "README.md", text }],
            requestId,
          },
          { schemaVersion: SCHEMA },
        );
      const first = await patch("\naudit probe one\n", "audit-race");
      assert.equal(first.ok, true, JSON.stringify(first.error ?? {}));
      assert.equal(first.data.outcome, "APPLIED");
      const second = await patch("\naudit probe two\n", "audit-race");
      // A reused request id with a different payload is a lost race, not a
      // rung of the ladder, so it must not be logged as an admission refusal.
      assert.equal(second.data.outcome, "REFUSED");
      assert.equal(second.data.error.code, "CONFLICT");
      assert.equal(entries.length, 0, JSON.stringify(entries));
    } finally {
      await rm(assembled, { recursive: true, force: true });
    }
  });
});

describe("the durable log through the mount manager", () => {
  // The host owns the log, so the wiring under test is the one MountManager
  // installs: `serviceFor` is what every hosted call actually gets, and a
  // refusal that never reaches the store there is invisible in production
  // even though every unit-level audit test above passes.
  const project = "stgmt/alpha";
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "omp-readiness-mounts-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function mountsWith(rows) {
    const store = {
      getBinding: (id) => (id === project ? { project, repoUrl: `file://${path.join(root, "specs.git")}`, branch: "main", status: "active" } : null),
      getCredential: () => null,
      logAccess: (entry) => rows.push(entry),
    };
    const config = parseProjectsConfig({
      projects: [{ id: project }],
      auth: {
        youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
        appBridge: { token: "bridge-token-1234567890" },
        roleGroups: { reader: ["spec-readers"] },
      },
    });
    return new MountManager({ config, cloneDir: path.join(root, "workspace"), store });
  }

  it("writes an admission refusal to the host store through serviceFor", async () => {
    const rows = [];
    const mounts = mountsWith(rows);
    // The materialised root is a directory the read path derives, so the
    // corpus can be placed there without a clone or a remote.
    await writeStubSpec(mounts.cacheRootFor(project, mounts.for(project)), "stub-spec");
    const envelope = await mounts.serviceFor(project).runQuery(
      "specPatch",
      {
        intent: "confirmTaskCreation",
        spec: "stub-spec",
        reason: "admission",
        dryRun: true,
        entity: "TASK-1",
        subject: "Too early",
        requirements: ["FR-1"],
        requestId: "readiness-mounts-audit",
      },
      { schemaVersion: SCHEMA },
    );
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "SPEC_NOT_READY");
    // Exactly one row, and it is selectable by the prefix the host reads.
    assert.equal(rows.length, 1, JSON.stringify(rows));
    assert.equal(rows[0].spec, "stub-spec");
    assert.match(rows[0].result, /^admission-refused:SPEC_NOT_READY:L0:/u);
  });
});

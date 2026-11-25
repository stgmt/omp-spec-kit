import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { removeTempRepo } from "./helpers/kernel-world.mjs";
import { createInterface } from "node:readline";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";

// Spawns the real source entry point (src/mcp/server.js), so no build is
// needed. The working directory is always a throwaway temp project.
const SERVER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "mcp", "server.js");
const REQUEST_TIMEOUT_MS = 15000;
const LATEST = "2025-11-25";

function startServer({ cwd, packageRoot }) {
  const env = { ...process.env };
  delete env.OMP_SPEC_KIT_ROOT;
  delete env.OMP_SPEC_KIT_PACKAGE_ROOT;
  if (packageRoot !== undefined) env.OMP_SPEC_KIT_PACKAGE_ROOT = packageRoot;
  const child = spawn(process.execPath, [SERVER_PATH], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ error }));
  });
  let stderrText = "";
  child.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  const pending = new Map();
  const reader = createInterface({ input: child.stdout });
  reader.on("line", (line) => {
    if (line.trim().length === 0) return;
    const frame = JSON.parse(line);
    const entry = pending.get(frame.id);
    if (entry === undefined) return;
    pending.delete(frame.id);
    clearTimeout(entry.timer);
    entry.resolve(frame);
  });

  let nextId = 0;
  function request(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out; server stderr:\n${stderrText}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      const frame = params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params };
      child.stdin.write(`${JSON.stringify(frame)}\n`);
    });
  }

  async function close() {
    reader.close();
    child.stdin.end();
    const settled = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), 5000))]);
    if (settled === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }

  return { child, request, close, stderr: () => stderrText };
}

const CLIENT_INFO = { name: "mcp-protocol-test", version: "1" };

function initialize(server, protocolVersion) {
  const params = { capabilities: {}, clientInfo: CLIENT_INFO };
  if (protocolVersion !== undefined) params.protocolVersion = protocolVersion;
  return server.request("initialize", params);
}

describe("MCP protocol negotiation", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-protocol-"));
    server = startServer({ cwd: projectDir });
  });

  after(async () => {
    await server.close();
    await removeTempRepo(projectDir);
  });

  test("echoes a supported 2025-11-25 request", async () => {
    const response = await initialize(server, "2025-11-25");
    assert.equal(response.result.protocolVersion, "2025-11-25");
    assert.equal(response.result.serverInfo.name, "omp-spec-kit");
    assert.deepEqual(response.result.capabilities, { tools: {} });
    assert.equal(typeof response.result.instructions, "string");
  });

  test("initialize gives agents the per-spec migration and retry workflow", async () => {
    const response = await initialize(server, LATEST);
    const instructions = response.result.instructions;
    assert.match(instructions, /Legacy documents remain readable/u);
    assert.match(instructions, /Before changing one legacy specification/u);
    assert.match(instructions, /spec_documents includeSnapshot: true/u);
    assert.match(instructions, /spec_patch intent: "migrateSpec"/u);
    assert.match(instructions, /both canonical feature files and source-to-target mapping/u);
    assert.match(instructions, /Preview, apply the same proposal with expectedProposalHash, then retry the requested change/u);
  });

  test("echoes a supported 2025-06-18 request", async () => {
    const response = await initialize(server, "2025-06-18");
    assert.equal(response.result.protocolVersion, "2025-06-18");
  });

  test("echoes a supported 2025-03-26 request", async () => {
    const response = await initialize(server, "2025-03-26");
    assert.equal(response.result.protocolVersion, "2025-03-26");
  });

  test("answers an unsupported 1999-01-01 request with 2025-11-25", async () => {
    const response = await initialize(server, "1999-01-01");
    assert.equal(response.result.protocolVersion, LATEST);
  });

  test("answers a request without protocolVersion with the latest supported 2025-11-25", async () => {
    const response = await initialize(server, undefined);
    assert.equal(response.result.protocolVersion, LATEST);
  });

  test("answers a non-string protocolVersion and absent params with 2025-11-25", async () => {
    const numeric = await server.request("initialize", { protocolVersion: 20251125, capabilities: {}, clientInfo: CLIENT_INFO });
    assert.equal(numeric.result.protocolVersion, LATEST);
    const bare = await server.request("initialize");
    assert.equal(bare.result.protocolVersion, LATEST);
  });

  test("rejects server/discover immediately so clients fall back to initialize", async () => {
    const response = await server.request("server/discover", {});
    assert.equal(response.error.code, -32601);
    assert.equal(response.result, undefined);
  });

  test("tools/list exposes authoring tools without scenario execution results", async () => {
    const response = await server.request("tools/list", {});
    const names = response.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 9);
    assert.equal(new Set(names).size, 9);
    assert.ok(names.includes("spec_catalog"));
    assert.ok(names.includes("spec_patch"));
    assert.equal(names.includes("spec_evidence"), false);
    const removed = await server.request("tools/call", { name: "spec_evidence", arguments: { view: "result", scenarioId: "SCEN-example" } });
    assert.equal(removed.error?.code, -32602);
  });
});

describe("PACKAGE_ROOT_REFUSED keeps the process alive", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-package-root-"));
    // A corpus the server would happily serve if the refusal did not apply.
    await mkdir(path.join(projectDir, ".specs", "decoy"), { recursive: true });
    await writeFile(path.join(projectDir, ".specs", "decoy", "README.md"), "# Decoy\n");
    server = startServer({ cwd: projectDir, packageRoot: projectDir });
  });

  after(async () => {
    await server.close();
    await removeTempRepo(projectDir);
  });

  test("initialize, ping and tools/list still answer", async () => {
    const initialized = await initialize(server, "2025-11-25");
    assert.equal(initialized.result.protocolVersion, "2025-11-25");
    assert.equal(initialized.result.serverInfo.name, "omp-spec-kit");
    const pong = await server.request("ping", {});
    assert.deepEqual(pong.result, {});
    const listed = await server.request("tools/list", {});
    assert.equal(listed.result.tools.length, 9);
  });

  test("tools/call returns a PACKAGE_ROOT_REFUSED error and serves no corpus", async () => {
    const response = await server.request("tools/call", {
      name: "spec_catalog",
      arguments: { view: "overview", specSlugs: ["decoy"] },
    });
    assert.equal(response.result, undefined);
    assert.match(response.error?.message ?? "", /PACKAGE_ROOT_REFUSED/u);
    assert.doesNotMatch(JSON.stringify(response), /decoy/u);
  });

  test("the process has not exited and initialize still answers after the refusal", async () => {
    assert.equal(server.child.exitCode, null, `server exited early; stderr:\n${server.stderr()}`);
    assert.equal(server.child.signalCode, null);
    const response = await initialize(server, "2025-06-18");
    assert.equal(response.result.protocolVersion, "2025-06-18");
  });
});

describe("without OMP_SPEC_KIT_PACKAGE_ROOT the same directory is served", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-served-"));
    await mkdir(path.join(projectDir, ".specs", "decoy"), { recursive: true });
    await writeFile(path.join(projectDir, ".specs", "decoy", "README.md"), "# Decoy\n");
    server = startServer({ cwd: projectDir });
  });

  after(async () => {
    await server.close();
    await removeTempRepo(projectDir);
  });

  test("tools/call returns a tool result, not a refusal", async () => {
    await initialize(server, "2025-11-25");
    const response = await server.request("tools/call", {
      name: "spec_catalog",
      arguments: { view: "overview", specSlugs: ["decoy"] },
    });
    assert.equal(response.error, undefined, JSON.stringify(response));
    assert.equal(typeof response.result?.structuredContent, "object");
    assert.doesNotMatch(JSON.stringify(response), /PACKAGE_ROOT_REFUSED/u);
  });
});

describe("MCP migration contract", () => {
  let projectDir;
  let server;

  before(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-migration-protocol-"));
    const specDir = path.join(projectDir, ".specs", "legacy");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "README.md"), "# Legacy\n\nStatus: DRAFT\n");
    await writeFile(path.join(specDir, "USER_STORIES.md"), "## US-1 — История\r\n\r\nКонтекст\r\n");
    await writeFile(path.join(specDir, "USE_CASES.md"), "## UC-1 — Кейс\n");
    await writeFile(path.join(specDir, "legacy.feature"), "Feature: Legacy\n");
    server = startServer({ cwd: projectDir });
    await initialize(server, LATEST);
  });

  after(async () => {
    await server.close();
    await removeTempRepo(projectDir);
  });

  test("advertises the snapshot and migration fields with conditional apply requirements", async () => {
    const tools = (await server.request("tools/list", {})).result.tools;
    const documents = tools.find((tool) => tool.name === "spec_documents");
    const patch = tools.find((tool) => tool.name === "spec_patch");
    assert.equal(documents.inputSchema.properties.includeSnapshot.type, "boolean");
    assert.equal(documents.inputSchema.properties.byteOffset.type, "integer");
    assert.equal(documents.inputSchema.properties.byteLimit.type, "integer");
    assert.equal(documents.inputSchema.properties.snapshot.type, "string");
    assert.equal(documents.inputSchema.properties.topic.type, "string");
    assert.equal(patch.inputSchema.properties.topic.type, "string");
    const migration = patch.inputSchema.oneOf.find((branch) => branch.title === "intent: migrateSpec");
    assert.ok(migration);
    assert.ok(migration.required.includes("snapshot"));
    assert.ok(migration.required.includes("mapping"));
    assert.equal(migration.properties.operations.minItems, 2);
    assert.deepEqual(migration.properties.operations.items.properties.kind.enum, ["replace_document"]);
    assert.equal(patch.inputSchema.properties.mapping.items.additionalProperties, false);
    assert.equal(patch.inputSchema.properties.decisions.maxItems, 1000);
    assert.deepEqual(patch.inputSchema.properties.decisions.items.required, ["caseId", "storyId", "reason"]);
    assert.equal(patch.inputSchema.properties.repairs.maxItems, 32);
    assert.equal(patch.inputSchema.properties.repairs.items.additionalProperties, false);
    assert.ok(patch.inputSchema.properties.repairs.items.required.includes("beforeSha256"));
    assert.ok(patch.inputSchema.properties.repairs.items.required.includes("afterSha256"));
    assert.equal(patch.inputSchema.properties.fieldDecisions.maxItems, 1000);
    assert.equal(patch.inputSchema.properties.fieldDecisions.items.additionalProperties, false);
    assert.ok(patch.inputSchema.properties.fieldDecisions.items.required.includes("entityId"));
    assert.ok(patch.inputSchema.properties.fieldDecisions.items.required.includes("sourceSha256"));
    assert.ok(migration.allOf[0].then.required.includes("expectedProposalHash"));
  });

  test("advertised intent schemas preserve dispatch and reject missing or foreign fields", async () => {
    const tools = (await server.request("tools/list", {})).result.tools;
    const schema = tools.find((tool) => tool.name === "spec_patch").inputSchema;
    const validate = new AjvJsonSchemaValidator().getValidator(schema);
    const invoke = async (args) => (await server.request("tools/call", { name: "spec_patch", arguments: args })).result.structuredContent;
    const base = { spec: "legacy", requestId: "schema-dispatch", reason: "verify dispatch", dryRun: true };
    const patch = { ...base, intent: "patch", operations: [{ kind: "replace_document", document: "README.md", content: "# Example\n" }] };

    // A valid raw patch still reaches the legacy write gate, rather than being
    // rejected by the advertised schema or mistaken for another intent.
    assert.equal(validate(patch).valid, true);
    assert.equal((await invoke(patch)).error?.causeCode, "LEGACY_SPEC_LAYOUT");

    const missingOperations = { ...patch };
    delete missingOperations.operations;
    assert.equal(validate(missingOperations).valid, false);
    assert.equal((await invoke(missingOperations)).error?.parameter, "operations");

    const noIntent = { ...patch };
    delete noIntent.intent;
    assert.equal(validate(noIntent).valid, false);
    assert.equal((await invoke(noIntent)).error?.parameter, "intent");

    const foreignField = { ...patch, unexpected: true };
    assert.equal(validate(foreignField).valid, false);
    const foreignRefusal = await invoke(foreignField);
    assert.equal(foreignRefusal.error?.code, "UNKNOWN_FIELD");
    assert.equal(foreignRefusal.error?.parameter, "unexpected");

    // A different branch keeps its own required fields while allowing an
    // unrelated zero-argument intent to remain selectable.
    const noDoc = { ...base, intent: "deleteSpecDoc" };
    assert.equal(validate(noDoc).valid, false);
    assert.equal((await invoke(noDoc)).error?.parameter, "doc");
    const scaffold = { ...base, spec: "schema-new", intent: "createSpec" };
    assert.equal(validate(scaffold).valid, true);
    assert.notEqual((await invoke(scaffold)).error?.code, "INVALID_REQUEST");

    // Migration remains stricter than ordinary patch operations.
    const migration = {
      ...base, intent: "migrateSpec", snapshot: "a".repeat(64),
      operations: [
        { kind: "delete_document", document: "USER_STORIES.md" },
        { kind: "replace_document", document: "legacy-use-cases.feature", content: "Feature: Cases\n" },
      ],
      mapping: [{ sourceDocument: "USER_STORIES.md", sourceSha256: "b".repeat(64), sourceStartLine: 1, sourceEndLine: 1, targetDocument: "legacy-user-stories.feature", targetStartLine: 1, targetEndLine: 1 }],
    };
    assert.equal(validate(migration).valid, false);
    assert.equal((await invoke(migration)).error?.parameter, "operations");
  });

  test("reads legacy files through ordinary MCP calls and detects a stale snapshot", async () => {
    const invoke = async (args) => (await server.request("tools/call", { name: "spec_documents", arguments: args })).result.structuredContent;
    const list = await invoke({ action: "list", spec: "legacy", includeSnapshot: true });
    assert.equal(list.ok, true, JSON.stringify(list));
    assert.ok(list.data.docs.includes("USER_STORIES.md"));
    assert.ok(list.data.docs.includes("legacy.feature"));
    assert.match(list.data.snapshot, /^[0-9a-f]{64}$/u);
    const original = await invoke({ action: "read", spec: "legacy", doc: "USER_STORIES.md", snapshot: list.data.snapshot, readForEdit: true });
    assert.equal(original.ok, true, JSON.stringify(original));
    assert.equal(original.data.content, "## US-1 — История\r\n\r\nКонтекст\r\n");
    await writeFile(path.join(projectDir, ".specs", "legacy", "README.md"), "# Changed\n");
    const stale = await invoke({ action: "read", spec: "legacy", doc: "USER_STORIES.md", snapshot: list.data.snapshot });
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "CONFLICT");
    const ordinary = await invoke({ action: "read", spec: "legacy", doc: "USER_STORIES.md", readForEdit: true });
    assert.equal(ordinary.ok, true);
  });

  test("reads a large legacy file through bounded MCP byte pages", async () => {
    const text = "Ж".repeat(1100000) + "\r\nend";
    await writeFile(path.join(projectDir, ".specs", "legacy", "USER_STORIES.md"), text);
    const invoke = async (args) => (await server.request("tools/call", { name: "spec_documents", arguments: args })).result.structuredContent;
    const list = await invoke({ action: "list", spec: "legacy", includeSnapshot: true });
    assert.equal(list.ok, true, JSON.stringify(list));
    let offset = 0, actual = "";
    for (;;) {
      const page = await invoke({ action: "read", spec: "legacy", doc: "USER_STORIES.md", snapshot: list.data.snapshot, byteOffset: offset, byteLimit: 100003 });
      assert.equal(page.ok, true, JSON.stringify(page.error));
      actual += page.data.content;
      offset = page.data.nextByteOffset;
      if (!page.data.truncated) break;
    }
    assert.equal(actual, text);
  });

  test("local stdio refuses topic rather than silently selecting the canonical branch", async () => {
    const list = await server.request("tools/call", {
      name: "spec_documents", arguments: { action: "list", spec: "legacy", topic: "draft" },
    });
    assert.equal(list.result.structuredContent.ok, false);
    assert.equal(list.result.structuredContent.error.code, "TOPIC_CONTEXT_UNSUPPORTED");
    const patch = await server.request("tools/call", {
      name: "spec_patch", arguments: { intent: "patch", spec: "legacy", topic: "draft", requestId: "wrong-scope", reason: "scope test", operations: [{ kind: "replace_document", document: "FR.md", content: "unsafe" }], dryRun: false },
    });
    assert.equal(patch.result.structuredContent.ok, false);
    assert.equal(patch.result.structuredContent.error.code, "TOPIC_CONTEXT_UNSUPPORTED");
  });

  test("rejects malformed mappings and requires the preview hash on apply", async () => {
    const invoke = async (args) => (await server.request("tools/call", { name: "spec_patch", arguments: args })).result.structuredContent;
    const tools = (await server.request("tools/list", {})).result.tools;
    const validator = new AjvJsonSchemaValidator().getValidator(tools.find((tool) => tool.name === "spec_patch").inputSchema);
    const args = {
      intent: "migrateSpec", spec: "legacy", requestId: "migration-contract", reason: "migrate",
      snapshot: "a".repeat(64), dryRun: true,
      operations: [
        { kind: "replace_document", document: "legacy-user-stories.feature", content: "Feature: Stories\n" },
        { kind: "replace_document", document: "legacy-use-cases.feature", content: "Feature: Cases\n" },
      ],
      mapping: [{ sourceDocument: "USER_STORIES.md", sourceSha256: "b".repeat(64), sourceStartLine: 0, sourceEndLine: 1, targetDocument: "legacy-user-stories.feature", targetStartLine: 1, targetEndLine: 1 }],
    };
    const invalidMapping = await invoke(args);
    assert.equal(validator(args).valid, false);
    assert.equal(invalidMapping.ok, false);
    assert.equal(invalidMapping.error.code, "INVALID_REQUEST");
    assert.equal(invalidMapping.error.parameter, "mapping");
    args.mapping[0].sourceStartLine = 1;
    assert.equal(validator(args).valid, true);
    args.dryRun = false;
    assert.equal(validator(args).valid, false);
    const missingHash = await invoke(args);
    assert.equal(missingHash.ok, false);
    assert.equal(missingHash.error.code, "INVALID_REQUEST");
    assert.equal(missingHash.error.parameter, "expectedProposalHash");
    args.expectedProposalHash = "wrong";
    assert.equal(validator(args).valid, false);
    const invalidHash = await invoke(args);
    assert.equal(invalidHash.ok, false);
    assert.equal(invalidHash.error.parameter, "expectedProposalHash");
    args.expectedProposalHash = "c".repeat(64);
    assert.equal(validator(args).valid, true);
    args.mapping[0].unexpected = "ignored?";
    assert.equal(validator(args).valid, false);
    const extraField = await invoke(args);
    assert.equal(extraField.error.parameter, "mapping");
    delete args.mapping[0].unexpected;
    args.decisions = [{ caseId: "UC-1", storyId: "US-1", reason: "   " }];
    assert.equal(validator(args).valid, false);
    assert.equal((await invoke(args)).error.parameter, "decisions");
    args.decisions[0].reason = "Согласовано владельцем";
    assert.equal(validator(args).valid, true);
    args.decisions.push({ caseId: "UC-1", storyId: "US-2", reason: "дубль" });
    assert.equal((await invoke(args)).error.parameter, "decisions");
    args.decisions.pop();
    args.decisions[0].reason = "ы".repeat(257);
    assert.equal((await invoke(args)).error.parameter, "decisions");
    args.decisions = [];
    args.repairs = [{ sourceDocument: "legacy.feature", sourceSha256: "a".repeat(64), scenarioId: "SCEN-preview",
      sourceStartLine: 2, sourceEndLine: 2, beforeSha256: "b".repeat(64), afterSha256: "c".repeat(64),
      replacement: "Then the outcome appears\n", reason: "Owner confirmed the outcome" }];
    assert.equal(validator(args).valid, true);
    args.repairs[0].beforeSha256 = "bad";
    assert.equal(validator(args).valid, false);
    assert.equal((await invoke(args)).error.parameter, "repairs");
    delete args.repairs;
    args.fieldDecisions = [{ entityId: "US-1", field: "Goal", value: "Inspect", reason: "Test owner confirmed",
      sourceDocument: "legacy.feature", sourceSha256: "a".repeat(64), sourceStartLine: 1, sourceEndLine: 1 }];
    assert.equal(validator(args).valid, true);
    args.fieldDecisions[0].field = "MadeUpField";
    assert.equal(validator(args).valid, false);
    assert.equal((await invoke(args)).error.parameter, "fieldDecisions");
  });
});

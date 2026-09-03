import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Given, When, Then, After } from "@cucumber/cucumber";
import { classifyToolCall } from "../../src/enforcement/classifier.js";
import { commitDocuments, withWriteLock } from "../../src/authoring/transactions.js";
import { createTempRepo, loadAuthoringRealCorpus, plantDirectoryJunction, removeTempRepo, sha256Hex, writeCorpus } from "../helpers/kernel-world.mjs";
import { runExtensionProbe, spawnMcpServer } from "../helpers/mcp-world.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER_PATH = path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");
const SCHEMA_VERSION = "spec-kernel@1";
const PACKAGE_VERSION = JSON.parse(await readFile(path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "package.json"), "utf8")).version;

async function call(world, name, arguments_ = {}) {
  const response = await world.server.request("tools/call", {
    name,
    arguments: { schemaVersion: SCHEMA_VERSION, requestId: `safe-${name}-${Date.now()}`, ...arguments_ },
  });
  return response.result.structuredContent;
}

async function overview(world) {
  return call(world, "spec_overview", { specSlugs: [] });
}

function proposalArgs(world, fingerprint, requestId, text = "safe authoring marker") {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId,
    repositoryRootFingerprint: fingerprint,
    spec: "plugin-distribution",
    reason: "safe authoring scenario",
    operations: [{ kind: "insert_at_eof", document: "README.md", text }],
  };
}

function expectedDocuments(proposal) {
  return proposal.data.operations.map((operation) => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
}

async function runCandidateManagerE2E() {
  const probeRoot = await mkdtemp(path.join(tmpdir(), "omp-safe-manager-project-"));
  const probeHome = await mkdtemp(path.join(tmpdir(), "omp-safe-manager-home-"));
  try {
    await cp(path.join(REPOSITORY_ROOT, "tests", "fixtures", "kernel", "authoring-real-corpus", ".specs"), path.join(probeRoot, ".specs"), { recursive: true });
    const digest = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
    const env = { ...process.env, HOME: probeHome, USERPROFILE: probeHome, PI_CODING_AGENT_DIR: path.join(probeHome, "agent"), OMP_PROFILE: "safe-authoring-e2e" };
    delete env.OMP_SPEC_KIT_STAGE;
    const result = spawnSync("bun", [
      path.join(REPOSITORY_ROOT, "scripts", "probe-omp-discovery-v18.0.11.mjs"),
      "--runtime-root", path.join(REPOSITORY_ROOT, "tests", "fixtures", "omp-discovery-runtime", "node_modules", "@oh-my-pi", "pi-coding-agent"),
      "--cwd", probeRoot,
      "--package-root", path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit"),
      "--phase-mode", "bounded",
      "--phase-timeout-ms", "30000",
      "--expected-dist-manifest-sha256", await digest(path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "dist", "manifest.json")),
      "--expected-launcher-sha256", await digest(path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit", "bin", "omp-spec-kit-mcp")),
    ], { cwd: probeRoot, env, encoding: "utf8", windowsHide: true, timeout: 120000 });
    if (result.status !== 0) {
      let detail = String(result.stderr);
      try {
        const receipt = JSON.parse(result.stdout);
        const phase = receipt.phaseMode?.terminalPhase;
        detail = receipt.phaseMode?.checkpoints?.[phase]?.error?.message ?? detail;
      } catch {}
      assert.equal(result.status, 0, detail);
    }
    return JSON.parse(result.stdout);
  } finally {
    await rm(probeRoot, { recursive: true, force: true });
    await rm(probeHome, { recursive: true, force: true });
  }
}
Given("a disposable real authoring corpus and live v0.4.1 MCP server", async function () {
  this.root = await createTempRepo();
  this.corpus = await loadAuthoringRealCorpus(REPOSITORY_ROOT);
  await writeCorpus(this.root, this.corpus.files);
  this.server = spawnMcpServer({
    serverPath: SERVER_PATH,
    root: this.root,
    cwd: this.root,
    env: { OMP_SPEC_KIT_STAGE: "v0.4.1" },
  });
});

When("the v0.4.1 scenario {string} runs", async function (scenario) {
  if (scenario === "inventory") {
    const listed = await this.server.request("tools/list");
    const names = listed.result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["apply_proposed_patch", "propose_patch", "spec_diagnostics", "spec_find_nodes", "spec_get_edges", "spec_get_node", "spec_inventory", "spec_markdown_inventory", "spec_overview", "spec_trace"]);
    this.result = true;
    return;
  }
  if (scenario === "proposal") {
    const before = await readFile(path.join(this.root, ".specs/plugin-distribution/README.md"));
    const graph = await overview(this);
    const first = await this.server.request("tools/call", { name: "propose_patch", arguments: proposalArgs(this, graph.graph.fingerprint, "safe-proposal-a") });
    const second = await this.server.request("tools/call", { name: "propose_patch", arguments: proposalArgs(this, graph.graph.fingerprint, "safe-proposal-b") });
    assert.equal(first.result.structuredContent.ok, true, JSON.stringify(first));
    assert.equal(second.result.structuredContent.ok, true, JSON.stringify(second));
    assert.deepEqual(first.result.structuredContent.data.operations, second.result.structuredContent.data.operations);
    assert.equal(sha256Hex(before), sha256Hex(await readFile(path.join(this.root, ".specs/plugin-distribution/README.md"))));
    this.result = true;
    return;
  }
  if (scenario === "invalid-preview") {
    const graph = await overview(this);
    const args = proposalArgs(this, graph.graph.fingerprint, "safe-invalid", "invalid");
    args.operations = [{ kind: "insert_at_eof", document: "README.md", text: "a" }, { kind: "insert_at_eof", document: "README.md", text: "b" }];
    const invalid = await this.server.request("tools/call", { name: "propose_patch", arguments: args });
    assert.equal(invalid.result.structuredContent.ok, false, JSON.stringify(invalid));
    assert.equal(["INVALID_REQUEST", "VALIDATION_FAILED"].includes(invalid.result.structuredContent.error.code), true);
    this.result = true;
    return;
  }
  if (scenario === "access-gate") {
    const blocked = classifyToolCall({ toolName: "read", cwd: this.root, input: { path: ".specs/plugin-distribution/README.md" } }, { root: this.root });
    const direct = classifyToolCall({ toolName: "write", cwd: this.root, input: { path: ".specs/plugin-distribution/README.md" } }, { root: this.root });
    const allowed = classifyToolCall({ toolName: "mcp__omp_spec_kit_propose_patch", input: {} }, { root: this.root });
    const rawDirect = classifyToolCall({ toolName: "propose_patch", input: {} }, { root: this.root });
    assert.equal(blocked.code, "RAW_SPEC_WRITE");
    assert.equal(direct.code, "RAW_SPEC_WRITE");
    assert.equal(allowed.code, "AUTHORING_TOOL_ALLOWED");
    assert.equal(rawDirect.code, "UNREGISTERED_AUTHORING_CALL");
    assert.ok(Buffer.byteLength(blocked.reason, "utf8") <= 512);
    this.result = true;
    return;
  }
  if (scenario === "apply-cas") {
    const graph = await overview(this);
    const proposal = (await this.server.request("tools/call", { name: "propose_patch", arguments: proposalArgs(this, graph.graph.fingerprint, "safe-apply-proposal") })).result.structuredContent;
    const applyArgs = { requestId: "safe-apply", proposalId: proposal.data.proposalId, proposalSha256: proposal.data.proposalHash, expectedDocuments: expectedDocuments(proposal), reason: "approve exact proposal", approval: "approve" };
    const applied = await this.server.request("tools/call", { name: "apply_proposed_patch", arguments: applyArgs });
    const replay = await this.server.request("tools/call", { name: "apply_proposed_patch", arguments: applyArgs });
    assert.equal(applied.result.structuredContent.data.outcome, "APPLIED", JSON.stringify(applied));
    assert.equal(replay.result.structuredContent.data.outcome, "APPLIED", JSON.stringify(replay));
    assert.ok((await readFile(path.join(this.root, ".specs/plugin-distribution/README.md"), "utf8")).includes("safe authoring marker"));
    this.result = true;
    return;
  }
  if (scenario === "concurrent-conflict") {
    const graph = await overview(this);
    const a = (await this.server.request("tools/call", { name: "propose_patch", arguments: proposalArgs(this, graph.graph.fingerprint, "safe-race-a", "race-a") })).result.structuredContent;
    const b = (await this.server.request("tools/call", { name: "propose_patch", arguments: proposalArgs(this, graph.graph.fingerprint, "safe-race-b", "race-b") })).result.structuredContent;
    const apply = (proposal, requestId) => this.server.request("tools/call", { name: "apply_proposed_patch", arguments: { requestId, proposalId: proposal.data.proposalId, proposalSha256: proposal.data.proposalHash, expectedDocuments: expectedDocuments(proposal), reason: "race", approval: "approve" } });
    const [first, second] = await Promise.all([apply(a, "safe-race-apply-a"), apply(b, "safe-race-apply-b")]);
    const outcomes = [first.result.structuredContent.data.outcome, second.result.structuredContent.data.outcome].sort();
    assert.deepEqual(outcomes, ["APPLIED", "REFUSED"], JSON.stringify([first, second]));
    const conflict = [first, second].find((response) => response.result.structuredContent.data.error?.code === "CONFLICT");
    assert.ok(conflict, JSON.stringify([first, second]));
    const finalText = await readFile(path.join(this.root, ".specs/plugin-distribution/README.md"), "utf8");
    assert.equal(finalText.includes("race-a") || finalText.includes("race-b"), true);
    assert.equal(finalText.includes("race-a") && finalText.includes("race-b"), false);
    this.result = true;
    return;
  }
  if (scenario === "fault-rollback") {
    const target = path.join(this.root, ".specs/plugin-distribution/TASKS.md");
    const before = await readFile(target);
    for (const faultAt of ["after-staging", "during-swap", "during-cleanup"]) {
      await assert.rejects(withWriteLock(this.root, `safe-fault-${faultAt}`, () => commitDocuments(this.root, `safe-fault-${faultAt}`, [{ spec: "plugin-distribution", document: "TASKS.md", afterBytes: Buffer.from(`${before}\nFAULT`), deleteAfter: false }], { faultAt })), /deterministic transaction fault/);
      assert.equal(sha256Hex(before), sha256Hex(await readFile(target)));
    }
    try { await access(path.join(this.root, ".specs", ".omp-spec-kit-staging")); assert.fail("staging residue"); } catch (error) { assert.equal(error.code, "ENOENT"); }
    this.result = true;
    return;
  }
  if (scenario === "redaction") {
    const graph = await overview(this);
    const redactionArgs = proposalArgs(this, graph.graph.fingerprint, "safe-redaction", "redacted marker");
    redactionArgs.reason = "SECRET / absolute C:\\private\\secret";
    const proposal = await this.server.request("tools/call", { name: "propose_patch", arguments: redactionArgs });
    const serialized = JSON.stringify(proposal.result.structuredContent);
    assert.equal(serialized.includes("SECRET"), false);
    assert.equal(serialized.includes("C:\\\\private"), false);
    assert.equal(serialized.includes("proposalSha256"), false);
    this.result = true;
    return;
  }
  if (scenario === "provenance") {
    assert.equal(this.corpus.manifest.schema, "omp-spec-kit-authoring-real-corpus@1");
    assert.equal(this.corpus.manifest.documentCount, 45);
    assert.equal(this.corpus.files.length, 45);
    assert.equal(this.corpus.graph.valid, true);
    this.result = true;
    return;
  }
  if (scenario === "installed-factory") {
    const receipt = await runExtensionProbe({ extensionPath: path.join(REPOSITORY_ROOT, "plugins/omp-spec-kit/dist/extension.js"), cwd: this.root, env: { OMP_SPEC_KIT_STAGE: "v0.4.1" } });
    const names = receipt.tools.map((tool) => tool.name).sort();
    assert.equal(receipt.exports.pluginVersion, PACKAGE_VERSION);
    assert.equal(names.length, 0, "installed extension must register 0 direct tools in MCP-only architecture");
    assert.ok(receipt.registeredEvents?.includes("tool_call"), "extension must register tool_call hook");
    assert.equal(receipt.labels[0], "OMP Spec Kit");
    this.result = true;
    return;
  }
  if (scenario === "future-hidden") {
    await this.server.close();
    this.server = spawnMcpServer({ serverPath: SERVER_PATH, root: this.root, cwd: this.root, env: { OMP_SPEC_KIT_STAGE: "v0.3.2" } });
    const listed = await this.server.request("tools/list");
    assert.equal(listed.result.tools.some((tool) => tool.name === "propose_patch"), false);
    assert.equal(listed.result.tools.some((tool) => tool.name === "apply_proposed_patch"), false);
    this.result = true;
    return;
  }
  if (scenario === "multi-document") {
    const graph = await overview(this);
    const documents = ["README.md", "REQUIREMENTS.md", "TASKS.md"];
    const before = new Map(await Promise.all(documents.map(async (document) => [document, sha256Hex(await readFile(path.join(this.root, ".specs/plugin-distribution", document)))])));
    const proposal = (await this.server.request("tools/call", { name: "propose_patch", arguments: { ...proposalArgs(this, graph.graph.fingerprint, "safe-multi-proposal"), operations: documents.map((document) => ({ kind: "insert_at_eof", document, text: "multi-document-" + document })) } })).result.structuredContent;
    assert.equal(proposal.ok, true, JSON.stringify(proposal));
    assert.equal(proposal.data.operations.length, 3);
    assert.deepEqual(proposal.data.operations.map((operation) => operation.path), documents.map((document) => ".specs/plugin-distribution/" + document));
    const applied = (await this.server.request("tools/call", { name: "apply_proposed_patch", arguments: { requestId: "safe-multi-apply", proposalId: proposal.data.proposalId, proposalSha256: proposal.data.proposalHash, expectedDocuments: expectedDocuments(proposal), reason: "apply same-spec multi-document proposal", approval: "approve" } })).result.structuredContent;
    assert.equal(applied.data.outcome, "APPLIED", JSON.stringify(applied));
    for (const document of documents) assert.equal((await readFile(path.join(this.root, ".specs/plugin-distribution", document), "utf8")).includes("multi-document-" + document), true);
    for (const [document, digest] of before) assert.notEqual(sha256Hex(await readFile(path.join(this.root, ".specs/plugin-distribution", document))), digest);
    assert.equal((await overview(this)).graph.valid, true);
    this.result = true;
    return;
  }
  if (scenario === "mutation-edges") {
    const graph = await overview(this);
    const target = path.join(this.root, ".specs/plugin-distribution/README.md");
    const before = sha256Hex(await readFile(target));
    const cases = [
      ["empty operations", "INVALID_REQUEST", { operations: [] }],
      ["empty reason", "INVALID_REQUEST", { reason: "" }],
      ["bad fingerprint", "CONFLICT", { repositoryRootFingerprint: "bad-fingerprint" }],
      ["unknown document", "PATH_FORBIDDEN", { operations: [{ kind: "insert_at_eof", document: "MISSING.md", text: "x" }] }],
      ["unsupported operation", "VALIDATION_FAILED", { operations: [{ kind: "bogus_edit", document: "README.md" }] }],
      ["duplicate target", "INVALID_REQUEST", { operations: [{ kind: "insert_at_eof", document: "README.md", text: "a" }, { kind: "insert_at_eof", document: "README.md", text: "b" }] }],
      ["cross-spec path", "PATH_FORBIDDEN", { operations: [{ kind: "insert_at_eof", document: "../spec-mcp-access-gate/README.md", text: "x" }] }],
    ];
    for (const [label, expectedCode, overrides] of cases) {
      const args = { ...proposalArgs(this, graph.graph.fingerprint, "safe-edge-" + label.replaceAll(" ", "-")), ...overrides };
      const response = (await this.server.request("tools/call", { name: "propose_patch", arguments: args })).result.structuredContent;
      assert.equal(response.ok, false, label + ": " + JSON.stringify(response));
      assert.equal(response.error.code, expectedCode, label + ": " + JSON.stringify(response));
      assert.equal(sha256Hex(await readFile(target)), before, label + " changed bytes");
    }
    try { await access(path.join(this.root, ".specs", ".omp-spec-kit-staging")); assert.fail("staging residue"); } catch (error) { assert.equal(error.code, "ENOENT"); }
    this.result = true;
    return;
  }
  if (scenario === "access-edges") {
    const specPath = ".specs/plugin-distribution/README.md";
    const absoluteSpecPath = path.join(this.root, specPath);
    const blocked = [
      { toolName: "read", input: { path: specPath }, code: "RAW_SPEC_WRITE" },
      { toolName: "write", input: { path: absoluteSpecPath }, code: "RAW_SPEC_WRITE" },
      { toolName: "edit", input: { path: "" }, code: "TARGET_INDETERMINATE" },
      { toolName: "shell", input: { path: String.fromCharCode(0) }, code: "TARGET_INDETERMINATE" },
    ];
    for (const testCase of blocked) {
      const result = classifyToolCall(testCase, { root: this.root });
      assert.equal(result.code, testCase.code, JSON.stringify(result));
      assert.ok(Buffer.byteLength(result.reason, "utf8") <= 512);
    }
    const linkPath = path.join(this.root, "spec-link");
    await plantDirectoryJunction(linkPath, path.join(this.root, ".specs"));
    const linked = classifyToolCall({ toolName: "write", cwd: this.root, input: { path: path.join(linkPath, "plugin-distribution", "README.md") } }, { root: this.root });
    assert.equal(linked.code, "RAW_SPEC_WRITE", JSON.stringify(linked));
    const unregistered = classifyToolCall({ toolName: "propose_patch", cwd: this.root, input: {} }, { root: this.root });
    assert.equal(unregistered.code, "UNREGISTERED_AUTHORING_CALL", JSON.stringify(unregistered));
    this.result = true;
    return;
  }
  if (scenario === "read-selectors") {
    const outsidePath = path.join(this.root, "outside-readable.txt");
    await writeFile(outsidePath, "safe file\n", "utf8");
    const externalPath = path.join(REPOSITORY_ROOT, "src", "enforcement", "classifier.js");
    const specPath = path.join(this.root, ".specs", "plugin-distribution", "README.md");
    const selectors = [":1", ":5", ":1-2", ":10-10", ":1+2", ":1-", ":1..2", ":L1", ":L1-L5", ":1-2,5", ":raw", ":conflicts", ":raw:1-2", ":1-2:raw", ":raw:L1-2", ":L1-2:raw"];
    for (const basePath of [outsidePath, externalPath]) {
      for (const suffix of selectors) {
        const safe = classifyToolCall({ toolName: "read", cwd: this.root, input: { path: basePath + suffix } }, { root: this.root });
        assert.equal(safe.action, "continue", basePath + suffix + ": " + JSON.stringify(safe));
        assert.equal(safe.touchesSpecs, false, basePath + suffix + ": " + JSON.stringify(safe));
      }
    }
    for (const suffix of selectors) {
      const spec = classifyToolCall({ toolName: "read", cwd: this.root, input: { path: specPath + suffix } }, { root: this.root });
      assert.equal(spec.code, "RAW_SPEC_WRITE", suffix + ": " + JSON.stringify(spec));
      assert.equal(spec.action, "block", suffix + ": " + JSON.stringify(spec));
    }
    const directWrite = classifyToolCall({ toolName: "write", cwd: this.root, input: { path: outsidePath + ":1-2" } }, { root: this.root });
    if (process.platform === "win32") {
      assert.equal(directWrite.code, "TARGET_INDETERMINATE", JSON.stringify(directWrite));
      const alternateDataStream = classifyToolCall({ toolName: "read", cwd: this.root, input: { path: outsidePath + ":secret" } }, { root: this.root });
      assert.equal(alternateDataStream.code, "TARGET_INDETERMINATE", JSON.stringify(alternateDataStream));
      const invalidSelector = classifyToolCall({ toolName: "read", cwd: this.root, input: { path: outsidePath + ":0" } }, { root: this.root });
      assert.equal(invalidSelector.code, "TARGET_INDETERMINATE", JSON.stringify(invalidSelector));
    }
    this.result = true;
    return;
  }
  if (scenario === "execution-edges") {
    const specPath = path.join(this.root, ".specs", "plugin-distribution", "README.md");
    const blocked = [
      { toolName: "eval", input: { code: `readFile(${JSON.stringify(specPath)})` } },
      { toolName: "mcp__context_mode_ctx_execute", input: { code: `open(${JSON.stringify(specPath)})` } },
      { toolName: "bash", input: { command: `type "${specPath}"` } },
      { toolName: "bash", input: { command: "root=.specs && type \"$root/plugin-distribution/README.md\"" } },
      { toolName: "eval", input: { args: { code: "open " + specPath } } },
    ];
    for (const event of blocked) {
      const result = classifyToolCall(event, { root: this.root });
      assert.equal(result.action, "block", JSON.stringify(result));
      assert.equal(result.code, "RAW_SPEC_WRITE", JSON.stringify(result));
      assert.equal(result.touchesSpecs, true, JSON.stringify(result));
    }
    const allowed = [
      { toolName: "eval", input: { code: "return 1" } },
      { toolName: "mcp__context_mode_ctx_execute", input: { code: "console.log(1)" } },
      { toolName: "bash", input: { command: "node --version" } },
    ];
    for (const event of allowed) {
      const result = classifyToolCall(event, { root: this.root });
      assert.equal(result.action, "continue", JSON.stringify(result));
      assert.equal(result.touchesSpecs, false, JSON.stringify(result));
    }
    this.result = true;
    return;
  }
  if (scenario === "omp-manager-authoring") {
    const receipt = await runCandidateManagerE2E();
    if (receipt.result !== "completed") {
      const phase = receipt.phaseMode?.terminalPhase;
      const detail = receipt.phaseMode?.checkpoints?.[phase]?.error?.message ?? "unknown manager failure";
      assert.equal(receipt.result, "completed", detail);
    }
    assert.equal(receipt.provenance.runtime.version, "18.0.11");
    assert.deepEqual(receipt.manager.connectionResult.connectedServers, ["omp-spec-kit:omp-spec-kit"]);
    assert.equal(receipt.manager.connectionResult.toolCount, 49);
    assert.deepEqual(receipt.manager.connectionResult.managedAuthoring.toolNames, ["spec_overview", "propose_patch", "apply_proposed_patch"]);
    assert.equal(receipt.manager.connectionResult.managedAuthoring.applyOutcome, "APPLIED");
    assert.equal(receipt.manager.connectionResult.managedAuthoring.finalDocumentContainsMarker, true);
    assert.equal(receipt.manager.connectionResult.managedAuthoring.finalGraphValid, true);
    this.result = true;
    return;
  }
  throw new Error("unknown safe-authoring scenario: " + scenario);
});

Then("the v0.4.1 scenario passes", function () {
  assert.equal(this.result, true);
});

After({ tags: "@safe-authoring" }, async function () {
  if (this.server) await this.server.close();
  await removeTempRepo(this.root ?? null);
});

import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createTempRepo, removeTempRepo } from "./helpers/kernel-world.mjs";
import { spawnMcpServer } from "./helpers/mcp-world.mjs";
import { spec, storyDoc, caseDoc, oldStory, oldCase, oldFeature, story, useCase, migrationInput } from "./helpers/migration-fixture.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distServer = path.join(repo, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");

test("packaged MCP pages a large legacy document without splitting UTF-8 characters", async (t) => {
  const root = await createTempRepo();
  const server = spawnMcpServer({ serverPath: distServer, root, cwd: root });
  t.after(async () => { await server.close(); await removeTempRepo(root); });
  const dir = path.join(root, ".specs", spec);
  await mkdir(dir, { recursive: true });
  const text = "Я".repeat(1100000) + "\r\nend";
  await writeFile(path.join(dir, "USER_STORIES.md"), text);
  await server.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "large-read-test", version: "1" } });
  server.notify("notifications/initialized", {});
  const call = async (args) => (await server.request("tools/call", { name: "spec_documents", arguments: args })).result.structuredContent;
  const list = await call({ action: "list", spec, includeSnapshot: true });
  assert.equal(list.ok, true, JSON.stringify(list));
  let offset = 0, actual = "";
  for (;;) {
    const page = await call({ action: "read", spec, doc: "USER_STORIES.md", snapshot: list.data.snapshot, byteOffset: offset, byteLimit: 100003 });
    assert.equal(page.ok, true, JSON.stringify(page.error));
    actual += page.data.content;
    offset = page.data.nextByteOffset;
    if (!page.data.truncated) break;
  }
  assert.equal(actual, text);
});

test("packaged stdio MCP reads and migrates one legacy specification without executing scenarios", async (t) => {
  const root = await createTempRepo();
  let server;
  t.after(async () => {
    if (server) await server.close();
    await removeTempRepo(root);
  });
  const dir = path.join(root, ".specs", spec);
  const neighborDir = path.join(root, ".specs", "neighbor");
  await mkdir(dir, { recursive: true });
  await mkdir(neighborDir, { recursive: true });
  const hugeContext = "APIKey-Case-Sensitive ".repeat(330000);
  const sentinel = path.join(root, "scenario-executed");
  const probe = `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed");\n`;
  const originals = {
    "README.md": "# Migration test\n\nStatus: DRAFT\n",
    // More than the previous graph cap; this has to pass through the full MCP
    // snapshot -> preview -> apply path before the old source is removed.
    "USER_STORIES.md": `${oldStory}Context: ${hugeContext}\n`,
    "USE_CASES.md": oldCase,
    [`${spec}.feature`]: oldFeature,
    "FR.md": "# Requirements\n",
    "execution-probe.mjs": probe,
  };
  const neighbor = {
    "README.md": "# Neighbor\n\nStatus: DRAFT\n",
    "USER_STORIES.md": "# Stories\n",
    "USE_CASES.md": "# Cases\n",
    "neighbor.feature": "Feature: Neighbor\n",
  };
  for (const [name, text] of Object.entries(originals)) await writeFile(path.join(dir, name), text);
  for (const [name, text] of Object.entries(neighbor)) await writeFile(path.join(neighborDir, name), text);
  // If a Cucumber runner were started for this project, importing its step
  // support would write the sentinel. MCP authoring must only parse the text.
  await writeFile(path.join(root, "cucumber.mjs"), `export default { default: { paths: [${JSON.stringify(`.specs/${spec}/${spec}.feature`)}], import: [${JSON.stringify(`.specs/${spec}/execution-probe.mjs`)}] } };\n`);

  server = spawnMcpServer({ serverPath: distServer, root, cwd: root });
  const initialized = await server.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "dist-migration-test", version: "1" } });
  assert.equal(initialized.result?.protocolVersion, "2025-11-25", JSON.stringify(initialized));
  server.notify("notifications/initialized", {});
  const call = async (name, args) => {
    const result = await server.request("tools/call", { name, arguments: args });
    assert.ok(result.result?.structuredContent, JSON.stringify(result));
    return result.result.structuredContent;
  };

  const ordinaryList = await call("spec_documents", { action: "list", spec });
  assert.equal(ordinaryList.ok, true, JSON.stringify(ordinaryList));
  assert.ok(ordinaryList.data.docs.includes("USER_STORIES.md"));
  const list = await call("spec_documents", { action: "list", spec, includeSnapshot: true });
  assert.equal(list.ok, true, JSON.stringify(list));
  for (const name of ["USER_STORIES.md", "USE_CASES.md", `${spec}.feature`]) assert.ok(list.data.docs.includes(name));
  assert.match(list.data.snapshot, /^[0-9a-f]{64}$/u);
  assert.ok(Buffer.byteLength(originals["USER_STORIES.md"]) > 2 * 1024 * 1024);
  assert.ok(Buffer.byteLength(originals["USER_STORIES.md"]) < 8 * 1024 * 1024);
  let sourceOffset = 0;
  let sourceContent = "";
  for (;;) {
    const page = await call("spec_documents", {
      action: "read", spec, doc: "USER_STORIES.md", snapshot: list.data.snapshot,
      byteOffset: sourceOffset, byteLimit: 1_500_000,
    });
    assert.equal(page.ok, true, JSON.stringify(page.error));
    sourceContent += page.data.content;
    sourceOffset = page.data.nextByteOffset;
    if (!page.data.truncated) break;
  }
  assert.equal(sourceContent, originals["USER_STORIES.md"], "large legacy source is readable exactly through MCP byte pages");
  for (const [name, expected] of [["USE_CASES.md", oldCase], [`${spec}.feature`, oldFeature]]) {
    const read = await call("spec_documents", { action: "read", spec, doc: name, snapshot: list.data.snapshot, readForEdit: true });
    assert.equal(read.ok, true, JSON.stringify(read));
    assert.equal(read.data.content, expected);
  }
  const ordinary = { intent: "patch", spec, requestId: "dist-ordinary-write", reason: "Update requirements", dryRun: false,
    operations: [{ kind: "replace_document", document: "FR.md", content: "# Updated requirements\n" }] };
  const blocked = await call("spec_patch", ordinary);
  assert.equal(blocked.ok, false, JSON.stringify(blocked));
  assert.equal(blocked.error?.causeCode, "LEGACY_SPEC_LAYOUT", JSON.stringify(blocked));
  assert.equal(await readFile(path.join(dir, "FR.md"), "utf8"), originals["FR.md"]);

  const context = `Context: ${hugeContext}`;
  const largeStory = story.replace("    Benefit: Safety\n", `    Benefit: Safety\n    ${context}\n`);
  const input = migrationInput({ snapshot: list.data.snapshot, files: list.data.files });
  const storySourceHash = input.mapping.find((item) => item.sourceDocument === "USER_STORIES.md").sourceSha256;
  input.mapping.push({
    sourceDocument: "USER_STORIES.md", sourceSha256: storySourceHash,
    sourceStartLine: 6, sourceEndLine: 6, targetDocument: storyDoc, targetStartLine: 8, targetEndLine: 8,
  });
  input.mapping = input.mapping.map((item) => item.sourceDocument === `${spec}.feature` && item.sourceStartLine === 2
    ? { ...item, targetStartLine: item.targetStartLine + 1, targetEndLine: item.targetEndLine + 1 }
    : item);
  input.operations[0].content = largeStory;
  const preview = await call("spec_patch", { ...input, dryRun: true });
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.data?.outcome, "PREVIEW", JSON.stringify(preview));
  assert.match(preview.data.proposalHash, /^[0-9a-f]{64}$/u);
  assert.equal(preview.data.operations.filter((entry) => entry.afterSha256 === null).length, 3);
  for (const [name, expected] of Object.entries(originals)) assert.equal(await readFile(path.join(dir, name), "utf8"), expected);
  await assert.rejects(access(sentinel), { code: "ENOENT" });

  const applied = await call("spec_patch", { ...input, expectedProposalHash: preview.data.proposalHash, dryRun: false });
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.equal(applied.data?.outcome, "APPLIED", JSON.stringify(applied));
  assert.equal(await readFile(path.join(dir, storyDoc), "utf8"), largeStory);
  assert.equal(await readFile(path.join(dir, caseDoc), "utf8"), useCase);
  for (const name of ["USER_STORIES.md", "USE_CASES.md", `${spec}.feature`]) await assert.rejects(access(path.join(dir, name)), { code: "ENOENT" });
  assert.equal(await readFile(path.join(dir, "execution-probe.mjs"), "utf8"), probe);
  for (const [name, expected] of Object.entries(neighbor)) assert.equal(await readFile(path.join(neighborDir, name), "utf8"), expected);

  const retried = await call("spec_patch", ordinary);
  assert.equal(retried.ok, true, JSON.stringify(retried));
  assert.equal(retried.data?.outcome, "APPLIED", JSON.stringify(retried));
  assert.equal(await readFile(path.join(dir, "FR.md"), "utf8"), "# Updated requirements\n");
  const migratedList = await call("spec_documents", { action: "list", spec, includeSnapshot: true });
  assert.equal(migratedList.ok, true, JSON.stringify(migratedList.error));
  let migratedOffset = 0;
  let migratedContent = "";
  for (;;) {
    const page = await call("spec_documents", {
      action: "read", spec, doc: storyDoc, snapshot: migratedList.data.snapshot,
      byteOffset: migratedOffset, byteLimit: 1_500_000,
    });
    assert.equal(page.ok, true, JSON.stringify(page.error));
    migratedContent += page.data.content;
    migratedOffset = page.data.nextByteOffset;
    if (!page.data.truncated) break;
  }
  assert.equal(migratedContent, largeStory);
  const indexedStory = await call("spec_entities", { mode: "get", canonicalId: `${spec}:US-1` });
  assert.equal(indexedStory.ok, true, JSON.stringify(indexedStory.error));
  assert.equal(indexedStory.data.node.canonicalId, `${spec}:US-1`);
  for (const [name, expected] of Object.entries(neighbor)) assert.equal(await readFile(path.join(neighborDir, name), "utf8"), expected);
  await assert.rejects(access(sentinel), { code: "ENOENT" }, "the specification scenario and its support module must not be executed");
  assert.deepEqual(server.nonProtocolLines, []);
});

test("packaged MCP traces stories to tasks and cases in both directions through requirements", async (t) => {
  const root = await createTempRepo();
  const server = spawnMcpServer({ serverPath: distServer, root, cwd: root });
  t.after(async () => { await server.close(); await removeTempRepo(root); });
  const slug = "traceability-test";
  const dir = path.join(root, ".specs", slug);
  await mkdir(dir, { recursive: true });
  await Promise.all(Object.entries({
    "README.md": `# ${slug}\n\nStatus: DRAFT\n`,
    "FR.md": "# Functional Requirements\n\n## FR-1: Validate the request\n\nThe service rejects malformed requests.\n",
    "TASKS.md": "# Tasks\n\n## TASK-1: Implement request validation\n\n- **Status:** todo\n- **Implements:** FR-1\n",
    [`${slug}-user-stories.feature`]: `Feature: Stories\n  @story:US-1\n  Rule: Submit a valid request\n    Actor: User\n    Goal: Submit a request\n    Benefit: Receive a result\n    Covers: FR-1\n    @id:SCEN-submit\n    Scenario: Submit valid input\n      Given the request is valid\n      When it is submitted\n      Then a result is returned\n`,
    [`${slug}-use-cases.feature`]: `Feature: Use cases\n  @case:UC-1 @story:US-1\n  Rule: Submit a valid request\n    Actor: User\n    Boundary: API\n    Trigger: Submit request\n    Precondition: The request is valid\n    Success: A result is returned\n    Covers: FR-1\n    Step: submit | Submit the request\n    Branch: success | submit | The request is valid | A result is returned | end\n    ScenarioRef: success | SCEN-submit\n`,
  }).map(([name, content]) => writeFile(path.join(dir, name), content)));
  await server.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "traceability-test", version: "1" } });
  server.notify("notifications/initialized", {});
  const trace = async (canonicalId) => {
    const response = await server.request("tools/call", { name: "spec_graph", arguments: {
      view: "trace", canonicalId, direction: "both", types: ["COVERS", "REFS", "IMPLEMENTS"],
      maxDepth: 2, maxVisited: 50, projection: "summary", limit: 50,
    } });
    const envelope = response.result?.structuredContent;
    assert.equal(envelope?.ok, true, JSON.stringify(envelope?.error));
    return new Set(envelope.data.nodes.map(({ canonicalId: id }) => id));
  };
  const fromStory = await trace(`${slug}:US-1`);
  assert.ok(fromStory.has(`${slug}:TASK-1`), "a story can reach its implementing task");
  assert.ok(fromStory.has(`${slug}:UC-1`), "a story can reach use cases linked to it");
  const fromTask = await trace(`${slug}:TASK-1`);
  assert.ok(fromTask.has(`${slug}:US-1`), "a task can reach the stories whose requirement it implements");
  assert.ok(fromTask.has(`${slug}:UC-1`), "a task can reach use cases covering the same requirement");
});

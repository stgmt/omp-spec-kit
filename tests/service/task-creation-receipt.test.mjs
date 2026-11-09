import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFile, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { startService } from "../../src/service/index.js";
import { seedSpecBranch } from "./lib/spec-repo.mjs";

const exec = promisify(execFile);
const project = "sandbox/receipt";
const spec = "spec-kernel";
const branch = `spec-${spec}`;
const identity = { name: "Sandbox", email: "sandbox@example.invalid" };

async function git(cwd, ...args) {
  return (await exec("git", args, { cwd })).stdout.trim();
}

test("creation confirmation reads the remote branch, never an unpushed worktree", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "registry-receipt-"));
  const token = randomBytes(24).toString("hex");
  const serviceToken = randomBytes(24).toString("hex");
  const auth = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.headers.authorization === `Bearer ${token}` && url.pathname === "/hub/api/rest/users/me") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "sandbox-user", login: "sandbox", banned: false }));
    } else if (request.headers.authorization === `Bearer ${serviceToken}` && url.pathname === "/hub/api/rest/users") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ users: [{ id: "sandbox-user", login: "sandbox", banned: false, transitiveGroups: [{ name: "sandbox" }] }] }));
    } else response.writeHead(401).end();
  });
  let service;
  try {
    await new Promise((resolve, reject) => { auth.once("error", reject); auth.listen(0, "127.0.0.1", resolve); });
    const bare = path.join(root, "specs.git");
    await exec("git", ["init", "--bare", "--initial-branch=main", bare]);
    await seedSpecBranch(bare, {
      project, spec,
      sourceDir: path.resolve("tests/fixtures/kernel/real-corpus", "." + "specs", spec),
    });
    const configPath = path.join(root, "projects.json");
    await writeFile(configPath, JSON.stringify({
      projects: [{ id: project }], bindings: [{ project, repoUrl: bare }],
      tenants: [{ tenant: "sandbox", projects: [project], hubGroups: ["sandbox"], defaultProject: project }],
      auth: { youtrack: { baseUrl: `http://127.0.0.1:${auth.address().port}`, serviceToken }, appBridge: { token: randomBytes(24).toString("hex") }, roleGroups: { owner: ["sandbox"] } },
    }));
    service = await startService({ configPath, cloneDir: path.join(root, "clone"), storeFile: path.join(root, "registry.db"), port: 0, identity, logger: () => {} });
    const url = `http://127.0.0.1:${service.port}/mcp`;
    async function rpc(method, params) {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
      });
      const payload = await response.json();
      assert.ok(payload.result, JSON.stringify(payload.error));
      return payload.result;
    }
    await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "receipt-test", version: "1" } });
    const tools = await rpc("tools/list", {});
    const patch = tools.tools.find((tool) => tool.name === "spec_patch");
    assert.ok(patch.inputSchema.oneOf.some((variant) => variant.properties.intent.enum.includes("confirmTaskCreation")));
    const call = async (args) => (await rpc("tools/call", { name: "spec_patch", arguments: { project, spec, ...args } })).structuredContent;
    const receipt = `${randomUUID()}.${"a".repeat(64)}`;
    const create = await call({ intent: "patch", requestId: "receipt-create", reason: "test creation", dryRun: false,
      operations: [{ kind: "upsert_task", document: "TASKS.md", localId: "TASK-998", title: "Receipt test", status: "todo", requirements: ["FR-1"], creationToken: receipt }] });
    assert.equal(create.data.outcome, "APPLIED", JSON.stringify(create.error ?? create.data.error));
    const confirm = (entity, creationToken, requestId = "receipt-confirm") => call({ intent: "confirmTaskCreation", requestId, reason: "confirm", dryRun: true, entity, creationToken });
    const remoteBefore = await git(bare, "rev-parse", `refs/heads/${branch}`);
    assert.equal((await confirm("TASK-998", receipt)).data.outcome, "CONFIRMED");
    assert.equal((await confirm("TASK-998", `${randomUUID()}.${"a".repeat(64)}`)).data.outcome, "UNKNOWN");
    assert.equal(await git(bare, "rev-parse", `refs/heads/${branch}`), remoteBefore, "confirmation must not write the authoritative branch");

    const worktree = await service.mounts.worktreeFor(project, spec);
    const localReceipt = `${randomUUID()}.${"b".repeat(64)}`;
    const taskPath = path.join(worktree.cwd, "." + "specs", spec, "TASKS.md");
    await appendFile(taskPath, `\n## TASK-999 — Local only\n\n- **Status:** todo\n\n<!-- agent-teams-creation:${localReceipt} -->\n`);
    await git(worktree.cwd, "add", ".");
    await git(worktree.cwd, "-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`, "commit", "-m", "local-only task");
    assert.equal((await confirm("TASK-999", localReceipt)).data.outcome, "UNKNOWN", "a local commit is not proof of a push");
    await git(worktree.cwd, "push", "origin", `HEAD:refs/heads/${branch}`);
    assert.equal((await confirm("TASK-999", localReceipt)).data.outcome, "CONFIRMED");
    await git(worktree.cwd, "rm", `.specs/${spec}/TASKS.md`);
    await git(worktree.cwd, "-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`, "commit", "-m", "remove task document");
    await git(worktree.cwd, "push", "origin", `HEAD:refs/heads/${branch}`);
    assert.equal((await confirm("TASK-999", localReceipt)).data.outcome, "UNKNOWN", "a missing TASKS.md on the fetched branch is not a verification failure");

    const invalid = await confirm("../escape", localReceipt);
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, "INVALID_REQUEST");
    await rename(bare, `${bare}.offline`);
    const offline = await confirm("TASK-999", localReceipt);
    assert.equal(offline.ok, false);
    assert.equal(offline.error.causeCode, "REMOTE_VERIFICATION_FAILED");
  } finally {
    service?.sync?.stop();
    service?.projection?.stop();
    if (service?.server) await new Promise((resolve) => service.server.close(resolve));
    service?.store?.close?.();
    await new Promise((resolve) => auth.close(resolve));
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MountManager, parseProjectsConfig } from "../../../src/service/mounts.js";
import { createVersionedReads } from "../../../src/service/versioned.js";
import { decodeHostedSnapshot, repositoryBindingId } from "../../../src/service/migration-snapshot.js";
import { commitToSpecBranch, initBare, seedSpecBranch } from "../../service/lib/spec-repo.mjs";

const project = "owner/demo";
const spec = "legacy-example";
const auth = { youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" }, appBridge: { token: "bridge-token-1234567890" }, roleGroups: { reader: ["readers"] } };

test("hosted read snapshot binds project, selected branch and remote tip", async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "hosted-snapshot-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const bare = await initBare(path.join(base, "specs.git"));
  const files = { "README.md": "# Legacy\n", "USER_STORIES.md": "# Stories\r\n## US-1: old\r\n", [`${spec}.feature`]: "Feature: Old\n" };
  await seedSpecBranch(bare, { project, spec, files });
  await seedSpecBranch(bare, { project, spec, branch: `spec-${spec}--work`, extra: { branch: `spec-${spec}` }, files: { ...files, "USER_STORIES.md": "# Stories\n## US-1: topic\n" } });
  const store = { getBinding: (id) => id === project ? { project, repoUrl: bare, branch: "main", status: "active" } : null, getCredential: () => null };
  const mounts = new MountManager({ config: parseProjectsConfig({ projects: [{ id: project }], auth }), cloneDir: path.join(base, "clones"), store });
  const documents = createVersionedReads({ mounts, store });
  const read = (args) => documents({ args, project, requestId: "read-1" }).then(({ envelope }) => envelope);

  const topicList = await read({ action: "list", spec, topic: "work", includeSnapshot: true });
  assert.equal(topicList.ok, true, JSON.stringify(topicList.error));
  assert.ok(topicList.data.docs.includes("USER_STORIES.md"));
  const token = topicList.data.snapshot;
  const repository = repositoryBindingId(bare);
  const decoded = decodeHostedSnapshot(token, { project, spec, topic: "work", repository });
  assert.ok(decoded);
  assert.equal(decodeHostedSnapshot(token, { project, spec, topic: null, repository }), null);
  assert.equal(decodeHostedSnapshot(token, { project: "owner/other", spec, topic: "work", repository }), null);
  assert.equal(decodeHostedSnapshot(token, { project, spec, topic: "work", repository: repositoryBindingId("another-repository") }), null);
  const topicRead = await read({ action: "read", spec, doc: "USER_STORIES.md", topic: "work", snapshot: token, readForEdit: true });
  assert.equal(topicRead.ok, true, JSON.stringify(topicRead.error));
  assert.match(topicRead.data.content, /topic/u);
  const ordinary = await read({ action: "read", spec, doc: "USER_STORIES.md", readForEdit: true });
  assert.equal(ordinary.ok, true, JSON.stringify(ordinary.error));
  assert.match(ordinary.data.content, /old/u);
  await commitToSpecBranch(bare, { spec, branch: `spec-${spec}--work`, files: { "README.md": "# Changed remotely\n" } });
  const stale = await read({ action: "read", spec, doc: "USER_STORIES.md", topic: "work", snapshot: token });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "CONFLICT");
  const invalid = await read({ action: "read", spec, doc: "USER_STORIES.md", topic: "work", version: "1.0.0" });
  assert.equal(invalid.error.code, "INVALID_REQUEST");
});

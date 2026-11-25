import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { executeDocumentOperation } from "../src/adapters/document-service.js";
import { specificationDirectoryDigest } from "../src/authoring/transactions.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "omp-document-read-"));
  assert.ok(path.isAbsolute(root));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const specDir = path.join(root, ".specs", "sample");
  await mkdir(specDir, { recursive: true });
  return { root, specDir };
}

const list = (root, extra = {}) => executeDocumentOperation(root, "listSpecDocs", { spec: "sample", ...extra });
const read = (root, doc, extra = {}) => executeDocumentOperation(root, "readSpecDoc", { spec: "sample", doc, ...extra });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("large legacy documents can be paged by line and UTF-8 byte without losing data", async (t) => {
  const { root, specDir } = await fixture(t);
  const text = "# Story\r\n" + "короткая строка\r\n".repeat(100000);
  await writeFile(path.join(specDir, "USER_STORIES.md"), text);
  const snapshot = (await list(root, { includeSnapshot: true })).data.snapshot;
  const page = await read(root, "USER_STORIES.md", { offset: 1, limit: 2, snapshot });
  assert.equal(page.ok, true, JSON.stringify(page));
  assert.equal(page.data.content, "# Story\r\nкороткая строка\r\n");
  let offset = 0, reconstructed = "";
  do {
    const part = await read(root, "USER_STORIES.md", { byteOffset: offset, byteLimit: 100003, snapshot });
    assert.equal(part.ok, true, JSON.stringify(part));
    reconstructed += part.data.content;
    offset = part.data.nextByteOffset;
    if (!part.data.truncated) break;
  } while (true);
  assert.equal(reconstructed, text);
  const badBoundary = await read(root, "USER_STORIES.md", { byteOffset: 10, byteLimit: 4, snapshot });
  assert.equal(badBoundary.error?.code, "INVALID_REQUEST");
  await writeFile(path.join(specDir, "USER_STORIES.md"), text + "changed");
  const stale = await read(root, "USER_STORIES.md", { byteOffset: 0, byteLimit: 64, snapshot });
  assert.equal(stale.error?.code, "CONFLICT");
  const longLine = "Я".repeat(1100000);
  await writeFile(path.join(specDir, "USER_STORIES.md"), longLine);
  const first = await read(root, "USER_STORIES.md", { byteOffset: 0, byteLimit: 100003 });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.data.content, longLine.slice(0, 50001));
  assert.equal(first.data.nextByteOffset, 100002);
});

test("ordinary document list and read preserve access to existing legacy files", async (t) => {
  const { root, specDir } = await fixture(t);
  const inputs = {
    "USER_STORIES.md": "## US-1 — Польза\r\nТекст\r\n",
    "USE_CASES.md": "## UC-1 — Действие\r\n",
    "sample.feature": "Feature: описание\r\n  Scenario: путь\r\n",
  };
  for (const [name, text] of Object.entries(inputs)) await writeFile(path.join(specDir, name), text);
  const result = await list(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.docs, Object.keys(inputs).sort());
  assert.equal("snapshot" in result.data, false);
  for (const [name, text] of Object.entries(inputs)) {
    const result = await read(root, name, { readForEdit: true });
    assert.equal(result.ok, true);
    assert.equal(result.data.content, text);
    assert.equal(result.data.sha256, digest(Buffer.from(text)));
    assert.equal(await readFile(path.join(specDir, name), "utf8"), text);
  }
});

test("mixed and incomplete layouts remain readable through the existing response shape", async (t) => {
  const { root, specDir } = await fixture(t);
  await writeFile(path.join(specDir, "USER_STORIES.md"), "## US-1\r\nСтарая история\r\n");
  await writeFile(path.join(specDir, "sample-user-stories.feature"), "Feature: черновик\r\n  Rule: US-1\r\n");
  const mixed = await list(root);
  assert.deepEqual(mixed, {
    ok: true,
    data: {
      kind: "spec-documents",
      spec: "sample",
      docs: ["USER_STORIES.md", "sample-user-stories.feature"],
      count: 2,
      attachments: [],
    },
    page: null,
  });
  const old = await read(root, "USER_STORIES.md", { offset: 1, limit: 1 });
  assert.equal(old.ok, true);
  assert.equal(old.data.content, "## US-1");
  assert.equal(old.data.startLine, 1);
  assert.equal(old.data.endLine, 1);
  assert.equal(old.data.truncated, true);
  assert.equal("snapshot" in old.data, false);
  const fresh = await read(root, "sample-user-stories.feature", { offset: 1, limit: 1 });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.data.content, "Feature: черновик");

  await unlink(path.join(specDir, "USER_STORIES.md"));
  const partial = await list(root);
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.data.docs, ["sample-user-stories.feature"]);
  const partialRead = await read(root, "sample-user-stories.feature", { readForEdit: true });
  assert.equal(partialRead.ok, true);
  assert.equal(partialRead.data.content, "Feature: черновик\r\n  Rule: US-1\r\n");
});

test("snapshot uses the existing spec-directory digest and inventories all files", async (t) => {
  const { root, specDir } = await fixture(t);
  await writeFile(path.join(specDir, "USER_STORIES.md"), "Сюжет\r\n");
  await mkdir(path.join(specDir, "attachments"));
  await writeFile(path.join(specDir, "attachments", "example.bin"), Buffer.from([0, 255, 1]));
  const result = await list(root, { includeSnapshot: true });
  const expected = await specificationDirectoryDigest(root, "sample");
  assert.equal(result.ok, true);
  assert.equal(result.data.snapshot, expected.digest);
  assert.deepEqual(result.data.files, expected.files);
  assert.deepEqual(result.data.attachments, ["attachments/example.bin"]);
  assert.deepEqual(result.data.docs, ["USER_STORIES.md"]);
});

test("snapshot page boundaries preserve Unicode, CRLF, mixed newlines and final empty line", async (t) => {
  const { root, specDir } = await fixture(t);
  const text = "Первый 🧪\r\n\r\n三番目\nконец\r\n";
  await writeFile(path.join(specDir, "USER_STORIES.md"), text);
  const inventory = await list(root, { includeSnapshot: true });
  assert.equal(inventory.ok, true);
  let offset = 1;
  const pages = [];
  while (true) {
    const result = await read(root, "USER_STORIES.md", { snapshot: inventory.data.snapshot, offset, limit: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.data.snapshot, inventory.data.snapshot);
    assert.equal(result.data.sha256, digest(Buffer.from(text)));
    assert.equal(result.data.totalLines, 5);
    pages.push(result.data.content);
    if (!result.data.truncated) break;
    offset = result.data.endLine + 1;
  }
  assert.deepEqual(pages, ["Первый 🧪\r\n", "\r\n", "三番目\n", "конец\r\n", ""]);
  assert.deepEqual(Buffer.from(pages.join("")), Buffer.from(text));
});

test("snapshot checks all source files on each page while ordinary reading stays available", async (t) => {
  const { root, specDir } = await fixture(t);
  await writeFile(path.join(specDir, "USER_STORIES.md"), "one\r\ntwo\r\n");
  await writeFile(path.join(specDir, "FR.md"), "first");
  const inventory = await list(root, { includeSnapshot: true });
  const first = await read(root, "USER_STORIES.md", { snapshot: inventory.data.snapshot, offset: 1, limit: 1 });
  assert.equal(first.ok, true);
  await writeFile(path.join(specDir, "FR.md"), "other");
  const stale = await read(root, "USER_STORIES.md", { snapshot: inventory.data.snapshot, offset: 2, limit: 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "CONFLICT");
  assert.equal(stale.error.causeCode, "SPEC_SNAPSHOT_MISMATCH");
  const ordinary = await read(root, "USER_STORIES.md", { readForEdit: true });
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.data.content, "one\r\ntwo\r\n");
  const malformed = await read(root, "USER_STORIES.md", { snapshot: "not-a-hash" });
  assert.equal(malformed.error.code, "INVALID_REQUEST");
});

test("snapshot does not silently replace invalid UTF-8 and paths cannot escape", async (t) => {
  const { root, specDir } = await fixture(t);
  await writeFile(path.join(specDir, "USER_STORIES.md"), Buffer.from([0x61, 0xff, 0x62]));
  const inventory = await list(root, { includeSnapshot: true });
  const invalid = await read(root, "USER_STORIES.md", { snapshot: inventory.data.snapshot });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "INVALID_UTF8");
  const escaped = await read(root, "../outside.md");
  assert.equal(escaped.ok, false);
  assert.equal(escaped.error.code, "PATH_FORBIDDEN");
});

test("snapshot rejects symlinks rather than following outside files", async (t) => {
  const { root, specDir } = await fixture(t);
  const outside = path.join(root, "outside.txt");
  await writeFile(outside, "outside");
  try {
    await symlink(outside, path.join(specDir, "linked.md"), "file");
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Windows does not permit symlink creation for this user");
      return;
    }
    throw error;
  }
  const inventory = await list(root, { includeSnapshot: true });
  assert.equal(inventory.ok, false);
  assert.equal(inventory.error.code, "PATH_FORBIDDEN");
  const doc = await read(root, "linked.md");
  assert.equal(doc.ok, false);
  assert.equal(doc.error.code, "PATH_FORBIDDEN");
});

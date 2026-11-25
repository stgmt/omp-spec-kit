import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { GitClient } from "../../../src/service/git.js";
import { removeTempRepo } from "../../helpers/kernel-world.mjs";

const exec = promisify(execFile);
const identity = { authorName: "test", authorEmail: "test@example.invalid" };

async function repository(t) {
  const root = await mkdtemp(path.join(tmpdir(), "spec-git-scoped-"));
  t.after(() => removeTempRepo(root));
  const git = new GitClient();
  await exec("git", ["init", "--initial-branch=main", root]);
  await exec("git", ["-C", root, "config", "user.name", identity.authorName]);
  await exec("git", ["-C", root, "config", "user.email", identity.authorEmail]);
  await mkdir(path.join(root, ".specs", "demo"), { recursive: true });
  await writeFile(path.join(root, ".specs", "demo", "old.md"), "old\n");
  await writeFile(path.join(root, ".spec-kit.json"), "{\"status\":\"active\"}\n");
  await writeFile(path.join(root, "outside.md"), "original\n");
  await git.add([".specs", ".spec-kit.json", "outside.md"], { cwd: root });
  await git.commit({ ...identity, cwd: root, message: "initial" });
  return { root, git };
}

test("scoped commit carries additions and deletions without publishing another staged file", async (t) => {
  const { root, git } = await repository(t);
  await rm(path.join(root, ".specs", "demo", "old.md"));
  await writeFile(path.join(root, ".specs", "demo", "new.feature"), "Feature: New\n");
  await writeFile(path.join(root, "outside.md"), "user change\n");
  await git.add([".specs/demo", "outside.md"], { cwd: root });
  const before = (await git.run(["diff", "--cached", "--", "outside.md"], { cwd: root })).stdout;
  await git.commit({ ...identity, cwd: root, message: "migration", paths: [".specs/demo"] });
  const committed = (await git.run(["show", "--format=", "--name-only", "HEAD"], { cwd: root })).stdout.trim().split(/\r?\n/u);
  assert.deepEqual(new Set(committed), new Set([".specs/demo/old.md", ".specs/demo/new.feature"]));
  assert.equal((await git.run(["diff", "--cached", "--", "outside.md"], { cwd: root })).stdout, before);
  assert.equal(await readFile(path.join(root, "outside.md"), "utf8"), "user change\n");
});

test("scoped archive commit permits its marker, old tree, and destination only", async (t) => {
  const { root, git } = await repository(t);
  await mkdir(path.join(root, ".specs", "archive", "demo"), { recursive: true });
  await writeFile(path.join(root, ".specs", "archive", "demo", "old.md"), "old\n");
  await rm(path.join(root, ".specs", "demo", "old.md"));
  await writeFile(path.join(root, ".spec-kit.json"), "{\"status\":\"archived\"}\n");
  await writeFile(path.join(root, "outside.md"), "user change\n");
  await git.add([".spec-kit.json", ".specs/demo", ".specs/archive/demo", "outside.md"], { cwd: root });
  const before = (await git.run(["diff", "--cached", "--", "outside.md"], { cwd: root })).stdout;
  await git.commit({ ...identity, cwd: root, message: "archive", paths: [".spec-kit.json", ".specs/demo", ".specs/archive/demo"] });
  const committed = (await git.run(["show", "--format=", "--name-only", "--no-renames", "HEAD"], { cwd: root })).stdout.trim().split(/\r?\n/u);
  assert.deepEqual(new Set(committed), new Set([".spec-kit.json", ".specs/demo/old.md", ".specs/archive/demo/old.md"]));
  assert.equal((await git.run(["diff", "--cached", "--", "outside.md"], { cwd: root })).stdout, before);
  assert.equal(await readFile(path.join(root, "outside.md"), "utf8"), "user change\n");
});

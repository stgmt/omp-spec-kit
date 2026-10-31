import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { migrateSpecsToBranches } from "../../../src/service/spec-migration.js";

const execFileAsync = promisify(execFile);
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })));
});

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

describe("legacy corpus migration", () => {
  it("creates one orphan branch per spec with matching metadata, idempotently", async () => {
    const base = await tempDir("spec-migrate-test-");
    const source = path.join(base, "old");
    const bare = path.join(base, "target.git");
    await mkdir(path.join(source, "stgmt/demo/.specs/alpha-spec"), { recursive: true });
    await mkdir(path.join(source, "stgmt/demo/.specs/beta-spec"), { recursive: true });
    await writeFile(path.join(source, "stgmt/demo/.specs/alpha-spec/README.md"), "# Alpha\n");
    await writeFile(path.join(source, "stgmt/demo/.specs/beta-spec/README.md"), "# Beta\n");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);

    const result = await migrateSpecsToBranches({ sourceRoot: source, project: "stgmt/demo", repoUrl: bare });
    assert.deepEqual(result.specs.map((entry) => entry.branch), ["spec-alpha-spec", "spec-beta-spec"]);
    assert.ok(result.specs.every((entry) => entry.outcome === "created"));
    assert.equal(await git(bare, ["rev-list", "--max-parents=0", "--count", "spec-alpha-spec"]), "1");

    const metadata = JSON.parse(await git(bare, ["show", "spec-alpha-spec:.spec-kit.json"]));
    assert.equal(metadata.project, "stgmt/demo");
    assert.equal(metadata.spec, "alpha-spec");
    assert.equal(metadata.branch, "spec-alpha-spec");
    assert.equal(metadata.repo, bare);

    const again = await migrateSpecsToBranches({ sourceRoot: source, project: "stgmt/demo", repoUrl: bare });
    assert.ok(again.specs.every((entry) => entry.outcome === "skipped" && entry.reason === "branch-exists"));
  });
});

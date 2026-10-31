import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { MountManager, parseProjectsConfig } from "../../../src/service/mounts.js";
import { seedSpecBranch } from "../../service/lib/spec-repo.mjs";

const execFileAsync = promisify(execFile);
const AUTH = {
  youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
  appBridge: { token: "bridge-token-1234567890" },
  roleGroups: { reader: ["spec-readers"] },
};
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })));
});

describe("materialised corpus", () => {
  it("preserves binary attachment bytes", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "spec-materialise-"));
    tempDirs.push(base);
    const bare = path.join(base, "specs.git");
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    const source = path.join(base, "source");
    await mkdir(source, { recursive: true });
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x01]);
    await writeFile(path.join(source, "blob.bin"), binary);
    await seedSpecBranch(bare, { project: "stgmt/demo", spec: "demo-spec", sourceDir: source });
    const config = parseProjectsConfig({ projects: [{ id: "stgmt/demo" }], auth: AUTH });
    const store = {
      getBinding: (project) => (project === "stgmt/demo" ? { project, repoUrl: bare, branch: "main", status: "active" } : null),
      getCredential: () => null,
    };
    const mounts = new MountManager({ config, cloneDir: path.join(base, "clone"), store, logger: () => {} });
    const root = await mounts.projectRoot("stgmt/demo");
    assert.deepEqual(await readFile(path.join(root, ".specs", "demo-spec", "blob.bin")), binary);
  });
});

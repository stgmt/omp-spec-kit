import { setWorldConstructor } from "@cucumber/cucumber";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink, rm } from "node:fs/promises";
import path from "node:path";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function snapshotTree(root) {
  const entries = [];

  async function visit(absolutePath, relativePath) {
    let stats;
    try {
      stats = await lstat(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT" && relativePath === ".") {
        entries.push({ path: ".", type: "absent" });
        return;
      }
      throw error;
    }

    if (stats.isSymbolicLink()) {
      entries.push({ path: relativePath, type: "link", target: await readlink(absolutePath) });
      return;
    }
    if (stats.isFile()) {
      const bytes = await readFile(absolutePath);
      entries.push({ path: relativePath, type: "file", size: stats.size, sha256: sha256(bytes) });
      return;
    }
    if (!stats.isDirectory()) {
      entries.push({ path: relativePath, type: "other", size: stats.size });
      return;
    }

    entries.push({ path: relativePath, type: "directory" });
    const children = await readdir(absolutePath);
    children.sort();
    for (const name of children) {
      const childRelative = relativePath === "." ? name : path.posix.join(relativePath, name);
      await visit(path.join(absolutePath, name), childRelative);
    }
  }

  await visit(root, ".");
  return {
    digest: sha256(JSON.stringify(entries)),
    entries,
  };
}

export class DistributionWorld {
  constructor() {
    this.repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
    this.repositorySpecsBefore = null;
    this.tempRoot = null;
    this.tempSpecsBefore = null;
    this.condition = null;
    this.request = {};
    this.signal = undefined;
    this.defaultResult = null;
    this.boundedResult = null;
    this.result = null;
    this.invalidCase = null;
    this.registration = null;
    this.execution = null;
  }

  async removeTemporaryProducer() {
    if (this.tempRoot !== null) {
      await rm(this.tempRoot, { recursive: true, force: true, maxRetries: 3 });
      this.tempRoot = null;
    }
  }
}

setWorldConstructor(DistributionWorld);

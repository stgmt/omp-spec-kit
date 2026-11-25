import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSpecService } from "../adapters/query-service.js";

// The token is a concurrency identifier, not an authorization credential.
// Permission checks remain on the enclosing MCP operation. The scope is also
// included in the preview's proposal hash by the authoring compiler.
export function repositoryBindingId(repoUrl) {
  return createHash("sha256").update(String(repoUrl), "utf8").digest("hex");
}

export function encodeHostedSnapshot({ project, spec, topic, head, tree, repository }) {
  return `snapshot-v1.${Buffer.from(JSON.stringify({ project, spec, topic, head, tree, repository }), "utf8").toString("base64url")}`;
}

export function decodeHostedSnapshot(value, { project, spec, topic = null, repository }) {
  if (typeof value !== "string" || value.length > 4096 || !value.startsWith("snapshot-v1.")) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value.slice("snapshot-v1.".length), "base64url").toString("utf8"));
    if (!parsed || Object.keys(parsed).sort().join(",") !== "head,project,repository,spec,topic,tree" ||
        parsed.project !== project || parsed.spec !== spec || parsed.topic !== topic ||
        parsed.repository !== repository || !/^[0-9a-f]{64}$/u.test(parsed.repository) ||
        !/^[0-9a-f]{40,64}$/u.test(parsed.head) || !/^[0-9a-f]{64}$/u.test(parsed.tree)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** A private read/preview root for exactly the selected branch's immutable tip. */
export async function materializeBranchRoot({ mounts, project, spec, worktree }) {
  const source = await mounts.projectRoot(project, { fetch: false });
  const temporary = await mkdtemp(path.join(worktree.cwd, "..", "..", "spec-migration-"));
  try {
    const sourceSpecs = path.join(source, ".specs");
    const targetSpecs = path.join(temporary, ".specs");
    await cp(sourceSpecs, targetSpecs, { recursive: true });
    const target = path.join(targetSpecs, spec);
    await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    await mkdir(target, { recursive: true });
    const prefix = `.specs/${spec}/`;
    const listing = await worktree.git.run(["ls-tree", "-r", "-z", worktree.head, "--", prefix], { cwd: worktree.cwd });
    const records = listing.stdout.split("\u0000").filter(Boolean);
    for (const record of records) {
      const match = /^(100644|100755) blob [0-9a-f]+\t(.+)$/u.exec(record);
      if (!match || !match[2].startsWith(prefix)) throw Object.assign(new Error("branch contains an unsupported or linked specification path"), { code: "PATH_FORBIDDEN" });
      const relative = match[2].slice(prefix.length);
      const parts = relative.split("/");
      if (parts.some((part) => part === "" || part === "." || part === ".." || part.includes("\\"))) throw Object.assign(new Error("branch contains an invalid specification path"), { code: "PATH_FORBIDDEN" });
      const destination = path.join(target, ...parts);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, await worktree.git.showBytes(worktree.head, match[2], { cwd: worktree.cwd }));
    }
    return {
      root: temporary,
      service: createSpecService(temporary),
      cleanup: () => rm(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }),
    };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {});
    throw error;
  }
}

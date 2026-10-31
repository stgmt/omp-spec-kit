import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { repoUrlHasCredentials, sanitizeRepoUrl } from "./mounts.js";

const execFileAsync = promisify(execFile);
const SPEC_BINDING_FILE = ".spec-kit.json";

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd, windowsHide: true })).stdout.trim();
}

async function branchExists(repoUrl, branch) {
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", "--heads", repoUrl, `refs/heads/${branch}`], { windowsHide: true });
    return stdout.trim() !== "";
  } catch {
    return false;
  }
}

/**
 * Convert the 2.x layout `<project>/.specs/<slug>/` into one orphan
 * `spec-<slug>` branch per specification. Idempotent: an existing remote
 * branch is reported as skipped and never overwritten.
 */
export async function migrateSpecsToBranches({
  sourceRoot,
  project,
  repoUrl,
  identity = { name: "spec-bot", email: "bot@example.invalid" },
  dryRun = false,
  logger = () => {},
}) {
  if (typeof sourceRoot !== "string" || sourceRoot.length === 0) throw new Error("sourceRoot is required");
  if (typeof project !== "string" || !/^[^/]+\/[^/]+$/u.test(project)) throw new Error("project must be owner/project");
  if (typeof repoUrl !== "string" || repoUrl.length === 0) throw new Error("repoUrl is required");
  if (repoUrlHasCredentials(repoUrl)) throw new Error("repoUrl must not embed credentials; use ambient git auth or a credential helper");
  const cleanRepoUrl = sanitizeRepoUrl(repoUrl);
  const specsRoot = path.join(sourceRoot, project, ".specs");
  const entries = await readdir(specsRoot, { withFileTypes: true }).catch(() => null);
  if (entries === null) throw new Error(`no old-layout corpus at ${specsRoot}`);
  const specs = entries.filter((entry) => entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.name)).map((entry) => entry.name).sort();
  if (specs.length === 0) throw new Error(`no spec directories under ${specsRoot}`);

  const results = [];
  for (const spec of specs) {
    const branch = `spec-${spec}`;
    if (await branchExists(cleanRepoUrl, branch)) {
      results.push({ spec, branch, outcome: "skipped", reason: "branch-exists" });
      logger(`skip ${branch}: already exists`);
      continue;
    }
    const source = path.join(specsRoot, spec);
    if (!(await stat(source)).isDirectory()) {
      results.push({ spec, branch, outcome: "skipped", reason: "not-a-directory" });
      continue;
    }
    const dir = await mkdtemp(path.join(tmpdir(), "spec-migrate-"));
    try {
      await git(dir, ["init", "-q"]);
      const target = path.join(dir, ".specs", spec);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target, { recursive: true });
      const metadata = {
        schema: "omp-spec-kit/spec-binding@1",
        project,
        spec,
        repo: cleanRepoUrl,
        branch,
        createdAt: new Date().toISOString(),
        owner: project.split("/")[0],
      };
      await writeFile(path.join(dir, SPEC_BINDING_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
      await git(dir, ["add", "-A"]);
      await git(dir, [
        "-c", `user.name=${identity.name}`,
        "-c", `user.email=${identity.email}`,
        "commit", "-qm", `chore: migrate ${spec} to ${branch}`,
      ]);
      if (!dryRun) {
        await git(dir, ["push", "-q", repoUrl, `HEAD:refs/heads/${branch}`]);
      }
      const commit = await git(dir, ["rev-parse", "HEAD"]);
      results.push({ spec, branch, commit, outcome: dryRun ? "planned" : "created" });
      logger(`${dryRun ? "plan" : "created"} ${branch} ${commit.slice(0, 12)}`);
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }
  return { project, repoUrl: cleanRepoUrl, specs: results };
}

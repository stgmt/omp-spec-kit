import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

export async function initBare(bare) {
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  return bare;
}

async function withClone(bare, fn) {
  const base = await mkdtemp(path.join(tmpdir(), "spec-seed-"));
  const work = path.join(base, "work");
  try {
    await execFileAsync("git", ["clone", bare, work]);
    await git(work, ["config", "user.email", "seed@example.invalid"]);
    await git(work, ["config", "user.name", "seed"]);
    return await fn(work);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
}

/**
 * Create an orphan `spec-<slug>` branch with `.spec-kit.json` and the spec
 * directory at the branch root. `files` maps document names to contents;
 * `sourceDir` copies a fixture spec directory instead.
 */
export async function seedSpecBranch(bare, { project, spec, repoUrl = bare, files = null, sourceDir = null, branch = `spec-${spec}`, extra = {} }) {
  await withClone(bare, async (work) => {
    await git(work, ["checkout", "--orphan", branch]);
    await git(work, ["rm", "-rf", ".", "--ignore-unmatch"]).catch(() => {});
    const specDir = path.join(work, ".specs", spec);
    await mkdir(specDir, { recursive: true });
    if (sourceDir !== null) {
      await cp(sourceDir, specDir, { recursive: true });
    }
    for (const [name, content] of Object.entries(files ?? {})) {
      await mkdir(path.dirname(path.join(specDir, name)), { recursive: true });
      await writeFile(path.join(specDir, name), content);
    }
    await writeFile(
      path.join(work, ".spec-kit.json"),
      `${JSON.stringify({
        schema: "omp-spec-kit/spec-binding@1",
        project,
        spec,
        repo: repoUrl,
        branch,
        createdAt: "2026-10-30T00:00:00.000Z",
        owner: project.split("/")[0],
        ...extra,
      }, null, 2)}\n`,
    );
    await git(work, ["add", "."]);
    await git(work, ["commit", "-m", `seed ${branch}`]);
    await git(work, ["push", "-q", "origin", `HEAD:refs/heads/${branch}`]);
  });
}

/** Push one extra commit to an existing spec branch. */
export async function commitToSpecBranch(bare, { spec, branch = `spec-${spec}`, files, message = "docs(spec): remote-only", author = null }) {
  await withClone(bare, async (work) => {
    await git(work, ["checkout", branch]);
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(work, ".specs", spec, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    await git(work, ["add", "."]);
    if (author) {
      await execFileAsync("git", ["-c", `user.email=${author.email}`, "-c", `user.name=${author.name}`, "commit", "-m", message], { cwd: work });
    } else {
      await git(work, ["commit", "-m", message]);
    }
    await git(work, ["push", "-q", "origin", `HEAD:refs/heads/${branch}`]);
  });
}

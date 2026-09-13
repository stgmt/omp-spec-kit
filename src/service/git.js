import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const queues = new Map();

function enqueue(key, task) {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  // Store a settled-twin so a failed task never leaves an unhandled
  // rejection in the queue map; callers handle `next` themselves.
  const stored = next.then(() => {}, () => {});
  queues.set(key, stored);
  void stored.then(() => {
    if (queues.get(key) === stored) queues.delete(key);
  });
  return next;
}

export class GitError extends Error {
  constructor(message, { args, stdout, stderr, exitCode } = {}) {
    super(message);
    this.name = "GitError";
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

/**
 * Thin serialized git CLI wrapper. One queue per repository root: git index and
 * refs are process-global state inside a worktree, so concurrent git calls on
 * the same clone must not interleave.
 */
export class GitClient {
  constructor({ defaultCwd, env = process.env } = {}) {
    this.defaultCwd = defaultCwd;
    this.env = env;
  }

  run(args, { cwd = this.defaultCwd } = {}) {
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
      return Promise.reject(new GitError("git arguments must be an array of strings", { args }));
    }
    return enqueue(`${cwd ?? ""}`, () =>
      execFileAsync("git", args, { cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
        .then(({ stdout, stderr }) => ({ stdout, stderr }))
        .catch((error) => {
          throw new GitError(`git ${args[0]} failed: ${(error.stderr || error.message || "").trim().slice(0, 500)}`, {
            args,
            stdout: error.stdout,
            stderr: error.stderr,
            exitCode: error.code,
          });
        }),
    );
  }

  async revParse(rev, { cwd } = {}) {
    const { stdout } = await this.run(["rev-parse", "--verify", rev], { cwd });
    return stdout.trim();
  }

  async clone(url, destination, { branch } = {}) {
    const args = ["clone", "--no-tags"];
    if (branch) args.push("--branch", branch);
    args.push("--", url, destination);
    await this.run(args);
  }

  async fetch({ remote = "origin", cwd } = {}) {
    await this.run(["fetch", "--prune", "--no-tags", remote], { cwd });
  }

  async add(paths, { cwd } = {}) {
    if (!Array.isArray(paths) || paths.length === 0) return;
    await this.run(["add", "--", ...paths], { cwd });
  }

  async commit({ message, authorName, authorEmail, cwd } = {}) {
    const args = [
      "-c", `user.name=${authorName}`,
      "-c", `user.email=${authorEmail}`,
      "commit", "--no-verify", "--allow-empty", "-m", message,
    ];
    await this.run(args, { cwd });
  }

  async push({ remote = "origin", refspec } = {}, { cwd } = {}) {
    await this.run(["push", remote, ...(refspec ? [refspec] : [])], { cwd });
  }

  async statusPorcelain({ cwd } = {}) {
    const { stdout } = await this.run(["status", "--porcelain"], { cwd });
    return stdout;
  }

  async log({ cwd, maxCount = 1, format = "%H%x00%an%x00%ae%x00%s" } = {}) {
    const { stdout } = await this.run(["log", `--max-count=${maxCount}`, `--format=${format}`], { cwd });
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [hash, authorName, authorEmail, subject] = line.split("\0");
      return { hash, authorName, authorEmail, subject };
    });
  }

  /** Commits with changed paths; `range` like `origin/main..HEAD`. */
  async logDetailed({ range = "HEAD", maxCount = 50, cwd } = {}) {
    const { stdout } = await this.run(["log", `--max-count=${maxCount}`, "--format=%H%x00%an%x00%ae%x00%s", "--name-only", range], { cwd });
    const commits = [];
    for (const line of stdout.split("\n")) {
      if (line.includes("\0")) {
        const [hash, authorName, authorEmail, subject] = line.split("\0");
        commits.push({ hash, authorName, authorEmail, subject, paths: [] });
      } else if (line.trim() !== "" && commits.length > 0) {
        commits[commits.length - 1].paths.push(line.trim());
      }
    }
    return commits;
  }

  async revCount(range, { cwd } = {}) {
    const { stdout } = await this.run(["rev-list", "--count", range], { cwd });
    return Number(stdout.trim()) || 0;
  }

  async mergeFF(ref, { cwd } = {}) {
    await this.run(["merge", "--ff-only", ref], { cwd });
  }
}

export function botIdentityFromEnv(env = process.env) {
  const name = env.SPEC_REGISTRY_BOT_NAME ?? "spec-registryd bot";
  const email = env.SPEC_REGISTRY_BOT_EMAIL ?? "bot@spec-registryd.invalid";
  return { name, email };
}

export function commitMessage({ subject, body, trailers = {} }) {
  const parts = [subject];
  const trailerLines = Object.entries(trailers).map(([key, value]) => `${key}: ${value}`);
  if (body) parts.push(body);
  if (trailerLines.length > 0) parts.push(trailerLines.join("\n"));
  return parts.join("\n\n");
}

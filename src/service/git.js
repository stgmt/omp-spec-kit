import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Git context variables that override cwd/`-C` and must never reach a child. */
const GIT_CONTEXT_VARS = Object.freeze([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
]);

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
 * Server-side credential for the private specs repo (TASK-14). The operator
 * token is handed to the git child process as a URL-scoped `http.extraheader`,
 * so it never lands in argv, in a config file, or in an error message — the
 * service reaches the specs repo under the hood and consumers never see it.
 */
export function gitAuthEnv(auth) {
  if (!auth || typeof auth.token !== "string" || auth.token.length === 0) return {};
  const key = typeof auth.url === "string" && auth.url.length > 0 ? `http.${auth.url}.extraheader` : "http.extraheader";
  const username = typeof auth.username === "string" && auth.username.length > 0 ? auth.username : "x-access-token";
  const header = `Authorization: Basic ${Buffer.from(`${username}:${auth.token}`, "utf8").toString("base64")}`;
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: key,
    GIT_CONFIG_VALUE_0: header,
  };
}

export function gitAuthFromEnv(env = process.env) {
  const token = env.SPEC_REGISTRY_GIT_TOKEN;
  if (typeof token !== "string" || token.trim().length === 0) return undefined;
  return {
    token: token.trim(),
    username: env.SPEC_REGISTRY_GIT_USER,
    url: env.SPEC_REGISTRY_GIT_AUTH_URL,
  };
}

/**
 * Thin serialized git CLI wrapper. One queue per repository root: git index and
 * refs are process-global state inside a worktree, so concurrent git calls on
 * the same clone must not interleave.
 */
export class GitClient {
  constructor({ defaultCwd, env = process.env, gitAuth } = {}) {
    this.defaultCwd = defaultCwd;
    this.env = env;
    this.gitAuth = gitAuth;
    this.secrets = [gitAuth?.token].filter((secret) => typeof secret === "string" && secret.length > 0);
  }

  childEnv() {
    // The service always names its repository through `cwd`, so the git context
    // variables a parent may carry — a pre-commit hook sets GIT_DIR and
    // GIT_INDEX_FILE, and they override cwd and `-C` in every descendant — must
    // not reach the child: without this a hook-started service would commit
    // into whatever repository the hook belongs to.
    const env = { ...this.env };
    for (const key of GIT_CONTEXT_VARS) delete env[key];
    return { ...env, ...gitAuthEnv(this.gitAuth) };
  }

  redact(text) {
    if (typeof text !== "string") return text;
    return this.secrets.reduce((out, secret) => out.split(secret).join("***"), text);
  }

  run(args, { cwd = this.defaultCwd } = {}) {
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
      return Promise.reject(new GitError("git arguments must be an array of strings", { args }));
    }
    // Fail closed: a git call without a cwd would run against whatever
    // directory the process happens to sit in — in a test run that is the
    // product worktree, where a stray commit would land on the checked-out
    // branch. Every call must name its repository.
    if (typeof cwd !== "string" || cwd.length === 0) {
      return Promise.reject(new GitError(`git ${args[0]} refused: no cwd (the service never runs git against the process cwd)`, { args }));
    }
    return enqueue(`${cwd ?? ""}`, () =>
      execFileAsync("git", args, { cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024, env: this.childEnv() })
        .then(({ stdout, stderr }) => ({ stdout, stderr }))
        .catch((error) => {
          throw new GitError(
            this.redact(`git ${args[0]} failed: ${(error.stderr || error.message || "").trim().slice(0, 500)}`),
            {
              args: args.map((arg) => this.redact(arg)),
              stdout: this.redact(error.stdout),
              stderr: this.redact(error.stderr),
              exitCode: error.code,
            },
          );
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
    // `clone` creates the destination itself, so it runs from the destination's
    // parent — never from the process cwd.
    await this.run(args, { cwd: path.dirname(path.resolve(destination)) });
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

  /** Author emails of the commits a push would send (`range` may be a tip). */
  async commitAuthors(range, { cwd } = {}) {
    const { stdout } = await this.run(["log", "--no-merges", "--format=%ae", range], { cwd });
    return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
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

  /**
   * Replay local commits on top of the remote (reconciliation, FR-5/FR-16).
   * Rebase creates commits, so it needs the bot identity like `commit` does —
   * the image ships no global git identity.
   */
  async rebaseOnto(ref, { cwd, identity } = {}) {
    const args = [];
    if (identity?.name && identity?.email) {
      args.push("-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`);
    }
    args.push("rebase", ref);
    await this.run(args, { cwd });
  }

  async rebaseAbort({ cwd } = {}) {
    await this.run(["rebase", "--abort"], { cwd }).catch(() => {});
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

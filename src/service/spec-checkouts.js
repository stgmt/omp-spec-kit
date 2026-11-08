/**
 * Per-spec checkouts: one bare mirror per repository, holding only the
 * `spec-*` branches. A worktree shares the mirror's object store, so nine
 * specs do not duplicate a large code repository, and two spec branches never
 * fight over a checked-out branch in a shared clone.
 *
 * Only spec branches are fetched: the repository's other branches (main, …)
 * are never mirrored, because specs live on orphan `spec-<slug>` branches
 * and never need the host repository's code or history.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
const SPEC_REFSPEC = "+refs/heads/spec-*:refs/remotes/origin/spec-*";

// Local heads that belong to active spec worktrees (`work/spec-*`) or direct
// spec-branch checkouts (`spec-*`) must survive cleanup of legacy mirrors.
const KEEP_LOCAL_HEAD = /^(?:work\/)?spec-/u;

/**
 * Remove refs that predate spec-only mirroring. `fetch --prune` with an
 * explicit refspec prunes only inside the destination pattern, so
 * `refs/remotes/origin/main` and local `refs/heads/main` from an old
 * `clone --bare` would otherwise linger (and keep host-repo objects alive).
 */
async function pruneNonSpecRefs({ git, mirrorDir, cwd }) {
  const { stdout } = await git.run(["--git-dir", mirrorDir, "for-each-ref", "--format=%(refname)", "refs/remotes/origin", "refs/heads"], { cwd });
  for (const ref of stdout.split(/\r?\n/u)) {
    if (!ref) continue;
    if (ref.startsWith("refs/remotes/origin/spec-")) continue;
    if (ref.startsWith("refs/heads/") && KEEP_LOCAL_HEAD.test(ref.slice("refs/heads/".length))) continue;
    await git.run(["--git-dir", mirrorDir, "update-ref", "-d", ref], { cwd }).catch(() => {});
  }
}

export async function ensureMirror({ git, repoUrl, mirrorDir, cwd }) {
  await mkdir(cwd, { recursive: true });
  if (existsSync(path.join(mirrorDir, "HEAD"))) {
    await git.run(["--git-dir", mirrorDir, "config", "remote.origin.fetch", SPEC_REFSPEC], { cwd });
    await git.run(["--git-dir", mirrorDir, "fetch", "--prune", "origin", SPEC_REFSPEC], { cwd });
    await pruneNonSpecRefs({ git, mirrorDir, cwd });
    return { created: false };
  }
  await git.run(["init", "--bare", mirrorDir], { cwd });
  await git.run(["--git-dir", mirrorDir, "remote", "add", "origin", repoUrl], { cwd });
  await git.run(["--git-dir", mirrorDir, "config", "remote.origin.fetch", SPEC_REFSPEC], { cwd });
  await git.run(["--git-dir", mirrorDir, "fetch", "origin", SPEC_REFSPEC], { cwd });
  return { created: true };
}

export async function ensureWorktree({ git, mirrorDir, worktreeDir, branch, startPoint = null, cwd }) {
  await mkdir(cwd, { recursive: true });
  if (existsSync(path.join(worktreeDir, ".git"))) {
    const current = (await git.run(["-C", worktreeDir, "rev-parse", "--abbrev-ref", "HEAD"], { cwd })).stdout.trim();
    if (current === branch) {
      // The mirror ref may have moved (fetch in another process); the working
      // tree must match its own branch tip before any read or write.
      await git.run(["-C", worktreeDir, "reset", "--hard"], { cwd });
      return { reused: true };
    }
    await removeWorktree({ git, mirrorDir, worktreeDir, cwd });
  }
  const local = await git.run(["--git-dir", mirrorDir, "rev-parse", "--verify", `refs/heads/${branch}`], { cwd }).catch(() => null);
  if (local !== null) {
    await git.run(["--git-dir", mirrorDir, "worktree", "add", "--force", worktreeDir, branch], { cwd });
    return { reused: false };
  }
  const remote = await git.run(["--git-dir", mirrorDir, "rev-parse", "--verify", `refs/remotes/origin/${branch}`], { cwd }).catch(() => null);
  if (remote === null) {
    if (startPoint === null) throw new Error(`branch ${branch} does not exist in ${mirrorDir}`);
    await git.run(["--git-dir", mirrorDir, "worktree", "add", "--force", "-b", branch, worktreeDir, startPoint], { cwd });
  } else {
    await git.run(["--git-dir", mirrorDir, "worktree", "add", "--force", "-b", branch, worktreeDir, `refs/remotes/origin/${branch}`], { cwd });
  }
  return { reused: false };
}

export async function removeWorktree({ git, mirrorDir, worktreeDir, cwd }) {
  if (!existsSync(worktreeDir)) return { removed: false };
  try {
    await git.run(["--git-dir", mirrorDir, "worktree", "remove", "--force", worktreeDir], { cwd });
  } catch {
    // A crashed worktree can be missing from the mirror's metadata; remove the
    // directory directly, with Windows retries, and let the next add repair it.
    await rm(worktreeDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
  return { removed: true };
}

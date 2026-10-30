/**
 * Per-spec checkouts: one bare mirror per repository, one worktree per spec
 * branch. A worktree shares the mirror's object store, so nine specs do not
 * duplicate a large code repository, and two spec branches never fight over a
 * checked-out branch in a shared clone.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

export async function ensureMirror({ git, repoUrl, mirrorDir, cwd }) {
  await mkdir(cwd, { recursive: true });
  if (existsSync(path.join(mirrorDir, "HEAD"))) {
    await git.run(["--git-dir", mirrorDir, "fetch", "--prune", "origin"], { cwd });
    return { created: false };
  }
  await git.run(["clone", "--bare", repoUrl, mirrorDir], { cwd });
  return { created: true };
}

export async function ensureWorktree({ git, mirrorDir, worktreeDir, branch, cwd }) {
  await mkdir(cwd, { recursive: true });
  if (existsSync(path.join(worktreeDir, ".git"))) {
    const current = (await git.run(["-C", worktreeDir, "rev-parse", "--abbrev-ref", "HEAD"], { cwd })).stdout.trim();
    if (current === branch) return { reused: true };
    await removeWorktree({ git, mirrorDir, worktreeDir, cwd });
  }
  await git.run(["--git-dir", mirrorDir, "worktree", "add", "--force", worktreeDir, branch], { cwd });
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

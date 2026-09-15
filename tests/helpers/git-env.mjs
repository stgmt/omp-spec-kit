/**
 * Test isolation guard.
 *
 * git runs a pre-commit hook with `GIT_DIR` / `GIT_INDEX_FILE` set, and those
 * variables override both `cwd` and `-C` in every descendant process. A test
 * run started from a hook (the review kit runs this suite) would therefore
 * commit into the *product* worktree instead of its own temporary
 * repositories — observed live: a hook-driven run left `seed` and
 * `chore: init scope` commits on the checked-out branch.
 *
 * Clearing them once per test process makes every suite correct regardless of
 * who started it.
 */
const HOOK_GIT_VARS = Object.freeze([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
]);

export function isolateGitEnvironment(env = process.env) {
  const cleared = [];
  for (const key of HOOK_GIT_VARS) {
    if (env[key] !== undefined) {
      delete env[key];
      cleared.push(key);
    }
  }
  return cleared;
}

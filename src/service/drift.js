/**
 * Drift report (FR-10): divergence between the clone and the remote —
 * clone-ahead-of-remote states and non-bot commits on the branch.
 */
export async function computeDrift({ git, branch, identity, cwd, headRef = "HEAD", remoteRef = `origin/${branch}`, detectedAt = new Date().toISOString() }) {
  const ahead = await git.logDetailed({ range: `${remoteRef}..${headRef}`, cwd }).catch(() => []);
  const recent = await git.logDetailed({ range: remoteRef, maxCount: 50, cwd }).catch(() => []);
  const events = [];
  for (const commit of ahead) {
    events.push({ kind: "clone-ahead-of-remote", commit: commit.hash, author: commit.authorName, divergentPaths: commit.paths, detectedAt });
  }
  for (const commit of recent) {
    if (commit.authorName === identity.name) continue;
    if (ahead.some((entry) => entry.hash === commit.hash)) continue;
    events.push({ kind: "non-bot-commit", commit: commit.hash, author: commit.authorName, divergentPaths: commit.paths, detectedAt });
  }
  return { events, branch };
}

/**
 * A worktree is the authoritative copy of a spec branch, but the bare mirror's
 * refs cannot show an already-committed local change that has not been pushed.
 * Report those commits explicitly so `/drift` remains complete.
 */
export async function worktreeDrift({ git, cwd, project, spec, branch, remoteRef, detectedAt = new Date().toISOString() }) {
  const localRef = `refs/heads/work/${branch}`;
  const local = await git.revParse(localRef, { cwd }).catch(() => null);
  if (!local) return [];
  const commits = await git.logDetailed({ range: `${remoteRef}..${localRef}`, cwd }).catch(() => []);
  return commits.map((commit) => ({
    kind: "clone-ahead-of-remote",
    commit: commit.hash,
    author: commit.authorName,
    divergentPaths: commit.paths,
    project,
    spec,
    detectedAt,
  }));
}

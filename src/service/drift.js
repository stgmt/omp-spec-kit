/**
 * Drift report (FR-10): divergence between the clone and the remote —
 * clone-ahead-of-remote states and non-bot commits on the branch.
 */
export async function computeDrift({ git, branch, identity, cwd, detectedAt = new Date().toISOString() }) {
  const remoteRef = `origin/${branch}`;
  const ahead = await git.logDetailed({ range: `${remoteRef}..HEAD`, cwd }).catch(() => []);
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

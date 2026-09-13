import { computeDrift } from "./drift.js";

/**
 * Periodic fetch + reconcile (FR-10): fetch the specs repo on an interval;
 * fast-forward the clone when only the remote moved; report drift otherwise.
 * Reconciles coalesce: an interval shorter than one reconcile must not pile
 * up git work behind the queue.
 */
export function startSync({ mounts, git, branch, identity, cwd, intervalMs = 30_000, logger = () => {} }) {
  async function reconcileOnce() {
    await git.fetch({ cwd });
    const behind = await git.revCount(`HEAD..origin/${branch}`, { cwd });
    const aheadCount = await git.revCount(`origin/${branch}..HEAD`, { cwd });
    if (behind > 0 && aheadCount === 0) {
      await git.mergeFF(`origin/${branch}`, { cwd });
      for (const projectId of mounts.projects) {
        mounts.serviceFor(projectId).refresh();
      }
      logger(`sync: fast-forwarded to origin/${branch}`);
    }
    return computeDrift({ git, branch, identity, cwd });
  }

  let inFlight = null;
  const runReconcile = () => {
    if (inFlight) return inFlight;
    inFlight = reconcileOnce()
      .catch((error) => {
        logger(`sync failed: ${error.message}`);
        return { events: [], branch };
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const timer = setInterval(runReconcile, intervalMs);
  timer.unref?.();
  return { reconcile: runReconcile, stop: () => clearInterval(timer) };
}

import { computeDrift } from "./drift.js";

/**
 * Reconcile the clone with the remote (FR-5/FR-10/FR-16): fetch, fast-forward
 * when only the remote moved, and replay local commits — skeleton creation, a
 * write whose push was rejected — on top of the remote when both sides moved.
 * A break-glass push or an out-of-band seed therefore never leaves the clone
 * stuck ahead of the remote with every subsequent push rejected.
 */
export async function reconcileClone({ git, cwd, branch, identity, logger = () => {} }) {
  await git.fetch({ cwd });
  // A freshly provisioned specs repo has an unborn HEAD (no origin/<branch>
  // yet): the clone has nothing to reconcile against.
  const remoteRef = await git.revParse(`origin/${branch}`, { cwd }).catch(() => null);
  if (!remoteRef) return { moved: false, behind: 0, ahead: 0, unborn: true };
  const behind = await git.revCount(`HEAD..origin/${branch}`, { cwd });
  if (behind === 0) return { moved: false, behind: 0, ahead: 0 };
  const ahead = await git.revCount(`origin/${branch}..HEAD`, { cwd });
  if (ahead === 0) {
    await git.mergeFF(`origin/${branch}`, { cwd });
    logger(`reconciled: fast-forwarded ${behind} commit(s) to origin/${branch}`);
    return { moved: true, behind, ahead: 0, fastForward: true };
  }
  try {
    await git.rebaseOnto(`origin/${branch}`, { cwd, identity });
  } catch (error) {
    // A conflicting replay means the remote moved under the clone's feet
    // (break-glass rewrite). Never drop the local commit and never fail boot:
    // the clone stays ahead and /drift reports the divergence.
    await git.rebaseAbort({ cwd });
    logger(
      `reconcile: ${branch} diverged from origin/${branch} and could not be replayed (${String(error.message).split("\n")[0]}); clone stays ahead, drift reports it`,
    );
    return { moved: false, behind, ahead, conflicted: true };
  }
  logger(`reconciled: replayed ${ahead} local commit(s) over ${behind} remote commit(s) on ${branch}`);
  return { moved: true, behind, ahead, fastForward: false };
}

/**
 * Periodic fetch + reconcile (FR-10): fetch every mounted specs repo on an
 * interval; fast-forward a clone when only its remote moved; report drift
 * otherwise. Reconciles coalesce: an interval shorter than one reconcile must
 * not pile up git work behind the queue.
 */
export function startSync({ mounts, identity, intervalMs = 30_000, logger = () => {}, afterReconcile = null }) {
  async function reconcileOnce() {
    let anyMoved = false;
    const events = [];
    for (const mount of mounts.activeMounts()) {
      // Each mounted repo is independent: an unreachable or deleted bound
      // repo must surface as drift, not take the whole sync pass down.
      try {
        const { moved } = await reconcileClone({ git: mount.git, cwd: mount.cwd, branch: mount.branch, identity, logger });
        anyMoved = anyMoved || moved;
        const drift = await computeDrift({ git: mount.git, branch: mount.branch, identity, cwd: mount.cwd });
        for (const event of drift.events) events.push({ ...event, repo: mount.repoUrl });
      } catch (error) {
        events.push({ kind: "repo-unreachable", repo: mount.repoUrl, detail: String(error?.message ?? error).split("\n")[0], detectedAt: new Date().toISOString() });
        logger(`sync: ${mount.repoUrl} unreachable: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    if (anyMoved) {
      for (const projectId of mounts.projects) {
        // An external-tenant project without a repo binding has no service —
        // skip it rather than wedging the whole reconcile pass.
        try { mounts.serviceFor(projectId).refresh(); } catch {}
      }
      // Accepted remote commits may carry ACTIVE transitions — publish them.
      await afterReconcile?.().catch((error) => logger(`publish after reconcile failed: ${error.message}`));
    }
    return { events };
  }

  let inFlight = null;
  const runReconcile = () => {
    if (inFlight) return inFlight;
    inFlight = reconcileOnce()
      .catch((error) => {
        logger(`sync failed: ${error.message}`);
        return { events: [] };
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

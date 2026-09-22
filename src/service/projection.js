import {
  PROJECTION_VERSION,
  YouTrackProjectionService,
  buildProjectionPlan,
  digest,
} from "../adapters/youtrack-projection.js";
import {
  YouTrackClient,
  YouTrackProjectionStore,
  YouTrackSyncStateStore,
} from "../adapters/youtrack-store.js";

/**
 * Service-side YouTrack projection: the committed spec corpus is mirrored into
 * the tracker without any manual sync run. Triggers:
 *   - post-commit (writepath): a confirmed push re-projects immediately;
 *   - reconcile-move (sync loop): an out-of-band/break-glass push re-projects
 *     on the next interval tick.
 *
 * Both paths funnel through one serialized loop — syncs never overlap, and a
 * trigger arriving mid-sync just marks the projection dirty for one re-run.
 * Projection is post-confirmation work like publish: failures are logged,
 * never thrown back into a write or a reconcile pass.
 *
 * The cheap no-op path reads only the committed pointer (one tracker page):
 * when fingerprint + snapshotHash + projectionVersion all match, no board is
 * built and no projection is read. A projectionVersion bump therefore forces
 * one rewrite after a code upgrade even on unchanged content.
 */
export function createProjection({ mounts, baseUrl, serviceToken, projectShortName, markerSecret, logger = () => {} }) {
  const client = new YouTrackClient({ host: baseUrl, token: serviceToken });
  let trackerProjectId = null;

  async function resolveTrackerProject() {
    if (trackerProjectId) return trackerProjectId;
    const rows = await client.get("/api/admin/projects?fields=id,shortName");
    const row = (Array.isArray(rows) ? rows : []).find((p) => p.shortName === projectShortName);
    if (!row) throw new Error(`projection: YouTrack project ${projectShortName} not found`);
    trackerProjectId = row.id;
    return trackerProjectId;
  }

  // One board per configured project, merged into a single projection surface:
  // the tracker project holds cards for every spec regardless of which mount
  // served it, and the snapshot fingerprint aggregates per-board fingerprints
  // so any mount's content move flips it.
  async function mergedBoard() {
    const nodes = [];
    const edges = [];
    const fingerprints = [];
    const specSlugs = [];
    for (const projectId of mounts.projects) {
      let service;
      try {
        service = mounts.serviceFor(projectId);
      } catch (error) {
        // An IdP-scoped project without a repo binding owns no specs — its
        // absence must not kill the projection for every bound project.
        if (error?.code === "REPO_BINDING_REQUIRED") continue;
        throw error;
      }
      const envelope = await service.runQuery("graph", { view: "board", specSlugs: [] });
      if (!envelope?.ok) {
        throw new Error(`board read failed for ${projectId}: ${envelope?.error?.message ?? "no envelope"}`);
      }
      const board = envelope.data;
      nodes.push(...board.nodes);
      edges.push(...board.edges);
      fingerprints.push(board.fingerprint);
      for (const slug of board.scope?.specSlugs ?? []) specSlugs.push(slug);
    }
    fingerprints.sort();
    specSlugs.sort();
    return {
      fingerprint: digest({ boards: fingerprints }),
      scope: { mode: "corpus", specSlugs },
      complete: true,
      page: null,
      nodes,
      edges,
      counts: { nodes: nodes.length, edges: edges.length },
    };
  }

  let running = false;
  let dirty = false;
  let chain = Promise.resolve();

  async function doSync() {
    const syncState = new YouTrackSyncStateStore({
      client,
      projectId: await resolveTrackerProject(),
      projectShortName,
      markerSecret,
    });
    const pointer = await syncState.readCommitted();
    const board = await mergedBoard();
    const plan = buildProjectionPlan(board);
    const fresh =
      pointer.valid === true &&
      pointer.fingerprint === plan.fingerprint &&
      pointer.snapshotHash === plan.snapshotHash &&
      pointer.projectionDigest === plan.projectionDigest &&
      pointer.projectionVersion === PROJECTION_VERSION;
    if (fresh) {
      logger("projection: committed snapshot is current, skipping");
      return { outcome: "SKIPPED", fingerprint: board.fingerprint, writeCalls: 0 };
    }
    const tracker = new YouTrackProjectionStore({
      client,
      projectId: trackerProjectId,
      projectShortName,
    });
    const service = new YouTrackProjectionService({
      sourceReader: { readBoard: async () => board },
      tracker,
      syncState,
    });
    const result = await service.sync({ log: logger });
    logger(`projection: ${result.outcome} fingerprint=${result.fingerprint?.slice(0, 12)} writeCalls=${result.writeCalls}`);
    return result;
  }

  async function runLoop() {
    while (dirty) {
      dirty = false;
      try {
        await doSync();
      } catch (error) {
        logger(`projection sync failed: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    running = false;
  }

  /** Fire-and-forget trigger: marks the projection dirty and schedules a run. */
  function syncNow() {
    dirty = true;
    if (!running) {
      running = true;
      chain = chain.then(runLoop, runLoop);
    }
  }

  return {
    syncNow,
    /** Awaitable variant for tests and explicit admin calls. */
    async syncOnce() {
      syncNow();
      await chain;
    },
  };
}

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
 *   - repo bind/unbind/migration: a pushed skeleton or copied corpus re-projects;
 *   - reconcile-move (sync loop): an out-of-band/break-glass push re-projects
 *     on the next interval tick;
 *   - boot: covers downtime plus projectionVersion upgrades.
 *
 * Both paths funnel through one serialized loop — syncs never overlap, and a
 * trigger arriving mid-sync just marks the projection dirty for one re-run.
 * Projection is post-confirmation work like publish: failures are logged,
 * never thrown back into a write or a reconcile pass.
 *
 * Single writer: there is no cross-process lock — running more than one
 * service replica with projection enabled can double-create cards and wedge
 * the projection on duplicate SpecId. Keep one replica or the flag off.
 *
 * Two-tier freshness check:
 *   - cheap path: the committed pointer (one filtered tracker page) plus
 *     per-mount `git rev-parse HEAD`/`status --porcelain`. Spec content only
 *     changes through a commit (writepath, reconcile replay, bind/migration
 *     push) or an uncommitted edit — equal HEADs on clean trees prove the
 *     merged board is identical, so no board is built at all;
 *   - exact path: the merged board fingerprint + snapshotHash +
 *     projectionDigest + projectionVersion must all match the pointer (a
 *     projectionVersion bump forces one rewrite on unchanged content).
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
  // so any mount's content move flips it. mountHeads/specProjects/skippedProjects
  // are recorded alongside so the cheap path and the writeback listener can
  // reason about the same layout without rebuilding the board.
  async function mergedBoard() {
    const nodes = [];
    const edges = [];
    const fingerprints = [];
    const specSlugs = [];
    // Null-prototype maps: spec slugs like "constructor"/"__proto__" are legal
    // (SPEC_SLUG_RE allows them) and must not collide with Object.prototype
    // members on the ownership/routing checks below.
    const mountHeads = Object.create(null);
    const specProjects = Object.create(null);
    const skippedProjects = [];
    const nodeProjects = new Map();
    let mountsClean = true;
    for (const projectId of mounts.projects) {
      let service;
      try {
        service = mounts.serviceFor(projectId);
      } catch (error) {
        // An IdP-scoped project without a repo binding owns no specs — its
        // absence must not kill the projection for every bound project.
        if (error?.code === "REPO_BINDING_REQUIRED") {
          skippedProjects.push(projectId);
          continue;
        }
        throw error;
      }
      const mount = mounts.for(projectId);
      const headBefore = await mount.git.revParse("HEAD", { cwd: mount.cwd });
      const envelope = await service.runQuery("graph", { view: "board", specSlugs: [] });
      if (!envelope?.ok) {
        throw new Error(`board read failed for ${projectId}: ${envelope?.error?.message ?? "no envelope"}`);
      }
      const board = envelope.data;
      for (const node of board.nodes) {
        // The same canonicalId from two mounts would wedge the sync on
        // "duplicate node identity" later — name the colliding projects here
        // so the operator sees who serves the duplicated slug.
        const seen = nodeProjects.get(node.canonicalId);
        if (seen !== undefined && seen !== projectId) {
          throw new Error(`duplicate spec node ${node.canonicalId} is served by both ${seen} and ${projectId}`);
        }
        nodeProjects.set(node.canonicalId, projectId);
      }
      nodes.push(...board.nodes);
      edges.push(...board.edges);
      fingerprints.push(board.fingerprint);
      for (const slug of board.scope?.specSlugs ?? []) {
        // A slug claimed by two mounts makes writeback routing ambiguous:
        // specProjects would silently keep whichever mount iterated first.
        const owner = specProjects[slug];
        if (owner !== undefined && owner !== projectId) {
          throw new Error(`spec ${slug} is served by both ${owner} and ${projectId}`);
        }
        specSlugs.push(slug);
        specProjects[slug] = projectId;
      }
      // HEAD is sampled BEFORE and AFTER the board read: a writepath push or
      // reconcile landing between them would otherwise record a HEAD newer
      // than the board that was actually read — and cheapCheck would certify
      // the unseen content on every later sync.
      const headAfter = await mount.git.revParse("HEAD", { cwd: mount.cwd });
      if (headAfter !== headBefore) {
        throw new Error(`mount ${projectId} moved mid-read (${headBefore} -> ${headAfter})`);
      }
      mountHeads[projectId] = headBefore;
      if ((await mount.git.statusPorcelain({ cwd: mount.cwd })).trim() !== "") mountsClean = false;
    }
    fingerprints.sort();
    specSlugs.sort();
    skippedProjects.sort();
    return {
      fingerprint: digest({ boards: fingerprints }),
      scope: { mode: "corpus", specSlugs },
      complete: true,
      page: null,
      nodes,
      edges,
      counts: { nodes: nodes.length, edges: edges.length },
      mountHeads,
      mountsClean,
      specProjects,
      skippedProjects,
    };
  }

  /**
   * Cheap staleness check: pointer plus per-mount git state only. Returns
   * true only when the committed marker is a v3 pointer whose recorded HEADs
   * and skipped-project set still match a clean live set — anything else
   * (missing fields, dirty clone, bind/unbind, git error) falls through to
   * the full path, which reports the real problem.
   */
  async function cheapCheck(pointer) {
    if (pointer.valid !== true) return false;
    if (pointer.projectionVersion !== PROJECTION_VERSION) return false;
    if (pointer.mountsClean !== true || !pointer.mountHeads || typeof pointer.mountHeads !== "object") return false;
    const recorded = pointer.mountHeads;
    const recordedSkipped = Array.isArray(pointer.skippedProjects) ? [...pointer.skippedProjects].sort() : [];
    const servedNow = [];
    const skippedNow = [];
    try {
      for (const projectId of mounts.projects) {
        let mount;
        try {
          mount = mounts.for(projectId);
        } catch (error) {
          if (error?.code !== "REPO_BINDING_REQUIRED") throw error;
          skippedNow.push(projectId);
          continue;
        }
        servedNow.push(projectId);
        if (recorded[projectId] !== await mount.git.revParse("HEAD", { cwd: mount.cwd })) return false;
        if ((await mount.git.statusPorcelain({ cwd: mount.cwd })).trim() !== "") return false;
      }
    } catch {
      return false;
    }
    if (servedNow.length !== Object.keys(recorded).length) return false;
    skippedNow.sort();
    return skippedNow.join("") === recordedSkipped.join("");
  }

  let running = false;
  let dirty = false;
  let chain = Promise.resolve();
  let lastResult = null;

  async function doSync() {
    try {
      const syncState = new YouTrackSyncStateStore({
        client,
        projectId: await resolveTrackerProject(),
        projectShortName,
        markerSecret,
      });
      const pointer = await syncState.readCommitted();
      if (await cheapCheck(pointer)) {
        logger("projection: mounts unchanged since committed snapshot, skipping");
        return { outcome: "SKIPPED", fingerprint: pointer.fingerprint, writeCalls: 0 };
      }
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
    } catch (error) {
      // A deleted/recreated tracker project invalidates the cached id —
      // clear it so the next trigger re-resolves instead of wedging on 404s.
      if (String(error?.message ?? error).includes("=> 404")) trackerProjectId = null;
      throw error;
    }
  }

  async function runLoop() {
    while (dirty) {
      dirty = false;
      try {
        const result = await doSync();
        lastResult = {
          at: new Date().toISOString(),
          ok: true,
          outcome: result.outcome,
          fingerprint: result.fingerprint ?? null,
          writeCalls: result.writeCalls ?? 0,
        };
      } catch (error) {
        lastResult = { at: new Date().toISOString(), ok: false, error: String(error?.message ?? error).split("\n")[0] };
        logger(`projection sync failed: ${lastResult.error}`);
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
    /** Live state for ops endpoints: last outcome, queue flags, last error. */
    status() {
      return { running, dirty, last: lastResult };
    },
  };
}

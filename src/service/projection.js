import {
  MARKER_SCHEMA_VERSION,
  PROJECTION_VERSION,
  YouTrackProjectionService,
  buildProjectionPlan,
  cardKey,
  digest,
} from "../adapters/youtrack-projection.js";
import {
  YouTrackClient,
  YouTrackProjectionStore,
  YouTrackSyncStateStore,
} from "../adapters/youtrack-store.js";

async function projectHead(mounts, projectId) {
  if (typeof mounts.projectHead === "function") return mounts.projectHead(projectId);
  // Test fakes predate the multi-branch model: keep their single-mount HEAD
  // contract, including a dirty tree marker.
  const mount = mounts.for(projectId);
  const head = await mount.git.revParse("HEAD", { cwd: mount.cwd });
  let dirty = "";
  try { dirty = await mount.git.statusPorcelain?.({ cwd: mount.cwd }) ?? ""; } catch {}
  return dirty.trim() === "" ? head : `${head}:dirty`;
}

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
  // so any mount's content move flips it. mountHeads/skippedProjects are
  // recorded alongside so the cheap path can reason about the same layout
  // without rebuilding the board; per-node project tags carry ownership.
  async function mergedBoard() {
    const nodes = [];
    const edges = [];
    const fingerprints = [];
    const slugOwners = new Map();
    const slugs = [];
    // Null-prototype maps: spec slugs like "constructor"/"__proto__" are legal
    // (SPEC_SLUG_RE allows them) and must not collide with Object.prototype
    // members on the ownership checks below.
    const mountHeads = Object.create(null);
    // specProjects removed: flat slug-to-project routing map deleted (see v8).
    // Identity is qualified at the shared boundary as (project, canonicalId).
    const projectBoards = Object.create(null);
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
      const headBefore = await projectHead(mounts, projectId);
      if (headBefore.endsWith(":dirty")) mountsClean = false;
      const envelope = await service.runQuery("graph", { view: "board", specSlugs: [] });
      if (!envelope?.ok) {
        throw new Error(`board read failed for ${projectId}: ${envelope?.error?.message ?? "no envelope"}`);
      }
      const board = envelope.data;
      // Keep each project's board for the per-project committed pointers. The
      // aggregate below stays the All-projects view; these boards are the
      // projection units that map to SPEC:SYNC-STATE:<project>.
      projectBoards[projectId] = board;
      for (const node of board.nodes) {
        // Same-project duplicate internal identity is still a defect: two nodes
        // with one canonicalId inside one corpus cannot both own the same card.
        // The key is project-qualified, so the same canonicalId served by two
        // different projects is legal and both are kept on the aggregate.
        const key = cardKey(projectId, node.canonicalId);
        const seen = nodeProjects.get(key);
        if (seen !== undefined) {
          throw new Error(`duplicate spec node ${node.canonicalId} is served by both ${seen} and ${projectId}`);
        }
        nodeProjects.set(key, projectId);
      }
      // Project is part of every aggregate entry: the tracker boundary keys a
      // card by project + canonicalId, and spec-local ids stay untouched.
      nodes.push(...board.nodes.map((node) => ({ ...node, project: projectId })));
      edges.push(...board.edges.map((edge) => ({ ...edge, project: projectId })));
      fingerprints.push(board.fingerprint);
      for (const slug of board.scope?.specSlugs ?? []) {
        // Same-project duplicate slug is still a defect (one corpus cannot
        // claim a slug twice); two projects using the same slug coexist.
        const key = cardKey(projectId, slug);
        const owner = slugOwners.get(key);
        if (owner !== undefined) {
          throw new Error(`spec ${slug} is served by both ${owner} and ${projectId}`);
        }
        slugOwners.set(key, projectId);
        slugs.push(slug);
      }
      // HEAD is sampled BEFORE and AFTER the board read: a writepath push or
      // reconcile landing between them would otherwise record a HEAD newer
      // than the board that was actually read — and cheapCheck would certify
      // the unseen content on every later sync.
      const headAfter = await projectHead(mounts, projectId);
      if (headAfter !== headBefore) {
        throw new Error(`mount ${projectId} moved mid-read (${headBefore} -> ${headAfter})`);
      }
      mountHeads[projectId] = headBefore;
    }
    fingerprints.sort();
    skippedProjects.sort();
    // Scope lists each served slug once; project ownership is carried per node
    // and per card key, so a slug shared by two projects is not "unassigned".
    const uniqueSlugs = [...new Set(slugs)].sort();
    return {
      fingerprint: digest({ boards: fingerprints }),
      scope: { mode: "corpus", specSlugs: uniqueSlugs },
      complete: true,
      page: null,
      nodes,
      edges,
      counts: { nodes: nodes.length, edges: edges.length },
      mountHeads,
      mountsClean,
      projectBoards,
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
    // A pointer committed under an older marker schema is authentic but not
    // what the in-tracker views read: republish instead of certifying it.
    if (pointer.schemaVersion !== MARKER_SCHEMA_VERSION) return false;
    // A partial marker carries the same fingerprint/heads but certifies
    // failed writes — never let it satisfy a skip.
    if (pointer.complete !== true) return false;
    if (pointer.projectIndexComplete !== true) return false;
    if (pointer.projectionVersion !== PROJECTION_VERSION) return false;
    if (pointer.mountsClean !== true || !pointer.mountHeads || typeof pointer.mountHeads !== "object") return false;
    const recorded = pointer.mountHeads;
    const recordedSkipped = Array.isArray(pointer.skippedProjects) ? [...pointer.skippedProjects].sort() : [];
    const servedNow = [];
    const skippedNow = [];
    try {
      for (const projectId of mounts.projects) {
        let head;
        try {
          head = await projectHead(mounts, projectId);
        } catch (error) {
          if (error?.code !== "REPO_BINDING_REQUIRED") throw error;
          skippedNow.push(projectId);
          continue;
        }
        servedNow.push(projectId);
        if (head.endsWith(":dirty")) return false;
        if (recorded[projectId] !== head) return false;
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
        pointer.complete === true &&
        pointer.schemaVersion === MARKER_SCHEMA_VERSION &&
        pointer.fingerprint === plan.fingerprint &&
        pointer.snapshotHash === plan.snapshotHash &&
        pointer.projectionDigest === plan.projectionDigest &&
        pointer.projectionVersion === PROJECTION_VERSION &&
        pointer.projectIndexComplete === true &&
        Array.isArray(pointer.projects);
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
      return {
        ...result,
        // Diagnostics for the per-project pointer publication: the projection
        // units this run built from the mounts. Every served node carries its
        // project, so the aggregate has no unassigned bucket.
        projects: Object.keys(board.projectBoards).sort(),
      };
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
          // PARTIAL means tracker writes failed and the pointer was published
          // complete:false — surface it as not-ok so ops notice the drift.
          ok: result.outcome !== "PARTIAL",
          outcome: result.outcome,
          fingerprint: result.fingerprint ?? null,
          writeCalls: result.writeCalls ?? 0,
          projects: result.projects ?? null,
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

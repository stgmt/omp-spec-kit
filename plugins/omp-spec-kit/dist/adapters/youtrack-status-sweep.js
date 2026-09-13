import { STATUS_MAP, specStatusForTrackerState } from "./youtrack-projection.js";

/**
 * Guaranteed-delivery reconciliation for tracker->spec TASK status.
 *
 * Three-way merge per TASK card against the committed BoardSnapshotV1:
 *   - spec unchanged since the committed snapshot and tracker differs from
 *     that snapshot -> the change happened in the tracker while the listener
 *     was down or a callback failed -> replay through spec_patch.
 *   - spec changed since the snapshot -> .specs wins; the next projection
 *     pushes the spec status back to the tracker.
 *   - both diverged -> .specs wins (AC-8.1); the conflict is logged.
 *   - no snapshot baseline for the node -> .specs wins; never let a stale
 *     tracker row rewrite a node that was never committed.
 *
 * Pure planning lives in planStatusSweep; StatusSweepService drives the ports.
 * planCardWriteback is the single-card form of the same three-way merge, used
 * by the live writeback listener so an event and a sweep decide identically.
 */
export function planCardWriteback({ specId, specStatus, trackerStatus, hasBaseline, snapshotStatus }) {
  if (trackerStatus === null) return { action: "skip", reason: "unmapped tracker state" };
  if (trackerStatus === specStatus) return { action: "skip", reason: "tracker and spec already agree" };
  // A spec status the tracker cannot represent (in-progress, ready, blocked,
  // deferred, unknown, ...) projects lossily; writing the lossy read-back
  // back would regress .specs, so the spec always wins.
  if (!specStatus || !Object.prototype.hasOwnProperty.call(STATUS_MAP, specStatus)) {
    return { action: "skip", reason: "spec status not representable in tracker; spec wins", specStatus, trackerStatus };
  }
  if (!hasBaseline) return { action: "skip", reason: "no committed baseline; spec wins", specStatus, trackerStatus };
  if (specStatus !== snapshotStatus) {
    return trackerStatus === snapshotStatus
      ? { action: "skip", reason: "spec diverged from baseline; spec wins", specStatus, trackerStatus, snapshotStatus }
      : { action: "skip", reason: "both sides diverged; spec wins", specStatus, trackerStatus, snapshotStatus };
  }
  return { action: "patch", specId, status: trackerStatus };
}

export function planStatusSweep({ board, trackerCards, snapshot }) {
  const specTasks = new Map();
  for (const node of board?.nodes ?? []) {
    if (node?.kind === "TASK" && typeof node.canonicalId === "string") specTasks.set(node.canonicalId, node);
  }
  const baseline = new Map();
  for (const node of snapshot?.nodes ?? []) {
    if (node?.kind === "TASK" && typeof node.canonicalId === "string") baseline.set(node.canonicalId, node.taskStatus ?? null);
  }
  const plan = [];
  const warnings = [];
  for (const card of trackerCards ?? []) {
    const specId = card?.specId;
    if (!specId || !specTasks.has(specId)) continue;
    const trackerStatus = specStatusForTrackerState(card.state);
    const specStatus = specTasks.get(specId).taskStatus ?? null;
    if (trackerStatus === null) {
      warnings.push({ specId, reason: "unmapped tracker state", state: card.state });
      continue;
    }
    const hasBaseline = baseline.has(specId);
    const decision = planCardWriteback({
      specId,
      specStatus,
      trackerStatus,
      hasBaseline,
      snapshotStatus: baseline.get(specId) ?? null,
    });
    if (decision.action !== "patch") {
      if (decision.reason !== "tracker and spec already agree") {
        warnings.push({ specId, reason: decision.reason, specStatus: decision.specStatus, trackerStatus: decision.trackerStatus, snapshotStatus: decision.snapshotStatus });
      }
      continue;
    }
    plan.push({ specId, status: trackerStatus, fromState: card.state, issueId: card.issueId ?? null });
  }
  plan.sort((a, b) => a.specId.localeCompare(b.specId, undefined, { numeric: true }));
  return { plan, warnings };
}

export class StatusSweepService {
  #sourceReader;
  #tracker;
  #syncState;
  #writeback;

  constructor({ sourceReader, tracker, syncState, writeback }) {
    if (!sourceReader || !tracker || !syncState || !writeback) {
      throw new TypeError("status sweep requires sourceReader, tracker, syncState, and writeback ports");
    }
    this.#sourceReader = sourceReader;
    this.#tracker = tracker;
    this.#syncState = syncState;
    this.#writeback = writeback;
  }

  /**
   * Replays tracker-held TASK status into the spec corpus. Returns the applied
   * entries plus per-item failures so callers can retry on the next sweep;
   * failures never throw — a wedged patch must not kill the daemon.
   */
  async sweep({ log = () => {} } = {}) {
    const [board, committed, trackerCards] = await Promise.all([
      this.#sourceReader.readBoard({}),
      this.#syncState.readCommitted(),
      this.#tracker.listTaskCards(),
    ]);
    const snapshot = committed?.valid === true ? committed.snapshot : null;
    // Only cards the last committed snapshot owns may drive spec_patch — a
    // SpecId typed by hand on a foreign issue is not ownership proof.
    const cardIds = committed?.valid === true && committed.cardIds && typeof committed.cardIds === "object"
      ? committed.cardIds
      : {};
    const ownedCards = (trackerCards ?? []).filter((card) => {
      const ownedId = cardIds[card?.specId];
      return typeof ownedId === "string" && (ownedId === card?.idReadable || ownedId === card?.issueId);
    });
    const { plan, warnings } = planStatusSweep({ board, trackerCards: ownedCards, snapshot });
    for (const warning of warnings) log({ op: "sweep-skip", ...warning });
    const applied = [];
    const failed = [];
    for (const entry of plan) {
      try {
        await this.#writeback.setSpecTaskStatus({ specId: entry.specId, status: entry.status });
        applied.push(entry);
        log({ op: "sweep-apply", specId: entry.specId, status: entry.status });
      } catch (error) {
        failed.push({ ...entry, error: error instanceof Error ? error.message : String(error) });
        log({ op: "sweep-fail", specId: entry.specId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { applied, failed, skipped: warnings };
  }
}

/**
 * YouTrack REST stores for the spec projection — the tracker-side composition
 * shared by scripts/spec-graph-sync.mjs (manual/bootstrap path) and the
 * service-side auto projection (src/service/projection.js).
 *
 * Domain mapping (desired summaries/descriptions, link rules, parity) lives in
 * youtrack-projection.js; this module owns only transport + issue/link/state
 * persistence.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  SYNC_STATE_SPEC_ID,
  PROJECT_POINTER_PREFIX,
  UNASSIGNED_PROJECT_ID,
  projectPointerSpecId,
  LINK_TYPES,
  STATUS_MAP,
  desiredDescription,
  desiredSummary,
  fieldValue,
  linkEquivalenceKey,
  stableJson,
} from "./youtrack-projection.js";

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * YouTrack stores issue descriptions up to 512 000 characters and silently
 * truncates longer writes. The committed marker is the only copy of the board
 * snapshot the widgets can read, so an over-limit description is corruption,
 * not a warning: fail before the POST and leave the previous marker intact.
 * The 12 000-character margin keeps the guard honest for code-unit counting.
 */
export const MARKER_DESCRIPTION_LIMIT = 500_000;

export class YouTrackClient {
  #host;
  #token;
  #pass;
  #timeoutMs;

  constructor({ host, token, password, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    this.#host = host.replace(/\/+$/, "");
    this.#token = token;
    this.#pass = password;
    this.#timeoutMs = timeoutMs;
  }

  async request(method, apiPath, body) {
    // Every tracker call carries an explicit deadline: --serve serializes all
    // writeback/sweep work through one chain, so a wedged request would stall
    // the whole lane without it.
    const response = await fetch(this.#host + apiPath, {
      method,
      signal: AbortSignal.timeout(this.#timeoutMs),
      headers: {
        Authorization: this.#pass
          ? "Basic " + Buffer.from(this.#token + ":" + this.#pass).toString("base64")
          : "Bearer " + this.#token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) throw new Error(method + " " + apiPath + " => " + response.status + " " + text.slice(0, 200));
    return json;
  }

  get(apiPath) {
    return this.request("GET", apiPath);
  }

  post(apiPath, body) {
    return this.request("POST", apiPath, body);
  }

  delete(apiPath) {
    return this.request("DELETE", apiPath);
  }

  command(query, issueIds) {
    return this.post("/api/commands", {
      query,
      issues: issueIds.map((id) => ({ id })),
      silent: true,
    });
  }

  async listProjectIssues(projectShortName) {
    const issues = [];
    const pageSize = 1000;
    for (let skip = 0; ; skip += pageSize) {
      const page = await this.get(
        "/api/issues?query=project:%20" + encodeURIComponent(projectShortName) +
        "&fields=id,idReadable,summary,customFields(name,value(name,presentation,text)),description&$top=" + pageSize + "&$skip=" + skip,
      );
      const rows = Array.isArray(page) ? page : [];
      issues.push(...rows);
      if (rows.length < pageSize) return issues;
    }
  }
}

export class YouTrackProjectionStore {
  #client;
  #projectId;
  #projectShortName;
  #issues = [];
  #links = [];
  #fieldValueTypes = new Map();

  constructor({ client, projectId, projectShortName }) {
    this.#client = client;
    this.#projectId = projectId;
    this.#projectShortName = projectShortName;
  }

  async readProjection() {
    const fields = await this.#client.get(
      "/api/admin/projects/" + this.#projectId + "/customFields?fields=field(name,fieldType(valueType))",
    );
    this.#fieldValueTypes = new Map((fields ?? []).map((row) => [row.field?.name, row.field?.fieldType?.valueType]));
    this.#issues = await this.#client.listProjectIssues(this.#projectShortName);
    const byIssueId = new Map(this.#issues.map((issue) => [issue.id, issue]));
    const bySpecId = new Map();
    for (const issue of this.#issues) {
      const specId = fieldValue(issue, "SpecId");
      if (!specId || specId === SYNC_STATE_SPEC_ID) continue;
      if (bySpecId.has(specId)) throw new Error("duplicate SpecId: " + specId);
      bySpecId.set(specId, issue);
    }
    // Direction-aware read: each physical link is reported once per endpoint
    // (OUTWARD on the source issue, INWARD on the target issue). Records are
    // deduped by the physical (type, sourceIssue, targetIssue) triple so the
    // outward-side handle wins for deletion. Legacy undirected link types
    // report direction BOTH from both endpoints; those are deduped on the
    // unordered issue pair and recorded in issue-id order so a leftover
    // undirected link never counts as two opposing links.
    const links = [];
    const seen = new Set();
    for (const issue of bySpecId.values()) {
      const groups = await this.#client.get(
        "/api/issues/" + issue.id + "/links?fields=linkType(name),direction,issues(id)",
      );
      for (const group of groups ?? []) {
        const type = group.linkType?.name;
        if (!LINK_TYPES.includes(type)) continue;
        const direction = group.direction ?? "BOTH";
        for (const other of group.issues ?? []) {
          const otherIssue = byIssueId.get(other.id);
          const otherSpecId = otherIssue ? fieldValue(otherIssue, "SpecId") : "";
          if (!otherSpecId || otherSpecId === SYNC_STATE_SPEC_ID) continue;
          let sourceIssue;
          let targetIssue;
          let key;
          if (direction === "BOTH") {
            const ordered = [issue.id, otherIssue.id].sort();
            sourceIssue = ordered[0] === issue.id ? issue : otherIssue;
            targetIssue = ordered[0] === issue.id ? otherIssue : issue;
            key = type + "|" + ordered[0] + "|" + ordered[1];
          } else {
            sourceIssue = direction === "OUTWARD" ? issue : otherIssue;
            targetIssue = direction === "OUTWARD" ? otherIssue : issue;
            key = type + "|" + sourceIssue.id + "|" + targetIssue.id;
          }
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({
            type,
            source: fieldValue(sourceIssue, "SpecId"),
            target: fieldValue(targetIssue, "SpecId"),
            sourceIssueId: sourceIssue.id,
            targetIssueId: targetIssue.id,
          });
        }
      }
    }
    this.#links = links;
    return { issues: [...bySpecId.values()], links };
  }

  async #setFreeTextField(issueId, name, value, { log = () => {} } = {}) {
    const valueType = this.#fieldValueTypes.get(name);
    let customField;
    if (valueType === "text") {
      customField = { name, $type: "TextIssueCustomField", value: value ? { $type: "TextFieldValue", text: value } : null };
    } else if (valueType === "string") {
      customField = { name, $type: "SimpleIssueCustomField", value: value ? value : null };
    } else {
      log({ op: "field-skip", specId: issueId, field: name, reason: "unknown valueType " + String(valueType) });
      return false;
    }
    await this.#client.post("/api/issues/" + issueId + "?fields=id", { customFields: [customField] });
    return true;
  }

  #createCustomFields(wanted, { log = () => {} } = {}) {
    const fields = [];
    for (const [name, value] of [
      ["SpecKind", wanted.kind],
      ["Type", wanted.typeValue],
    ]) {
      if (value) fields.push({ name, $type: "SingleEnumIssueCustomField", value: { name: value } });
    }
    for (const [name, value] of [
      ["SpecId", wanted.specId],
      ["ContentHash", wanted.contentHash],
      ["Evidence", wanted.evidence ?? ""],
    ]) {
      const valueType = this.#fieldValueTypes.get(name);
      if (value === undefined || value === "") continue;
      if (valueType === "text") {
        fields.push({ name, $type: "TextIssueCustomField", value: { $type: "TextFieldValue", text: value } });
      } else if (valueType === "string" || !valueType) {
        fields.push({ name, $type: "SimpleIssueCustomField", value });
      } else {
        log({ op: "field-skip", specId: wanted.specId, field: name, reason: "unknown valueType " + String(valueType) });
      }
    }
    return fields;
  }

  async upsertCards(wantedIssues, { log = () => {} } = {}) {
    const bySpecId = new Map();
    for (const issue of this.#issues) {
      const specId = fieldValue(issue, "SpecId");
      if (specId && specId !== SYNC_STATE_SPEC_ID) bySpecId.set(specId, issue);
    }
    let writeCalls = 0;
    const cardIds = {};
    // One bad card must not abort the whole sync: failures are collected and
    // reported, the failed specId never enters cardIds, and the next run's
    // parity check retries it. Its links are skipped downstream with a log.
    const failures = [];
    for (const wanted of wantedIssues) {
      try {
        writeCalls += await this.#upsertOneCard(wanted, bySpecId, cardIds, { log });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ specId: wanted.specId, error: message });
        log({ op: "card-fail", specId: wanted.specId, error: message });
      }
    }
    return { writeCalls, cardIds, failures };
  }

  async #upsertOneCard(wanted, bySpecId, cardIds, { log }) {
    let writeCalls = 0;
    let existing = bySpecId.get(wanted.specId);
      if (existing?.idReadable || existing?.id) cardIds[wanted.specId] = existing.idReadable ?? existing.id;
      if (!existing) {
        existing = await this.#client.post("/api/issues?fields=id,idReadable", {
          project: { id: this.#projectId },
          summary: desiredSummary(wanted),
          description: desiredDescription(wanted),
          customFields: this.#createCustomFields(wanted, { log }),
        });
        writeCalls += 1;
        log({ op: "create", specId: wanted.specId, issue: existing.idReadable });
        const state = wanted.status ? STATUS_MAP[wanted.status] : "Submitted";
        const record = {
          ...existing,
          summary: desiredSummary(wanted),
          description: desiredDescription(wanted),
          customFields: [
            { name: "SpecId", value: wanted.specId },
            { name: "SpecKind", value: { name: wanted.kind } },
            { name: "Type", value: { name: wanted.typeValue } },
            { name: "ContentHash", value: wanted.contentHash },
            { name: "Evidence", value: wanted.evidence || null },
            { name: "State", value: { name: state } },
          ],
        };
        bySpecId.set(wanted.specId, record);
        this.#issues.push(record);
        if (state !== "Submitted") {
          await this.#client.command("State " + state, [existing.id]);
          writeCalls += 1;
        }
        cardIds[wanted.specId] = existing.idReadable ?? existing.id;
        return writeCalls;
      }
      cardIds[wanted.specId] = existing.idReadable ?? existing.id;
      const patches = [];
      if (fieldValue(existing, "SpecKind") !== wanted.kind) patches.push(["SpecKind", wanted.kind]);
      if (fieldValue(existing, "Type") !== wanted.typeValue) patches.push(["Type", wanted.typeValue]);
      if (fieldValue(existing, "ContentHash") !== wanted.contentHash) patches.push(["ContentHash", wanted.contentHash]);
      // A card whose State was cleared by hand is drifted too: the empty
      // value differs from the wanted mapping and must be re-patched.
      if (wanted.status && fieldValue(existing, "State") !== STATUS_MAP[wanted.status]) patches.push(["State", STATUS_MAP[wanted.status]]);
      for (const [field, value] of patches) {
        await this.#client.command(field + " " + value, [existing.id]);
        writeCalls += 1;
        log({ op: "patch", specId: wanted.specId, field });
      }
      const wantedEvidence = wanted.evidence ?? "";
      if (fieldValue(existing, "Evidence") !== wantedEvidence) {
        if (await this.#setFreeTextField(existing.id, "Evidence", wantedEvidence, { log })) {
          writeCalls += 1;
          log({ op: "patch", specId: wanted.specId, field: "Evidence" });
        }
      }
      const summary = desiredSummary(wanted);
      const description = desiredDescription(wanted);
      if ((existing.summary ?? "") !== summary) {
        await this.#client.post("/api/issues/" + existing.id + "?fields=id", { summary });
        writeCalls += 1;
        log({ op: "patch", specId: wanted.specId, field: "Summary" });
      }
      if ((existing.description ?? "") !== description) {
        await this.#client.post("/api/issues/" + existing.id + "?fields=id", { description });
        writeCalls += 1;
        log({ op: "patch", specId: wanted.specId, field: "Description" });
      }
      return writeCalls;
  }

  async reconcileLinks(wantedLinks, wantedIssues, { log = () => {} } = {}) {
    const bySpecId = new Map();
    for (const issue of this.#issues) {
      const specId = fieldValue(issue, "SpecId");
      if (specId && specId !== SYNC_STATE_SPEC_ID) bySpecId.set(specId, issue);
    }
    const typeRows = await this.#client.get("/api/issueLinkTypes?fields=id,name,directed");
    const typeIds = new Map((typeRows ?? []).map((row) => [row.name, row.id]));
    const directedTypes = new Set((typeRows ?? []).filter((row) => row.directed === true).map((row) => row.name));
    // Directed link types require the s/t direction marker on the link-type id;
    // bare ids are only valid for undirected types. The URL issue is the link
    // target in every call below, so the marker is always `t`.
    const linkTypePath = (type) => {
      const typeId = typeIds.get(type);
      return typeId === undefined ? undefined : directedTypes.has(type) ? typeId + "t" : typeId;
    };
    const actualKeys = new Set(this.#links.map(linkEquivalenceKey));
    const desiredKeys = new Set(wantedLinks.map(linkEquivalenceKey));
    let writeCalls = 0;
    for (const link of wantedLinks) {
      const key = linkEquivalenceKey(link);
      if (actualKeys.has(key)) continue;
      const source = bySpecId.get(link.source);
      const target = bySpecId.get(link.target);
      const linkType = linkTypePath(link.type);
      if (!linkType) throw new Error("cannot materialize link " + key);
      // A missing endpoint means its card upsert failed this run (logged as
      // card-fail): skip the link so one bad card cannot abort the whole sync;
      // next run's parity check reports the drift and retries.
      if (!source || !target) {
        log({ op: "link-skip", type: link.type, source: link.source, target: link.target, reason: "endpoint card missing" });
        continue;
      }
      // The attach endpoint reads "link {body.id} TO this issue": the URL
      // issue becomes the target and the posted id becomes the source.
      await this.#client.post("/api/issues/" + target.id + "/links/" + linkType + "/issues?fields=id", { id: source.id });
      writeCalls += 1;
      actualKeys.add(key);
      log({ op: "link", type: link.type, source: link.source, target: link.target });
    }
    for (const link of this.#links) {
      const key = linkEquivalenceKey(link);
      if (desiredKeys.has(key) || !link.sourceIssueId || !link.targetIssueId) continue;
      const linkType = linkTypePath(link.type);
      if (!linkType) continue;
      try {
        // Mirror of the attach endpoint: the URL issue is the link target and
        // the path id is the source, so deletion is addressed from the
        // target's side to remove exactly the recorded direction.
        await this.#client.delete("/api/issues/" + link.targetIssueId + "/links/" + linkType + "/issues/" + link.sourceIssueId);
        writeCalls += 1;
        log({ op: "unlink", type: link.type, source: link.source, target: link.target });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("=> 404 ")) throw error;
        log({ op: "unlink-missing", type: link.type, source: link.source, target: link.target });
      }
    }
    void wantedIssues;
    return { writeCalls };
  }

  /**
   * Deletes only issues that the last committed snapshot owns (their SpecId
   * was recorded in cardIds by a previous successful sync). A SpecId set by
   * hand on an arbitrary issue is not ownership proof — such issues are
   * reported as unmanaged and left untouched.
   */
  async listTaskCards() {
    const issues = await this.#client.listProjectIssues(this.#projectShortName);
    const cards = [];
    for (const issue of issues) {
      const specId = fieldValue(issue, "SpecId");
      if (!specId || specId === SYNC_STATE_SPEC_ID) continue;
      if (fieldValue(issue, "SpecKind") !== "TASK") continue;
      cards.push({
        specId,
        state: fieldValue(issue, "State"),
        issueId: issue.id,
        idReadable: issue.idReadable ?? issue.id,
      });
    }
    return cards;
  }

  async removeStaleCards(wantedIssues, { log = () => {}, knownSpecIds = null } = {}) {
    const wanted = new Set(wantedIssues.map((issue) => issue.specId));
    const owned = knownSpecIds === null ? null : new Set(knownSpecIds);
    let writeCalls = 0;
    for (const issue of this.#issues) {
      const specId = fieldValue(issue, "SpecId");
      if (!specId || specId === SYNC_STATE_SPEC_ID || wanted.has(specId)) continue;
      if (owned === null) {
        log({ op: "delete-skip", specId, issue: issue.idReadable ?? issue.id, reason: "no committed snapshot — refusing to prove ownership" });
        continue;
      }
      if (!owned.has(specId)) {
        log({ op: "delete-skip", specId, issue: issue.idReadable ?? issue.id, reason: "SpecId not owned by committed snapshot" });
        continue;
      }
      await this.#client.delete("/api/issues/" + issue.id);
      writeCalls += 1;
      log({ op: "delete", specId, issue: issue.idReadable ?? issue.id });
    }
    return { writeCalls };
  }
}

/**
 * Marker integrity: the committed snapshot's cardIds map is the sole
 * ownership proof for writeback/sweep, so the marker cannot be trusted on
 * description alone — any SPEC-project member could edit or duplicate the
 * pointer issue. Every published marker is HMAC-signed with a secret that
 * tracker members cannot read; an unsigned or wrongly signed marker is never
 * a committed baseline. Pointer issues are deduplicated deterministically:
 * the lowest-id candidate wins and publishCommitted deletes the rest, so
 * overlapping syncs cannot leave permanent split-brain state.
 */
export class YouTrackSyncStateStore {
  #client;
  #projectId;
  #projectShortName;
  #markerSecret;
  #pointer;
  #pointers = [];
  #fieldValueTypes;

  constructor({ client, projectId, projectShortName, markerSecret }) {
    if (typeof markerSecret !== "string" || markerSecret.length < 32) {
      throw new TypeError("YouTrackSyncStateStore requires a marker secret (>= 32 chars)");
    }
    this.#client = client;
    this.#projectId = projectId;
    this.#projectShortName = projectShortName;
    this.#markerSecret = markerSecret;
  }

  #sign(marker) {
    const { signature, ...unsigned } = marker;
    void signature;
    return createHmac("sha256", this.#markerSecret).update(stableJson(unsigned), "utf8").digest("hex");
  }

  #verify(marker) {
    if (typeof marker?.signature !== "string") return false;
    const expected = Buffer.from(this.#sign(marker), "utf8");
    const actual = Buffer.from(marker.signature, "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /**
   * Pointer candidates: a bounded filtered query can evict the real marker
   * (relevance/recency ordering under SpecId spam) or legitimately return an
   * empty page for a non-queryable field while markers exist — both silently
   * corrupt the committed state. The full project listing cannot be evicted,
   * so pointer discovery stays on the unbounded read.
   */
  async #listPointerIssues() {
    return this.#client.listProjectIssues(this.#projectShortName);
  }

  async readCommitted() {
    const issues = await this.#listPointerIssues();
    const candidates = issues
      .filter((issue) => fieldValue(issue, "SpecId") === SYNC_STATE_SPEC_ID)
      .sort((a, b) => issueIdOrder(a.id, b.id));
    this.#pointers = candidates;
    this.#pointer = null;
    for (const candidate of candidates) {
      const marker = parseMarker(candidate.description);
      if (!marker || typeof marker.fingerprint !== "string" || typeof marker.snapshotHash !== "string") continue;
      if (!this.#verify(marker)) continue;
      this.#pointer = candidate;
      // A complete:false (partial) marker is still authentic and owned — its
      // cardIds (project-qualified keys) route writeback for the cards that did land.
      // Completeness gates the skip paths, not the read.
      return { valid: true, ...marker, projectIndexComplete: this.#validateProjectIndex(marker, issues) };
    }
    // No marker passes signature verification: spec wins. The lowest-id
    // candidate is taken over on publish so a forged pointer cannot outlive
    // the next sync.
    this.#pointer = candidates[0] ?? null;
    return { valid: false };
  }

  /**
   * The root index is only trustworthy when every pointer it names exists,
   * verifies, is complete, and is scoped to the same project. A missing or
   * edited project pointer must force a republish instead of being skipped.
   */
  #validateProjectIndex(marker, issues) {
    if (!Array.isArray(marker.projects)) return false;
    const byReadable = new Map(issues.map((issue) => [issue.idReadable ?? issue.id, issue]));
    const verify = (entry, expectedProject) => {
      if (!entry || typeof entry.pointer !== "string") return false;
      const issue = byReadable.get(entry.pointer);
      if (!issue) return false;
      const child = parseMarker(issue.description);
      if (!child || !this.#verify(child)) return false;
      return child.complete === true &&
        child.scope?.mode === "project" &&
        child.scope.project === expectedProject;
    };
    for (const project of marker.projects) {
      if (!project || typeof project.id !== "string" || !verify(project, project.id)) return false;
    }
    if (marker.unassigned && !verify(marker.unassigned, UNASSIGNED_PROJECT_ID)) return false;
    return true;
  }

  async #specIdCustomField(specId = SYNC_STATE_SPEC_ID) {
    if (!this.#fieldValueTypes) {
      const fields = await this.#client.get(
        "/api/admin/projects/" + this.#projectId + "/customFields?fields=field(name,fieldType(valueType))",
      );
      this.#fieldValueTypes = new Map((fields ?? []).map((row) => [row.field?.name, row.field?.fieldType?.valueType]));
    }
    // Same valueType contract as #createCustomFields: a text-typed SpecId
    // takes TextIssueCustomField, otherwise the string-typed default.
    return this.#fieldValueTypes.get("SpecId") === "text"
      ? { name: "SpecId", $type: "TextIssueCustomField", value: { $type: "TextFieldValue", text: specId } }
      : { name: "SpecId", $type: "SimpleIssueCustomField", value: specId };
  }

  #buildMarker(plan, { cardIds = {}, complete = true, projects = null, unassigned = null } = {}) {
    const marker = {
      schemaVersion: "BoardSnapshotV1",
      projectionVersion: plan.projectionVersion ?? null,
      complete,
      fingerprint: plan.fingerprint,
      snapshotHash: plan.snapshotHash,
      projectionDigest: plan.projectionDigest,
      scope: plan.scope,
      nodeCount: plan.snapshot.nodes.length,
      edgeCount: plan.snapshot.edges.length,
      mountHeads: plan.mountHeads ?? null,
      mountsClean: plan.mountsClean ?? null,
      skippedProjects: plan.skippedProjects ?? null,
      projects,
      unassigned,
      cardIds,
      snapshot: plan.snapshot,
      committedAt: new Date().toISOString(),
    };
    marker.signature = this.#sign(marker);
    const description = "SPEC-SYNC-STATE\n" + JSON.stringify(marker);
    if (description.length > MARKER_DESCRIPTION_LIMIT) {
      const error = new Error(
        `committed marker is ${description.length} characters; ` +
        `${MARKER_DESCRIPTION_LIMIT} is the safe limit (YouTrack truncates descriptions at 512000)`,
      );
      error.code = "MARKER_TOO_LARGE";
      error.descriptionLength = description.length;
      error.descriptionLimit = MARKER_DESCRIPTION_LIMIT;
      throw error;
    }
    return { marker, description };
  }

  async #upsertPointer(specId, description, issues) {
    const candidates = issues
      .filter((issue) => fieldValue(issue, "SpecId") === specId)
      .sort((a, b) => issueIdOrder(a.id, b.id));
    let pointer = candidates[0] ?? null;
    let writeCalls = 0;
    if (!pointer) {
      pointer = await this.#client.post("/api/issues?fields=id,idReadable", {
        project: { id: this.#projectId },
        summary: specId,
        description,
        customFields: [await this.#specIdCustomField(specId)],
      });
      writeCalls += 1;
      issues.push(pointer);
    } else {
      await this.#client.post("/api/issues/" + pointer.id + "?fields=id", { description });
      writeCalls += 1;
    }
    for (const extra of candidates) {
      if (extra.id === pointer.id) continue;
      await this.#client.delete("/api/issues/" + extra.id);
      writeCalls += 1;
    }
    return { pointer, writeCalls };
  }

  /**
   * Publish one signed marker per project (and the optional unassigned bucket).
   * The root index is written afterwards by publishCommitted, so a failure here
   * leaves the previous root untouched. Stale project pointers are returned,
   * not deleted, until the root has been committed.
   */
  async publishProjectPointers(projectPlans, { cardIds = {}, complete = true, unassignedPlan = null } = {}) {
    const issues = await this.#listPointerIssues();
    const projects = [];
    const keep = new Set();
    let writeCalls = 0;

    const writeOne = async (projectId, plan) => {
      const scoped = {
        ...plan,
        scope: { mode: "project", project: projectId, specSlugs: plan.scope?.specSlugs ?? [] },
      };
      const own = new Set((scoped.issues ?? []).map((issue) => issue.specId));
      const ownCards = Object.fromEntries(Object.entries(cardIds).filter(([canonicalId]) => own.has(canonicalId)));
      const { description } = this.#buildMarker(scoped, { cardIds: ownCards, complete });
      const specId = projectPointerSpecId(projectId);
      keep.add(specId);
      const result = await this.#upsertPointer(specId, description, issues);
      writeCalls += result.writeCalls;
      return {
        pointer: result.pointer.idReadable ?? result.pointer.id,
        nodeCount: scoped.snapshot.nodes.length,
        edgeCount: scoped.snapshot.edges.length,
      };
    };

    for (const [projectId, plan] of Object.entries(projectPlans ?? {})) {
      const row = await writeOne(projectId, plan);
      projects.push({ id: projectId, ...row });
    }

    let unassigned = null;
    if (unassignedPlan && (unassignedPlan.snapshot?.nodes?.length ?? 0) > 0) {
      const row = await writeOne(UNASSIGNED_PROJECT_ID, unassignedPlan);
      unassigned = { ...row };
    }

    const stale = issues.filter((issue) => {
      const specId = fieldValue(issue, "SpecId");
      return typeof specId === "string" && specId.startsWith(PROJECT_POINTER_PREFIX) && !keep.has(specId);
    });
    return { writeCalls, projects, unassigned, stale };
  }

  async publishCommitted(plan, { cardIds = {}, complete = true, projects = null, unassigned = null, staleProjectPointers = [] } = {}) {
    const { description } = this.#buildMarker(plan, { cardIds, complete, projects, unassigned });
    let writeCalls = 0;
    let pointer = this.#pointer;
    if (!pointer) {
      pointer = await this.#client.post("/api/issues?fields=id,idReadable", {
        project: { id: this.#projectId },
        summary: SYNC_STATE_SPEC_ID,
        description,
        customFields: [await this.#specIdCustomField()],
      });
      writeCalls += 1;
    } else {
      await this.#client.post("/api/issues/" + pointer.id + "?fields=id", { description });
      writeCalls += 1;
    }
    this.#pointer = pointer;
    for (const extra of this.#pointers) {
      if (extra.id === pointer.id) continue;
      await this.#client.delete("/api/issues/" + extra.id);
      writeCalls += 1;
    }
    this.#pointers = [pointer];
    // Root index is committed: safe to drop pointers for projects that no
    // longer exist. A failed root write above throws before this loop.
    for (const stale of staleProjectPointers) {
      await this.#client.delete("/api/issues/" + stale.id);
      writeCalls += 1;
    }
    return { writeCalls };
  }
}

export function issueIdOrder(a, b) {
  const pa = String(a ?? "").split("-");
  const pb = String(b ?? "").split("-");
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const na = Number(pa[i] ?? 0);
    const nb = Number(pb[i] ?? 0);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    if (pa[i] !== pb[i]) return (pa[i] ?? "") < (pb[i] ?? "") ? -1 : 1;
  }
  return 0;
}

export function parseMarker(description) {
  if (typeof description !== "string") return null;
  const prefix = "SPEC-SYNC-STATE\n";
  if (!description.startsWith(prefix)) return null;
  try {
    return JSON.parse(description.slice(prefix.length));
  } catch {
    return null;
  }
}

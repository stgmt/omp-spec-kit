#!/usr/bin/env node
/**
 * Whole-corpus projection: one MCP board read -> YouTrack project SPEC.
 *
 * The script is only an infrastructure composition root. Domain mapping and
 * sync decisions live in src/adapters/youtrack-projection.js. The source graph
 * is read through MCP; this process never imports or rebuilds the kernel graph.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { constants as fsConstants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline";
import {
  BUTTON_TRANSITIONS,
  KIND_LABELS,
  LINK_TYPES,
  TYPE_PER_KIND,
  STATUS_MAP,
  SYNC_STATE_SPEC_ID,
  YouTrackProjectionService,
  buildProjectionPlan,
  desiredDescription,
  desiredSummary,
  fieldValue,
  linkEquivalenceKey,
  specStatusForTrackerState,
  stableJson,
  validateWritebackEvent,
} from "../src/adapters/youtrack-projection.js";
import { StatusSweepService, planCardWriteback } from "../src/adapters/youtrack-status-sweep.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECT_SHORT_NAME = "SPEC";

/**
 * Resolve the MCP server entry: prefer the installed OMP plugin's dist server,
 * so a fresh sync process exercises the shipped artifact; fall back to the
 * repo source checkout for development.
 */
function resolveMcpServer() {
  const candidates = [
    path.join(homedir(), ".omp", "plugins", "node_modules", "omp-spec-kit", "dist", "mcp", "server.js"),
    path.join(ROOT, "src", "mcp", "server.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[1];
}

const MCP_CALL_TIMEOUT_MS = configuredPositiveInt(process.env.SPEC_SYNC_MCP_TIMEOUT_MS, 60_000);
const YOUTRACK_CALL_TIMEOUT_MS = configuredPositiveInt(process.env.SPEC_SYNC_YT_TIMEOUT_MS, 60_000);
const MCP_CLOSE_GRACE_MS = 5_000;

function configuredPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// The spawned MCP server only needs a launcher environment plus the
// OMP_SPEC_KIT_* contract: forwarding the whole parent environment would hand
// the tracker admin token and the writeback token to whatever code runs
// inside the installed plugin's dist on every call.
const MCP_CHILD_ENV_KEYS = [
  "PATH", "Path", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
  "TEMP", "TMP", "TMPDIR", "SystemRoot", "SYSTEMROOT", "SystemDrive",
  "WINDIR", "LANG", "LC_ALL", "NODE_PATH",
];

function mcpChildEnv(root) {
  const env = {};
  for (const key of MCP_CHILD_ENV_KEYS) {
    if (typeof process.env[key] === "string") env[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("OMP_SPEC_KIT_") && typeof value === "string") env[key] = value;
  }
  env.OMP_SPEC_KIT_ROOT = root;
  return env;
}

class McpStdioClient {
  #root;
  #server;
  #node;

  constructor({ root = ROOT, server = resolveMcpServer(), node = process.execPath, timeoutMs = MCP_CALL_TIMEOUT_MS } = {}) {
    this.#root = root;
    this.#server = server;
    this.#node = node;
    this.#timeoutMs = timeoutMs;
  }

  #timeoutMs;

  async callTool(name, args = {}) {
    const child = spawn(this.#node, [this.#server], {
      cwd: this.#root,
      env: mcpChildEnv(this.#root),
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pending = new Map();
    let nextId = 1;
    let closed = false;
    const rejectAll = (error) => {
      for (const waiter of pending.values()) waiter.reject(error);
      pending.clear();
    };
    const closeError = new Error("MCP client closed before a response");
    child.on("error", (error) => {
      closed = true;
      rejectAll(error);
    });
    child.stdin.on("error", () => {});
    const input = createInterface({ input: child.stdout });
    input.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message ?? "MCP request failed"));
      else waiter.resolve(message.result);
    });
    child.once("close", () => {
      closed = true;
      rejectAll(closeError);
    });
    const request = (method, params) => new Promise((resolve, reject) => {
      if (closed) {
        reject(closeError);
        return;
      }
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        child.kill();
        reject(new Error("MCP request timed out after " + this.#timeoutMs + "ms"));
      }, this.#timeoutMs);
      pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      try {
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
    try {
      await request("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "spec-graph-sync", version: "1" },
      });
      const result = await request("tools/call", {
        name,
        arguments: args,
      });
      const envelope = result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? "null");
      if (!envelope?.ok) throw new Error(envelope?.error?.message ?? "MCP request failed");
      return envelope.data;
    } finally {
      try {
        child.stdin.end();
      } catch {}
      if (!closed) {
        const killer = setTimeout(() => child.kill(), MCP_CLOSE_GRACE_MS);
        await new Promise((resolve) => child.once("close", resolve));
        clearTimeout(killer);
      }
    }
  }
}

export class McpBoardReader {
  #client;

  constructor(options = {}) {
    this.#client = new McpStdioClient(options);
  }

  readBoard({ specSlugs = [] } = {}) {
    return this.#client.callTool("spec_graph", { view: "board", specSlugs });
  }
}

export class McpTaskStatusWriteback {
  #client;

  constructor(options = {}) {
    this.#client = new McpStdioClient(options);
  }

  setSpecTaskStatus({ specId, status }) {
    const separator = typeof specId === "string" ? specId.indexOf(":") : -1;
    if (separator <= 0 || separator === specId.length - 1) throw new TypeError("specId must be specSlug:localId");
    if (!Object.prototype.hasOwnProperty.call(STATUS_MAP, status)) throw new TypeError("status must be planned, todo, or done");
    return this.#client.callTool("spec_patch", {
      requestId: "youtrack-writeback-" + Date.now(),
      reason: "YouTrack task status writeback for " + specId,
      spec: specId.slice(0, separator),
      intent: "setEntityStatus",
      entity: specId.slice(separator + 1),
      status,
      dryRun: false,
    }).then((data) => ({ writeCalls: 1, data }));
  }
}

export class YouTrackClient {
  #host;
  #token;
  #password;

  constructor({ host, token, password }) {
    this.#host = host.replace(/\/+$/, "");
    this.#token = token;
    this.#password = password;
  }

  async request(method, apiPath, body) {
    // Every tracker call carries an explicit deadline: --serve serializes all
    // writeback/sweep work through one chain, so a wedged request would stall
    // the whole lane without it.
    const response = await fetch(this.#host + apiPath, {
      method,
      signal: AbortSignal.timeout(YOUTRACK_CALL_TIMEOUT_MS),
      headers: {
        Authorization: this.#password
          ? "Basic " + Buffer.from(this.#token + ":" + this.#password).toString("base64")
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

class YouTrackProjectionStore {
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
      if (wanted.status && fieldValue(existing, "State") && fieldValue(existing, "State") !== STATUS_MAP[wanted.status]) patches.push(["State", STATUS_MAP[wanted.status]]);
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
 * pointer issue. Every published marker is HMAC-signed with a local secret
 * (SPEC_SYNC_MARKER_KEY or ~/.omp/spec-sync-marker-key) that tracker members
 * cannot read; an unsigned or wrongly signed marker is never a committed
 * baseline. Pointer issues are deduplicated deterministically: the
 * lowest-id candidate wins and publishCommitted deletes the rest, so
 * overlapping syncs cannot leave permanent split-brain state.
 */
class YouTrackSyncStateStore {
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

  async readCommitted() {
    const issues = await this.#client.listProjectIssues(this.#projectShortName);
    const candidates = issues
      .filter((issue) => fieldValue(issue, "SpecId") === SYNC_STATE_SPEC_ID)
      .sort((a, b) => issueIdOrder(a.id, b.id));
    this.#pointers = candidates;
    this.#pointer = null;
    for (const candidate of candidates) {
      const marker = parseMarker(candidate.description);
      if (!marker || marker.complete !== true || typeof marker.fingerprint !== "string" || typeof marker.snapshotHash !== "string") continue;
      if (!this.#verify(marker)) continue;
      this.#pointer = candidate;
      return { valid: true, ...marker };
    }
    // No marker passes signature verification: spec wins. The lowest-id
    // candidate is taken over on publish so a forged pointer cannot outlive
    // the next sync.
    this.#pointer = candidates[0] ?? null;
    return { valid: false };
  }

  async #specIdCustomField() {
    if (!this.#fieldValueTypes) {
      const fields = await this.#client.get(
        "/api/admin/projects/" + this.#projectId + "/customFields?fields=field(name,fieldType(valueType))",
      );
      this.#fieldValueTypes = new Map((fields ?? []).map((row) => [row.field?.name, row.field?.fieldType?.valueType]));
    }
    // Same valueType contract as #createCustomFields: a text-typed SpecId
    // takes TextIssueCustomField, otherwise the string-typed default.
    return this.#fieldValueTypes.get("SpecId") === "text"
      ? { name: "SpecId", $type: "TextIssueCustomField", value: { $type: "TextFieldValue", text: SYNC_STATE_SPEC_ID } }
      : { name: "SpecId", $type: "SimpleIssueCustomField", value: SYNC_STATE_SPEC_ID };
  }

  async publishCommitted(plan, { cardIds = {} } = {}) {
    const marker = {
      schemaVersion: "BoardSnapshotV1",
      complete: true,
      fingerprint: plan.fingerprint,
      snapshotHash: plan.snapshotHash,
      projectionDigest: plan.projectionDigest,
      scope: plan.scope,
      nodeCount: plan.snapshot.nodes.length,
      edgeCount: plan.snapshot.edges.length,
      cardIds,
      snapshot: plan.snapshot,
      committedAt: new Date().toISOString(),
    };
    marker.signature = this.#sign(marker);
    const description = "SPEC-SYNC-STATE\n" + JSON.stringify(marker);
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
    return { writeCalls };
  }
}

function issueIdOrder(a, b) {
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

function parseMarker(description) {
  if (typeof description !== "string") return null;
  const prefix = "SPEC-SYNC-STATE\n";
  if (!description.startsWith(prefix)) return null;
  try {
    return JSON.parse(description.slice(prefix.length));
  } catch {
    return null;
  }
}

const MARKER_KEY_PATH = path.join(homedir(), ".omp", "spec-sync-marker-key");
const SYNC_LOCK_PATH = path.join(homedir(), ".omp", "spec-graph-sync.lock");

/**
 * The marker-signing secret: SPEC_SYNC_MARKER_KEY (>= 32 chars) wins, else a
 * stable random key persisted under ~/.omp mode 0600 — the same convention as
 * the writeback token in spec-listener-ensure.mjs. Without it a tracker-side
 * edit of the pointer issue could forge cardIds ownership and drive spec_patch.
 */
function ensureMarkerSecret() {
  const fromEnv = process.env.SPEC_SYNC_MARKER_KEY;
  if (typeof fromEnv === "string" && fromEnv.length >= 32) return fromEnv;
  try {
    const existing = readFileSync(MARKER_KEY_PATH, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const generated = randomBytes(24).toString("hex");
  mkdirSync(path.dirname(MARKER_KEY_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(MARKER_KEY_PATH, generated + "\n", { mode: 0o600 });
  return generated;
}

/**
 * Same-host mutual exclusion for one-shot sync runs: two overlapping syncs
 * could both create the SPEC:SYNC-STATE pointer before either publishes. The
 * lock file records the holder pid; a lock whose process is gone is broken
 * rather than waited on forever. Cross-host runs still converge through
 * deterministic pointer selection and duplicate deletion.
 */
async function acquireSyncLock() {
  await mkdir(path.dirname(SYNC_LOCK_PATH), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(SYNC_LOCK_PATH, "wx", 0o600);
      await handle.writeFile(String(process.pid));
      return handle;
    } catch (error) {
      if (!(error instanceof Error) || error.code !== "EEXIST") throw error;
      const pid = Number((await readFile(SYNC_LOCK_PATH, "utf8").catch(() => "")).trim());
      let alive = false;
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          alive = true;
        } catch (killError) {
          alive = killError instanceof Error && killError.code === "EPERM";
        }
      }
      if (alive) throw new Error("another spec-graph-sync is already running (pid " + pid + ")");
      await rm(SYNC_LOCK_PATH, { force: true });
    }
  }
  throw new Error("could not acquire the spec-graph-sync lock");
}

function fail(message) {
  console.error("spec-graph-sync: " + message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    host: process.env.YOUTRACK_HOST ?? "http://localhost:8080",
    token: process.env.YOUTRACK_TOKEN ?? "",
    password: process.env.YOUTRACK_PASSWORD ?? "",
    writebackToken: process.env.SPEC_WRITEBACK_TOKEN ?? "",
    project: PROJECT_SHORT_NAME,
    dryRun: false,
    serve: false,
    provision: false,
    migrate: false,
    port: 8787,
    bind: "127.0.0.1",
    sweepIntervalMs: configuredPositiveInt(process.env.SPEC_SYNC_SWEEP_INTERVAL_MS, 300_000),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") args.host = argv[++i] ?? fail("missing --host value");
    else if (arg === "--project") args.project = argv[++i] ?? fail("missing --project value");
    else if (arg === "--port") args.port = Number(argv[++i] ?? fail("missing --port value"));
    else if (arg === "--bind") args.bind = argv[++i] ?? fail("missing --bind value");
    else if (arg === "--sweep-interval") args.sweepIntervalMs = Number(argv[++i] ?? fail("missing --sweep-interval value"));
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--serve") args.serve = true;
    else if (arg === "--provision") args.provision = true;
    else if (arg === "--migrate") args.migrate = true;
    else fail("unknown argument " + arg);
  }
  if (!Number.isInteger(args.port) || args.port <= 0) fail("invalid --port value");
  if (!Number.isInteger(args.sweepIntervalMs) || args.sweepIntervalMs < 0) fail("invalid --sweep-interval value");
  // Credentials come from the environment only: argv values are visible to
  // every local process via the command line and land in shell history.
  if (!args.token && !args.password) fail("provide YOUTRACK_TOKEN or YOUTRACK_PASSWORD in the environment");
  // A writeback token is mandatory on every --serve: on Docker Desktop a
  // loopback bind is still reachable from any container via
  // host.docker.internal, so loopback is not an authentication boundary.
  if (args.serve && !args.writebackToken) {
    fail("--serve requires SPEC_WRITEBACK_TOKEN in the environment");
  }
  return args;
}

const MAX_EVENT_BODY_BYTES = 64 * 1024;
const MAX_OUTBOX_BYTES = 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

function writeJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

// O_NOFOLLOW is not defined on Windows; the default outbox lives under
// ~/.omp (not the world-writable shared tmpdir), so the primary mitigation is
// the private directory and the flag is best-effort hardening on POSIX.
const OUTBOX_OPEN_FLAGS = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_APPEND | (fsConstants.O_NOFOLLOW ?? 0);

/**
 * Appends a draft event to the durable outbox, rotating the file to a single
 * .1 backup once it exceeds the cap so junk POSTs cannot grow it without
 * bound. Rotation keeps the newest entries — the sweep converges state
 * regardless, so bounded history is sufficient audit. The path must be a
 * real file: a planted symlink would turn every append into a write to an
 * attacker-chosen target under the listener's credentials.
 */
async function appendOutbox(outbox, event) {
  await mkdir(path.dirname(outbox), { recursive: true, mode: 0o700 });
  const line = JSON.stringify({ ...event, at: new Date().toISOString() }) + "\n";
  const stats = await lstat(outbox).catch(() => null);
  if (stats?.isSymbolicLink()) throw new Error("outbox path must be a regular file");
  if (stats && stats.size + line.length > MAX_OUTBOX_BYTES) {
    await rename(outbox, outbox + ".1").catch(() => {});
  }
  const handle = await open(outbox, OUTBOX_OPEN_FLAGS, 0o600);
  try {
    await handle.appendFile(line);
  } finally {
    await handle.close();
  }
}

/**
 * Writeback listener: the tracker event is only a hint. The issue's real
 * SpecId and State are re-read from YouTrack before any spec mutation, so a
 * forged POST cannot introduce a status the tracker does not actually hold.
 * Ownership is proven against the committed snapshot's cardIds map — a SpecId
 * typed by hand on a foreign card cannot drive a spec_patch. The same
 * three-way merge as the sweep decides apply vs spec-wins, so a spec status
 * the tracker cannot represent is never regressed. Every validated event is
 * appended to the durable outbox first; processing is serialized so ordering
 * and one-MCP-child-at-a-time hold.
 */
async function handleWritebackRequest(req, res, { client, sourceReader, syncState, writeback, outbox, projectShortName, chainRef, writebackToken }) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    // Liveness proof, not just a 200: the answer must carry an HMAC of the
    // caller's fresh nonce under the writeback secret, so a foreign process
    // squatting on the port cannot impersonate this listener and collect the
    // token-bearing /writeback posts.
    const nonce = url.searchParams.get("nonce") ?? "";
    const body = { ok: true, service: "spec-graph-sync" };
    if (writebackToken && nonce !== "") {
      body.proof = createHmac("sha256", writebackToken).update("spec-graph-sync/health:" + nonce, "utf8").digest("hex");
    }
    writeJson(res, 200, body);
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/writeback") {
    writeJson(res, 404, { ok: false, error: "not found" });
    return;
  }
  if (!writebackToken || req.headers["x-spec-writeback-token"] !== writebackToken) {
    writeJson(res, 401, { ok: false, error: "missing or invalid writeback token" });
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_EVENT_BODY_BYTES) {
      writeJson(res, 413, { ok: false, error: "event body too large" });
      req.destroy();
      return;
    }
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    writeJson(res, 400, { ok: false, error: "bad json" });
    return;
  }
  const problem = validateWritebackEvent(event);
  if (problem) {
    writeJson(res, 400, { ok: false, error: problem });
    return;
  }
  try {
    await appendOutbox(outbox, event);
  } catch (error) {
    // fs error messages embed the outbox path — log it locally, but never
    // return filesystem detail in the HTTP response.
    console.error("spec-graph-sync outbox append failed: " + (error instanceof Error ? error.message : String(error)));
    writeJson(res, 500, { ok: false, error: "cannot persist writeback draft" });
    return;
  }
  const job = chainRef.current.then(async () => {
    let issue;
    try {
      issue = await client.get(
        "/api/issues/" + encodeURIComponent(event.issueId) +
        "?fields=id,idReadable,project(shortName),customFields(name,value(name,presentation,text))",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("spec-graph-sync writeback verify failed: " + message);
      throw new HttpError(message.includes("=> 404") ? 404 : 502, "cannot verify issue against tracker");
    }
    if (!issue || issue.project?.shortName !== projectShortName) throw new HttpError(404, "issue is outside the managed project");
    const trackerSpecId = fieldValue(issue, "SpecId");
    if (trackerSpecId !== event.specId) throw new HttpError(409, "specId does not match the tracker-held value");
    if (fieldValue(issue, "SpecKind") !== "TASK") throw new HttpError(422, "writeback applies to TASK cards only");
    const committed = await syncState.readCommitted();
    const cardIds = committed?.valid === true && committed.cardIds && typeof committed.cardIds === "object" ? committed.cardIds : {};
    const ownedId = cardIds[event.specId];
    if (typeof ownedId !== "string" || (ownedId !== issue.idReadable && ownedId !== issue.id)) {
      throw new HttpError(409, "card is not owned by the committed snapshot");
    }
    const board = await sourceReader.readBoard({});
    const node = (board?.nodes ?? []).find((entry) => entry?.canonicalId === event.specId && entry.kind === "TASK");
    if (!node) return { applied: false, reason: "no such task in the spec corpus; spec wins" };
    const baseline = (committed.snapshot?.nodes ?? []).find((entry) => entry?.canonicalId === event.specId && entry.kind === "TASK");
    const decision = planCardWriteback({
      specId: event.specId,
      specStatus: node.taskStatus ?? null,
      trackerStatus: specStatusForTrackerState(fieldValue(issue, "State")),
      hasBaseline: Boolean(baseline),
      snapshotStatus: baseline?.taskStatus ?? null,
    });
    if (decision.action !== "patch") return { applied: false, reason: decision.reason };
    const result = await writeback.setSpecTaskStatus({ specId: event.specId, status: decision.status });
    return { applied: true, status: decision.status, writeback: result };
  });
  chainRef.current = job.catch(() => {});
  try {
    const outcome = await job;
    writeJson(res, 200, { ok: true, ...outcome });
  } catch (error) {
    const status = error instanceof HttpError ? error.httpStatus : 502;
    writeJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

export function startServe({
  port = 8787,
  bind = "127.0.0.1",
  client,
  sourceReader,
  syncState,
  writeback,
  projectShortName = PROJECT_SHORT_NAME,
  // Default lives in the user-private ~/.omp directory: os.tmpdir() is
  // world-writable on POSIX, where a pre-planted symlink or directory would
  // turn durable drafts into an arbitrary-file write or a silent 500 loop.
  outbox = path.join(homedir(), ".omp", "spec-graph-writeback.jsonl"),
  writebackToken = "",
  sweep = null,
  sweepIntervalMs = 0,
} = {}) {
  if (!client || !sourceReader || !syncState || !writeback) {
    throw new TypeError("startServe requires tracker client, sourceReader, syncState, and writeback ports");
  }
  if (!writebackToken) throw new TypeError("startServe requires a non-empty writebackToken");
  const chainRef = { current: Promise.resolve() };
  const server = http.createServer((req, res) => {
    handleWritebackRequest(req, res, { client, sourceReader, syncState, writeback, outbox, projectShortName, chainRef, writebackToken }).catch((error) => {
      if (!res.headersSent) writeJson(res, 500, { ok: false, error: "internal writeback error" });
      if (!res.writableEnded) res.end();
      console.error("spec-graph-sync writeback error: " + (error instanceof Error ? error.message : String(error)));
    });
  });
  const runSweep = () => {
    if (!sweep) return;
    chainRef.current = chainRef.current.then(() =>
      sweep.sweep({ log: (event) => console.log(JSON.stringify(event)) }).catch((error) => {
        console.error("spec-graph-sync sweep error: " + (error instanceof Error ? error.message : String(error)));
      }),
    );
  };
  let sweepTimer = null;
  server.listen(port, bind, () => {
    console.log(JSON.stringify({ op: "serve", port, bind, outbox, sweepIntervalMs }));
    runSweep();
    if (sweep && sweepIntervalMs > 0) {
      sweepTimer = setInterval(runSweep, sweepIntervalMs);
      sweepTimer.unref();
    }
  });
  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    if (sweepTimer) clearInterval(sweepTimer);
    return originalClose(callback);
  };
  return server;
}

const LINK_TYPE_LABELS = Object.freeze({
  satisfies: ["satisfies", "satisfied by"],
  "satisfied-by": ["satisfied by", "satisfies"],
  verifies: ["verifies", "verified by"],
  covers: ["covers", "covered by"],
  implements: ["implements", "implemented by"],
  "implemented-by": ["implemented by", "implements"],
  "depends-on": ["depends on", "required for"],
  constrains: ["constrains", "constrained by"],
  contains: ["contains", "contained by"],
});

/**
 * Ensures the eight spec link types exist as directed link types so physical
 * link direction is auditable. An existing undirected type is only replaced
 * under --migrate: deleting a type drops its links, and the next sync
 * recreates them from the spec projection.
 */
async function provisionLinkTypes(client, { migrate = false, log = console.log } = {}) {
  const rows = await client.get("/api/issueLinkTypes?fields=id,name,directed");
  const byName = new Map((rows ?? []).map((row) => [row.name, row]));
  for (const name of LINK_TYPES) {
    const existing = byName.get(name);
    if (existing && existing.directed === true) continue;
    if (existing && !migrate) {
      throw new Error(
        "link type " + name + " exists but is undirected; rerun with --migrate to recreate it directed (its links are dropped, sync recreates them)",
      );
    }
    if (existing) await client.delete("/api/issueLinkTypes/" + existing.id);
    const [sourceToTarget, targetToSource] = LINK_TYPE_LABELS[name];
    await client.post("/api/issueLinkTypes?fields=id,name", {
      name,
      directed: true,
      sourceToTarget,
      targetToSource,
    });
    log(JSON.stringify({ op: "provision-link-type", name, directed: true }));
  }
}

/**
 * Ensures the project enum bundles hold every SpecKind/Type value the
 * projection can emit (e.g. SpecKind=ROADMAP, Type=Roadmap). Bundle edits
 * apply to the bundle wherever it is shared, so this runs only under the
 * explicit --provision flag.
 */
async function provisionEnumValues(client, projectId, { log = console.log } = {}) {
  const fields = await client.get(
    "/api/admin/projects/" + projectId + "/customFields?fields=field(name),bundle(id,values(name))",
  );
  const wanted = {
    SpecKind: Object.keys(KIND_LABELS).map((kind) => KIND_LABELS[kind]),
    Type: [...new Set(Object.values(TYPE_PER_KIND))],
  };
  for (const row of fields ?? []) {
    const required = wanted[row.field?.name];
    if (!required || !row.bundle?.id) continue;
    const existing = new Set((row.bundle.values ?? []).map((value) => value.name));
    for (const name of required) {
      if (existing.has(name)) continue;
      await client.post(
        "/api/admin/customFieldSettings/bundles/enum/" + row.bundle.id + "/values?fields=id,name",
        { name, $type: "EnumBundleElement" },
      );
      log(JSON.stringify({ op: "provision-enum-value", field: row.field.name, value: name }));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new YouTrackClient({ host: args.host, token: args.token, password: args.password });
  const projects = await client.get("/api/admin/projects?fields=id,name,shortName");
  const project = (projects ?? []).find((entry) => entry.shortName === args.project);
  if (!project) fail("project missing on server: " + args.project);
  if (args.provision) {
    await provisionLinkTypes(client, { migrate: args.migrate });
    await provisionEnumValues(client, project.id);
  }
  const sourceReader = new McpBoardReader({ root: ROOT });
  const tracker = new YouTrackProjectionStore({ client, projectId: project.id, projectShortName: project.shortName });
  const state = new YouTrackSyncStateStore({
    client,
    projectId: project.id,
    projectShortName: project.shortName,
    markerSecret: ensureMarkerSecret(),
  });
  if (args.serve) {
    const writeback = new McpTaskStatusWriteback({ root: ROOT });
    const sweep = new StatusSweepService({ sourceReader, tracker, syncState: state, writeback });
    startServe({
      port: args.port,
      bind: args.bind,
      client,
      sourceReader,
      syncState: state,
      writeback,
      projectShortName: args.project,
      writebackToken: args.writebackToken,
      sweep,
      sweepIntervalMs: args.sweepIntervalMs,
    });
    return;
  }
  const service = new YouTrackProjectionService({ sourceReader, tracker, syncState: state });
  const lock = await acquireSyncLock();
  let result;
  try {
    result = await service.sync({ dryRun: args.dryRun, log: (event) => console.log(JSON.stringify(event)) });
  } finally {
    await lock.close();
    await rm(SYNC_LOCK_PATH, { force: true });
  }
  console.log(JSON.stringify({
    outcome: result.outcome,
    fingerprint: result.fingerprint,
    nodeCount: result.plan.issues.length,
    linkCount: result.plan.links.length,
    skippedLinks: result.plan.skippedLinks,
    parity: result.parity,
    writeCalls: result.writeCalls,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}

export { BUTTON_TRANSITIONS, YouTrackProjectionStore, YouTrackSyncStateStore, buildProjectionPlan, desiredDescription, desiredSummary, fieldValue, specStatusForTrackerState, validateWritebackEvent };

import { createHash } from "node:crypto";

export const KIND_LABELS = Object.freeze({
  FUNCTIONAL_REQUIREMENT: "FR",
  NON_FUNCTIONAL_REQUIREMENT: "NFR",
  ACCEPTANCE_CRITERION: "AC",
  TASK: "TASK",
  SCENARIO: "SCENARIO",
  ROADMAP: "ROADMAP",
});

export const TYPE_PER_KIND = Object.freeze({
  TASK: "Task",
  FUNCTIONAL_REQUIREMENT: "Feature",
  ACCEPTANCE_CRITERION: "Criterion",
  SCENARIO: "Scenario",
  NON_FUNCTIONAL_REQUIREMENT: "Constraint",
  ROADMAP: "Roadmap",
});

export const STATUS_MAP = Object.freeze({
  planned: "Submitted",
  todo: "Open",
  done: "Fixed",
});

export const REVERSE_STATUS_MAP = Object.freeze({
  Submitted: "planned",
  Open: "todo",
  "In Progress": "todo",
  "To be discussed": "todo",
  Reopened: "todo",
  Fixed: "done",
  Verified: "done",
});

export const BUTTON_TRANSITIONS = Object.freeze([
  Object.freeze({ button: "Approve", from: "Open", to: "Fixed", specTo: "done" }),
  Object.freeze({ button: "Verify", from: "Fixed", to: "Verified", specTo: "done" }),
  Object.freeze({ button: "Reopen", from: "*", to: "Reopened", specTo: "todo" }),
]);

export const LINK_TYPES = Object.freeze([
  "satisfies",
  "satisfied-by",
  "verifies",
  "covers",
  "implements",
  "implemented-by",
  "depends-on",
  "constrains",
  "contains",
]);

export const REVERSE_LINK_TYPE = Object.freeze({
  implements: "implemented-by",
  "implemented-by": "implements",
  satisfies: "satisfied-by",
  "satisfied-by": "satisfies",
});

/**
 * Canonical relation types: satisfies, verifies, covers, implements,
 * depends-on, constrains. The inverse-named tracker types (satisfied-by,
 * implemented-by) normalize to the canonical type with swapped endpoints, so
 * link identity is (canonicalType, source, target) and direction is audited.
 */
const INVERSE_LINK_TYPE = Object.freeze({
  "satisfied-by": "satisfies",
  "implemented-by": "implements",
});

export function canonicalLink(type, source, target) {
  const inverse = INVERSE_LINK_TYPE[type];
  return inverse ? { type: inverse, source: target, target: source } : { type, source, target };
}

/**
 * Declared kernel-edge -> tracker-link mapping (spec DESIGN "Projection
 * mapping" is the contract). Rows are matched on (edge.type, from.kind,
 * to.kind); flip=true emits the tracker link with swapped endpoints because
 * the semantic direction is the reverse of the kernel edge direction.
 * Edges that match no row are skipped with a diagnostic — never guessed.
 */
const EDGE_LINK_RULES = Object.freeze([
  Object.freeze({ edge: "TESTED_BY", from: "FR", to: "SCENARIO", link: "covers", flip: true }),
  Object.freeze({ edge: "TESTED_BY", from: "NFR", to: "SCENARIO", link: "covers", flip: true }),
  Object.freeze({ edge: "TESTED_BY", from: "AC", to: "SCENARIO", link: "verifies", flip: true }),
  Object.freeze({ edge: "COVERS", from: "SCENARIO", to: "FR", link: "covers", flip: false }),
  Object.freeze({ edge: "COVERS", from: "AC", to: "FR", link: "covers", flip: false }),
  Object.freeze({ edge: "REFS", from: "FR", to: "AC", link: "satisfies", flip: false }),
  Object.freeze({ edge: "REFS", from: "AC", to: "FR", link: "satisfied-by", flip: false }),
  Object.freeze({ edge: "REFS", from: "TASK", to: "FR", link: "implements", flip: false }),
  Object.freeze({ edge: "REFS", from: "FR", to: "TASK", link: "implemented-by", flip: false }),
  Object.freeze({ edge: "REFS", from: "TASK", to: "NFR", link: "constrains", flip: true }),
  Object.freeze({ edge: "IMPLEMENTS", from: "TASK", to: "FR", link: "implements", flip: false }),
  Object.freeze({ edge: "IMPLEMENTS", from: "TASK", to: "NFR", link: "constrains", flip: true }),
  Object.freeze({ edge: "IMPLEMENTS", from: "TASK", to: "AC", link: "implements", flip: false }),
  Object.freeze({ edge: "DEPENDS_ON", from: "TASK", to: "TASK", link: "depends-on", flip: false }),
  Object.freeze({ edge: "DECLARES", from: "TASK", to: "NFR", link: "constrains", flip: true }),
  Object.freeze({ edge: "CONTAINS", from: "ROADMAP", to: "FR", link: "contains", flip: false }),
  Object.freeze({ edge: "CONTAINS", from: "ROADMAP", to: "NFR", link: "contains", flip: false }),
  Object.freeze({ edge: "CONTAINS", from: "ROADMAP", to: "AC", link: "contains", flip: false }),
  Object.freeze({ edge: "CONTAINS", from: "ROADMAP", to: "TASK", link: "contains", flip: false }),
  Object.freeze({ edge: "CONTAINS", from: "ROADMAP", to: "SCENARIO", link: "contains", flip: false }),
]);

export const LINK_LABELS = Object.freeze({
  implements: "Реализует",
  "implemented-by": "Реализуется в",
  "depends-on": "Зависит от",
  "required-for": "Требуется для",
  constrains: "Ограничено",
  "constrained-by": "Ограничивает",
  satisfies: "Удовлетворяет",
  "satisfied-by": "Удовлетворяется",
  verifies: "Верифицирует",
  "verified-by": "Верифицируется",
  covers: "Покрывает",
  "covered-by": "Покрывается",
  contains: "Содержит",
  "contained-by": "Входит в",
});

/** Display-only reverse labels for canonical types that have no inverse tracker type. */
const DISPLAY_REVERSE_LINK_TYPE = Object.freeze({
  verifies: "verified-by",
  covers: "covered-by",
  "depends-on": "required-for",
  constrains: "constrained-by",
  contains: "contained-by",
});

export const SYNC_STATE_SPEC_ID = "SPEC:SYNC-STATE";

/**
 * Shape version of the projected payload: bump when the marker, snapshot, or
 * card layout changes in a way an older committed snapshot cannot express
 * (e.g. new fields the board widget consumes). The skip check treats a
 * pointer with an older version as stale even when content is unchanged, so
 * a code upgrade re-projects without waiting for a spec edit.
 */
export const PROJECTION_VERSION = 2;

const BOARD_KINDS = new Set(Object.keys(KIND_LABELS));

export class SpecGraphReader {
  async readBoard() {
    throw new Error("SpecGraphReader.readBoard is not implemented");
  }
}

export class TrackerProjectionStore {
  async readProjection() {
    throw new Error("TrackerProjectionStore.readProjection is not implemented");
  }

  async upsertCards() {
    throw new Error("TrackerProjectionStore.upsertCards is not implemented");
  }

  async reconcileLinks() {
    throw new Error("TrackerProjectionStore.reconcileLinks is not implemented");
  }

  async removeStaleCards() {
    throw new Error("TrackerProjectionStore.removeStaleCards is not implemented");
  }
}

export class SyncStateStore {
  async readCommitted() {
    throw new Error("SyncStateStore.readCommitted is not implemented");
  }

  async publishCommitted() {
    throw new Error("SyncStateStore.publishCommitted is not implemented");
  }
}

export class TaskStatusWriteback {
  async setSpecTaskStatus() {
    throw new Error("TaskStatusWriteback.setSpecTaskStatus is not implemented");
  }
}

export function parseTaskStatus(body) {
  const match = typeof body === "string"
    ? body.match(/(?:\*\*)?Status:(?:\*\*)?\s*([A-Za-z]+)/i)
    : null;
  const status = match ? match[1].toLowerCase() : "todo";
  return STATUS_MAP[status] ? status : "todo";
}

export function specStatusForTrackerState(state) {
  return REVERSE_STATUS_MAP[state] ?? null;
}

export function validateWritebackEvent(event) {
  if (!event || typeof event !== "object") return "not an object";
  if (typeof event.specId !== "string" || !event.specId.includes(":")) return "bad specId";
  if (typeof event.toState !== "string" || event.toState === "") return "bad toState";
  if (typeof event.issueId !== "string" || event.issueId === "") return "bad issueId";
  return null;
}

export function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function assertBoardProjection(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) throw new TypeError("board projection must be an object");
  if (board.complete !== true || board.page !== null) throw new TypeError("board projection must be complete and unpaged");
  if (typeof board.fingerprint !== "string" || board.fingerprint === "") throw new TypeError("board projection fingerprint is required");
  if (!Array.isArray(board.nodes) || !Array.isArray(board.edges)) throw new TypeError("board projection nodes and edges are required");
  const identities = new Set();
  for (const node of board.nodes) {
    if (!node || typeof node.canonicalId !== "string" || !BOARD_KINDS.has(node.kind)) throw new TypeError("board projection contains an invalid node");
    if (identities.has(node.canonicalId)) throw new TypeError("board projection contains duplicate node identity");
    identities.add(node.canonicalId);
  }
  for (const edge of board.edges) {
    if (!edge || !identities.has(edge.from) || !identities.has(edge.to) || typeof edge.type !== "string") {
      throw new TypeError("board projection contains an invalid edge endpoint");
    }
  }
}

function addSortedLink(links, seen, type, source, target) {
  if (!LINK_TYPES.includes(type) || source === target) return false;
  const canonical = canonicalLink(type, source, target);
  const key = canonical.type + "|" + canonical.source + "|" + canonical.target;
  if (seen.has(key)) return false;
  seen.add(key);
  links.push(canonical);
  return true;
}

function sortNatural(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function buildProjectionPlan(board) {
  assertBoardProjection(board);
  const wanted = new Map();
  for (const node of board.nodes) {
    const kind = KIND_LABELS[node.kind];
    const specId = node.canonicalId;
    wanted.set(specId, {
      canonicalId: node.canonicalId,
      specId,
      kind,
      typeValue: TYPE_PER_KIND[node.kind],
      localId: node.localId,
      title: node.title ?? node.localId,
      body: node.body ?? "",
      docPath: node.source?.path ?? "",
      startLine: node.source?.startLine ?? 0,
      contentHash: node.contentHash ?? "",
      evidence: node.evidence ?? "",
      status: node.kind === "TASK"
        ? (STATUS_MAP[node.taskStatus] ? node.taskStatus : parseTaskStatus(node.body))
        : null,
      links: {},
    });
  }

  const links = [];
  const seen = new Set();
  let skippedLinks = 0;
  const byId = (id) => wanted.get(id);

  for (const edge of board.edges) {
    const from = byId(edge.from);
    const to = byId(edge.to);
    if (!from || !to) {
      skippedLinks += 1;
      continue;
    }
    const rule = EDGE_LINK_RULES.find(
      (entry) => entry.edge === edge.type && entry.from === from.kind && entry.to === to.kind,
    );
    if (!rule) {
      skippedLinks += 1;
      continue;
    }
    addSortedLink(links, seen, rule.link, rule.flip ? to.specId : from.specId, rule.flip ? from.specId : to.specId);
  }

  links.sort((a, b) => sortNatural(a.type, b.type) || sortNatural(a.source, b.source) || sortNatural(a.target, b.target));
  const bySpecId = new Map([...wanted.values()].map((issue) => [issue.specId, issue]));
  for (const link of links) {
    const source = bySpecId.get(link.source);
    const target = bySpecId.get(link.target);
    if (!source || !target) continue;
    (source.links[link.type] ??= []).push(target.localId);
    const reverse = REVERSE_LINK_TYPE[link.type] ?? DISPLAY_REVERSE_LINK_TYPE[link.type];
    if (reverse) (target.links[reverse] ??= []).push(source.localId);
  }
  for (const issue of wanted.values()) {
    for (const values of Object.values(issue.links)) values.sort(sortNatural);
  }

  const issues = [...wanted.values()].sort((a, b) => sortNatural(a.specId, b.specId));
  const snapshot = {
    schemaVersion: "BoardSnapshotV1",
    fingerprint: board.fingerprint,
    scope: board.scope ?? { mode: "corpus", specSlugs: [] },
    complete: true,
    page: null,
    nodes: board.nodes,
    edges: board.edges,
    counts: board.counts ?? { nodes: board.nodes.length, edges: board.edges.length },
  };
  const projectionDigest = digest({ issues, links });
  return {
    fingerprint: board.fingerprint,
    projectionVersion: PROJECTION_VERSION,
    scope: snapshot.scope,
    issues,
    links,
    skippedLinks,
    projectionDigest,
    snapshot,
    snapshotHash: digest(snapshot),
  };
}

function desiredState(wanted) {
  return wanted.status ? STATUS_MAP[wanted.status] : "Submitted";
}

function stripMarkdownLinks(text) {
  return text.replace(/\[(.+?)\]\([^)]+\)/g, "$1").trim();
}

function footer(wanted) {
  return "---\nSource: " + wanted.docPath + "#L" + wanted.startLine + " · contentHash " + wanted.contentHash;
}

function relationsSection(wanted) {
  const groups = [];
  for (const type of LINK_TYPES) {
    const ids = wanted.links?.[type];
    if (!ids || ids.length === 0) continue;
    groups.push("- **" + LINK_LABELS[type] + ":** " + ids.join(", "));
  }
  return groups.length === 0 ? "" : "### Связи\n" + groups.join("\n") + "\n\n";
}

function formatTask(wanted) {
  const body = wanted.body;
  const status = wanted.status ?? parseTaskStatus(body);
  const estimateMatch = body.match(/(?:\*\*)?Estimate:(?:\*\*)?\s*([^\n]+)/i);
  const doneWhenMatch = body.match(/(?:^|\n)(?:\*\*)?Done When:(?:\*\*)?\s*\n((?:- [^\n]*(?:\n|$))+)/i);
  const doneWhen = doneWhenMatch ? doneWhenMatch[1].split("\n").filter((line) => line.startsWith("- ")).map((line) => line.trim()) : [];
  const remainder = body
    .replace(/(?:\*\*)?Status:(?:\*\*)?[^\n]*(\n|$)/i, "")
    .replace(/(?:\*\*)?Estimate:(?:\*\*)?[^\n]*(\n|$)/i, "")
    .replace(/(?:\*\*)?Depends On:(?:\*\*)?[^\n]*(\n|$)/i, "")
    .replace(/(?:\*\*)?Requirements:(?:\*\*)?[^\n]*(\n|$)/i, "")
    .replace(/(?:^|\n)(?:\*\*)?Done When:(?:\*\*)?\s*\n((?:- [^\n]*(?:\n|$))+)/i, "")
    .trim();
  let result = "### Статус\n" + status;
  if (estimateMatch) result += " · " + stripMarkdownLinks(estimateMatch[1]);
  result += "\n\n";
  if (remainder) result += "### Что делаем\n" + remainder + "\n\n";
  if (doneWhen.length) result += "### Условия готовности\n" + doneWhen.join("\n") + "\n\n";
  return result + relationsSection(wanted) + footer(wanted);
}

function formatRequirement(wanted) {
  const refs = [];
  const main = [];
  for (const line of wanted.body.split("\n")) {
    const trimmed = line.trim();
    if (/^(?:\*\*)?Acceptance:(?:\*\*)?/i.test(trimmed) || /^(?:\*\*)?Scenario:(?:\*\*)?/i.test(trimmed)) refs.push(stripMarkdownLinks(trimmed.replace(/^(?:\*\*)?(?:Acceptance|Scenario):(?:\*\*)?\s*/i, "")));
    else main.push(line);
  }
  let result = "### Требование\n" + main.join("\n").trim() + "\n\n";
  if (refs.length) result += "### Приёмка и сценарий\n" + refs.join(" · ") + "\n\n";
  return result + relationsSection(wanted) + footer(wanted);
}

function formatCriterion(wanted) {
  let result = "";
  for (const paragraph of wanted.body.split(/\n\n+/)) {
    const text = paragraph.trim();
    if (!text) continue;
    if (/^(?:\*\*)?EARS:(?:\*\*)?/i.test(text)) result += "> " + text.split("\n").join("\n> ") + "\n\n";
    else if (/^(?:\*\*)?Scenario:(?:\*\*)?/i.test(text)) result += "### Сценарий\n" + stripMarkdownLinks(text.replace(/^(?:\*\*)?Scenario:(?:\*\*)?\s*/i, "")) + "\n\n";
    else result += "### Критерий\n" + text + "\n\n";
  }
  return result + relationsSection(wanted) + footer(wanted);
}

function formatScenario(wanted) {
  const quoted = wanted.body.trim().split("\n").map((line) => line.trim() ? "> " + line : ">" ).join("\n");
  return quoted + "\n\n" + relationsSection(wanted) + footer(wanted);
}

// YouTrack rejects summaries longer than 255 characters; kernel titles may
// reach 512 scalars, so the projection truncates deterministically.
const SUMMARY_LIMIT = 255;

export function desiredSummary(wanted) {
  return String(wanted.title ?? wanted.localId).slice(0, SUMMARY_LIMIT);
}

function formatRoadmap(wanted) {
  const body = wanted.body.trim();
  const head = body ? "### Дорожная карта\n" + body + "\n\n" : "";
  return head + relationsSection(wanted) + footer(wanted);
}

export function desiredDescription(wanted) {
  const formatter = {
    TASK: formatTask,
    FR: formatRequirement,
    AC: formatCriterion,
    SCENARIO: formatScenario,
    ROADMAP: formatRoadmap,
    NFR: (item) => "### Ограничение\n" + item.body.trim() + "\n\n" + relationsSection(item) + footer(item),
  }[wanted.kind];
  // FR-9: every card — including kinds without a dedicated formatter — carries
  // the grouped relations section, never a bare body.
  return formatter ? formatter(wanted) : wanted.body.trim() + "\n\n" + relationsSection(wanted) + footer(wanted);
}

export function fieldValue(issue, name) {
  const field = (issue.customFields ?? []).find((entry) => entry.name === name);
  if (!field || field.value === null || field.value === undefined) return "";
  if (typeof field.value === "string") return field.value;
  return field.value.name ?? field.value.presentation ?? field.value.text ?? "";
}

export function linkEquivalenceKey(link) {
  const canonical = canonicalLink(
    String(link?.type ?? ""),
    String(link?.source ?? ""),
    String(link?.target ?? ""),
  );
  return canonical.type + "|" + canonical.source + "|" + canonical.target;
}

function comparableCard(issue) {
  return {
    specId: fieldValue(issue, "SpecId"),
    kind: fieldValue(issue, "SpecKind"),
    typeValue: fieldValue(issue, "Type"),
    contentHash: fieldValue(issue, "ContentHash"),
    evidence: fieldValue(issue, "Evidence"),
    summary: issue.summary ?? "",
    description: issue.description ?? "",
  };
}

export function compareProjection(actual, plan) {
  const actualIssues = Array.isArray(actual?.issues) ? actual.issues : Array.isArray(actual?.cards) ? actual.cards : [];
  const actualLinks = Array.isArray(actual?.links) ? actual.links : [];
  const actualById = new Map();
  for (const issue of actualIssues) {
    const card = comparableCard(issue);
    if (!card.specId || card.specId === SYNC_STATE_SPEC_ID) continue;
    if (actualById.has(card.specId)) return { equal: false, reason: "DUPLICATE_SPEC_ID" };
    actualById.set(card.specId, card);
  }
  if (actualById.size !== plan.issues.length) return { equal: false, reason: "CARD_COUNT" };
  for (const wanted of plan.issues) {
    const actualCard = actualById.get(wanted.specId);
    if (!actualCard) return { equal: false, reason: "MISSING_CARD" };
    const expected = {
      specId: wanted.specId,
      kind: wanted.kind,
      typeValue: wanted.typeValue,
      contentHash: wanted.contentHash,
      evidence: wanted.evidence,
      summary: desiredSummary(wanted),
      description: desiredDescription(wanted),
    };
    if (stableJson(actualCard) !== stableJson(expected)) return { equal: false, reason: "CARD_DRIFT", specId: wanted.specId };
  }
  const actualLinkKeys = new Set(actualLinks.map(linkEquivalenceKey));
  const desiredLinkKeys = new Set(plan.links.map(linkEquivalenceKey));
  if (actualLinkKeys.size !== desiredLinkKeys.size || [...desiredLinkKeys].some((key) => !actualLinkKeys.has(key))) return { equal: false, reason: "LINK_DRIFT" };
  return { equal: true, reason: "PARITY" };
}

export class YouTrackProjectionService {
  #sourceReader;
  #tracker;
  #syncState;

  constructor({ sourceReader, tracker, syncState }) {
    if (!sourceReader || !tracker || !syncState) throw new TypeError("projection service requires sourceReader, tracker, and syncState");
    this.#sourceReader = sourceReader;
    this.#tracker = tracker;
    this.#syncState = syncState;
  }

  async sync({ specSlugs = [], dryRun = false, log = () => {} } = {}) {
    const board = await this.#sourceReader.readBoard({ specSlugs });
    const plan = buildProjectionPlan(board);
    const pointer = await this.#syncState.readCommitted();
    const actual = await this.#tracker.readProjection();
    const parity = compareProjection(actual, plan);
    const canSkip = pointer?.valid === true && pointer.fingerprint === plan.fingerprint &&
      pointer.snapshotHash === plan.snapshotHash && pointer.projectionDigest === plan.projectionDigest &&
      pointer.projectionVersion === plan.projectionVersion && parity.equal;
    if (canSkip) {
      return { outcome: "SKIPPED", fingerprint: plan.fingerprint, writeCalls: 0, plan, parity };
    }
    if (dryRun) {
      return { outcome: "DRYRUN", fingerprint: plan.fingerprint, writeCalls: 0, plan, parity };
    }
    const cardResult = await this.#tracker.upsertCards(plan.issues, { log });
    const linkResult = await this.#tracker.reconcileLinks(plan.links, plan.issues, { log });
    const knownSpecIds = pointer?.valid === true && pointer.cardIds && typeof pointer.cardIds === "object"
      ? Object.keys(pointer.cardIds)
      : null;
    const staleResult = typeof this.#tracker.removeStaleCards === "function"
      ? await this.#tracker.removeStaleCards(plan.issues, { log, knownSpecIds })
      : null;
    const stateResult = await this.#syncState.publishCommitted(plan, { cardIds: cardResult?.cardIds ?? {} });
    const writeCalls = (cardResult?.writeCalls ?? 0) + (linkResult?.writeCalls ?? 0) +
      (staleResult?.writeCalls ?? 0) + (stateResult?.writeCalls ?? 0);
    const failures = cardResult?.failures ?? [];
    return { outcome: "SYNCED", fingerprint: plan.fingerprint, writeCalls, failures, plan, parity };
  }
}

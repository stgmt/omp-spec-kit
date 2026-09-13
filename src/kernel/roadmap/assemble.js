// Pure roadmap assembler: derives scope from the roadmap spec's own
// IMPLEMENTS/REFS edges, collects requirement-level items (FR/UC/US) from
// covered specs, derives deterministic status from implementing TASKs,
// and merges the generated block into the ROADMAP.md marker region.
//
// No filesystem I/O — callers supply the graph and the current document
// text.  The assembler is a pure function of (graph, specSlug, documentText).

import { compareCodePoints } from "../normalize.js";

const ROADMAP_SPEC_PREFIX = "roadmap-";
const START_MARKER = "<!-- roadmap:auto:start -->";
const END_MARKER = "<!-- roadmap:auto:end -->";
const ITEM_KINDS = new Set(["FUNCTIONAL_REQUIREMENT", "USE_CASE", "USER_STORY"]);
const SOURCE_NODE_KINDS = new Set(["FUNCTIONAL_REQUIREMENT", "TASK"]);
const SCOPE_EDGE_TYPES = new Set(["IMPLEMENTS", "REFS"]);
const DONE_STATUS = "done";
const NON_TERMINAL_STATUSES = new Set(["planned", "todo", "ready", "in-progress", "blocked"]);

// ── public API ──────────────────────────────────────────────────────────

export function assembleRoadmap(graph, specSlug, documentText) {
  if (typeof specSlug !== "string" || !specSlug.startsWith(ROADMAP_SPEC_PREFIX)) {
    return { ok: false, code: "NOT_A_ROADMAP_SPEC", message: `${specSlug} is not a roadmap spec (must start with ${ROADMAP_SPEC_PREFIX})` };
  }
  if (typeof documentText !== "string") {
    return { ok: false, code: "INVALID_INPUT", message: "documentText must be a string" };
  }

  const scope = deriveScope(graph, specSlug);
  const items = collectItems(graph, scope);
  const block = renderBlock(items);
  const merged = mergeRegion(documentText, block);
  if (!merged.ok) return merged;
  return { ok: true, content: merged.content, scope, itemCount: items.length };
}

// ── 1. scope derivation ─────────────────────────────────────────────────

function deriveScope(graph, specSlug) {
  const scope = new Set();
  for (const edge of graph.edges) {
    if (!SCOPE_EDGE_TYPES.has(edge.type)) continue;
    const sourceNode = graph.nodes.find((n) => n.canonicalId === edge.from);
    if (!sourceNode || sourceNode.specSlug !== specSlug) continue;
    if (!SOURCE_NODE_KINDS.has(sourceNode.kind)) continue;
    const targetNode = graph.nodes.find((n) => n.canonicalId === edge.to);
    if (!targetNode) continue;
    scope.add(targetNode.specSlug);
  }
  return [...scope].sort(compareCodePoints);
}

// ── 2. item collection ──────────────────────────────────────────────────

function collectItems(graph, scope) {
  const scopeSet = new Set(scope);
  const items = [];
  for (const node of graph.nodes) {
    if (!ITEM_KINDS.has(node.kind)) continue;
    if (!scopeSet.has(node.specSlug)) continue;
    items.push({
      canonicalId: node.canonicalId,
      specSlug: node.specSlug,
      localId: node.localId,
      kind: node.kind,
      title: node.title || node.localId,
      status: deriveStatus(graph, node),
    });
  }
  items.sort((a, b) => compareCodePoints(a.canonicalId, b.canonicalId));
  return items;
}

// ── 3. status derivation ────────────────────────────────────────────────

function deriveStatus(graph, node) {
  // Find all TASKs that IMPLEMENTS this node (for FR/NFR/AC).
  // For UC/US, aggregate via COVERS/REFS to FR-level entities.
  if (node.kind === "FUNCTIONAL_REQUIREMENT" || node.kind === "NON_FUNCTIONAL_REQUIREMENT") {
    return deriveRequirementStatus(graph, node.canonicalId);
  }
  if (node.kind === "USE_CASE" || node.kind === "USER_STORY") {
    return deriveAggregateStatus(graph, node.canonicalId);
  }
  return "planned";
}

function deriveRequirementStatus(graph, canonicalId) {
  const implementingTasks = [];
  for (const edge of graph.edges) {
    if (edge.type !== "IMPLEMENTS" || edge.to !== canonicalId) continue;
    const task = graph.nodes.find((n) => n.canonicalId === edge.from);
    if (task && task.kind === "TASK") implementingTasks.push(task);
  }
  if (implementingTasks.length === 0) return "planned";
  const statuses = implementingTasks.map((task) => taskStatus(task));
  if (statuses.every((s) => s === DONE_STATUS)) return "done";
  if (statuses.some((s) => s === DONE_STATUS || s === "todo" || s === "ready" || s === "in-progress")) return "in progress";
  return "planned";
}

function deriveAggregateStatus(graph, canonicalId) {
  // UC/US COVER/REFS to FR/NFR; aggregate their derived statuses.
  const refTargets = [];
  for (const edge of graph.edges) {
    if (edge.from !== canonicalId) continue;
    if (edge.type !== "COVERS" && edge.type !== "REFS") continue;
    const target = graph.nodes.find((n) => n.canonicalId === edge.to);
    if (target && (target.kind === "FUNCTIONAL_REQUIREMENT" || target.kind === "NON_FUNCTIONAL_REQUIREMENT")) {
      refTargets.push(target);
    }
  }
  if (refTargets.length === 0) return "planned";
  const statuses = refTargets.map((fr) => deriveRequirementStatus(graph, fr.canonicalId));
  if (statuses.every((s) => s === DONE_STATUS)) return "done";
  if (statuses.some((s) => s === "done" || s === "in progress")) return "in progress";
  return "planned";
}

function taskStatus(task) {
  let raw = typeof task.attributes?.status === "string" ? task.attributes.status : undefined;
  if (!raw || raw.trim().toLowerCase() === "unknown") {
    raw = typeof task.body === "string" ? task.body.match(/\*\*Status:\*\*\s*([^\n]+)/u)?.[1] : undefined;
  }
  if (typeof raw !== "string") return "unknown";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "completed") return "done";
  return NON_TERMINAL_STATUSES.has(normalized) || normalized === "done" || normalized === "deferred" ? normalized : "unknown";
}

// ── 4. block rendering ──────────────────────────────────────────────────

function renderBlock(items) {
  if (items.length === 0) return "";
  const lines = [];
  let currentSpec = null;
  for (const item of items) {
    if (item.specSlug !== currentSpec) {
      if (currentSpec !== null) lines.push("");
      lines.push(`### ${item.specSlug}`);
      currentSpec = item.specSlug;
    }
    const kindLabel = kindShortLabel(item.kind);
    lines.push(`- [${item.status}] ${item.localId} — ${item.title} (${kindLabel})`);
  }
  return lines.join("\n") + "\n";
}

function kindShortLabel(kind) {
  switch (kind) {
    case "FUNCTIONAL_REQUIREMENT": return "FR";
    case "USE_CASE": return "UC";
    case "USER_STORY": return "US";
    default: return kind;
  }
}

// ── 5. region merge ─────────────────────────────────────────────────────

export function mergeRegion(documentText, generatedBlock) {
  const startIdx = documentText.indexOf(START_MARKER);
  if (startIdx < 0) {
    return { ok: false, code: "MISSING_MARKERS", message: `ROADMAP.md is missing the ${START_MARKER} marker` };
  }
  const endIdx = documentText.indexOf(END_MARKER, startIdx + START_MARKER.length);
  if (endIdx < 0) {
    return { ok: false, code: "MISSING_MARKERS", message: `ROADMAP.md is missing the ${END_MARKER} marker` };
  }
  // Detect duplicate start markers.
  if (documentText.indexOf(START_MARKER, startIdx + START_MARKER.length) >= 0) {
    return { ok: false, code: "DUPLICATE_MARKERS", message: `ROADMAP.md has multiple ${START_MARKER} markers` };
  }
  const before = documentText.slice(0, startIdx + START_MARKER.length);
  const after = documentText.slice(endIdx);
  const content = before + "\n" + generatedBlock + after;
  return { ok: true, content };
}

import {
  DIAGNOSTIC_SEVERITIES,
  EDGE_TYPES,
  NODE_KINDS,
  TASK_STATUSES,
} from "../types.js";
import { isValidSpecSlug } from "../identity.js";

export const EXTENDED_OPERATIONS = Object.freeze([
  "findByTags",
  "listTasks",
  "listPhaseTasks",
  "findOrphans",
  "validateAnchor",
  "listSpecs",
  "validateRequirementMetadata",
  "policyQueryRequirements",
  "getArchivalProof",
  "validateSpec",
  "getSpecStatus",
]);

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;
const NON_TERMINAL_TASK_STATUSES = new Set(["planned", "todo", "ready", "in-progress", "blocked"]);
const REQUIREMENT_KINDS = new Set(["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function operationError(code, message, extra = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: false,
      ...extra,
    },
  };
}

function operationSuccess(data, page = null) {
  return { ok: true, data, page };
}

function specSlugs(graph) {
  return [...new Set(graph.documents.map((document) => document.specSlug))].sort(compareStrings);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nodeSource(node) {
  return {
    path: node.span?.path ?? null,
    startLine: node.span?.startLine ?? null,
    startColumn: node.span?.startColumn ?? null,
    endLine: node.span?.endLine ?? null,
    endColumn: node.span?.endColumn ?? null,
  };
}

function nodeSummary(node, includeBody = false) {
  const result = {
    canonicalId: node.canonicalId,
    specSlug: node.specSlug,
    localId: node.localId,
    kind: node.kind,
    title: node.title,
    source: nodeSource(node),
    contentHash: node.contentHash,
  };
  if (includeBody) {
    result.body = node.body;
    result.attributes = node.attributes ?? {};
  }
  return result;
}

function taskPhase(task) {
  if (typeof task.attributes?.phase === "string" && task.attributes.phase.trim()) return task.attributes.phase.trim();
  const match = typeof task.body === "string" ? task.body.match(/\*\*Phase:\*\*\s*([^\n]+)/u) : null;
  return match?.[1]?.trim() ?? null;
}

function taskStatus(task) {
  let raw = typeof task.attributes?.status === "string" ? task.attributes.status : undefined;
  if (!raw || raw.trim().toLowerCase() === "unknown") raw = typeof task.body === "string" ? task.body.match(/\*\*Status:\*\*\s*([^\n]+)/u)?.[1] : undefined;
  if (typeof raw !== "string") return "unknown";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "completed") return "done";
  return TASK_STATUSES.includes(normalized) ? normalized : "unknown";
}

function taskRequirements(graph, taskId) {
  const refs = [];
  for (const edge of graph.edges) {
    if (edge.from !== taskId || !["REFS", "COVERS", "IMPLEMENTS"].includes(edge.type)) continue;
    const target = graph.nodes.find((node) => node.canonicalId === edge.to);
    if (target && REQUIREMENT_KINDS.has(target.kind)) refs.push(target.canonicalId);
  }
  return [...new Set(refs)].sort(compareStrings);
}

function taskEntry(graph, task, includeComments) {
  const entry = {
    canonicalId: task.canonicalId,
    specSlug: task.specSlug,
    localId: task.localId,
    title: task.title,
    status: taskStatus(task),
    phase: taskPhase(task),
    source: nodeSource(task),
    requirements: taskRequirements(graph, task.canonicalId),
  };
  if (includeComments) entry.body = task.body;
  return entry;
}

function decodeCursor(cursor) {
  if (cursor === null || cursor === undefined || cursor === "") return null;
  if (typeof cursor !== "string" || cursor.length > 512) return operationError("INVALID_CURSOR", "cursor must be a bounded opaque cursor");
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!isPlainObject(parsed) || !Number.isSafeInteger(parsed.index) || parsed.index < 0) {
      return operationError("INVALID_CURSOR", "cursor payload is invalid");
    }
    return parsed;
  } catch {
    return operationError("INVALID_CURSOR", "cursor payload is invalid");
  }
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function paginate(graph, operation, items, args) {
  const limit = args.limit === undefined ? DEFAULT_PAGE_LIMIT : args.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    return operationError("LIMIT_EXCEEDED", `limit must be an integer from 1 through ${MAX_PAGE_LIMIT}`, {
      parameter: "limit",
      limitName: "maxPageItems",
      limitValue: MAX_PAGE_LIMIT,
      observedValue: limit,
    });
  }
  const decoded = decodeCursor(args.cursor);
  if (decoded?.ok === false) return decoded;
  if (decoded && (decoded.operation !== operation || decoded.fingerprint !== graph.fingerprint)) {
    return operationError("STALE_CURSOR", "cursor does not belong to this graph and operation");
  }
  const start = decoded?.index ?? 0;
  const slice = items.slice(start, start + limit);
  const nextCursor = start + slice.length < items.length
    ? encodeCursor({ operation, fingerprint: graph.fingerprint, index: start + slice.length })
    : null;
  return {
    ok: true,
    items: slice,
    page: {
      limit,
      returned: slice.length,
      totalMatched: items.length,
      cursor: args.cursor ?? null,
      nextCursor,
      truncated: nextCursor !== null,
    },
  };
}

function resolveNode(graph, rawId, spec) {
  if (typeof rawId !== "string" || rawId.trim() === "") return { error: operationError("INVALID_PARAMETER", "node identifier is required") };
  const input = rawId.trim();
  if (input.includes(":")) {
    const node = graph.nodes.find((candidate) => candidate.canonicalId === input);
    return node ? { node } : { error: operationError("NOT_FOUND", `node not found: ${input}`, { canonicalId: input }) };
  }
  const candidates = graph.nodes.filter((candidate) => candidate.localId === input && (!spec || candidate.specSlug === spec));
  if (candidates.length === 1) return { node: candidates[0] };
  if (candidates.length > 1) {
    return {
      error: operationError("AMBIGUOUS_ID", `node identifier is ambiguous: ${input}`, {
        candidates: candidates.map((candidate) => candidate.canonicalId).sort(compareStrings),
      }),
    };
  }
  return { error: operationError("NOT_FOUND", `node not found: ${input}`, { canonicalId: input }) };
}

function metadataFromNode(node) {
  if (isPlainObject(node.attributes?.metadata)) return node.attributes.metadata;
  const body = typeof node.body === "string" ? node.body : "";
  const block = body.match(/```yaml metadata\s*\n([\s\S]*?)\n```/u)?.[1] ?? "";
  if (!block) return null;
  const metadata = {};
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/u);
    if (!match) continue;
    const value = match[2].replace(/^['"]|['"]$/gu, "");
    metadata[match[1]] = value;
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function validateMetadata(metadata) {
  const issues = [];
  if (!isPlainObject(metadata)) return { valid: false, issues: [{ field: "metadata", message: "metadata must be an object" }] };
  if (metadata.schemaVersion !== undefined && metadata.schemaVersion !== 1 && metadata.schemaVersion !== "1") {
    issues.push({ field: "schemaVersion", message: "schemaVersion must be 1" });
  }
  if (metadata.verificationMethod !== undefined && !["test", "analysis", "review", "inspection", "demonstration"].includes(metadata.verificationMethod)) {
    issues.push({ field: "verificationMethod", message: "verificationMethod is not supported" });
  }
  if (metadata.safetyClass !== undefined && !["critical", "major", "minor"].includes(metadata.safetyClass)) {
    issues.push({ field: "safetyClass", message: "safetyClass is not supported" });
  }
  if (metadata.contract !== undefined && !isPlainObject(metadata.contract)) {
    issues.push({ field: "contract", message: "contract must be an object" });
  }
  return { valid: issues.length === 0, issues };
}

function scenarioTags(node) {
  return Array.isArray(node.attributes?.tags) ? node.attributes.tags.filter((tag) => typeof tag === "string") : [];
}

function runFindByTags(graph, args) {
  if (!Array.isArray(args.tags) || args.tags.length === 0 || args.tags.some((tag) => typeof tag !== "string" || tag.trim() === "")) {
    return operationError("INVALID_PARAMETER", "tags must be a non-empty string array", { parameter: "tags" });
  }
  const required = new Set(args.tags.map((tag) => (tag.startsWith("@") ? tag : `@${tag}`)));
  const scenarios = graph.nodes
    .filter((node) => node.kind === "SCENARIO")
    .filter((node) => {
      const tags = new Set(scenarioTags(node));
      return [...required].every((tag) => tags.has(tag));
    })
    .sort((left, right) => compareStrings(left.canonicalId, right.canonicalId))
    .map((node) => ({ ...nodeSummary(node), tags: scenarioTags(node) }));
  return operationSuccess({ kind: "scenarios", scenarios, count: scenarios.length });
}

function runListTasks(graph, args, phaseOnly = false) {
  if (typeof args.spec !== "string" || !isValidSpecSlug(args.spec)) {
    return operationError("INVALID_PARAMETER", "spec must be a valid specification slug", { parameter: "spec" });
  }
  const requestedStatuses = args.statuses === undefined
    ? NON_TERMINAL_TASK_STATUSES
    : new Set(Array.isArray(args.statuses) ? args.statuses : []);
  if (args.statuses !== undefined && (!Array.isArray(args.statuses) || [...requestedStatuses].some((status) => !TASK_STATUSES.includes(status)))) {
    return operationError("INVALID_PARAMETER", "statuses must contain only known task statuses", { parameter: "statuses" });
  }
  if (phaseOnly && typeof args.phase !== "string" || phaseOnly && args.phase.trim() === "") {
    return operationError("INVALID_PARAMETER", "phase is required", { parameter: "phase" });
  }
  const tasks = graph.nodes
    .filter((node) => node.kind === "TASK" && node.specSlug === args.spec)
    .filter((task) => requestedStatuses.has(taskStatus(task)))
    .filter((task) => !phaseOnly || taskPhase(task) === args.phase)
    .filter((task) => !phaseOnly || taskPhase(task) !== null)
    .filter((task) => args.phase === undefined || taskPhase(task) === args.phase)
    .filter((task) => args.requirement === undefined || taskRequirements(graph, task.canonicalId).includes(args.requirement) || taskRequirements(graph, task.canonicalId).some((id) => id.endsWith(`:${args.requirement}`)))
    .sort((left, right) => compareStrings(left.canonicalId, right.canonicalId))
    .map((task) => taskEntry(graph, task, args.includeComments === true));
  if (phaseOnly && !graph.nodes.some((node) => node.kind === "TASK" && node.specSlug === args.spec && taskPhase(node) === args.phase)) {
    const phases = [...new Set(graph.nodes.filter((node) => node.kind === "TASK" && node.specSlug === args.spec).map(taskPhase).filter(Boolean))].sort(compareStrings);
    return operationError("PHASE_NOT_FOUND", `phase not found: ${args.phase}`, { spec: args.spec, phase: args.phase, candidates: phases });
  }
  const page = paginate(graph, phaseOnly ? "listPhaseTasks" : "listTasks", tasks, args);
  if (!page.ok) return page;
  return operationSuccess({ kind: "tasks", spec: args.spec, tasks: page.items, count: page.items.length }, page.page);
}

function runFindOrphans(graph) {
  const findings = [];
  for (const node of graph.nodes) {
    if (node.kind === "FUNCTIONAL_REQUIREMENT" || node.kind === "NON_FUNCTIONAL_REQUIREMENT") {
      const covered = graph.edges.some((edge) => edge.type === "COVERS" && edge.to === node.canonicalId);
      if (!covered) findings.push({ code: "UNCOVERED_FR", canonicalId: node.canonicalId, source: nodeSource(node), message: "requirement has no incoming coverage edge" });
    }
    if (node.kind === "TASK") {
      const implemented = graph.edges.some((edge) => edge.from === node.canonicalId && ["IMPLEMENTS", "REFS"].includes(edge.type));
      if (!implemented) findings.push({ code: "ORPHAN_TASK", canonicalId: node.canonicalId, source: nodeSource(node), message: "task has no requirement edge" });
    }
    if (node.kind === "SCENARIO") {
      const tested = graph.edges.some((edge) => edge.type === "TESTED_BY" && edge.to === node.canonicalId);
      if (!tested) findings.push({ code: "SCENARIO_TAG_ORPHAN", canonicalId: node.canonicalId, source: nodeSource(node), message: "scenario has no tested-by edge" });
    }
  }
  findings.sort((left, right) => compareStrings(left.canonicalId, right.canonicalId) || compareStrings(left.code, right.code));
  return operationSuccess({ kind: "orphans", findings, count: findings.length });
}

function runValidateAnchor(graph, args) {
  if (typeof args.anchor !== "string" || args.anchor.trim() === "") return operationError("INVALID_PARAMETER", "anchor is required", { parameter: "anchor" });
  const anchor = args.anchor.trim();
  const hash = anchor.indexOf("#");
  if (hash > 0) {
    const path = anchor.slice(0, hash);
    const fragment = anchor.slice(hash + 1);
    const match = graph.markdownHeadingOccurrences.find((heading) => heading.path === path && heading.canonicalAnchor === fragment);
    return operationSuccess({ anchor, registered: match !== undefined, kind: "marksman-heading-slug", location: match ? { path: match.path, headingOccurrenceId: match.headingOccurrenceId, source: nodeSource({ span: match.span }) } : null });
  }
  const resolved = resolveNode(graph, anchor, args.spec);
  if (resolved.node) return operationSuccess({ anchor, registered: true, kind: "spec-graph-id", location: nodeSummary(resolved.node) });
  return resolved.error ?? operationSuccess({ anchor, registered: false, kind: "spec-graph-id" });
}

function runListSpecs(graph) {
  return operationSuccess({ kind: "specs", specs: specSlugs(graph), count: specSlugs(graph).length });
}

function runValidateRequirementMetadata(args) {
  const result = validateMetadata(args.metadata);
  return operationSuccess({ kind: "requirement-metadata", valid: result.valid, issues: result.issues, metadata: result.valid ? args.metadata : null });
}

function deliveryForRequirement(graph, node) {
  const scenarioIds = graph.edges.filter((edge) => edge.type === "TESTED_BY" && edge.from === node.canonicalId).map((edge) => edge.to).sort(compareStrings);
  const hasImplementation = graph.edges.some((edge) => edge.type === "IMPLEMENTS" && edge.to === node.canonicalId);
  const overall = hasImplementation && scenarioIds.length > 0 ? "DELIVERED" : "INCOMPLETE";
  return { overall, scenarioIds, hasImplementation };
}

function runPolicyQueryRequirements(graph, args) {
  const results = graph.nodes
    .filter((node) => REQUIREMENT_KINDS.has(node.kind))
    .filter((node) => args.spec === undefined || args.spec === null || node.specSlug === args.spec)
    .map((node) => ({ node, metadata: metadataFromNode(node), delivery: deliveryForRequirement(graph, node) }))
    .filter(({ metadata }) => args.verificationMethod === undefined || metadata?.verificationMethod === args.verificationMethod)
    .filter(({ metadata }) => args.safetyClass === undefined || metadata?.safetyClass === args.safetyClass)
    .filter(({ metadata }) => args.verificationMethodMissing !== true || metadata?.verificationMethod === undefined)
    .filter(({ delivery }) => args.delivery === undefined || delivery.overall === args.delivery)
    .map(({ node, metadata, delivery }) => ({ ...nodeSummary(node), metadata, delivery }));
  return operationSuccess({ kind: "requirement-policy", results, count: results.length });
}

function runArchivalProof(graph, args) {
  if (typeof args.spec !== "string" || !isValidSpecSlug(args.spec)) return operationError("INVALID_PARAMETER", "spec must be a valid specification slug", { parameter: "spec" });
  const nodes = graph.nodes.filter((node) => node.specSlug === args.spec);
  if (nodes.length === 0) return operationError("NOT_FOUND", `specification not found: ${args.spec}`, { specSlug: args.spec });
  const ids = new Set(nodes.map((node) => node.canonicalId));
  const references = graph.edges
    .filter((edge) => ids.has(edge.to))
    .map((edge) => graph.nodes.find((node) => node.canonicalId === edge.from))
    .filter((node) => node && node.specSlug !== args.spec)
    .map((node) => nodeSummary(node));
  const uniqueReferences = [...new Map(references.map((node) => [node.canonicalId, node])).values()].sort((left, right) => compareStrings(left.canonicalId, right.canonicalId));
  return operationSuccess({ kind: "archival-proof", spec: args.spec, verdict: uniqueReferences.length > 0 ? "KEEP_FALSE_POSITIVE" : "ARCHIVE", liveInboundReferences: uniqueReferences, count: uniqueReferences.length });
}

function runValidateSpec(graph, args) {
  if (typeof args.spec !== "string" || !isValidSpecSlug(args.spec)) return operationError("INVALID_PARAMETER", "spec must be a valid specification slug", { parameter: "spec" });
  if (!specSlugs(graph).includes(args.spec)) return operationError("NOT_FOUND", `specification not found: ${args.spec}`, { specSlug: args.spec });
  const findings = graph.diagnostics.filter((diagnostic) => diagnostic.span?.path?.startsWith(`.specs/${args.spec}/`)).map((diagnostic) => ({ diagnosticId: diagnostic.diagnosticId, code: diagnostic.code, severity: diagnostic.severity, message: diagnostic.message, source: diagnostic.span ?? null }));
  const valid = findings.every((finding) => finding.severity !== "ERROR");
  return operationSuccess({ kind: "spec-validation", spec: args.spec, valid, verdict: valid ? "VALID" : "INVALID", findings, snapshot: { fingerprint: graph.fingerprint, schemaVersion: graph.schemaVersion }, counts: { nodes: graph.nodes.filter((node) => node.specSlug === args.spec).length, findings: findings.length } });
}

function statusForSpec(graph, spec) {
  const nodes = graph.nodes.filter((node) => node.specSlug === spec);
  const tasks = nodes.filter((node) => node.kind === "TASK");
  const scenarios = nodes.filter((node) => node.kind === "SCENARIO");
  const requirements = nodes.filter((node) => REQUIREMENT_KINDS.has(node.kind));
  const taskStatuses = Object.fromEntries(TASK_STATUSES.map((status) => [status, tasks.filter((task) => taskStatus(task) === status).length]));
  const scenarioIds = scenarios.map((scenario) => scenario.canonicalId).sort(compareStrings);
  const passedScenarioCount = scenarios.filter((scenario) => scenario.attributes?.lastResult === "PASSED" || scenario.attributes?.lastResult === "passed").length;
  return {
    spec,
    counts: { nodes: nodes.length, requirements: requirements.length, tasks: tasks.length, scenarios: scenarios.length, documents: graph.documents.filter((document) => document.specSlug === spec).length },
    taskStatuses,
    scenarios: { total: scenarios.length, passed: passedScenarioCount, ids: scenarioIds },
    readiness: findingsForSpec(graph, spec).length === 0 ? "READY_FOR_REVIEW" : "INCOMPLETE",
  };
}

function findingsForSpec(graph, spec) {
  return graph.diagnostics.filter((diagnostic) => diagnostic.span?.path?.startsWith(`.specs/${spec}/`));
}

function runSpecStatus(graph, args) {
  const view = args.view ?? "status";
  const specs = args.spec === undefined || args.spec === null ? specSlugs(graph) : [args.spec];
  if (specs.some((spec) => !specSlugs(graph).includes(spec))) return operationError("NOT_FOUND", "specification not found", { specSlug: specs.find((spec) => !specSlugs(graph).includes(spec)) });
  const rows = specs.map((spec) => statusForSpec(graph, spec));
  if (view === "counts") return operationSuccess({ kind: "counts", specs: rows.map((row) => row.counts ? { spec: row.spec, ...row.counts } : row) });
  if (view === "coverage") {
    return operationSuccess({ kind: "coverage", specs: rows.map((row) => ({ spec: row.spec, requirements: graph.nodes.filter((node) => node.specSlug === row.spec && REQUIREMENT_KINDS.has(node.kind)).map((node) => ({ ...nodeSummary(node), testedBy: graph.edges.filter((edge) => edge.type === "TESTED_BY" && edge.from === node.canonicalId).map((edge) => edge.to).sort(compareStrings) })) })) });
  }
  if (view === "summary") return operationSuccess({ kind: "summary", specs: rows.map((row) => ({ spec: row.spec, counts: row.counts, readiness: row.readiness })) });
  return operationSuccess({ kind: "status", spec: args.spec ?? null, specs: rows });
}

export function executeExtendedQuery(graph, operation, args = {}) {
  if (!EXTENDED_OPERATIONS.includes(operation)) return operationError("UNKNOWN_OPERATION", `unknown extended operation: ${operation}`);
  switch (operation) {
    case "findByTags": return runFindByTags(graph, args);
    case "listTasks": return runListTasks(graph, args);
    case "listPhaseTasks": return runListTasks(graph, args, true);
    case "findOrphans": return runFindOrphans(graph);
    case "validateAnchor": return runValidateAnchor(graph, args);
    case "listSpecs": return runListSpecs(graph);
    case "validateRequirementMetadata": return runValidateRequirementMetadata(args);
    case "policyQueryRequirements": return runPolicyQueryRequirements(graph, args);
    case "getArchivalProof": return runArchivalProof(graph, args);
    case "validateSpec": return runValidateSpec(graph, args);
    case "getSpecStatus": return runSpecStatus(graph, args);
    default: return operationError("UNKNOWN_OPERATION", `unknown extended operation: ${operation}`);
  }
}

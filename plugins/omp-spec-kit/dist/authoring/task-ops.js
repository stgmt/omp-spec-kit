// Structured task operations: the single place that reads and writes TASK
// block fields. A client that composes task Markdown by hand is refused with
// STRUCTURED_TASK_OP_REQUIRED, so task structure has exactly one author — the
// registry — and the kernel schema stays spec-kernel@2 (fields, not node
// kinds, carry the structure).

import { TASK_STATUS_NORMALIZATION, TASK_STATUSES } from "../kernel/types.js";
import { isValidCanonicalId, isValidLocalId, localIdKind } from "../kernel/identity.js";

export const TASK_DOCUMENT = "TASKS.md";
export const STRUCTURED_TASK_OP_REQUIRED = "STRUCTURED_TASK_OP_REQUIRED";

export const STRUCTURED_TASK_OPERATION_KINDS = Object.freeze([
  "upsert_task",
  "replace_task_status",
  "replace_task_owner",
  "replace_task_links",
]);

const STRUCTURED_KIND_SET = new Set(STRUCTURED_TASK_OPERATION_KINDS);

const META_FIELDS = Object.freeze(["Status", "Owner"]);
const REFERENCE_FIELDS = Object.freeze(["Implements", "Depends On", "Refs"]);
const TRACKING_FIELDS = Object.freeze(["Tracking"]);
const BODY_FIELDS = Object.freeze(["Done When"]);
const ALL_TASK_FIELDS = Object.freeze([
  ...META_FIELDS,
  ...REFERENCE_FIELDS,
  ...TRACKING_FIELDS,
  ...BODY_FIELDS,
]);

const MAX_TITLE_CHARS = 200;
const MAX_FIELD_CHARS = 8192;

// Any authored line that carries a task field the kernel parses. A free-form
// edit that introduces one is refused; the structured operations below are the
// only writers.
const AUTHORED_TASK_FIELD_RE =
  /^[ ]{0,3}(?:[-*][ \t]+)?(?:\*\*)?[ \t]*(?:Status|Owner|Tracking|Implements|Depends On|Refs|Done When|Phase|Estimate|Related|Covers)[ \t]*(?:\*\*)?[ \t]*:/mu;
const AUTHORED_TASK_HEADING_RE = /^##[ \t]+TASK-[1-9][0-9]*(?:[ \t:—–-]|$)/mu;

function fieldPattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^([ ]{0,3}(?:[-*][ \\t]+)?(?:\\*\\*)?[ \\t]*${escaped}[ \\t]*(?:\\*\\*)?[ \\t]*:(?:\\*\\*)?)[ \\t]*(.*)$`,
    "u",
  );
}

function normalizeFieldValue(raw) {
  return String(raw ?? "")
    .replace(/[ \t]*\*\*[ \t]*$/u, "")
    .trim();
}

function parseFieldLine(line, name) {
  const match = fieldPattern(name).exec(line);
  if (!match) return null;
  return { prefix: match[1], value: normalizeFieldValue(match[2]) };
}

function matchTaskHeading(line) {
  const match = /^##[ \t]+([^\s:]+)(?:[ \t]*[—:–-][ \t]*(.*))?[ \t]*$/u.exec(line);
  if (!match) return null;
  return { localId: match[1], title: (match[2] ?? "").trim() };
}

/** Null when the document is not TASKS.md; the task surface owns that one file. */
export function isTaskDocument(document) {
  if (typeof document !== "string") return false;
  const base = document.split(/[\\/]/u).pop() ?? "";
  return base.toUpperCase() === TASK_DOCUMENT.toUpperCase();
}

export function isStructuredTaskOperation(kind) {
  return STRUCTURED_KIND_SET.has(kind);
}

/**
 * Free-form Markdown authoring of task structure is refused. A bare task
 * heading is not structure; fields under one are. Editing a TASK section with
 * a field line carries the same meaning as composing a new block, so both are
 * refused with the one typed reason.
 */
export function freeFormTaskWriteRefusal(operation) {
  // Deleting a whole authored entity is a structured entity operation; it is
  // not a free-form edit of task fields, so the field guard must not block it.
  if (operation?.allowStructuredTaskFields === true) return null;
  if (!isTaskDocument(operation?.document)) return null;
  if (STRUCTURED_KIND_SET.has(operation?.kind)) return null;
  const authored = [operation.content, operation.text, operation.newText]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\n");
  if (authored === "" || !AUTHORED_TASK_FIELD_RE.test(authored)) return null;
  const selector = operation.heading ?? operation.section;
  const selectorText = typeof selector === "string" ? selector.trim().replace(/^#+[ \t]*/u, "") : "";
  const targetsTaskSection = /^TASK-[1-9][0-9]*\b/u.test(selectorText);
  return targetsTaskSection || AUTHORED_TASK_HEADING_RE.test(authored)
    ? {
        code: "INVALID_REQUEST",
        causeCode: STRUCTURED_TASK_OP_REQUIRED,
        message:
          `${STRUCTURED_TASK_OP_REQUIRED}: task fields in ${TASK_DOCUMENT} are written through ` +
          "upsert_task, replace_task_owner, replace_task_links or replace_task_status; " +
          `free-form ${operation.kind} is refused`,
      }
    : null;
}

export function normalizeTaskStatus(raw) {
  if (typeof raw !== "string") return "unknown";
  const stripped = raw.replace(/\s*\(.*?\)\s*/u, "").trim();
  if (stripped === "") return "unknown";
  if (Object.hasOwn(TASK_STATUS_NORMALIZATION, stripped)) return TASK_STATUS_NORMALIZATION[stripped];
  const lowered = stripped.toLowerCase();
  if (lowered === "completed") return "done";
  return TASK_STATUSES.includes(lowered) ? lowered : "unknown";
}

const TASK_LOCAL_ID_RE = /^TASK-[1-9][0-9]*$/u;
const TASK_NUMBER_RE = /^[1-9][0-9]*$/u;

/**
 * One canonical local id from the two spellings a client may send: `TASK-12`
 * and the bare number `12`. Anything else is not a task identity.
 */
export function taskLocalId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (TASK_LOCAL_ID_RE.test(trimmed)) return trimmed;
  if (TASK_NUMBER_RE.test(trimmed)) return `TASK-${trimmed}`;
  return null;
}

function locateTask(lines, localId) {
  const heading = lines.findIndex((line) => {
    const match = matchTaskHeading(line);
    return match !== null && match.localId === localId;
  });
  if (heading < 0) return null;
  let end = lines.length;
  for (let index = heading + 1; index < lines.length; index += 1) {
    if (/^##\s/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { heading, end };
}

function findTaskField(lines, block, name) {
  for (let index = block.heading + 1; index < block.end; index += 1) {
    const parsed = parseFieldLine(lines[index], name);
    if (parsed) return { index, ...parsed };
  }
  return null;
}

function lastLineOfAnyField(lines, block) {
  let last = null;
  for (let index = block.heading + 1; index < block.end; index += 1) {
    if (ALL_TASK_FIELDS.some((name) => parseFieldLine(lines[index], name) !== null)) last = index;
  }
  return last;
}

function insertTaskFieldLine(lines, block, name, value, group) {
  const bullet = group !== "refs";
  const lineText = bullet ? `- **${name}:** ${value}` : `**${name}:** ${value}`;
  const anchors =
    group === "refs"
      ? REFERENCE_FIELDS
      : group === "tracking"
        ? TRACKING_FIELDS
        : group === "body"
          ? BODY_FIELDS
          : META_FIELDS;
  let insertAt = null;
  for (let index = block.end - 1; index > block.heading; index -= 1) {
    if (anchors.some((anchor) => parseFieldLine(lines[index], anchor) !== null)) {
      insertAt = index + 1;
      break;
    }
  }
  if (insertAt === null) {
    const last = lastLineOfAnyField(lines, block);
    insertAt = last === null ? block.heading + 1 : last + 1;
  }
  // Keep the authored block airy: a field never sits directly under the
  // heading, and the meta, reference, tracking and body groups stay separated.
  const previous = lines[insertAt - 1] ?? "";
  const previousIsHeading = /^##[ \t]/u.test(previous);
  const previousIsMeta = META_FIELDS.some((anchor) => parseFieldLine(previous, anchor) !== null);
  const previousIsReference = REFERENCE_FIELDS.some((anchor) => parseFieldLine(previous, anchor) !== null);
  const previousIsTracking = TRACKING_FIELDS.some((anchor) => parseFieldLine(previous, anchor) !== null);
  const previousIsBody = BODY_FIELDS.some((anchor) => parseFieldLine(previous, anchor) !== null);
  const previousIsField = previousIsMeta || previousIsReference || previousIsTracking || previousIsBody;
  const needsBlank =
    previous.trim() !== "" &&
    (previousIsHeading ||
      (group === "refs" && previousIsMeta) ||
      (group === "tracking" && (previousIsMeta || previousIsReference)) ||
      (group === "body" && (previousIsMeta || previousIsReference || previousIsTracking)) ||
      (group === "meta" && previousIsField && !previousIsMeta));
  if (needsBlank) lines.splice(insertAt, 0, "");
  lines.splice(insertAt + (needsBlank ? 1 : 0), 0, lineText);
}


function setTaskField(lines, localId, name, value, group) {
  const block = locateTask(lines, localId);
  if (!block) return { found: false, changed: false };
  const existing = findTaskField(lines, block, name);
  if (existing) {
    if (existing.value === value) return { found: true, changed: false };
    lines[existing.index] = `${existing.prefix} ${value}`;
    return { found: true, changed: true };
  }
  insertTaskFieldLine(lines, block, name, value, group);
  return { found: true, changed: true };
}

function clearTaskField(lines, localId, name) {
  const block = locateTask(lines, localId);
  if (!block) return { found: false, changed: false };
  const existing = findTaskField(lines, block, name);
  if (!existing) return { found: true, changed: false };
  lines.splice(existing.index, 1);
  return { found: true, changed: true };
}

function setTaskTitle(lines, localId, title) {
  const block = locateTask(lines, localId);
  if (!block) return { found: false, changed: false };
  const current = matchTaskHeading(lines[block.heading]);
  if (current.title === title) return { found: true, changed: false };
  lines[block.heading] = `## ${localId} — ${title}`;
  return { found: true, changed: true };
}

function isStringArrayOfTargets(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "");
}

function invalid(message, extra = {}) {
  return { ok: false, code: "INVALID_REQUEST", message, ...extra };
}

function targetList(operation, field) {
  const raw = operation[field];
  if (raw === undefined) return null;
  if (!isStringArrayOfTargets(raw)) return { error: `${field} must be an array of non-empty identifier strings` };
  const seen = new Set();
  for (const entry of raw) {
    const target = entry.trim();
    if (!isValidLocalId(target) && !isValidCanonicalId(target)) {
      return { error: `STRUCTURED_TASK_OP_REQUIRED: ${field} must contain ids, not free text: ${target}` };
    }
    seen.add(target);
  }
  return { targets: [...seen].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)) };
}

function requirementKindAllowed(target) {
  const local = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
  return ["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION"].includes(localIdKind(local));
}

function dependencyKindAllowed(target) {
  const local = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
  return localIdKind(local) === "TASK";
}

function replaceStatus(text, operation) {
  if (typeof operation.entity !== "string" || typeof operation.status !== "string")
    return invalid("replace_task_status needs entity and status");
  const localId = taskLocalId(operation.entity);
  if (localId === null) return invalid(`replace_task_status.entity is not a task id: ${operation.entity}`);
  if (typeof operation.expectedStatus !== "string" || operation.expectedStatus.trim() === "")
    return invalid("replace_task_status needs expectedStatus (the status the caller read)");
  const target = normalizeTaskStatus(operation.status);
  if (target === "unknown" && operation.status !== "unknown")
    return invalid(`replace_task_status.status is not a known task status: ${operation.status}`);
  const expected = normalizeTaskStatus(operation.expectedStatus);
  if (expected === "unknown" && operation.expectedStatus !== "unknown")
    return invalid(`replace_task_status.expectedStatus is not a known task status: ${operation.expectedStatus}`);
  const lines = text.split(/\r?\n/u);
  const block = locateTask(lines, localId);
  if (!block) return { ok: false, code: "VALIDATION_FAILED", message: `task heading not found: ${localId}` };
  const status = findTaskField(lines, block, "Status");
  if (!status)
    return { ok: false, code: "VALIDATION_FAILED", message: `task status field not found: ${localId}` };
  const current = normalizeTaskStatus(status.value);
  if (current !== expected)
    return {
      ok: false,
      code: "STATUS_CONFLICT",
      message: `task ${localId} is in status ${current}, expected ${expected}`,
      localId,
      currentStatus: current,
      expectedStatus: expected,
    };
  if (current === target) return { ok: true, text, unchanged: true, transition: null };
  lines[status.index] = `${status.prefix} ${target}`;
  return {
    ok: true,
    text: lines.join("\n"),
    transition: { localId, from: current, to: target },
  };
}

function upsertTask(text, operation) {
  const localId = taskLocalId(operation.localId);
  if (localId === null) return invalid("upsert_task.localId must be TASK-<n> or <n>");
  if (typeof operation.title !== "string" || operation.title.trim() === "")
    return invalid("upsert_task.title must be a non-empty string");
  const title = operation.title.trim();
  if (/[\r\n]/u.test(title)) return invalid("upsert_task.title must be a single line");
  if (title.length > MAX_TITLE_CHARS) return invalid(`upsert_task.title must be at most ${MAX_TITLE_CHARS} characters`);
  if (operation.body !== undefined && typeof operation.body !== "string")
    return invalid("upsert_task.body must be a string");
  if (typeof operation.body === "string") {
    if (/[\r\n]/u.test(operation.body)) return invalid("upsert_task.body must be a single Markdown line");
    if (operation.body.length > MAX_FIELD_CHARS) return invalid(`upsert_task.body must be at most ${MAX_FIELD_CHARS} characters`);
  }
  for (const name of ["owner", "tracking"]) {
    if (operation[name] !== undefined && (typeof operation[name] !== "string" || /[\r\n]/u.test(operation[name])))
      return invalid(`upsert_task.${name} must be a single-line string`);
  }
  if (operation.tracking !== undefined && operation.tracking.trim() !== "" && !/^agent-teams:[^\s/]+\/[^\s]+$/u.test(operation.tracking.trim()))
    return invalid("upsert_task.tracking must look like agent-teams:<team>/<uuid>");
  if (operation.status !== undefined && !TASK_STATUSES.includes(operation.status))
    return invalid("upsert_task.status must be a known task status");

  const dependsOn = targetList(operation, "dependsOn");
  if (dependsOn?.error) return invalid(dependsOn.error);
  const refs = targetList(operation, "refs");
  if (refs?.error) return invalid(refs.error);
  const requirements = targetList(operation, "requirements");
  if (requirements?.error) return invalid(requirements.error);
  for (const target of dependsOn?.targets ?? [])
    if (!dependencyKindAllowed(target)) return invalid(`upsert_task.dependsOn must reference TASK ids: ${target}`);
  for (const target of requirements?.targets ?? [])
    if (!requirementKindAllowed(target))
      return invalid(`upsert_task.requirements must reference FR, NFR or AC ids: ${target}`);

  const lines = text.split(/\r?\n/u);
  const existing = locateTask(lines, localId);

  if (!existing) {
    const status = operation.status ?? "todo";
    const blockLines = [`## ${localId} — ${title}`, "", `- **Status:** ${status}`];
    if (typeof operation.owner === "string" && operation.owner.trim() !== "")
      blockLines.push(`- **Owner:** ${operation.owner.trim()}`);
    // The authored shape is fixed: Implements and Depends On are reference
    // fields, Tracking and Done When are their own groups, each separated by a
    // blank line so the kernel field scanner reads them unambiguously.
    if (requirements?.targets.length) blockLines.push("", `**Implements:** ${requirements.targets.join(", ")}`);
    if (dependsOn?.targets.length) blockLines.push("", `**Depends On:** ${dependsOn.targets.join(", ")}`);
    if (refs?.targets.length) blockLines.push("", `**Refs:** ${refs.targets.join(", ")}`);
    if (typeof operation.tracking === "string" && operation.tracking.trim() !== "")
      blockLines.push("", `- **Tracking:** ${operation.tracking.trim()}`);
    if (typeof operation.body === "string" && operation.body.trim() !== "")
      blockLines.push("", `- **Done When:** ${operation.body.trim()}`);
    const block = blockLines.join("\n") + "\n";
    const separator = text === "" ? "" : text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
    return { ok: true, text: `${text}${separator}${block}`, created: true };
  }

  const currentStatus = findTaskField(lines, existing, "Status");
  const currentStatusValue = currentStatus ? normalizeTaskStatus(currentStatus.value) : "unknown";
  if (operation.status !== undefined && operation.status !== currentStatusValue)
    return invalid(
      `task ${localId} already exists in status ${currentStatusValue}; status changes go through replace_task_status with expectedStatus`,
      { localId, currentStatus: currentStatusValue },
    );

  let changed = false;
  const titleResult = setTaskTitle(lines, localId, title);
  changed = changed || titleResult.changed;
  if (typeof operation.owner === "string" && operation.owner.trim() !== "") {
    changed = setTaskField(lines, localId, "Owner", operation.owner.trim(), "meta").changed || changed;
  }
  if (requirements !== null) {
    changed = applyListField(lines, localId, "Implements", requirements.targets) || changed;
  }
  if (dependsOn !== null) {
    changed = applyListField(lines, localId, "Depends On", dependsOn.targets) || changed;
  }
  if (refs !== null) {
    changed = applyListField(lines, localId, "Refs", refs.targets) || changed;
  }
  if (typeof operation.tracking === "string" && operation.tracking.trim() !== "") {
    changed = setTaskField(lines, localId, "Tracking", operation.tracking.trim(), "tracking").changed || changed;
  }
  if (typeof operation.body === "string" && operation.body.trim() !== "") {
    changed = setTaskField(lines, localId, "Done When", operation.body.trim(), "body").changed || changed;
  }
  if (!changed) return { ok: true, text, unchanged: true };
  return { ok: true, text: lines.join("\n"), created: false };
}

function applyListField(lines, localId, name, targets) {
  if (!targets || targets.length === 0) return clearTaskField(lines, localId, name).changed;
  return setTaskField(lines, localId, name, targets.join(", "), "refs").changed;
}

function replaceOwner(text, operation) {
  if (typeof operation.entity !== "string") return invalid("replace_task_owner needs entity");
  const localId = taskLocalId(operation.entity);
  if (localId === null) return invalid(`replace_task_owner.entity is not a task id: ${operation.entity}`);
  if (typeof operation.owner !== "string" || operation.owner.trim() === "")
    return invalid("replace_task_owner.owner must be a non-empty string");
  const owner = operation.owner.trim();
  if (/[\r\n]/u.test(owner)) return invalid("replace_task_owner.owner must be a single line");
  if (owner.length > MAX_FIELD_CHARS) return invalid(`replace_task_owner.owner must be at most ${MAX_FIELD_CHARS} characters`);
  const lines = text.split(/\r?\n/u);
  if (!locateTask(lines, localId))
    return { ok: false, code: "VALIDATION_FAILED", message: `task heading not found: ${localId}` };
  const result = setTaskField(lines, localId, "Owner", owner, "meta");
  if (!result.changed) return { ok: true, text, unchanged: true };
  return { ok: true, text: lines.join("\n"), owner };
}

function replaceLinks(text, operation) {
  if (typeof operation.entity !== "string") return invalid("replace_task_links needs entity");
  const localId = taskLocalId(operation.entity);
  if (localId === null) return invalid(`replace_task_links.entity is not a task id: ${operation.entity}`);
  const dependsOn = targetList(operation, "dependsOn");
  if (dependsOn?.error) return invalid(dependsOn.error);
  const refs = targetList(operation, "refs");
  if (refs?.error) return invalid(refs.error);
  const requirements = targetList(operation, "requirements");
  if (requirements?.error) return invalid(requirements.error);
  if (dependsOn === null && refs === null && requirements === null)
    return invalid("replace_task_links needs at least one of dependsOn, refs or requirements");
  for (const target of dependsOn?.targets ?? [])
    if (!dependencyKindAllowed(target)) return invalid(`replace_task_links.dependsOn must reference TASK ids: ${target}`);
  for (const target of requirements?.targets ?? [])
    if (!requirementKindAllowed(target))
      return invalid(`replace_task_links.requirements must reference FR, NFR or AC ids: ${target}`);

  const lines = text.split(/\r?\n/u);
  if (!locateTask(lines, localId))
    return { ok: false, code: "VALIDATION_FAILED", message: `task heading not found: ${localId}` };
  let changed = false;
  if (requirements !== null) changed = applyListField(lines, localId, "Implements", requirements.targets) || changed;
  if (dependsOn !== null) changed = applyListField(lines, localId, "Depends On", dependsOn.targets) || changed;
  if (refs !== null) changed = applyListField(lines, localId, "Refs", refs.targets) || changed;
  if (!changed) return { ok: true, text, unchanged: true };
  return { ok: true, text: lines.join("\n") };
}

/** Entry point for the four structured task operations. */
export function applyTaskOperation(text, operation) {
  if (!isTaskDocument(operation?.document))
    return invalid(`${operation?.kind ?? "task operation"} targets ${TASK_DOCUMENT} only`);
  switch (operation.kind) {
    case "replace_task_status":
      return replaceStatus(text, operation);
    case "upsert_task":
      return upsertTask(text, operation);
    case "replace_task_owner":
      return replaceOwner(text, operation);
    case "replace_task_links":
      return replaceLinks(text, operation);
    default:
      return invalid(`unsupported structured task operation: ${operation.kind}`);
  }
}

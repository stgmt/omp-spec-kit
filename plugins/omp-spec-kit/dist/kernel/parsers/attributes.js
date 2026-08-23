// Kind-specific closed attribute extraction for definition bodies.
// Pure text heuristics over normalized body text; unknown values become null
// or empty arrays, never invented structure.

import { TASK_STATUS_NORMALIZATION } from "../types.js";

// Parse `**Field:** value` style lines plus their immediately following bullet
// lists. Keys keep authored casing; lookup is exact.
export function parseFields(bodyText) {
  const fields = new Map();
  const lines = bodyText.split("\n");
  let current = null;
  const FIELD_RE = /^[ ]{0,3}(?:\*\*)?\s*([A-Za-z][A-Za-z0-9 ]{0,40}?)\s*(?:\*\*)?\s*:\s*(?:\*\*)?(.*)$/u;
  const BULLET_RE = /^[ ]{0,3}[-*][ \t]+(.*)$/u;
  for (const line of lines) {
    const bullet = BULLET_RE.exec(line);
    if (current !== null && bullet) {
      current.bullets.push(bullet[1].trim());
      continue;
    }
    const field = FIELD_RE.exec(line);
    if (field && field[2] !== undefined) {
      const entry = { value: field[2].trim(), bullets: [] };
      const key = field[1].trim();
      if (!fields.has(key)) fields.set(key, entry);
      current = entry;
      continue;
    }
    if (line.trim() === "") continue;
    current = null;
  }
  return fields;
}

function fieldValue(fields, ...names) {
  for (const name of names) {
    const entry = fields.get(name);
    if (entry && entry.value !== "") return entry.value;
  }
  return null;
}

function fieldList(fields, ...names) {
  for (const name of names) {
    const entry = fields.get(name);
    if (!entry) continue;
    const items = [...entry.bullets];
    if (entry.value !== "") {
      for (const token of entry.value.split(/[,;]/u)) {
        const trimmed = token.trim().replace(/^[-*`]|[`]$/gu, "").trim();
        if (trimmed !== "") items.push(trimmed);
      }
    }
    if (items.length > 0) return items.map((item) => item.slice(0, 512));
  }
  return [];
}

const STORY_RE =
  /^[^A-Za-z]*As an?\s+(.{1,200}?),?\s+I want\s+(.{1,400}?)(?:\s+so that\s+(.{1,400}?))?$/is;

function parseStorySentence(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return { actor: null, goal: null, benefit: null };
  }
  const match = STORY_RE.exec(text.trim());
  if (!match) return { actor: null, goal: null, benefit: null };
  return {
    actor: match[1]?.trim() || null,
    goal: match[2]?.trim() || null,
    benefit: match[3]?.trim() || null,
  };
}

function normativeBody(bodyText) {
  // Body text without field markup noise, trimmed and bounded.
  return bodyText.trim();
}

function fixtureHash(value) {
  if (typeof value !== "string") return null;
  const match = /\b[0-9a-f]{64}\b/iu.exec(value);
  return match ? match[0].toLowerCase() : null;
}

// Main entry. `tablePaths` supplies FILE_CHANGE path-table rows collected by
// the Markdown scanner (optional).
export function extractAttributes(documentKind, role, localId, title, bodyText, tablePaths = []) {
  void documentKind;
  const fields = parseFields(bodyText);

  switch (role) {
    case "USER_STORY": {
      const story = parseStorySentence(fields.get("Story")?.value ?? "");
      return {
        priority: fieldValue(fields, "Priority"),
        actor: story.actor,
        goal: story.goal,
        benefit: story.benefit,
      };
    }
    case "USE_CASE":
      return {
        actors: fieldList(fields, "Actors", "Actor"),
        preconditions: fieldList(fields, "Preconditions", "Precondition"),
        postconditions: fieldList(fields, "Postconditions", "Postcondition"),
      };
    case "RESEARCH_FINDING":
      return {
        evidenceRefs: fieldList(fields, "Evidence", "Evidence Refs", "EvidenceRefs"),
        decision: fieldValue(fields, "Decision"),
      };
    case "RISK":
      return {
        likelihood: fieldValue(fields, "Likelihood"),
        impact: fieldValue(fields, "Impact"),
        mitigations: fieldList(fields, "Mitigations", "Mitigation"),
      };
    case "FUNCTIONAL_REQUIREMENT":
      return { normativeText: normativeBody(bodyText) };
    case "NON_FUNCTIONAL_REQUIREMENT": {
      const categoryMatch = /^NFR-([A-Z][A-Z0-9-]*)-[1-9][0-9]*$/u.exec(localId);
      return {
        category: categoryMatch ? categoryMatch[1] : "",
        normativeText: normativeBody(bodyText),
        numericBudgets: fieldList(fields, "Budgets", "Budget", "Numeric Budgets"),
      };
    }
    case "ACCEPTANCE_CRITERION": {
      const numberMatch = /^AC-([1-9][0-9]*)\.[1-9][0-9]*$/u.exec(localId);
      return {
        parentLocalId: numberMatch ? `FR-${numberMatch[1]}` : "",
        earsText: normativeBody(bodyText),
      };
    }
    case "DECISION":
      return {
        rationale: fieldValue(fields, "Rationale"),
        tradeoff: fieldValue(fields, "Trade-off", "Tradeoff"),
        alternatives: fieldList(fields, "Alternatives", "Alternative"),
      };
    case "TASK": {
      const rawStatus = fieldValue(fields, "Status");
      let status;
      if (rawStatus === null || rawStatus === "") status = "unknown";
      else if (Object.hasOwn(TASK_STATUS_NORMALIZATION, rawStatus)) {
        status = TASK_STATUS_NORMALIZATION[rawStatus];
      } else status = "unknown";
      return {
        status,
        estimate: fieldValue(fields, "Estimate"),
        owner: fieldValue(fields, "Owner"),
        doneWhen: fieldList(fields, "Done When", "DoneWhen"),
      };
    }
    case "FILE_CHANGE": {
      const rawAction = (fieldValue(fields, "Action") ?? "").toLowerCase();
      const action = ["create", "edit", "delete"].includes(rawAction) ? rawAction : "create";
      // FC actions are planning statements; absence of an explicit Planned
      // field means planned (matching the canonical corpus form).
      const plannedExplicit = fieldValue(fields, "Planned");
      const planned =
        plannedExplicit === null ? true : /^(true|yes|planned)$/iu.test(plannedExplicit);
      const paths = new Set();
      for (const pathEntry of fieldList(fields, "Paths", "Path")) paths.add(pathEntry);
      for (const tablePath of tablePaths) paths.add(tablePath.pathText);
      return { action, planned, paths: [...paths].slice(0, 256) };
    }
    case "FIXTURE": {
      const rawType = (fieldValue(fields, "fixtureType", "Fixture Type", "Type") ?? "").toLowerCase();
      return {
        fixtureType: rawType === "real" ? "real" : "synthetic",
        provenanceRef: fieldValue(
          fields,
          "sourcePathOrUrl",
          "Provenance",
          "Source",
          "producerName",
        ),
        sha256: fixtureHash(
          fieldValue(fields, "storedSha256", "sourceSha256", "sha256", "SHA-256") ?? "",
        ),
      };
    }
    case "SCHEMA_ENTITY":
      return {
        schemaName: title,
        schemaVersion: fieldValue(fields, "Schema Version", "schemaVersion"),
      };
    default:
      return {};
  }
}

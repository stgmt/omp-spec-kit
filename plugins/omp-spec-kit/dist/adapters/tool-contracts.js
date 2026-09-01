// Single source of truth for all eight SCHEMA-11 read-only tools. The
// `spec_inventory` NAME COLLISION applies only to the OMP extension registry,
// where the v0.1 entry owns that name — the MCP surface has its own namespace,
// so spec_inventory IS one of the eight MCP tools per SCHEMA-11 while
// register-spec-tools (the OMP side) intentionally skips it and registers only
// the remaining seven.
//
// Both transports derive their argument schema from this table so the closed
// SCHEMA-8 op args cannot drift between the OMP zod surface and the MCP JSON
// Schema surface.
//
// Field kinds:
//   string         - { type: "string" }              / z.string()
//   boolean        - { type: "boolean" }             / z.boolean()
//   integer        - { type: "integer", min 1 }      / z.number().int().min(1)
//   nullableString - { type: ["string","null"] }     / z.union([z.string(), z.null()])
//   enum           - { type: "string", enum }        / z.enum(values)
//   enumArray      - { type: "array", items: enum }  / z.array(z.enum(values))
//   stringArray    - { type: "array", items: string }/ z.array(z.string())

import {
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_SEVERITIES,
  EDGE_TYPES,
  LINK_OUTCOMES,
  NODE_KINDS,
} from "../kernel/types.js";

function field(name, kind, values) {
  return values === undefined ? { name, kind } : { name, kind, values };
}

function optionalField(name, kind, values) {
  return { ...field(name, kind, values), optional: true };
}

export const TOOL_CONTRACTS = Object.freeze([
  {
    tool: "spec_inventory",
    label: "Spec Inventory",
    operation: "inventory",
    description:
      "Read a bounded, paged inventory of the specifications under the target repository's .specs directory. MCP-only name: in the OMP extension registry this name is owned by the v0.1 lightweight tool.",
    fields: [
      field("specSlugs", "stringArray"),
      field("includeDocuments", "boolean"),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_get_node",
    label: "Spec Get Node",
    operation: "getNode",
    description:
      "Read one specification graph node by qualified canonical ID (for example plugin-distribution:FR-1), with summary or full projection.",
    fields: [
      field("canonicalId", "string"),
      field("projection", "enum", ["summary", "full"]),
      field("includeIncidentCounts", "boolean"),
    ],
  },
  {
    tool: "spec_find_nodes",
    label: "Spec Find Nodes",
    operation: "findNodes",
    description:
      "Search specification nodes by spec slug, node kind, canonical ID, or bounded text match; empty filter arrays mean all.",
    fields: [
      field("specSlugs", "stringArray"),
      field("kinds", "enumArray", NODE_KINDS),
      field("canonicalIds", "stringArray"),
      field("text", "nullableString"),
      field("projection", "enum", ["summary", "full"]),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_get_edges",
    label: "Spec Get Edges",
    operation: "getEdges",
    description: "List resolved edges incident to one canonical node, optionally aggregated by endpoint pair and type.",
    fields: [
      field("canonicalId", "string"),
      field("direction", "enum", ["in", "out", "both"]),
      field("types", "enumArray", EDGE_TYPES),
      field("aggregate", "boolean"),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_trace",
    label: "Spec Trace",
    operation: "trace",
    description: "Bounded breadth-first trace from one canonical node across resolved edges with depth and visited limits.",
    fields: [
      field("canonicalId", "string"),
      field("direction", "enum", ["in", "out", "both"]),
      field("types", "enumArray", EDGE_TYPES),
      field("maxDepth", "integer"),
      field("maxVisited", "integer"),
      field("projection", "enum", ["summary", "full"]),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_diagnostics",
    label: "Spec Diagnostics",
    operation: "diagnostics",
    description: "List stable parser/graph diagnostics filtered by severity, code, spec slug, and repository-relative path.",
    fields: [
      field("severities", "enumArray", DIAGNOSTIC_SEVERITIES),
      field("codes", "enumArray", DIAGNOSTIC_CODES),
      field("specSlugs", "stringArray"),
      field("paths", "stringArray"),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_overview",
    label: "Spec Overview",
    operation: "overview",
    description: "Read corpus-level counts, limits, and diagnostic-code/node-kind/edge-type histograms for the target repository.",
    fields: [field("specSlugs", "stringArray")],
  },
  {
    tool: "spec_markdown_inventory",
    label: "Spec Markdown Inventory",
    operation: "markdownInventory",
    description:
      "Inventory Markdown headings and GLFM link occurrences (unscoped or heading-focused) to plan safe renames without mutating anything.",
    fields: [
      field("specSlugs", "stringArray"),
      field("mode", "enum", ["all", "focus"]),
      field("focusPath", "nullableString"),
      field("focusAnchor", "nullableString"),
      field("direction", "enum", ["in", "out", "both"]),
      field("outcomes", "enumArray", LINK_OUTCOMES),
      field("includeHeadings", "boolean"),
      field("includeLinks", "boolean"),
      field("limit", "integer"),
      field("cursor", "nullableString"),
    ],
  },
]);

const JSON_SCHEMA_TYPES = {
  string: () => ({ type: "string" }),
  boolean: () => ({ type: "boolean" }),
  integer: () => ({ type: "integer", minimum: 1 }),
  nullableString: () => ({ type: ["string", "null"] }),
  enum: (values) => ({ type: "string", enum: [...values] }),
  enumArray: (values) => ({ type: "array", items: { type: "string", enum: [...values] } }),
  stringArray: () => ({ type: "array", items: { type: "string" } }),
  json: () => ({}),
};

// MCP inputSchema uses closed operation fields plus optional common transport
// metadata. Future-stage fields may be optional; unknown fields remain rejected.
export function jsonSchemaFor(contract) {
  const properties = {};
  const required = [];
  for (const entry of contract.fields) {
    properties[entry.name] = JSON_SCHEMA_TYPES[entry.kind](entry.values);
    if (!entry.optional) required.push(entry.name);
  }
  return {
    type: "object",
    properties: {
      ...properties,
      schemaVersion: { type: "string" },
      requestId: { type: ["string", "null"] },
    },
    required,
    additionalProperties: false,
  };
}
function receivedType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validFieldValue(entry, value) {
  switch (entry.kind) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return Number.isSafeInteger(value) && value >= 1;
    case "nullableString":
      return value === null || typeof value === "string";
    case "enum":
      return typeof value === "string" && entry.values.includes(value);
    case "enumArray":
      return Array.isArray(value) && value.every((item) => typeof item === "string" && entry.values.includes(item));
    case "stringArray":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "json":
      return true;
    default:
      return false;
  }
}

/** Validate the closed wire arguments before dispatching to a handler. */
export function validateContractArguments(contract, args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, code: "INVALID_REQUEST", message: "tool arguments must be an object", parameter: "arguments", expected: "object" };
  }
  const fields = new Map(contract.fields.map((entry) => [entry.name, entry]));
  const unknown = Object.keys(args).filter((key) => !fields.has(key)).sort();
  if (unknown.length > 0) {
    return { ok: false, code: "UNKNOWN_FIELD", message: `unknown tool argument field: ${unknown[0]}`, parameter: unknown[0], expected: "declared contract field" };
  }
  for (const entry of contract.fields) {
    if (args[entry.name] === undefined) {
      if (!entry.optional) return { ok: false, code: "INVALID_REQUEST", message: `required tool argument is missing: ${entry.name}`, parameter: entry.name, expected: entry.kind };
      continue;
    }
    if (!validFieldValue(entry, args[entry.name])) {
      return { ok: false, code: "INVALID_REQUEST", message: `tool argument has the wrong type or value: ${entry.name}`, parameter: entry.name, expected: entry.kind, receivedType: receivedType(args[entry.name]) };
    }
  }
  return { ok: true };
}

// OMP zod parameters derived from the same table. register-spec-tools filters
// out spec_inventory before calling this — that name stays owned by the v0.1
// extension entry in the OMP registry.
export function zodParametersFor(contract, z) {
  const shape = {};
  for (const entry of contract.fields) {
    let schema;
    switch (entry.kind) {
      case "string":
        schema = z.string();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "integer":
        schema = z.number().int().min(1);
        break;
      case "nullableString":
        schema = z.union([z.string(), z.null()]);
        break;
      case "enum":
        schema = z.enum([...entry.values]);
        break;
      case "enumArray":
        schema = z.array(z.enum([...entry.values]));
        break;
      case "stringArray":
        schema = z.array(z.string());
        break;
      case "json":
        schema = z.unknown();
        break;
      default:
        throw new Error(`unknown tool contract field kind: ${entry.kind}`);
    }
    shape[entry.name] = entry.optional ? schema.optional() : schema;
  }
  // Common SCHEMA-11 transport fields stay optional at both surfaces; an
  // absent schemaVersion means the current kernel contract. A contract-owned
  // requestId remains required when the operation explicitly declares it.
  if (shape.schemaVersion === undefined) shape.schemaVersion = z.string().optional();
  if (shape.requestId === undefined) shape.requestId = z.union([z.string(), z.null()]).optional();
  return z.object(shape).strict();
}

const TASK_STATUS_VALUES = ["planned", "todo", "ready", "in-progress", "blocked", "done", "deferred", "unknown"];
const VERIFICATION_METHOD_VALUES = ["test", "analysis", "review", "inspection", "demonstration"];
const SAFETY_CLASS_VALUES = ["critical", "major", "minor"];
const DELIVERY_VALUES = ["NOT_DECLARED", "DELIVERED", "INCOMPLETE"];
const SPEC_STATUS_VALUES = ["active", "backlog"];
const READINESS_VIEW_VALUES = ["status", "summary", "counts", "coverage"];

function futureContract(tool, label, operation, description, fields) {
  return { tool, label, operation, description, fields };
}

export const READ_COMPLETE_TOOL_CONTRACTS = Object.freeze([
  ...TOOL_CONTRACTS,
  futureContract(
    "find_by_tags",
    "Find Scenarios By Tags",
    "findByTags",
    "List scenarios whose tag set contains every requested tag.",
    [field("tags", "stringArray")],
  ),
  futureContract(
    "list_tasks",
    "List Spec Tasks",
    "listTasks",
    "List bounded tasks for one specification, with status, phase, requirement, and cursor filters.",
    [
      field("spec", "string"),
      optionalField("statuses", "enumArray", TASK_STATUS_VALUES),
      optionalField("phase", "nullableString"),
      optionalField("requirement", "nullableString"),
      optionalField("includeComments", "boolean"),
      optionalField("limit", "integer"),
      optionalField("cursor", "nullableString"),
    ],
  ),
  futureContract(
    "list_phase_tasks",
    "List Phase Tasks",
    "listPhaseTasks",
    "List tasks under one exact canonical task phase.",
    [
      field("spec", "string"),
      field("phase", "string"),
      optionalField("statuses", "enumArray", TASK_STATUS_VALUES),
      optionalField("includeComments", "boolean"),
      optionalField("limit", "integer"),
      optionalField("cursor", "nullableString"),
    ],
  ),
  futureContract(
    "find_orphans",
    "Find Orphaned Spec Nodes",
    "findOrphans",
    "Return structural orphan findings for uncovered requirements, tasks, and scenarios.",
    [],
  ),
  futureContract(
    "validate_anchor",
    "Validate Spec Anchor",
    "validateAnchor",
    "Validate a canonical node ID or Markdown heading anchor without writing.",
    [field("anchor", "string"), optionalField("spec", "nullableString")],
  ),
  futureContract(
    "list_specs",
    "List Specifications",
    "listSpecs",
    "Enumerate specification slugs present in the current graph.",
    [],
  ),
  futureContract(
    "validate_requirement_metadata",
    "Validate Requirement Metadata",
    "validateRequirementMetadata",
    "Validate a typed requirement metadata object without writing.",
    [field("metadata", "json")],
  ),
  futureContract(
    "policy_query_requirements",
    "Query Requirement Policy",
    "policyQueryRequirements",
    "Filter requirements by verification method, safety class, missing metadata, and delivery.",
    [
      optionalField("spec", "nullableString"),
      optionalField("verificationMethod", "enum", VERIFICATION_METHOD_VALUES),
      optionalField("safetyClass", "enum", SAFETY_CLASS_VALUES),
      optionalField("verificationMethodMissing", "boolean"),
      optionalField("delivery", "enum", DELIVERY_VALUES),
    ],
  ),
  futureContract(
    "get_archival_proof",
    "Get Archival Proof",
    "getArchivalProof",
    "Check whether a specification has live inbound references from other specifications.",
    [field("spec", "string")],
  ),
  futureContract(
    "validate_spec",
    "Validate Specification",
    "validateSpec",
    "Run the bounded graph validation for one specification without writing.",
    [field("spec", "string")],
  ),
  futureContract(
    "get_spec_status",
    "Get Specification Status",
    "getSpecStatus",
    "Read status, counts, or structural coverage for one specification or the corpus.",
    [optionalField("spec", "nullableString"), optionalField("view", "enum", READINESS_VIEW_VALUES)],
  ),
  futureContract(
    "mcp_preflight",
    "MCP Preflight",
    "mcpPreflight",
    "Read redacted root, version, lock, and dependency admission facts.",
    [optionalField("declaredWorktree", "nullableString")],
  ),
  futureContract(
    "list_spec_docs",
    "List Specification Documents",
    "listSpecDocs",
    "List readable documents and binary attachments under one specification.",
    [field("spec", "string")],
  ),
  futureContract(
    "read_spec_doc",
    "Read Specification Document",
    "readSpecDoc",
    "Read one contained specification document, optionally by section or bounded line window.",
    [
      field("spec", "string"),
      field("doc", "string"),
      optionalField("section", "nullableString"),
      optionalField("offset", "integer"),
      optionalField("limit", "integer"),
      optionalField("readForEdit", "boolean"),
    ],
  ),
  futureContract(
    "read_attachment",
    "Read Specification Attachment",
    "readAttachment",
    "Read one contained binary attachment as a bounded base64 payload.",
    [field("spec", "string"), field("path", "string")],
  ),
]);

export const EVIDENCE_TOOL_CONTRACTS = Object.freeze([
  ...READ_COMPLETE_TOOL_CONTRACTS,
  futureContract(
    "get_test_result",
    "Get Scenario Test Result",
    "getTestResult",
    "Read the last recorded result and freshness fields for one scenario.",
    [field("scenarioId", "string"), optionalField("spec", "nullableString")],
  ),
  futureContract(
    "get_scenario_trace",
    "Get Scenario Trace",
    "getScenarioTrace",
    "Read one scenario result with its hash-bound runtime trace metadata.",
    [field("scenarioId", "string"), optionalField("spec", "nullableString")],
  ),
]);

export const AUTHORING_TOOL_CONTRACTS = Object.freeze([
  ...EVIDENCE_TOOL_CONTRACTS,
  futureContract(
    "propose_spec_change",
    "Propose Specification Change",
    "proposeSpecChange",
    "Create a dry-run proposal for one document change; no bytes are written.",
    [
      field("spec", "string"),
      field("doc", "string"),
      field("change", "json"),
      field("reason", "string"),
      optionalField("expectedSha", "nullableString"),
    ],
  ),
  futureContract(
    "apply_spec_change",
    "Apply Proposed Specification Change",
    "applySpecChange",
    "Apply an existing proposal through the central transactional writer.",
    [
      field("requestId", "string"),
      field("proposalId", "string"),
      field("proposalSha256", "string"),
      field("reason", "string"),
      optionalField("expectedDocuments", "json"),
      optionalField("actorRef", "nullableString"),
      optionalField("approval", "enum", ["approve"]),
    ],
  ),
  futureContract(
    "propose_patch",
    "Propose Specification Patch",
    "proposePatch",
    "Create a complete proposal for a set of specification operations; no bytes are written.",
    [
      field("requestId", "string"),
      field("repositoryRootFingerprint", "string"),
      field("spec", "string"),
      field("reason", "string"),
      field("operations", "json"),
    ],
  ),
  futureContract(
    "apply_proposed_patch",
    "Apply Proposed Specification Patch",
    "applyProposedPatch",
    "Apply a previously reviewed patch after rechecking its proposal and document hashes.",
    [
      field("requestId", "string"),
      field("proposalId", "string"),
      field("proposalSha256", "string"),
      field("expectedDocuments", "json"),
      field("reason", "string"),
      optionalField("actorRef", "nullableString"),
      optionalField("approval", "enum", ["approve"]),
    ],
  ),
  futureContract(
    "apply_spec_transaction",
    "Apply Specification Transaction",
    "applySpecTransaction",
    "Apply a proposal-backed multi-document transaction through the central writer.",
    [field("requestId", "string"), field("proposalId", "string"), field("reason", "string"), optionalField("approval", "enum", ["approve"])],
  ),
  futureContract(
    "append_to_section",
    "Append To Section",
    "appendToSection",
    "Compile an append operation into a proposal; direct writes are refused.",
    [field("spec", "string"), field("doc", "string"), field("heading", "string"), field("text", "string"), field("reason", "string"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "insert_after_heading",
    "Insert After Heading",
    "insertAfterHeading",
    "Compile an insertion operation into a proposal; direct writes are refused.",
    [field("spec", "string"), field("doc", "string"), field("heading", "string"), field("text", "string"), field("reason", "string"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "insert_at_eof",
    "Insert At End Of Document",
    "insertAtEof",
    "Compile an end-of-file insertion into a proposal; direct writes are refused.",
    [field("spec", "string"), field("doc", "string"), field("text", "string"), field("reason", "string"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "replace_in_section",
    "Replace In Section",
    "replaceInSection",
    "Compile a bounded section replacement into a proposal; direct writes are refused.",
    [field("spec", "string"), field("doc", "string"), field("heading", "string"), field("oldText", "string"), field("newText", "string"), field("reason", "string"), optionalField("replaceAll", "boolean"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "amend_requirement",
    "Amend Requirement",
    "amendRequirement",
    "Compile a requirement amendment into a proposal; direct writes are refused.",
    [field("spec", "string"), field("requirement", "string"), field("body", "string"), field("reason", "string"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "add_acceptance_criterion",
    "Add Acceptance Criterion",
    "addAcceptanceCriterion",
    "Compile a canonical acceptance criterion into a proposal.",
    [field("spec", "string"), field("requirement", "string"), field("criterion", "string"), field("reason", "string")],
  ),
  futureContract(
    "add_phase",
    "Add Task Phase",
    "addPhase",
    "Compile a task phase into a proposal.",
    [field("spec", "string"), field("title", "string"), field("reason", "string"), optionalField("phase", "string")],
  ),
  futureContract(
    "set_entity_status",
    "Set Entity Status",
    "setEntityStatus",
    "Compile a validated task status transition into a proposal.",
    [field("spec", "string"), field("entity", "string"), field("status", "enum", TASK_STATUS_VALUES), field("reason", "string")],
  ),
  futureContract(
    "set_spec_status",
    "Set Specification Status",
    "setSpecStatus",
    "Compile an explicit specification status change into a proposal.",
    [field("spec", "string"), field("status", "enum", SPEC_STATUS_VALUES), field("reason", "string")],
  ),
  futureContract(
    "set_requirement_metadata",
    "Set Requirement Metadata",
    "setRequirementMetadata",
    "Validate and compile a typed requirement metadata block into a proposal.",
    [field("spec", "string"), field("requirement", "string"), field("metadata", "json"), field("reason", "string")],
  ),
  futureContract(
    "propose_requirement_contract",
    "Propose Requirement Contract",
    "proposeRequirementContract",
    "Create a proposal-backed typed requirement contract.",
    [field("spec", "string"), field("requirement", "string"), field("contract", "json"), field("reason", "string")],
  ),
  futureContract(
    "propose_spec_repairs",
    "Propose Specification Repairs",
    "proposeSpecRepairs",
    "Create a dry-run proposal for bounded mechanical repairs.",
    [field("spec", "string"), field("reason", "string"), optionalField("repairs", "json")],
  ),
  futureContract(
    "apply_spec_repairs",
    "Apply Specification Repairs",
    "applySpecRepairs",
    "Apply a previously reviewed repair proposal through the central writer.",
    [field("requestId", "string"), field("proposalId", "string"), field("proposalSha256", "string"), field("expectedDocuments", "json"), field("reason", "string"), optionalField("approval", "enum", ["approve"])],
  ),
  futureContract(
    "delete_spec_doc",
    "Delete Specification Document",
    "deleteSpecDoc",
    "Compile a contained document deletion into a proposal.",
    [field("spec", "string"), field("doc", "string"), field("reason", "string"), optionalField("expectedSha", "nullableString")],
  ),
  futureContract(
    "rename_spec_doc",
    "Rename Specification Document",
    "renameSpecDoc",
    "Compile a contained document rename into a proposal; refuse when inbound Markdown links would break.",
    [field("spec", "string"), field("doc", "string"), field("newDoc", "string"), field("reason", "string")],
  ),
  futureContract(
    "create_spec",
    "Create Specification",
    "createSpec",
    "Compile a complete canonical specification scaffold into a proposal.",
    [field("spec", "string"), field("reason", "string"), optionalField("title", "nullableString")],
  ),
  futureContract(
    "archive_spec",
    "Archive Specification",
    "archiveSpec",
    "Compile an archival move after live inbound-reference proof.",
    [field("spec", "string"), field("reason", "string")],
  ),
  futureContract(
    "add_backlog_task",
    "Add Backlog Task",
    "addBacklogTask",
    "Compile a traced backlog task into a proposal.",
    [field("spec", "string"), field("title", "string"), field("reason", "string"), optionalField("requirements", "json")],
  ),
  futureContract(
    "register_incident_backlog",
    "Register Incident Backlog",
    "registerIncidentBacklog",
    "Compile a traced incident task into a proposal.",
    [field("spec", "string"), field("summary", "string"), field("reason", "string"), optionalField("requirements", "json")],
  ),
]);

export function toolContractsForStage(stage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE) {
  const value = typeof stage === "string" ? stage.trim().toLowerCase() : "";
  if (value === "read-complete" || value === "v0.4.0") return READ_COMPLETE_TOOL_CONTRACTS;
  if (value === "evidence" || value === "v0.5.0") return EVIDENCE_TOOL_CONTRACTS;
  if (value === "authoring" || value === "v0.6.0" || value === "v0.7.0") return AUTHORING_TOOL_CONTRACTS;
  return TOOL_CONTRACTS;
}

export function ompToolContractsForStage(stage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE) {
  return Object.freeze(toolContractsForStage(stage).filter((contract) => contract.tool !== "spec_inventory"));
}

// The seven tools registered on the OMP side (spec_inventory excluded)
// for the historical v0.3.2 compatibility profile.
export const OMP_TOOL_CONTRACTS = Object.freeze(TOOL_CONTRACTS.filter((c) => c.tool !== "spec_inventory"));

export const TOOL_AUTHORITY_ABI = "tool-call-authority-abi@1";

export function authorityProfileAccepted(env = globalThis.process?.env) {
  if (env?.OMP_SPEC_KIT_INTERNAL_DOGFOOD === "1") return true;
  return (
    env?.OMP_SPEC_KIT_AUTHORITY_ACCEPTED === "1" &&
    env?.OMP_SPEC_KIT_AUTHORITY_ABI === TOOL_AUTHORITY_ABI &&
    env?.OMP_SPEC_KIT_ENFORCEMENT_ACCEPTED === "1"
  );
}

export function activeStageForEnvironment(stage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE, env = globalThis.process?.env) {
  const normalized = typeof stage === "string" ? stage.trim().toLowerCase() : "";
  if (["authoring", "v0.6.0", "v0.7.0", "plan-gate"].includes(normalized) && !authorityProfileAccepted(env)) return "v0.3.2";
  return normalized || stage;
}

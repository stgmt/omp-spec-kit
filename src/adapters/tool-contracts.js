// Single source of truth for the consolidated 10-tool MCP surface.
// Every tool is task-oriented, strictly typed, and self-contained.
// 9 tools are read-only; exactly 1 tool (spec_patch) is mutating.

import {
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_SEVERITIES,
  EDGE_TYPES,
  EDGE_TYPE_DESCRIPTORS,
  ENTITY_TYPE_DESCRIPTORS,
  LINK_OUTCOMES,
  NODE_KINDS,
} from "../kernel/types.js";
import {
  ELICITATION_HINT,
  ELICITATION_REQUIRED,
  ELICITATION_SKILL_URI,
} from "../authoring/elicitation-guard.js";

export { ELICITATION_HINT, ELICITATION_REQUIRED, ELICITATION_SKILL_URI };

export function field(name, kind, values) {
  return values === undefined ? { name, kind } : { name, kind, values };
}

export function optionalField(name, kind, values) {
  return { ...field(name, kind, values), optional: true };
}

// Transport-level context, not operation arguments: every tool may name the
// registry project that serves the call, and the local stdio/test transport may
// name a worktree root. The generator injects them into every advertised input
// schema so the declared contract and the accepted arguments cannot diverge.
export const TRANSPORT_CONTEXT_FIELDS = Object.freeze({
  project: Object.freeze({ type: "string" }),
  declaredWorktree: Object.freeze({ type: "string" }),
});

function addTransportContextFields(properties) {
  for (const [name, specification] of Object.entries(TRANSPORT_CONTEXT_FIELDS)) {
    if (properties[name] === undefined) properties[name] = { ...specification };
  }
}

export const TASK_STATUS_VALUES = Object.freeze([
  "planned",
  "todo",
  "ready",
  "in-progress",
  "blocked",
  "done",
  "deferred",
  "unknown",
  "deleted",
]);

export const VERIFICATION_METHOD_VALUES = Object.freeze([
  "test",
  "analysis",
  "review",
  "inspection",
  "demonstration",
]);

export const SAFETY_CLASS_VALUES = Object.freeze(["critical", "major", "minor"]);
export const DELIVERY_VALUES = Object.freeze(["NOT_DECLARED", "DELIVERED", "INCOMPLETE"]);
export const SPEC_STATUS_VALUES = Object.freeze(["active", "backlog"]);
export const TASK_REVIEW_VALUES = Object.freeze(["none", "requested", "approved", "changes-requested"]);
export const READINESS_VIEW_VALUES = Object.freeze(["status", "summary", "counts", "coverage"]);

export const PATCH_OPERATION_KINDS = Object.freeze([
  "insert_at_eof",
  "insert_after_heading",
  "replace_section",
  "replace_in_section",
  "replace_task_status",
  "create_task",
  "update_task",
  "replace_task_owner",
  "replace_task_links",
  "append_task_comment",
  "replace_document",
  "delete_document",
  "rename_document",
]);

export const TOOL_CONTRACTS = Object.freeze([
  {
    tool: "mcp_preflight",
    label: "MCP Preflight",
    operation: "mcpPreflight",
    description: "Read redacted root, lock, and dependency admission facts.",
    fields: [optionalField("declaredWorktree", "string")],
  },
  {
    tool: "spec_catalog",
    label: "Spec Catalog",
    operation: "catalog",
    description: "Query the spec catalog.",
    discriminator: "view",
    variants: Object.freeze({
      types: Object.freeze({
        description: "Return the authoritative domain type dictionary of 15 entity kinds and 7 edge types.",
        fields: Object.freeze([]),
      }),
      specs: Object.freeze({
        description: "List all specification slugs present in the current repository.",
        fields: Object.freeze([]),
      }),
      inventory: Object.freeze({
        description: "Read a bounded, paged inventory of specifications and documents.",
        fields: Object.freeze([
          optionalField("specSlugs", "stringArray"),
          optionalField("includeDocuments", "boolean"),
          optionalField("limit", "integer"),
          optionalField("cursor", "nullableString"),
        ]),
      }),
      overview: Object.freeze({
        description: "Read corpus counts and histograms.",
        fields: Object.freeze([optionalField("specSlugs", "stringArray")]),
      }),
      status: Object.freeze({
        description: "Read status, counts, or structural coverage for one specification or the corpus.",
        fields: Object.freeze([
          optionalField("spec", "string"),
          optionalField("statusView", "enum", READINESS_VIEW_VALUES),
        ]),
      }),
      branches: Object.freeze({
        description: "List spec branches.",
        fields: Object.freeze([]),
      }),
    }),
  },
  {
    tool: "spec_entities",
    label: "Spec Entities",
    operation: "entities",
    description: "Get or find spec nodes by canonical ID, slug, kind, or text.",
    discriminator: "mode",
    variants: Object.freeze({
      get: Object.freeze({
        description: "Read one specification node by qualified canonical ID.",
        fields: Object.freeze([
          field("canonicalId", "string"),
          optionalField("projection", "enum", ["summary", "full"]),
          optionalField("includeIncidentCounts", "boolean"),
        ]),
      }),
      find: Object.freeze({
        description: "Search specification nodes by spec slug, node kind, canonical ID, or bounded text match.",
        fields: Object.freeze([
          optionalField("specSlugs", "stringArray"),
          optionalField("kinds", "enumArray", NODE_KINDS),
          optionalField("canonicalIds", "stringArray"),
          optionalField("text", "nullableString"),
          optionalField("projection", "enum", ["summary", "full"]),
          optionalField("limit", "integer"),
          optionalField("cursor", "nullableString"),
        ]),
      }),
    }),
  },
  {
    tool: "spec_graph",
    label: "Spec Graph",
    operation: "graph",
    description: "Read incident edges, bounded trace, or one complete board projection.",
    discriminator: "view",
    variants: Object.freeze({
      edges: Object.freeze({
        description: "List resolved edges incident to one canonical node, optionally aggregated.",
        fields: Object.freeze([
          field("canonicalId", "string"),
          optionalField("direction", "enum", ["in", "out", "both"]),
          optionalField("types", "enumArray", EDGE_TYPES),
          optionalField("aggregate", "boolean"),
          optionalField("limit", "integer"),
          optionalField("cursor", "nullableString"),
        ]),
      }),
      trace: Object.freeze({
        description: "Bounded breadth-first trace from one canonical node across resolved edges.",
        fields: Object.freeze([
          field("canonicalId", "string"),
          optionalField("direction", "enum", ["in", "out", "both"]),
          optionalField("types", "enumArray", EDGE_TYPES),
          optionalField("maxDepth", "integer"),
          optionalField("maxVisited", "integer"),
          optionalField("projection", "enum", ["summary", "full"]),
          optionalField("limit", "integer"),
          optionalField("cursor", "nullableString"),
        ]),
      }),
      board: Object.freeze({
        description: "Read one complete bounded board projection for the whole corpus or selected specifications.",
        fields: Object.freeze([
          optionalField("specSlugs", "stringArray"),
        ]),
      }),
    }),
  },
  {
    tool: "spec_documents",
    label: "Spec Documents",
    operation: "documents",
    description: "List, read, or fetch attachments for spec documents.",
    discriminator: "action",
    variants: Object.freeze({
      list: Object.freeze({
        description: "List readable documents and binary attachments under one specification.",
        fields: Object.freeze([field("spec", "string")]),
      }),
      read: Object.freeze({
        description: "Read one specification document, optionally by section or window.",
        fields: Object.freeze([
          field("spec", "string"),
          field("doc", "string"),
          optionalField("section", "nullableString"),
          optionalField("offset", "integer"),
          optionalField("limit", "integer"),
          optionalField("readForEdit", "boolean"),
          optionalField("version", "nullableString"),
        ]),
      }),
      attachment: Object.freeze({
        description: "Read one binary attachment as a base64 payload.",
        fields: Object.freeze([
          field("spec", "string"),
          field("path", "string"),
        ]),
      }),
    }),
  },
  {
    tool: "spec_inspect",
    label: "Spec Inspect",
    operation: "inspect",
    description: "Run validation, orphans, anchors, and policy checks.",
    discriminator: "check",
    variants: Object.freeze({
      scenariosByTags: Object.freeze({
        description: "List scenarios whose tag set contains every requested tag.",
        fields: Object.freeze([field("tags", "stringArray")]),
      }),
      orphans: Object.freeze({
        description: "Return structural orphan findings for uncovered requirements, tasks, and scenarios.",
        fields: Object.freeze([]),
      }),
      anchor: Object.freeze({
        description: "Validate a canonical node ID or Markdown heading anchor without writing.",
        fields: Object.freeze([
          field("anchor", "string"),
          optionalField("spec", "string"),
        ]),
      }),
      requirementMetadata: Object.freeze({
        description: "Validate a typed requirement metadata object without writing.",
        fields: Object.freeze([field("metadata", "json")]),
      }),
      requirementsPolicy: Object.freeze({
        description: "Filter requirements by verification method, safety class, missing metadata, and delivery.",
        fields: Object.freeze([
          optionalField("spec", "string"),
          optionalField("verificationMethod", "enum", VERIFICATION_METHOD_VALUES),
          optionalField("safetyClass", "enum", SAFETY_CLASS_VALUES),
          optionalField("verificationMethodMissing", "boolean"),
          optionalField("delivery", "enum", DELIVERY_VALUES),
        ]),
      }),
      archivalProof: Object.freeze({
        description: "Check whether a specification has live inbound references from other specifications.",
        fields: Object.freeze([field("spec", "string")]),
      }),
      validation: Object.freeze({
        description: "Run bounded graph validation and return verdict, scope counts, and filtered diagnostics.",
        fields: Object.freeze([
          optionalField("specSlugs", "stringArray"),
          optionalField("severities", "enumArray", DIAGNOSTIC_SEVERITIES),
          optionalField("codes", "enumArray", DIAGNOSTIC_CODES),
          optionalField("paths", "stringArray"),
          optionalField("limit", "integer"),
          optionalField("cursor", "nullableString"),
        ]),
      }),
    }),
  },
  {
    tool: "spec_tasks",
    label: "Spec Tasks",
    operation: "tasks",
    description: "List tasks for one spec with status, phase, and requirement filters.",
    fields: [
      field("spec", "string"),
      optionalField("statuses", "enumArray", TASK_STATUS_VALUES),
      optionalField("phase", "nullableString"),
      optionalField("requirement", "nullableString"),
      optionalField("includeComments", "boolean"),
      optionalField("limit", "integer"),
      optionalField("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_evidence",
    label: "Spec Evidence",
    operation: "evidence",
    description: "Read scenario test results or execution trace metadata.",
    discriminator: "view",
    variants: Object.freeze({
      result: Object.freeze({
        description: "Read the last recorded result and freshness fields for one scenario.",
        fields: Object.freeze([
          field("scenarioId", "string"),
          optionalField("spec", "string"),
        ]),
      }),
      trace: Object.freeze({
        description: "Read one scenario result with its hash-bound runtime trace metadata.",
        fields: Object.freeze([
          field("scenarioId", "string"),
          optionalField("spec", "string"),
        ]),
      }),
    }),
  },
  {
    tool: "spec_markdown",
    label: "Spec Markdown",
    operation: "markdown",
    description: "Inventory Markdown headings and links to plan safe edits.",
    fields: [
      optionalField("specSlugs", "stringArray"),
      optionalField("mode", "enum", ["all", "focus"]),
      optionalField("focusPath", "nullableString"),
      optionalField("focusAnchor", "nullableString"),
      optionalField("direction", "enum", ["in", "out", "both"]),
      optionalField("outcomes", "enumArray", LINK_OUTCOMES),
      optionalField("includeHeadings", "boolean"),
      optionalField("includeLinks", "boolean"),
      optionalField("limit", "integer"),
      optionalField("cursor", "nullableString"),
    ],
  },
  {
    tool: "spec_patch",
    label: "Spec Patch",
    operation: "specPatch",
    mutating: true,
    description: "Preview or apply spec patches in memory or atomically to disk.",
    discriminator: "intent",
    commonFields: Object.freeze([
      field("requestId", "string"),
      field("reason", "string"),
      field("spec", "string"),
      optionalField("dryRun", "boolean"),
      optionalField("actorRef", "nullableString"),
    ]),
    variants: Object.freeze({
      patch: Object.freeze({
        description: "Patch operations on one spec.",
        fields: Object.freeze([
          optionalField("repositoryRootFingerprint", "string"),
          optionalField("designReview", "json"),
          field("operations", "operations"),
          // Declared here as well: clients read force from the operations
          // variant, and task maintenance needs it for idempotent cleanup.
          optionalField("force", "boolean"),
        ]),
      }),
      amendRequirement: Object.freeze({
        description: "Amend a requirement.",
        fields: Object.freeze([
          field("requirement", "string"),
          field("body", "string"),
          optionalField("expectedSha", "string"),
        ]),
      }),
      addAcceptanceCriterion: Object.freeze({
        description: "Add an acceptance criterion.",
        fields: Object.freeze([
          field("requirement", "string"),
          field("criterion", "string"),
        ]),
      }),
      addPhase: Object.freeze({
        description: "Add a task phase.",
        fields: Object.freeze([field("title", "string")]),
      }),
      confirmTaskCreation: Object.freeze({
        description: "Create one canonical task in TASKS.md.",
        fields: Object.freeze([
          field("entity", "string"),
          field("subject", "string"),
          field("requirements", "stringArray"),
          optionalField("owner", "nullableString"),
          optionalField("description", "string"),
          optionalField("status", "enum", TASK_STATUS_VALUES),
          optionalField("creationToken", "string"),
        ]),
      }),
      updateTask: Object.freeze({
        description: "Update one canonical task: status, owner, description, review state or links.",
        fields: Object.freeze([
          field("entity", "string"),
          optionalField("status", "enum", TASK_STATUS_VALUES),
          optionalField("owner", "nullableString"),
          optionalField("expectedStatus", "enum", TASK_STATUS_VALUES),
          optionalField("description", "string"),
          optionalField("clearOwner", "boolean"),
          optionalField("force", "boolean"),
          optionalField("review", "enum", TASK_REVIEW_VALUES),
          optionalField("refs", "stringArray"),
          optionalField("dependsOn", "stringArray"),
        ]),
      }),
      addTaskComment: Object.freeze({
        description: "Append one comment to a canonical task.",
        fields: Object.freeze([
          field("entity", "string"),
          field("text", "string"),
          optionalField("actor", "string"),
        ]),
      }),
      setEntityStatus: Object.freeze({
        description: "Apply a task status transition.",
        fields: Object.freeze([
          field("entity", "string"),
          field("status", "enum", TASK_STATUS_VALUES),
        ]),
      }),
      setSpecStatus: Object.freeze({
        description: "Apply a spec status change.",
        fields: Object.freeze([field("status", "enum", SPEC_STATUS_VALUES)]),
      }),
      setRequirementMetadata: Object.freeze({
        description: "Apply a requirement metadata block.",
        fields: Object.freeze([
          field("requirement", "string"),
          field("metadata", "json"),
        ]),
      }),
      deleteSpecDoc: Object.freeze({
        description: "Delete a spec document.",
        fields: Object.freeze([
          field("doc", "string"),
          optionalField("expectedSha", "string"),
          optionalField("designReview", "json"),
        ]),
      }),
      deleteEntity: Object.freeze({
        description: "Delete one authored entity from its owning document.",
        fields: Object.freeze([
          field("entity", "string"),
          optionalField("forceDelete", "boolean"),
          optionalField("designReview", "json"),
        ]),
      }),
      renameSpecDoc: Object.freeze({
        description: "Rename a spec document.",
        fields: Object.freeze([
          field("doc", "string"),
          field("newDoc", "string"),
          optionalField("designReview", "json"),
        ]),
      }),
      createSpec: Object.freeze({
        description: "Create a canonical spec scaffold.",
        fields: Object.freeze([
          optionalField("title", "string"),
          optionalField("designReview", "json"),
        ]),
      }),
      archiveSpec: Object.freeze({
        description: "Archive a spec after inbound-reference proof.",
        fields: Object.freeze([optionalField("designReview", "json")]),
      }),
      addBacklogTask: Object.freeze({
        description: "Add a traced backlog task.",
        fields: Object.freeze([
          field("title", "string"),
          optionalField("requirements", "json"),
        ]),
      }),
      registerIncidentBacklog: Object.freeze({
        description: "Preview or apply a traced incident task.",
        fields: Object.freeze([
          field("summary", "string"),
          optionalField("requirements", "json"),
        ]),
      }),
      createRoadmap: Object.freeze({
        description: "Preview or apply a ROADMAP.md skeleton for a roadmap-* spec.",
        fields: Object.freeze([optionalField("title", "string")]),
      }),
      assembleRoadmap: Object.freeze({
        description: "Preview or apply graph-derived ROADMAP.md auto-assembly.",
        fields: Object.freeze([]),
      }),
    }),
  },
]);

export const OPERATION_SCHEMAS = Object.freeze([
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "text"],
    properties: {
      kind: { type: "string", enum: ["insert_at_eof"] },
      document: { type: "string" },
      text: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "heading", "text"],
    properties: {
      kind: { type: "string", enum: ["insert_after_heading"] },
      document: { type: "string" },
      heading: { type: "string" },
      text: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "heading", "content"],
    properties: {
      kind: { type: "string", enum: ["replace_section"] },
      document: { type: "string" },
      heading: { type: "string" },
      content: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "heading", "oldText", "newText"],
    properties: {
      kind: { type: "string", enum: ["replace_in_section"] },
      document: { type: "string" },
      heading: { type: "string" },
      oldText: { type: "string" },
      newText: { type: "string" },
      replaceAll: { type: "boolean" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "entity", "status"],
    properties: {
      kind: { type: "string", enum: ["replace_task_status"] },
      document: { type: "string" },
      entity: { type: "string" },
      status: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "content"],
    properties: {
      kind: { type: "string", enum: ["replace_document"] },
      document: { type: "string" },
      content: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document"],
    properties: {
      kind: { type: "string", enum: ["delete_document"] },
      document: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
  Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["kind", "document", "newDocument"],
    properties: {
      kind: { type: "string", enum: ["rename_document"] },
      document: { type: "string" },
      newDocument: { type: "string" },
      expectedSha: { type: "string" },
    },
  }),
]);

export const OPERATIONS_SCHEMA = Object.freeze({
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    required: ["kind", "document"],
    properties: {
      kind: { type: "string", enum: PATCH_OPERATION_KINDS },
      document: { type: "string" },
      heading: { type: "string" },
      text: { type: "string" },
      content: { type: "string" },
      oldText: { type: "string" },
      newText: { type: "string" },
      replaceAll: { type: "boolean" },
      entity: { type: "string" },
      status: { type: "string", enum: TASK_STATUS_VALUES },
      expectedStatus: { type: "string", enum: TASK_STATUS_VALUES },
      owner: { type: ["string", "null"] },
      clearOwner: { type: "boolean" },
      force: { type: "boolean" },
      description: { type: "string" },
      subject: { type: "string" },
      requirements: { type: "array", items: { type: "string" } },
      creationToken: { type: "string" },
      actor: { type: "string" },
      review: { type: "string", enum: TASK_REVIEW_VALUES },
      refs: { type: "array", items: { type: "string" } },
      dependsOn: { type: "array", items: { type: "string" } },
      newDocument: { type: "string" },
      expectedSha: { type: "string" },
    },
  },
});

function topSchemaType(f) {
  if (f.kind === "operations") return { type: "array" };
  switch (f.kind) {
    case "string": return { type: "string" };
    case "boolean": return { type: "boolean" };
    case "integer": return { type: "integer", minimum: 1 };
    case "nullableString": return { type: ["string", "null"] };
    case "enum": return { type: "string" };
    case "enumArray": return { type: "array", items: { type: "string" } };
    case "stringArray": return { type: "array", items: { type: "string" } };
    case "json": return { type: "object" };
    default: return {};
  }
}

function branchSchemaType(f) {
  switch (f.kind) {
    case "string": return { type: "string" };
    case "boolean": return { type: "boolean" };
    case "integer": return { type: "integer", minimum: 1 };
    case "nullableString": return { type: ["string", "null"] };
    case "enum": return { type: "string" };
    case "enumArray": return { type: "array", items: { type: "string" } };
    case "stringArray": return { type: "array", items: { type: "string" } };
    case "operations": return OPERATIONS_SCHEMA;
    case "json": return { type: "object" };
    default: return {};
  }
}

export function jsonSchemaFor(contract) {
  if (!contract.discriminator) {
    const properties = {
      schemaVersion: { type: "string" },
      requestId: { type: ["string", "null"] },
    };
    const required = [];
    for (const entry of contract.fields) {
      properties[entry.name] = branchSchemaType(entry);
      if (!entry.optional) required.push(entry.name);
    }
    addTransportContextFields(properties);
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  const disc = contract.discriminator;
  const topProperties = {
    [disc]: {
      type: "string",
      description: `Select one declared ${disc} branch in oneOf.`,
      enum: Object.keys(contract.variants),
    },
    schemaVersion: { type: "string" },
    requestId: { type: ["string", "null"] },
  };

  if (Array.isArray(contract.commonFields)) {
    for (const f of contract.commonFields) {
      topProperties[f.name] = topSchemaType(f);
    }
  }

  for (const variant of Object.values(contract.variants)) {
    for (const f of variant.fields) {
      if (!topProperties[f.name]) {
        topProperties[f.name] = {};
      }
    }
  }

  const oneOf = [];
  for (const [vName, variant] of Object.entries(contract.variants)) {
    const vProps = {
      [disc]: {
        type: "string",
        enum: [vName],
      },
    };
    const required = [disc];

    if (Array.isArray(contract.commonFields)) {
      for (const f of contract.commonFields) {
        vProps[f.name] = branchSchemaType(f);
        if (!f.optional) required.push(f.name);
      }
    }

    for (const f of variant.fields) {
      vProps[f.name] = branchSchemaType(f);
      if (!f.optional) required.push(f.name);
    }

    // Transport context is declared once on the root schema. Branches stay
    // open: the root already rejects an unknown key, and repeating the
    // transport fields per branch would grow the catalog without adding a
    // single check the runtime performs.

    // The root closes unknown keys; a branch only constrains its own fields.
    // Declaring transport context per branch would not add an enforcement the
    // runtime lacks (the root already rejects it) and would double the schema.
    oneOf.push({
      type: "object",
      title: `${disc}: ${vName}`,
      description: variant.description,
      properties: vProps,
      required,
    });
  }

  addTransportContextFields(topProperties);
  return {
    type: "object",
    additionalProperties: false,
    properties: topProperties,
    required: [disc],
    oneOf,
  };
}

function receivedType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function hasDuplicates(arr) {
  return new Set(arr).size !== arr.length;
}

/**
 * Fields that only a task operation may carry. The published schema is a union
 * of every kind (the client reads one flat property map), so the runtime must
 * refuse a task field on a document operation instead of ignoring it.
 */
const TASK_ONLY_FIELDS = Object.freeze([
  "entity",
  "status",
  "expectedStatus",
  "owner",
  "clearOwner",
  "force",
  "description",
  "subject",
  "requirements",
  "creationToken",
]);
const TASK_OPERATION_KINDS = Object.freeze([
  "create_task",
  "update_task",
  "replace_task_status",
  "replace_task_owner",
  "replace_task_links",
]);

function validateOperationObject(op) {
  if (op === null || typeof op !== "object" || Array.isArray(op)) return false;
  if (!PATCH_OPERATION_KINDS.includes(op.kind)) return false;
  if (!TASK_OPERATION_KINDS.includes(op.kind)) {
    if (TASK_ONLY_FIELDS.some((field) => op[field] !== undefined)) return false;
  }
  if (typeof op.document !== "string" || op.document.trim() === "") return false;
  if (op.expectedSha !== undefined && typeof op.expectedSha !== "string") return false;

  switch (op.kind) {
    case "insert_at_eof":
      return typeof op.text === "string";
    case "insert_after_heading":
      return typeof op.heading === "string" && typeof op.text === "string";
    case "replace_section":
      return typeof op.heading === "string" && typeof op.content === "string";
    case "replace_in_section":
      return (
        typeof op.heading === "string" &&
        typeof op.oldText === "string" &&
        typeof op.newText === "string" &&
        (op.replaceAll === undefined || typeof op.replaceAll === "boolean")
      );
    case "replace_task_status":
      return typeof op.entity === "string" && TASK_STATUS_VALUES.includes(op.status);
    case "create_task":
      return (
        typeof op.entity === "string" &&
        typeof op.subject === "string" &&
        op.subject.trim() !== "" &&
        (op.owner === undefined || op.owner === null || typeof op.owner === "string") &&
        (op.description === undefined || typeof op.description === "string") &&
        (op.status === undefined || TASK_STATUS_VALUES.includes(op.status)) &&
        (op.requirements === undefined ||
          (Array.isArray(op.requirements) &&
            !hasDuplicates(op.requirements) &&
            op.requirements.every((item) => typeof item === "string")))
      );
    case "append_task_comment":
      return (
        typeof op.entity === "string" &&
        typeof op.text === "string" &&
        op.text.trim() !== "" &&
        (op.actor === undefined || typeof op.actor === "string")
      );
    case "update_task":
      return (
        typeof op.entity === "string" &&
        (op.review === undefined || TASK_REVIEW_VALUES.includes(op.review)) &&
        (op.refs === undefined || (Array.isArray(op.refs) && op.refs.every((item) => typeof item === "string"))) &&
        (op.dependsOn === undefined ||
          (Array.isArray(op.dependsOn) && op.dependsOn.every((item) => typeof item === "string"))) &&
        (op.status === undefined || TASK_STATUS_VALUES.includes(op.status)) &&
        (op.owner === undefined || op.owner === null || typeof op.owner === "string") &&
        (op.description === undefined || typeof op.description === "string") &&
        (op.expectedStatus === undefined || TASK_STATUS_VALUES.includes(op.expectedStatus))
      );
    case "replace_task_owner":
      return (
        typeof op.entity === "string" &&
        (op.owner === undefined || op.owner === null || typeof op.owner === "string")
      );
    case "replace_task_links":
      return (
        typeof op.entity === "string" &&
        (op.requirements === undefined ||
          (Array.isArray(op.requirements) && op.requirements.every((item) => typeof item === "string"))) &&
        (op.dependsOn === undefined ||
          (Array.isArray(op.dependsOn) && op.dependsOn.every((item) => typeof item === "string"))) &&
        (op.refs === undefined ||
          (Array.isArray(op.refs) && op.refs.every((item) => typeof item === "string"))) &&
        (op.expectedSha === undefined || typeof op.expectedSha === "string")
      );
    case "replace_document":
      return typeof op.content === "string";
    case "delete_document":
      return true;
    case "rename_document":
      return typeof op.newDocument === "string" && op.newDocument.trim() !== "";
    default:
      return false;
  }
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
      return (
        Array.isArray(value) &&
        !hasDuplicates(value) &&
        value.every((item) => typeof item === "string" && entry.values.includes(item))
      );
    case "stringArray":
      return (
        Array.isArray(value) &&
        !hasDuplicates(value) &&
        value.every((item) => typeof item === "string")
      );
    case "operations":
      return Array.isArray(value) && value.length >= 1 && value.every(validateOperationObject);
    case "json":
      return value !== null && typeof value === "object";
    default:
      return false;
  }
}

export function validateContractArguments(contract, args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "tool arguments must be an object",
      parameter: "arguments",
      expected: "object",
    };
  }

  // Transport context is advertised on every tool (see
  // TRANSPORT_CONTEXT_FIELDS) and is not an operation argument: it selects
  // which corpus serves the call, so it is accepted without contract churn but
  // still type-checked here.
  const COMMON_METADATA_KEYS = new Set(["schemaVersion", "requestId", ...Object.keys(TRANSPORT_CONTEXT_FIELDS)]);
  for (const name of Object.keys(TRANSPORT_CONTEXT_FIELDS)) {
    const value = args[name];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: name + " must be a non-empty string",
        parameter: name,
        expected: "string",
        receivedType: receivedType(value),
      };
    }
  }

  if (contract.discriminator) {
    const discKey = contract.discriminator;
    const discVal = args[discKey];

    if (discVal === undefined) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "missing required discriminator " + discKey,
        parameter: discKey,
        expected: Object.keys(contract.variants),
      };
    }

    if (typeof discVal !== "string" || !Object.hasOwn(contract.variants, discVal)) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "unknown " + discKey + " variant: " + discVal,
        parameter: discKey,
        expected: Object.keys(contract.variants),
      };
    }

    const variant = contract.variants[discVal];
    const commonFields = contract.commonFields ?? [];
    const variantFields = variant.fields ?? [];

    const allowedFieldsMap = new Map();
    for (const f of commonFields) allowedFieldsMap.set(f.name, f);
    for (const f of variantFields) allowedFieldsMap.set(f.name, f);

    const otherVariantFields = new Set();
    for (const [otherName, otherVariant] of Object.entries(contract.variants)) {
      if (otherName === discVal) continue;
      for (const f of otherVariant.fields) {
        if (!allowedFieldsMap.has(f.name)) otherVariantFields.add(f.name);
      }
    }

    for (const key of Object.keys(args)) {
      if (key === discKey || COMMON_METADATA_KEYS.has(key)) continue;
      if (!allowedFieldsMap.has(key)) {
        if (otherVariantFields.has(key)) {
          return {
            ok: false,
            code: "INVALID_REQUEST",
            message: "field " + key + " belongs to another variant, not " + discVal,
            parameter: key,
          };
        }
        return {
          ok: false,
          code: "UNKNOWN_FIELD",
          message: "unknown tool argument field: " + key,
          parameter: key,
          expected: "declared contract field",
        };
      }
    }

    for (const f of commonFields) {
      if (args[f.name] === undefined) {
        if (!f.optional) {
          return {
            ok: false,
            code: "INVALID_REQUEST",
            message: "required tool argument is missing: " + f.name,
            parameter: f.name,
            expected: f.kind,
          };
        }
        continue;
      }
      if (!validFieldValue(f, args[f.name])) {
        return {
          ok: false,
          code: "INVALID_REQUEST",
          message: "tool argument has the wrong type or value: " + f.name,
          parameter: f.name,
          expected: f.kind,
          receivedType: receivedType(args[f.name]),
        };
      }
    }

    for (const f of variantFields) {
      if (args[f.name] === undefined) {
        if (!f.optional) {
          return {
            ok: false,
            code: "INVALID_REQUEST",
            message: "required tool argument is missing: " + f.name,
            parameter: f.name,
            expected: f.kind,
          };
        }
        continue;
      }
      if (!validFieldValue(f, args[f.name])) {
        return {
          ok: false,
          code: "INVALID_REQUEST",
          message: "tool argument has the wrong type or value: " + f.name,
          parameter: f.name,
          expected: f.kind,
          receivedType: receivedType(args[f.name]),
        };
      }
    }

    return { ok: true };
  }

  const fields = new Map(contract.fields.map((entry) => [entry.name, entry]));
  const unknown = Object.keys(args)
    .filter((key) => !fields.has(key) && !COMMON_METADATA_KEYS.has(key))
    .sort();

  if (unknown.length > 0) {
    return {
      ok: false,
      code: "UNKNOWN_FIELD",
      message: "unknown tool argument field: " + unknown[0],
      parameter: unknown[0],
      expected: "declared contract field",
    };
  }

  for (const entry of contract.fields) {
    if (args[entry.name] === undefined) {
      if (!entry.optional) {
        return {
          ok: false,
          code: "INVALID_REQUEST",
          message: "required tool argument is missing: " + entry.name,
          parameter: entry.name,
          expected: entry.kind,
        };
      }
      continue;
    }
    if (!validFieldValue(entry, args[entry.name])) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "tool argument has the wrong type or value: " + entry.name,
        parameter: entry.name,
        expected: entry.kind,
        receivedType: receivedType(args[entry.name]),
      };
    }
  }

  return { ok: true };
}

export const READ_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const MUTATING_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
});

/** A read that never leaves this service (local listings, identity). */
export const LOCAL_READ_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

/**
 * The one statement about whether a contract can change anything: a contract
 * that declares `mutating`, or whose variants carry a non-read-only
 * annotation. Tool visibility, role gating and the advertised annotations all
 * read this function; no second list of "write tools" exists.
 */
export function contractIsMutating(contract) {
  if (contract?.mutating === true) return true;
  const variants = contract?.variants ?? null;
  if (!variants || typeof variants !== "object") return false;
  return Object.values(variants).some((variant) => variant?.annotations?.readOnlyHint === false);
}

/**
 * A discriminated tool with at least one explicitly read-only action stays
 * available to readers. A mutating tool whose variants declare no annotations
 * (every action writes) does not become reader-visible by omission.
 */
export function contractExposesReadAction(contract) {
  const variants = contract?.variants ?? null;
  if (!variants || typeof variants !== "object") return contract?.mutating !== true;
  const declared = Object.values(variants).filter((variant) => typeof variant?.annotations?.readOnlyHint === "boolean");
  if (declared.length === 0) return contract?.mutating !== true;
  return declared.some((variant) => variant.annotations.readOnlyHint === true);
}

/**
 * Annotations for the call being made: a discriminated tool answers per action
 * (its variant owns the truth), everything else answers for the contract.
 */
export function annotationsFor(contract, action = null) {
  const variant = contract?.discriminator && action !== null ? contract.variants?.[action] : null;
  if (variant?.annotations) return variant.annotations;
  return contractIsMutating(contract) ? MUTATING_TOOL_ANNOTATIONS : READ_TOOL_ANNOTATIONS;
}

export const MCP_SERVER_INSTRUCTIONS = `Start with spec_catalog, then read the affected documents. Use spec_patch to preview or apply changes: omit dryRun or pass dryRun: true to review diffs and hashes in memory without writing, or pass dryRun: false to commit changes atomically under exclusive lock. Every tool accepts an optional project (owner/project) that selects the project serving that call only; when it is omitted the host's session project or your default scope applies, and an unresolved or unauthorized project is refused instead of falling back. declaredWorktree (absolute path) selects a corpus only on the local stdio/test transport; the hosted HTTP transport refuses it, so select a project there instead. ${ELICITATION_HINT}`;

export const KERNEL_ENVELOPE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "requestId",
    "operation",
    "ok",
    "graph",
    "page",
    "data",
    "error",
    "diagnostics",
    "provenance",
  ],
  properties: {
    schemaVersion: { type: "string" },
    requestId: {},
    operation: { type: "string" },
    ok: { type: "boolean" },
    graph: {},
    page: {},
    data: {},
    error: {},
    diagnostics: { type: "array" },
    provenance: {},
  },
});

// SCHEMA-11 common transport fields and snake_case aliases, shared by every
// transport (the stdio server keeps its local copy; the HTTP service imports
// this one so both normalize tool arguments identically).
export const TOOL_ARGUMENT_ALIASES = Object.freeze({
  spec_slugs: "specSlugs",
  include_documents: "includeDocuments",
  canonical_id: "canonicalId",
  include_incident_counts: "includeIncidentCounts",
  max_depth: "maxDepth",
  max_visited: "maxVisited",
  focus_path: "focusPath",
  focus_anchor: "focusAnchor",
  include_headings: "includeHeadings",
  include_links: "includeLinks",
  read_for_edit: "readForEdit",
  declared_worktree: "declaredWorktree",
  verification_method: "verificationMethod",
  safety_class: "safetyClass",
  status_view: "statusView",
  verification_method_missing: "verificationMethodMissing",
  scenario_id: "scenarioId",
  actor_ref: "actorRef",
  repository_root_fingerprint: "repositoryRootFingerprint",
  expected_sha: "expectedSha",
  old_string: "oldText",
  new_string: "newText",
  replace_all: "replaceAll",
  new_doc: "newDoc",
  node_id: "canonicalId",
  design_review: "designReview",
});

export function normalizeToolArguments(rawArguments) {
  const normalized = {};
  for (const [name, value] of Object.entries(rawArguments)) {
    const canonical = TOOL_ARGUMENT_ALIASES[name] ?? name;
    if (Object.hasOwn(normalized, canonical)) {
      return { ok: false, error: { code: "DUPLICATE_FIELD", message: `tool argument has duplicate aliases: ${canonical}`, parameter: canonical } };
    }
    normalized[canonical] = value;
  }
  return { ok: true, args: normalized };
}

export function assertContractInvariants(contracts = TOOL_CONTRACTS) {
  if (!Array.isArray(contracts) || contracts.length !== 10) {
    throw new Error("Invariants failed: expected exactly 10 contracts, got " + contracts?.length);
  }
  const toolNames = contracts.map((c) => c.tool);
  if (new Set(toolNames).size !== contracts.length) {
    throw new Error("Invariants failed: duplicate tool names in contracts");
  }
  const operations = contracts.map((c) => c.operation);
  if (new Set(operations).size !== contracts.length) {
    throw new Error("Invariants failed: duplicate operation names in contracts");
  }
  const mutatingTools = contracts.filter(contractIsMutating);
  if (mutatingTools.length !== 1 || mutatingTools[0].tool !== "spec_patch") {
    throw new Error("Invariants failed: expected exactly one mutating tool 'spec_patch', got " + mutatingTools.map((c) => c.tool).join(","));
  }
  const readOnlyTools = contracts.filter((c) => !contractIsMutating(c));
  if (readOnlyTools.length !== 9) {
    throw new Error("Invariants failed: expected exactly 9 read-only tools");
  }
  for (const c of contracts) {
    if (typeof c.description !== "string" || c.description.trim().length === 0) {
      throw new Error("Invariants failed: empty description for tool " + c.tool);
    }
    const firstLine = c.description.split(/\r?\n/u)[0].trim();
    if (firstLine.length > 200) {
      throw new Error("Invariants failed: first description line exceeds 200 chars for " + c.tool);
    }
    if (c.discriminator) {
      if (!c.variants || typeof c.variants !== "object") {
        throw new Error("Invariants failed: discriminated tool " + c.tool + " missing variants");
      }
      const variantKeys = Object.keys(c.variants);
      if (new Set(variantKeys).size !== variantKeys.length) {
        throw new Error("Invariants failed: duplicate variants in tool " + c.tool);
      }
    }
  }
  return true;
}

assertContractInvariants(TOOL_CONTRACTS);

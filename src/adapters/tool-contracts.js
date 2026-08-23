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
      "Read one specification graph node by qualified canonical ID (for example product:FR-1), with summary or full projection.",
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
};

// MCP inputSchema per SCHEMA-11: exact closed op args plus the common
// schemaVersion/requestId transport fields. Every op arg is required; no
// additional properties are accepted.
export function jsonSchemaFor(contract) {
  const properties = {};
  const required = [];
  for (const entry of contract.fields) {
    properties[entry.name] = JSON_SCHEMA_TYPES[entry.kind](entry.values);
    required.push(entry.name);
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

// OMP zod parameters derived from the same table. register-spec-tools filters
// out spec_inventory before calling this — that name stays owned by the v0.1
// extension entry in the OMP registry.
export function zodParametersFor(contract, z) {
  const shape = {};
  for (const entry of contract.fields) {
    switch (entry.kind) {
      case "string":
        shape[entry.name] = z.string();
        break;
      case "boolean":
        shape[entry.name] = z.boolean();
        break;
      case "integer":
        shape[entry.name] = z.number().int().min(1);
        break;
      case "nullableString":
        shape[entry.name] = z.union([z.string(), z.null()]);
        break;
      case "enum":
        shape[entry.name] = z.enum([...entry.values]);
        break;
      case "enumArray":
        shape[entry.name] = z.array(z.enum([...entry.values]));
        break;
      case "stringArray":
        shape[entry.name] = z.array(z.string());
        break;
      default:
        throw new Error(`unknown tool contract field kind: ${entry.kind}`);
    }
  }
  // Common SCHEMA-11 transport fields stay optional at both surfaces; an
  // absent schemaVersion means the current kernel contract.
  shape.schemaVersion = z.string().optional();
  shape.requestId = z.union([z.string(), z.null()]).optional();
  return z.object(shape).strict();
}

// The seven tools registered on the OMP side (spec_inventory excluded there).
export const OMP_TOOL_CONTRACTS = Object.freeze(TOOL_CONTRACTS.filter((c) => c.tool !== "spec_inventory"));

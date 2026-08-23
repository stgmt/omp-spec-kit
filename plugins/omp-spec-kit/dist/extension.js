import {
  HARD_MAX_DIAGNOSTICS,
  HARD_MAX_SPECS,
  inventorySpecs,
  summarizeInventory,
} from "./inventory.js";
export const PLUGIN_VERSION = "0.1.0";
export const SCHEMA_VERSION = "1";

// OMP v17.3.7 extension contract pinned at commit
// 8500092296621a6826b7136e840f8a59ea338958:
// docs/extensions.md and packages/coding-agent/src/extensibility/extensions/types.ts.
export default function ompSpecKitExtension(pi) {
  const z = pi.zod;
  const parameters = z
    .object({
      schemaVersion: z.literal(SCHEMA_VERSION).optional(),
      maxSpecs: z.number().int().min(1).max(HARD_MAX_SPECS).optional(),
      maxDiagnostics: z.number().int().min(0).max(HARD_MAX_DIAGNOSTICS).optional(),
      includeDocumentCounts: z.boolean().optional(),
    })
    .strict();

  pi.setLabel("OMP Spec Kit");
  pi.registerTool({
    name: "spec_inventory",
    label: "Spec Inventory",
    description:
      "Read a bounded inventory of direct specifications under the active project's .specs directory without reading document contents or writing project state.",
    parameters,
    approval: "read",
    strict: true,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await inventorySpecs(ctx.cwd, params, signal);
      return {
        content: [{ type: "text", text: summarizeInventory(details) }],
        details,
      };
    },
  });
}

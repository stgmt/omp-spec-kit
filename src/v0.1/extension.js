import {
  HARD_MAX_DIAGNOSTICS,
  HARD_MAX_SPECS,
  inventorySpecs,
  summarizeInventory,
} from "./inventory.js";
import { activeStageForEnvironment } from "../adapters/tool-contracts.js";
import { registerSpecTools } from "../adapters/omp/register-spec-tools.js";
import {
  createResponseProvenance,
  createSpecService,
  resolveRepositoryContext,
} from "../adapters/query-service.js";
import { registerSpecEnforcement } from "../enforcement/adapter.js";
import { registerAutomaticPlanGate } from "../gate/automatic-adapter.js";

export const PLUGIN_VERSION = "0.5.4";
export const SCHEMA_VERSION = "1";

// OMP 18.0.11 extension contract pinned at the active release runtime
// 33cc6b9a043a74e00a157e72ca909272796d8461. Authority-dependent mutation
// profiles additionally require the candidate OMP event ABI.
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
      const rootContext = resolveRepositoryContext(globalThis.process?.env, ctx?.cwd);
      const details = await inventorySpecs(rootContext.resolvedRoot, params, signal);
      const result = {
        ...details,
        provenance: createResponseProvenance(rootContext),
      };
      return {
        content: [{ type: "text", text: summarizeInventory(result) }],
        details: result,
      };
    },
  });

  // One lazily-built reader/graph/query service per root context, shared by
  // the eight kernel-backed read tools and two proposal-first authoring tools.
  // Active cwd and optional absolute override are both part of the cache key.
  const servicesByContext = new Map();
  function getService(ctx) {
    const rootContext = resolveRepositoryContext(globalThis.process?.env, ctx?.cwd);
    const key = [
      rootContext.resolvedRoot,
      rootContext.activeProjectRoot,
      rootContext.rootMode,
    ].join("\u0000");
    let service = servicesByContext.get(key);
    if (service === undefined) {
      service = createSpecService(rootContext.resolvedRoot, rootContext);
      servicesByContext.set(key, service);
    }
    return service;
  }

  // v0.5.0 is the shipped OMP discovery default; older profiles remain
  // selectable explicitly through OMP_SPEC_KIT_STAGE.
  // Direct filesystem mutation remains blocked by the enforcement handler.
  const requestedStage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE ?? "v0.5.0";
  const activeStage = activeStageForEnvironment(requestedStage);
  registerSpecEnforcement(pi);
  if (["v0.7.0", "plan-gate"].includes(activeStage)) {
    registerAutomaticPlanGate(pi);
  }
  registerSpecTools(pi, getService, activeStage);
}

// Registers the active stage's OMP projection. v0.4.0 exposes exactly eight
// kernel-backed read tools plus the two proposal-first authoring tools.

import { summarizeEnvelope } from "../query-service.js";
import { ompToolContractsForStage, zodParametersFor } from "../tool-contracts.js";

const WRITE_OPERATIONS = new Set(["applyProposedPatch", "applySpecChange", "applySpecTransaction", "applySpecRepairs"]);

export function registerSpecTools(pi, getService, stage = globalThis.process?.env?.OMP_SPEC_KIT_STAGE) {
  const z = pi.zod;
  const toolContracts = ompToolContractsForStage(stage);
  for (const contract of toolContracts) {
    const parameters = zodParametersFor(contract, z);
    pi.registerTool({
      name: contract.tool,
      label: contract.label,
      description: contract.description,
      parameters,
      approval: WRITE_OPERATIONS.has(contract.operation) ? "write" : "read",
      strict: true,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const service = getService(ctx);
        const { schemaVersion, requestId, ...args } = params ?? {};
        const envelope = await service.runQuery(contract.operation, args, {
          requestId: requestId === undefined ? null : requestId,
          schemaVersion,
        });
        return {
          content: [{ type: "text", text: summarizeEnvelope(envelope) }],
          details: envelope,
        };
      },
    });
  }
}

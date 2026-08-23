// FC-6: registers the seven kernel-backed read-only OMP tools listed in
// SCHEMA-11 (minus spec_inventory — the v0.1 extension entry owns that name in
// the OMP registry). Each tool mirrors its query operation's closed args via
// the shared contract table, declares approval "read", and returns exactly one
// canonical QueryEnvelope as `details` plus a one-line text summary.

import { summarizeEnvelope } from "../query-service.js";
import { OMP_TOOL_CONTRACTS as TOOL_CONTRACTS, zodParametersFor } from "../tool-contracts.js";

export function registerSpecTools(pi, getService) {
  const z = pi.zod;
  for (const contract of TOOL_CONTRACTS) {
    const parameters = zodParametersFor(contract, z);
    pi.registerTool({
      name: contract.tool,
      label: contract.label,
      description: contract.description,
      parameters,
      approval: "read",
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

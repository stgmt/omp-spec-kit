import { KERNEL_SCHEMA_VERSION } from "../../kernel/index.js";
import { serviceErrorEnvelope, serviceSuccess } from "../dispatch.js";
import { field, optionalField } from "../../adapters/tool-contracts.js";

export const CLAIM_CONTRACTS = Object.freeze([
  {
    tool: "spec_claim",
    label: "Spec Claim",
    operation: "specClaim",
    mutating: true,
    description: "Take a renewable write lease (default TTL 30 min) on one spec in a project.",
    fields: [field("spec", "string"), optionalField("ttlMinutes", "integer")],
  },
  {
    tool: "spec_release",
    label: "Spec Release",
    operation: "specRelease",
    mutating: true,
    description: "Drop the caller's write lease on one spec in a project.",
    fields: [field("spec", "string")],
  },
]);

/** Listing ops treat absent `project` as "all scopes"; claim ops are targeted. */
export function createClaimOps({ claims, mounts = null }) {
  return {
    specClaim: { listing: false, async run({ args, ctx, project, requestId }) {
      const spec = args.spec;
      const holder = ctx.identity.login;
      if (mounts) {
        try {
          const { bindings } = await mounts.discoverProject(project);
          const binding = bindings.find((entry) => entry.spec === spec) ?? null;
          if (binding?.archived === true) {
            return { envelope: serviceErrorEnvelope("specClaim", requestId, "SPEC_ARCHIVED", `spec ${spec} is archived and read-only`, { specSlug: spec, retryable: false }) };
          }
        } catch {
          // A discovery failure is a read-path problem, not a claim refusal;
          // the claim below still cannot expose archived content.
        }
      }
      try {
        const data = claims.claim({ project, spec, holder, ttlMinutes: args.ttlMinutes });
        return { envelope: serviceSuccess("specClaim", requestId, data) };
      } catch (error) {
        if (error?.code === "CLAIM_HELD") {
          return { envelope: serviceErrorEnvelope("specClaim", requestId, "CLAIM_HELD", error.message, { specSlug: spec, holder: error.holder, expiresAt: error.expiresAt }) };
        }
        throw error;
      }
    } },
    specRelease: { listing: false, async run({ args, ctx, project, requestId }) {
      const result = claims.release({ project, spec: args.spec, holder: ctx.identity.login });
      if (!result.released && result.reason === "CLAIM_HELD") {
        return { envelope: serviceErrorEnvelope("specRelease", requestId, "CLAIM_HELD", `spec is claimed by ${result.holder}`, { specSlug: args.spec, holder: result.holder, expiresAt: result.expiresAt }) };
      }
      return { envelope: serviceSuccess("specRelease", requestId, { spec: args.spec, released: result.released }) };
    } },
  };
}

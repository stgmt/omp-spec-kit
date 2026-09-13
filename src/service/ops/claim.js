import { KERNEL_SCHEMA_VERSION } from "../../kernel/index.js";
import { serviceErrorEnvelope, serviceSuccess } from "../dispatch.js";

export const CLAIM_CONTRACTS = Object.freeze([
  {
    tool: "spec_claim",
    label: "Spec Claim",
    operation: "specClaim",
    description: "Take a renewable write lease (default TTL 30 min) on one spec in a project.",
    fields: [field("spec", "string"), optionalField("ttlMinutes", "integer")],
  },
  {
    tool: "spec_release",
    label: "Spec Release",
    operation: "specRelease",
    description: "Drop the caller's write lease on one spec in a project.",
    fields: [field("spec", "string")],
  },
]);

function field(name, kind, values) {
  return values === undefined ? { name, kind } : { name, kind, values };
}

function optionalField(name, kind, values) {
  return { ...field(name, kind, values), optional: true };
}

/** Listing ops treat absent `project` as "all scopes"; claim ops are targeted. */
export function createClaimOps({ claims }) {
  return {
    specClaim: { listing: false, async run({ args, ctx, project, requestId }) {
      const spec = args.spec;
      try {
        const data = claims.claim({ project, spec, holder: ctx.identity ?? ctx.tenant, ttlMinutes: args.ttlMinutes });
        return { envelope: serviceSuccess("specClaim", requestId, data) };
      } catch (error) {
        if (error?.code === "CLAIM_HELD") {
          return { envelope: serviceErrorEnvelope("specClaim", requestId, "CLAIM_HELD", error.message, { specSlug: spec, holder: error.holder, expiresAt: error.expiresAt }) };
        }
        throw error;
      }
    } },
    specRelease: { listing: false, async run({ args, ctx, project, requestId }) {
      const result = claims.release({ project, spec: args.spec, holder: ctx.identity ?? ctx.tenant });
      if (!result.released && result.reason === "CLAIM_HELD") {
        return { envelope: serviceErrorEnvelope("specRelease", requestId, "CLAIM_HELD", `spec is claimed by ${result.holder}`, { specSlug: args.spec, holder: result.holder, expiresAt: result.expiresAt }) };
      }
      return { envelope: serviceSuccess("specRelease", requestId, { spec: args.spec, released: result.released }) };
    } },
  };
}

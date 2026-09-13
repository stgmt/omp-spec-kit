import { serviceSuccess } from "../dispatch.js";

export const REGISTRY_CONTRACTS = Object.freeze([
  {
    tool: "spec_registry",
    label: "Spec Registry",
    operation: "specRegistry",
    description: "Projected registry index: per project, per spec — status, version, digest, claim, published pointer. Listing op: absent project = all allowed scopes.",
    fields: [],
  },
  {
    tool: "spec_drift",
    label: "Spec Drift",
    operation: "specDrift",
    description: "Divergence report: non-bot commits and clone-ahead-of-remote states on the specs repo.",
    fields: [],
  },
]);

/** Listing ops: absent `project` means "all scopes in my allowed set". */
export function createRegistryOps({ registryIndex, driftReport }) {
  return {
    specRegistry: {
      listing: true,
      async run({ project, allScopes, requestId }) {
        const index = await registryIndex();
        const projects = allScopes ? index.projects : index.projects.filter((entry) => entry.id === project);
        return { envelope: serviceSuccess("specRegistry", requestId, { projects }) };
      },
    },
    specDrift: {
      listing: true,
      async run({ requestId }) {
        const report = await driftReport();
        return { envelope: serviceSuccess("specDrift", requestId, { events: report.events, branch: report.branch }) };
      },
    },
  };
}

import { serviceSuccess } from "../dispatch.js";
import { requireScope } from "../scope.js";

export const REGISTRY_CONTRACTS = Object.freeze([
  {
    tool: "spec_registry",
    label: "Spec Registry",
    operation: "specRegistry",
    description: "Projected registry index: per project, per spec — status, version, digest, claim, published pointer, repository binding. Listing op: absent project = all allowed scopes.",
    fields: [],
  },
  {
    tool: "spec_drift",
    label: "Spec Drift",
    operation: "specDrift",
    description: "Divergence report: non-bot commits and clone-ahead-of-remote states on the specs repo. Listing op: absent project = all allowed scopes.",
    fields: [],
  },
]);

/**
 * Listing ops. An unqualified listing covers the caller's allowed projects
 * only, and the index/report is built for exactly those projects: a tenant
 * never learns that another project, its repository URL or its spec count
 * exists. `scope.restrict` hands the callee the already-narrowed subset, so no
 * callee can widen it back to the deployment's project list.
 */
export function createRegistryOps({ registryIndex, driftReport, branch, repositoryStatus = () => [] }) {
  function selection({ allScopes, project, ctx, owner }) {
    const scope = requireScope(ctx?.scope, owner);
    const selected = allScopes ? scope.projects : (scope.allows(project) ? [project] : []);
    return { scope, selected, scoped: scope.restrict(selected) };
  }

  return {
    specRegistry: {
      listing: true,
      async run({ project, allScopes, requestId, ctx }) {
        const { selected, scoped } = selection({ allScopes, project, ctx, owner: "spec_registry" });
        if (selected.length === 0) {
          return { envelope: serviceSuccess("specRegistry", requestId, { branch, projects: [] }) };
        }
        const index = await registryIndex({ scope: scoped });
        const repositories = new Map(repositoryStatus(ctx).map((entry) => [entry.project, entry]));
        const projects = index.projects.map((entry) => ({
          ...entry,
          // Setup visibility for the caller's own project: an unbound or
          // errored project still reports what state its binding is in.
          repository: repositories.get(entry.id) ?? { project: entry.id, repoUrl: null, bound: false, status: "required" },
        }));
        return { envelope: serviceSuccess("specRegistry", requestId, { branch, projects }) };
      },
    },
    specDrift: {
      listing: true,
      async run({ project, allScopes, requestId, ctx }) {
        const { selected, scoped } = selection({ allScopes, project, ctx, owner: "spec_drift" });
        if (selected.length === 0) {
          return { envelope: serviceSuccess("specDrift", requestId, { events: [], branch: null }) };
        }
        const report = await driftReport({ scope: scoped });
        return { envelope: serviceSuccess("specDrift", requestId, { events: report.events, branch: report.branch }) };
      },
    },
  };
}

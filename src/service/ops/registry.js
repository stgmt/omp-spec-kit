import { serviceSuccess } from "../dispatch.js";

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

/** The verified scope set a service op may read from — never the whole config. */
export function callerScopes(ctx) {
  const scopes = Array.isArray(ctx?.scopes) ? ctx.scopes : [];
  return scopes.filter((project) => typeof project === "string" && project.length > 0);
}

/**
 * Listing ops. An unqualified listing covers the caller's allowed projects
 * only, and the index/report is built for exactly those projects: a tenant
 * never learns that another project, its repository URL or its spec count
 * exists.
 */
export function createRegistryOps({ registryIndex, driftReport, branch, repositoryStatus = () => [] }) {
  return {
    specRegistry: {
      listing: true,
      async run({ project, allScopes, requestId, ctx }) {
        const scopes = callerScopes(ctx);
        const visible = new Set(scopes);
        const selected = allScopes ? scopes : (visible.has(project) ? [project] : []);
        if (selected.length === 0) {
          return { envelope: serviceSuccess("specRegistry", requestId, { branch, projects: [] }) };
        }
        const index = await registryIndex({ projects: selected });
        const repositories = new Map(repositoryStatus(ctx).map((entry) => [entry.project, entry]));
        const projects = index.projects
          .filter((entry) => visible.has(entry.id))
          .map((entry) => ({
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
        const scopes = callerScopes(ctx);
        const visible = new Set(scopes);
        const selected = allScopes ? scopes : (visible.has(project) ? [project] : []);
        if (selected.length === 0) {
          return { envelope: serviceSuccess("specDrift", requestId, { events: [], branch: null }) };
        }
        const report = await driftReport({ projects: selected });
        // Defence in depth: the report was built for the selected projects, and
        // every event must still name one of the caller's own projects.
        const events = report.events.filter((event) => typeof event.project === "string" && visible.has(event.project));
        return { envelope: serviceSuccess("specDrift", requestId, { events, branch: report.branch }) };
      },
    },
  };
}

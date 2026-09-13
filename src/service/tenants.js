import { createHash } from "node:crypto";

export class TenantConfigError extends Error {}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Phase-1 tenant seed: `token → tenant → allowed projects`. Tokens arrive as
 * operator secrets (config seed / env); only their SHA-256 is kept in memory.
 * The auth seam (TASK-12) replaces this directory with YouTrack Hub
 * introspection — the resolved context shape stays the same.
 */
export function createTenantDirectory({ tenants }) {
  if (!Array.isArray(tenants)) throw new TenantConfigError("tenants must be an array");
  const byTokenHash = new Map();
  for (const entry of tenants) {
    if (!entry || typeof entry !== "object") throw new TenantConfigError("tenant entry must be an object");
    const { token, tenant, projects, defaultProject } = entry;
    if (typeof token !== "string" || token.length < 8) throw new TenantConfigError("tenant token must be a string of at least 8 characters");
    if (typeof tenant !== "string" || tenant.length === 0) throw new TenantConfigError("tenant name is required");
    if (!Array.isArray(projects) || projects.length === 0) throw new TenantConfigError(`tenant ${tenant} needs a non-empty projects array`);
    for (const project of projects) {
      if (typeof project !== "string" || !project.includes("/")) throw new TenantConfigError(`tenant ${tenant} has an invalid project id: ${JSON.stringify(project)}`);
    }
    if (new Set(projects).size !== projects.length) throw new TenantConfigError(`tenant ${tenant} has duplicate projects`);
    if (defaultProject !== undefined && !projects.includes(defaultProject)) throw new TenantConfigError(`tenant ${tenant} defaultProject is outside its allowed set`);
    const hash = tokenHash(token);
    if (byTokenHash.has(hash)) throw new TenantConfigError("tenant tokens must be unique");
    byTokenHash.set(hash, {
      tenant,
      projects: [...projects],
      defaultProject: defaultProject ?? (projects.length === 1 ? projects[0] : null),
    });
  }

  return {
    resolve(token) {
      if (typeof token !== "string" || token.length === 0) return null;
      return byTokenHash.get(tokenHash(token)) ?? null;
    },
    get size() {
      return byTokenHash.size;
    },
  };
}

/** Context shape consumed by the dispatcher; identity stays asserted (RISK-5/7). */
export function contextFor(record, assertedIdentity) {
  return {
    tenant: record.tenant,
    scopes: record.projects,
    defaultScope: record.defaultProject,
    identity: typeof assertedIdentity === "string" && assertedIdentity.length > 0 ? assertedIdentity : null,
  };
}

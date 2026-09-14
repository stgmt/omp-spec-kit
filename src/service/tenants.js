export class TenantConfigError extends Error {}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Tenant definitions: which Hub groups map a user into a tenant, and which
 * `owner/project` scopes that tenant owns. The service stores no users and no
 * tokens — a user's membership is resolved live from YouTrack groups.
 */
export function parseTenants(raw) {
  if (!Array.isArray(raw)) throw new TenantConfigError("tenants must be an array");
  const names = new Set();
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") throw new TenantConfigError("tenant entry must be an object");
    const { tenant, projects, hubGroups, defaultProject } = entry;
    if (!isNonEmptyString(tenant)) throw new TenantConfigError("tenant name is required");
    if (names.has(tenant)) throw new TenantConfigError(`duplicate tenant name: ${tenant}`);
    names.add(tenant);
    if (!Array.isArray(projects) || projects.length === 0 || projects.some((project) => !isNonEmptyString(project) || !project.includes("/"))) {
      throw new TenantConfigError(`tenant ${tenant} needs a non-empty projects array of owner/project ids`);
    }
    if (new Set(projects).size !== projects.length) throw new TenantConfigError(`tenant ${tenant} has duplicate projects`);
    if (!Array.isArray(hubGroups) || hubGroups.length === 0 || hubGroups.some((group) => !isNonEmptyString(group))) {
      throw new TenantConfigError(`tenant ${tenant} needs a non-empty hubGroups array (YouTrack group names)`);
    }
    if (defaultProject !== undefined && defaultProject !== null && !projects.includes(defaultProject)) {
      throw new TenantConfigError(`tenant ${tenant} defaultProject is outside its projects`);
    }
    return { tenant, projects: [...projects], hubGroups: [...hubGroups], defaultProject: defaultProject ?? null };
  });
}

/** Pure scope/role resolution shared by auth paths; used by auth.js. */
export function resolveTenantScopes(groups, tenants) {
  const matched = tenants.filter((tenant) => groups.some((group) => tenant.hubGroups.includes(group)));
  return {
    matched: matched.map((tenant) => tenant.tenant),
    scopes: [...new Set(matched.flatMap((tenant) => tenant.projects))],
    defaultScope: matched.length === 1 ? matched[0].defaultProject : null,
  };
}

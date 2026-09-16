import { createHash, randomBytes } from "node:crypto";
import { sealSecret, openSecret } from "./secrets.js";

export class IdpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "IdpError";
    this.status = status;
    this.code = code;
    this.retryable = extra.retryable === true;
  }
}

const PROBE_TIMEOUT_MS = 8_000;
const TENANT_RE = /^[a-z][a-z0-9-]{1,39}$/;

/**
 * External YouTrack URL policy: http(s) only, https required for public
 * hosts, optional idpPolicy.allowedHosts allowlist on top — same SSRF shape
 * as repoPolicy, since the service calls the bound URL with a stored token.
 */
export function idpUrlAllowed(rawUrl, allowedHosts) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: `youtrack url is not a valid URL: ${rawUrl}` };
  }
  const host = parsed.hostname;
  const scheme = parsed.protocol.replace(/:$/, "");
  const isPrivateHost = host === "localhost" || host === "127.0.0.1" || !host.includes(".") || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith(".local") || host.endsWith(".internal");
  if (!["https", "http"].includes(scheme)) {
    return { ok: false, reason: `youtrack url scheme must be http(s), got ${scheme}` };
  }
  if (scheme !== "https" && !isPrivateHost) {
    return { ok: false, reason: `youtrack url must use https for a public host: ${host}` };
  }
  if (Array.isArray(allowedHosts) && allowedHosts.length > 0 && !allowedHosts.includes(host) && !isPrivateHost) {
    return { ok: false, reason: `youtrack host is not in idpPolicy.allowedHosts: ${host}` };
  }
  return { ok: true, host };
}

function normalizeUrl(raw) {
  const url = new URL(raw);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function assertStringArray(value, name, { min = 1, pattern = null } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((v) => typeof v !== "string" || v.length === 0 || (pattern !== null && !pattern.test(v)))) {
    throw new IdpError(400, "BAD_INPUT", `${name} must be an array of at least ${min} non-empty strings${pattern ? ` matching ${pattern}` : ""}`);
  }
  return [...new Set(value)];
}

function validateRoleGroups(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new IdpError(400, "BAD_INPUT", "roleGroups must be an object {owner?, writer?, reader?} of group-name arrays");
  }
  const out = {};
  let any = 0;
  for (const role of ["owner", "writer", "reader"]) {
    const groups = raw[role];
    if (groups === undefined) { out[role] = []; continue; }
    out[role] = assertStringArray(groups, `roleGroups.${role}`, { min: 1 });
    any += out[role].length;
  }
  if (any === 0) throw new IdpError(400, "BAD_INPUT", "roleGroups must map at least one YouTrack group to a role");
  return out;
}

function publicBinding(row) {
  return {
    tenant: row.tenant,
    youtrackUrl: row.youtrackUrl,
    projects: row.projects,
    hubGroups: row.hubGroups,
    roleGroups: row.roleGroups,
    defaultProject: row.defaultProject,
    status: row.status,
    boundBy: row.boundBy,
    boundAt: row.boundAt,
    lastError: row.lastError,
  };
}

/**
 * External IdP bindings (TASK-13): a verified user on the operator's YouTrack
 * binds a customer's own YouTrack server. One binding = one tenant; the
 * bound instance verifies user identity and supplies groups for that
 * tenant's scopes/roles. The customer's service token is sealed at rest; the
 * minted app-bridge secret is shown once at bind and stored as a hash.
 */
export function createIdpManager({ store, config, secretsKey, logger = () => {}, fetchImpl = fetch }) {
  const audit = (entry) => { try { store?.logAccess?.(entry); } catch {} };

  function requireStore() {
    if (!store) throw new IdpError(503, "IDP_STORE_UNAVAILABLE", "IdP bindings need the service store", { retryable: true });
  }

  function assertBindAllowed(ctx) {
    // Self-service: any verified user of the OPERATOR's IdP may provision a
    // tenant (spec: "a user logged into the operator's YouTrack can bind").
    // External-IdP users cannot nest-bind — tenant isolation holds.
    if (ctx?.idp != null) {
      throw new IdpError(403, "FORBIDDEN_IDP", "IdP binding is only available to users verified by the operator's YouTrack");
    }
  }

  async function probeFetch(url, token) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new IdpError(400, "IDP_PROBE_FAILED", `YouTrack is unreachable: ${String(error?.message ?? error)}`);
    }
    return response;
  }

  /**
   * Reachability + capability probe without persisting anything: the supplied
   * service token must (a) resolve as a real user and (b) enumerate users —
   * group resolution later needs `transitiveGroups` visibility.
   */
  async function probeYoutrack(baseUrl, serviceToken) {
    const me = await probeFetch(`${baseUrl}/hub/api/rest/users/me?fields=id,login,banned`, serviceToken);
    if (me.status === 401 || me.status === 403) throw new IdpError(400, "IDP_TOKEN_REJECTED", "the supplied service token was rejected by YouTrack");
    if (!me.ok) throw new IdpError(400, "IDP_PROBE_FAILED", `users/me returned HTTP ${me.status}`);
    const meBody = await me.json().catch(() => null);
    if (typeof meBody?.login !== "string") throw new IdpError(400, "IDP_PROBE_FAILED", "users/me returned no login — is this a YouTrack Hub API?");

    const users = await probeFetch(`${baseUrl}/hub/api/rest/users?$top=1&fields=id,login`, serviceToken);
    if (!users.ok) throw new IdpError(400, "IDP_CAPABILITY", `service token cannot enumerate users (HTTP ${users.status}) — group resolution would fail`);
    return { ok: true, serviceLogin: meBody.login };
  }

  function validateInput({ tenant, youtrackUrl, serviceToken, projects, hubGroups, roleGroups, defaultProject }) {
    if (typeof tenant !== "string" || !TENANT_RE.test(tenant)) {
      throw new IdpError(400, "BAD_TENANT", `tenant must match ${TENANT_RE} (lowercase slug, 2-40 chars)`);
    }
    if (typeof youtrackUrl !== "string" || youtrackUrl.length === 0) throw new IdpError(400, "IDP_URL_REQUIRED", "youtrackUrl is required");
    const url = normalizeUrl(youtrackUrl);
    const host = idpUrlAllowed(url, config.idpPolicy?.allowedHosts);
    if (!host.ok) throw new IdpError(400, "IDP_HOST_FORBIDDEN", host.reason);
    if (url === config.auth?.youtrack?.baseUrl) {
      throw new IdpError(400, "IDP_SELF_BIND", "the operator's own YouTrack cannot be bound as an external IdP");
    }
    const projectsNorm = assertStringArray(projects, "projects", { min: 1, pattern: /^[^/\s]+\/[^/\s]+$/ });
    const hubNorm = assertStringArray(hubGroups, "hubGroups", { min: 1 });
    const rolesNorm = validateRoleGroups(roleGroups);
    if (defaultProject !== undefined && defaultProject !== null && !projectsNorm.includes(defaultProject)) {
      throw new IdpError(400, "BAD_INPUT", `defaultProject ${defaultProject} is outside projects`);
    }
    if (typeof serviceToken !== "string" || serviceToken.length < 16) {
      throw new IdpError(400, "IDP_TOKEN_REQUIRED", "a YouTrack service token (>=16 chars) is required for group resolution");
    }
    return { url, projectsNorm, hubNorm, rolesNorm, defaultProject: defaultProject ?? null };
  }

  async function probe({ ctx, youtrackUrl, serviceToken }) {
    requireStore();
    assertBindAllowed(ctx);
    const { url } = validateInput({ tenant: "probe-ok", youtrackUrl, serviceToken, projects: ["x/y"], hubGroups: ["g"], roleGroups: { reader: ["g"] } });
    return probeYoutrack(url, serviceToken);
  }

  async function bind({ ctx, tenant, youtrackUrl, serviceToken, projects, hubGroups, roleGroups, defaultProject }) {
    requireStore();
    assertBindAllowed(ctx);
    const v = validateInput({ tenant, youtrackUrl, serviceToken, projects, hubGroups, roleGroups, defaultProject });
    if (!secretsKey) throw new IdpError(503, "SECRETS_UNAVAILABLE", "SPEC_REGISTRY_SECRETS_KEY is not set — IdP bindings are disabled", { retryable: true });

    const staticTenantNames = new Set((config.tenants ?? []).map((t) => t.tenant));
    if (staticTenantNames.has(tenant)) throw new IdpError(409, "TENANT_TAKEN", `tenant name collides with a configured tenant: ${tenant}`);
    const existing = store.getIdpBinding(tenant);
    if (existing?.status === "active" && existing.youtrackUrl === v.url) {
      return { binding: publicBinding(existing), unchanged: true };
    }
    const urlOwner = store.getIdpBindingByUrl(v.url);
    if (urlOwner && urlOwner.tenant !== tenant) {
      throw new IdpError(409, "IDP_URL_TAKEN", `YouTrack ${v.url} is already bound as tenant ${urlOwner.tenant}`);
    }

    const probeResult = await probeYoutrack(v.url, serviceToken);

    // Bridge secret: minted by the service, shown once, stored as a hash —
    // the row carries no usable credential.
    const bridgeToken = randomBytes(32).toString("base64url");
    const bridgeTokenHash = createHash("sha256").update(bridgeToken).digest("hex");

    await store.putIdpCredential(tenant, { serviceTokenEnc: sealSecret(secretsKey, serviceToken) });
    await store.putIdpBinding({
      tenant, youtrackUrl: v.url, projects: v.projectsNorm, hubGroups: v.hubNorm, roleGroups: v.rolesNorm,
      defaultProject: v.defaultProject ?? v.projectsNorm[0], bridgeTokenHash, status: "active",
      boundBy: ctx.identity?.login ?? null, boundAt: new Date().toISOString(), lastError: null,
    });
    audit({ login: ctx.identity?.login ?? null, role: ctx.role ?? null, tenant, project: null, op: "idp-bind", spec: null, result: `ok:${v.url}` });
    logger(`idp-bind ${tenant} -> ${v.url}`);
    return { binding: publicBinding(store.getIdpBinding(tenant)), bridgeToken, probe: probeResult };
  }

  async function unbind({ ctx, tenant }) {
    requireStore();
    assertBindAllowed(ctx);
    const row = store.getIdpBinding(tenant);
    if (!row) throw new IdpError(404, "NOT_BOUND", `tenant ${tenant} has no IdP binding`);
    // The binder revokes their own binding; an operator-YT owner may revoke any.
    if (row.boundBy !== ctx.identity?.login && ctx.role !== "owner") {
      throw new IdpError(403, "FORBIDDEN", "only the binder or an owner may unbind an IdP");
    }
    await store.deleteIdpBinding(tenant);
    await store.deleteIdpCredential(tenant);
    audit({ login: ctx.identity?.login ?? null, role: ctx.role ?? null, tenant, project: null, op: "idp-unbind", spec: null, result: `ok:${row.youtrackUrl}` });
    logger(`idp-unbind ${tenant} (was ${row.youtrackUrl})`);
    return { unbound: tenant, previous: row.youtrackUrl };
  }

  function bindings(ctx) {
    assertBindAllowed(ctx);
    const all = store?.listIdpBindings?.() ?? [];
    const visible = ctx.role === "owner" ? all : all.filter((row) => row.boundBy === ctx.identity?.login);
    return { bindings: visible.map(publicBinding) };
  }

  /**
   * The auth registry's view: active bindings with unsealed service tokens.
   * Called on every auth cache miss — keep it cheap (two indexed reads).
   */
  async function listActiveIdps() {
    const rows = store?.listIdpBindings?.() ?? [];
    const out = [];
    for (const row of rows) {
      if (row.status !== "active") continue;
      const cred = store.getIdpCredential(row.tenant);
      if (!cred || !secretsKey) continue;
      let serviceToken;
      try {
        serviceToken = openSecret(secretsKey, cred.serviceTokenEnc);
      } catch {
        continue; // a row that fails to unseal must not take auth down
      }
      out.push({
        isDefault: false,
        tenant: row.tenant,
        baseUrl: row.youtrackUrl,
        serviceToken,
        bridgeTokenHash: row.bridgeTokenHash,
        projects: row.projects,
        hubGroups: row.hubGroups,
        roleGroups: row.roleGroups,
        defaultProject: row.defaultProject,
        status: row.status,
      });
    }
    return out;
  }

  /**
   * Projects registered through active bindings — MountManager treats them as
   * configured, so a customer's YouTrack needs no operator config entry.
   */
  function projectScopes() {
    const rows = store?.listIdpBindings?.() ?? [];
    return [...new Set(rows.filter((row) => row.status === "active").flatMap((row) => row.projects ?? []))];
  }

  return { probe, bind, unbind, bindings, listActiveIdps, projectScopes };
}

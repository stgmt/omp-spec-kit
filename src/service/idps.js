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
 * Hosts the service must never call for IdP verification: loopback beyond
 * 127.0.0.1, wildcard, link-local/cloud-metadata, v4-mapped v6. A bound IdP
 * gets called with a stored bearer token on every auth lookup — these
 * destinations would make that an internal-network oracle.
 */
function idpHostDenied(host) {
  const bare = host.replace(/^\[|\]$/g, "");
  return bare === "::1" || bare === "::" || bare === "0.0.0.0"
    || /^::ffff:/i.test(bare)
    || /^169\.254\./.test(bare)
    || /^fe[89a-f]/i.test(bare);
}

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
  if (idpHostDenied(host)) {
    return { ok: false, reason: `youtrack host is not a bindable address: ${host}` };
  }
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
  // userinfo must never persist: `https://user:pass@host` would otherwise be
  // stored in the binding row and echoed back through /idp/bindings.
  url.username = "";
  url.password = "";
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
    capabilities: row.capabilities ?? null,
  };
}

/**
 * External IdP bindings (TASK-13): a verified user on the operator's YouTrack
 * binds a customer's own YouTrack server. One binding = one tenant; the
 * bound instance verifies user identity and supplies groups for that
 * tenant's scopes/roles. The customer's service token is sealed at rest; the
 * minted app-bridge secret is shown once at bind and stored as a hash.
 */
export function createIdpManager({ store, config, secretsKey, logger = () => {}, fetchImpl = fetch, bindProjectRepo = null, unbindProjectRepo = null }) {
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

    const users = await probeFetch(`${baseUrl}/hub/api/rest/users?$top=5&fields=id,login`, serviceToken);
    if (!users.ok) throw new IdpError(400, "IDP_CAPABILITY", `service token cannot enumerate users (HTTP ${users.status}) — group resolution would fail`);
    // Mint capability matters at onboarding time: reading another user's
    // permanenttokens needs the same elevated rights as minting one. A
    // read-only service token passes users/me + enumeration but dies on
    // mint — report it now instead of failing the member later.
    const usersBody = await users.json().catch(() => null);
    const other = (usersBody?.users ?? []).find((u) => u?.id && u.id !== meBody.id);
    let mintTokens = null;
    if (other?.id) {
      const probe = await probeFetch(`${baseUrl}/hub/api/rest/users/${other.id}/permanenttokens?$top=1&fields=id`, serviceToken);
      mintTokens = probe.ok;
    }
    return { ok: true, serviceLogin: meBody.login, capabilities: { mintTokens } };
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

  function sameSet(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v) => b.includes(v));
  }

  function sameRoleGroups(a, b) {
    return ["owner", "writer", "reader"].every((role) => sameSet(a?.[role] ?? [], b?.[role] ?? []));
  }

  /**
   * Optionally bind the tenant's projects to the customer's own specs repo
   * in the same call — the tenant's specs then never touch the operator's
   * shared repo. Per-project results are reported; a failed repo bind leaves
   * the IdP binding in place and the project refusing REPO_BINDING_REQUIRED.
   */
  async function applyRepoBlock(repo, projectsNorm, boundBy) {
    if (repo === undefined || repo === null) return undefined;
    if (typeof repo !== "object" || Array.isArray(repo)) {
      throw new IdpError(400, "BAD_INPUT", "repo must be an object {url, token, branch?, username?, migrate?}");
    }
    if (typeof bindProjectRepo !== "function") {
      throw new IdpError(503, "REPO_BIND_UNAVAILABLE", "the repo manager is not wired — cannot bind tenant projects to a specs repo", { retryable: true });
    }
    const results = {};
    for (const project of projectsNorm) {
      try {
        results[project] = await bindProjectRepo({ project, repoUrl: repo.url, branch: repo.branch, token: repo.token, username: repo.username, migrate: repo.migrate, boundBy });
      } catch (error) {
        results[project] = { error: error?.code ?? "REPO_BIND_FAILED", message: String(error?.message ?? error).split("\n")[0] };
      }
    }
    return results;
  }

  async function bind({ ctx, tenant, youtrackUrl, serviceToken, projects, hubGroups, roleGroups, defaultProject, repo = null }) {
    requireStore();
    assertBindAllowed(ctx);
    const v = validateInput({ tenant, youtrackUrl, serviceToken, projects, hubGroups, roleGroups, defaultProject });
    if (!secretsKey) throw new IdpError(503, "SECRETS_UNAVAILABLE", "SPEC_REGISTRY_SECRETS_KEY is not set — IdP bindings are disabled", { retryable: true });

    const staticTenantNames = new Set((config.tenants ?? []).map((t) => t.tenant));
    if (staticTenantNames.has(tenant)) throw new IdpError(409, "TENANT_TAKEN", `tenant name collides with a configured tenant: ${tenant}`);

    // Project scopes are exclusive: an external IdP may never claim a project
    // the operator configuration manages or another binding already owns —
    // binding `stgmt/alpha` would hand the customer's users the operator's
    // specs, writes included.
    const configured = new Set(config.projects ?? []);
    const claimed = new Map();
    for (const row of store.listIdpBindings() ?? []) {
      for (const p of row.projects ?? []) claimed.set(p, row.tenant);
    }
    for (const project of v.projectsNorm) {
      if (configured.has(project)) {
        throw new IdpError(409, "IDP_PROJECT_TAKEN", `project is managed by the operator configuration and cannot be claimed by an external IdP: ${project}`);
      }
      const owner = claimed.get(project);
      if (owner && owner !== tenant) {
        throw new IdpError(409, "IDP_PROJECT_TAKEN", `project ${project} is already claimed by tenant ${owner}`);
      }
    }

    const existing = store.getIdpBinding(tenant);
    // Only the binder (or an owner) may touch a live binding — otherwise a
    // stranger could re-point the tenant at their own YouTrack and silently
    // rotate the bridge secret under the installed app.
    if (existing && existing.boundBy !== ctx.identity?.login && ctx.role !== "owner") {
      throw new IdpError(403, "FORBIDDEN", "only the binder or an owner may change an IdP binding");
    }
    const identical = existing?.status === "active" && existing.youtrackUrl === v.url
      && sameSet(existing.projects ?? [], v.projectsNorm)
      && sameSet(existing.hubGroups ?? [], v.hubNorm)
      && sameRoleGroups(existing.roleGroups ?? {}, v.rolesNorm)
      && (existing.defaultProject ?? null) === (v.defaultProject ?? v.projectsNorm[0]);

    let row;
    let bridgeToken = null;
    let probeResult = null;
    if (identical) {
      row = existing;
    } else {
      if (existing && existing.youtrackUrl === v.url) {
        throw new IdpError(409, "IDP_EXISTS", `tenant ${tenant} is already bound to ${v.url} with different parameters — unbind first to change scope or group configuration`);
      }
      const urlOwner = store.getIdpBindingByUrl(v.url);
      if (urlOwner && urlOwner.tenant !== tenant) {
        throw new IdpError(409, "IDP_URL_TAKEN", `YouTrack ${v.url} is already bound as tenant ${urlOwner.tenant}`);
      }

      probeResult = await probeYoutrack(v.url, serviceToken);

      // Bridge secret: minted by the service, shown once, stored as a hash —
      // the row carries no usable credential.
      bridgeToken = randomBytes(32).toString("base64url");
      const bridgeTokenHash = createHash("sha256").update(bridgeToken).digest("hex");

      await store.putIdpCredential(tenant, { serviceTokenEnc: sealSecret(secretsKey, serviceToken) });
      await store.putIdpBinding({
        tenant, youtrackUrl: v.url, projects: v.projectsNorm, hubGroups: v.hubNorm, roleGroups: v.rolesNorm,
        defaultProject: v.defaultProject ?? v.projectsNorm[0], bridgeTokenHash, status: "active",
        boundBy: ctx.identity?.login ?? null, boundAt: new Date().toISOString(), lastError: null,
        capabilities: probeResult?.capabilities ?? null,
      });
      audit({ login: ctx.identity?.login ?? null, role: ctx.role ?? null, tenant, project: null, op: "idp-bind", spec: null, result: `ok:${v.url}` });
      logger(`idp-bind ${tenant} -> ${v.url}`);
      row = store.getIdpBinding(tenant);
    }

    const repos = await applyRepoBlock(repo, v.projectsNorm, ctx.identity?.login ?? null);
    return {
      binding: publicBinding(row),
      ...(bridgeToken !== null ? { bridgeToken } : {}),
      ...(probeResult !== null ? { probe: probeResult } : {}),
      ...(identical ? { unchanged: true } : {}),
      ...(repos !== undefined ? { repos } : {}),
    };
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
    // The tenant's projects cease to exist the moment the binding goes — an
    // orphaned repo binding would otherwise resurface if the project id is
    // later claimed by a different tenant.
    for (const project of row.projects ?? []) {
      try { await unbindProjectRepo?.(project); } catch {}
    }
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

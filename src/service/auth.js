import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_CACHE_MS = 60_000;
const YOUTRACK_TIMEOUT_MS = 5_000;
// Hub REST user fields. transitiveGroups carries inherited membership — the
// correct source for tenant/role resolution. Verified live on YouTrack 2025.3.
const USER_FIELDS = "id,login,name,banned,transitiveGroups(id,name)";

export class AuthError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.retryable = extra.retryable === true;
    Object.assign(this, { ...extra, retryable: extra.retryable === true });
  }
}

export class AuthConfigError extends Error {}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashesEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function bearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * AuthN/Z against live YouTrack IdPs (TASK-12, TASK-13). Two verified
 * credential paths:
 *   - app bridge: the YouTrack app backend authenticates with its own secret
 *     and asserts the session user (X-Spec-User); the service re-verifies that
 *     user with that IdP's service token (`GET /api/users/{login}`);
 *   - direct: a user's YouTrack permanent token presented as the bearer
 *     credential, verified as itself (`GET /api/users/me`).
 * Both resolve `user -> groups -> tenant -> scopes` plus a role. Fail-closed:
 * YouTrack unreachable -> retryable UNAVAILABLE, never an unverified pass.
 *
 * Multi-IdP: `idps` supplies externally bound YouTrack instances (one tenant
 * per binding). The bridge secret identifies the IdP by hash; a direct token
 * is verified against the hinted (`X-Spec-Idp`) or default IdP first, then
 * remaining bound IdPs in order — the hint is a routing preference only, it
 * never widens authorization.
 */

/**
 * The YouTrack-app request signature — how a call proves it arrived through
 * the installed app rather than from a raw client:
 *   Authorization: Bearer <bridgeToken>   (sha256 must equal a bound
 *                                        IdP's bridgeTokenHash)
 *   X-Spec-User: <login>                  (session user asserted by YouTrack;
 *                                        always re-verified server-side)
 * classifyRequest() is the single place that recognizes the signature; a
 * bearer that matches no bridge hash is treated as a direct user token.
 */
export function classifyRequest(req, idpCandidates) {
  const token = bearerToken(req);
  if (token === null) return { kind: "anonymous" };
  const tokenHash = sha256(token);
  const bridgeIdp = idpCandidates.find((idp) => hashesEqual(tokenHash, idp.bridgeTokenHash)) ?? null;
  if (bridgeIdp === null) return { kind: "direct", token, tokenHash };
  const assertedLogin = typeof req.headers?.["x-spec-user"] === "string" && req.headers["x-spec-user"].length > 0
    ? req.headers["x-spec-user"]
    : null;
  return { kind: "bridge", tokenHash, idp: bridgeIdp, assertedLogin };
}
export function createYouTrackAuth({ youtrack, appBridgeToken, tenants, roleGroups, idps = null, cacheTtlMs = DEFAULT_CACHE_MS, fetchImpl = fetch, logger = () => {} }) {
  const defaultIdp = {
    isDefault: true,
    tenant: null,
    baseUrl: youtrack.baseUrl,
    serviceToken: youtrack.serviceToken,
    bridgeTokenHash: sha256(appBridgeToken),
  };
  const cache = new Map();

  function cacheKey(tokenHash, assertedLogin) {
    return assertedLogin ? `${tokenHash}|${assertedLogin}` : tokenHash;
  }

  async function fetchJson(url, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), YOUTRACK_TIMEOUT_MS);
    try {
      return await fetchImpl(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      throw new AuthError(503, "UNAVAILABLE", `YouTrack is unreachable: ${error?.message ?? error}`, { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeUser(raw) {
    const groups = Array.isArray(raw?.transitiveGroups) ? raw.transitiveGroups : Array.isArray(raw?.groups) ? raw.groups : [];
    return {
      login: typeof raw?.login === "string" ? raw.login : null,
      userId: raw?.id ?? null,
      name: raw?.name ?? raw?.fullName ?? null,
      banned: raw?.banned === true,
      groups: groups.map((group) => group?.name).filter((name) => typeof name === "string" && name.length > 0),
    };
  }

  /**
   * Authorization data (groups) is resolved with the IdP's SERVICE token: Hub
   * field visibility hides a non-admin's group list from `users/me`, so the
   * caller's own token proves identity only — verified live on 2025.3.
   */
  async function fetchUserWithServiceToken(login, idp) {
    const url = `${idp.baseUrl}/hub/api/rest/users?query=login:${encodeURIComponent(login)}&fields=${USER_FIELDS}`;
    const response = await fetchJson(url, idp.serviceToken);
    if (response.status === 401 || response.status === 403) throw new AuthError(503, "UNAVAILABLE", "YouTrack rejected the service token", { retryable: true });
    if (!response.ok) throw new AuthError(503, "UNAVAILABLE", `YouTrack user lookup failed (${response.status})`, { retryable: true });
    const page = await response.json();
    const raw = Array.isArray(page?.users) ? page.users[0] : null;
    if (!raw) throw new AuthError(401, "UNKNOWN_USER", `user is not known to YouTrack: ${login}`);
    const user = normalizeUser(raw);
    if (!user.login) throw new AuthError(503, "UNAVAILABLE", "YouTrack user lookup returned no login", { retryable: true });
    return user;
  }

  /** Identity proof: the caller's token must resolve to a real YouTrack user on that IdP. */
  async function verifyTokenIdentity(token, idp) {
    const url = `${idp.baseUrl}/hub/api/rest/users/me?fields=id,login,banned`;
    const response = await fetchJson(url, token);
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new AuthError(503, "UNAVAILABLE", `YouTrack token verification failed (${response.status})`, { retryable: true });
    const raw = await response.json();
    if (typeof raw?.login !== "string" || raw.login.length === 0) {
      throw new AuthError(503, "UNAVAILABLE", "YouTrack token verification returned no login", { retryable: true });
    }
    return { login: raw.login, userId: raw.id ?? null, banned: raw.banned === true };
  }

  function roleFor(groups, mapping) {
    for (const role of ["owner", "writer", "reader"]) {
      const groupsForRole = mapping[role] ?? [];
      if (groups.some((group) => groupsForRole.includes(group))) return role;
    }
    return null;
  }

  function resolveContext(user, idp) {
    if (user.banned) throw new AuthError(403, "BANNED", `user is banned in YouTrack: ${user.login}`);
    if (idp.isDefault !== true) {
      // An external IdP maps to exactly one tenant (its binding): scopes and
      // role groups come from the binding, not the static tenant config.
      if (!user.groups.some((group) => idp.hubGroups.includes(group))) {
        throw new AuthError(403, "NO_SCOPES", `no scopes matched for user ${user.login}`);
      }
      const role = roleFor(user.groups, idp.roleGroups);
      if (!role) throw new AuthError(403, "NO_ROLE", `no role group for user ${user.login}`);
      return {
        tenant: [idp.tenant],
        scopes: [...idp.projects],
        defaultScope: idp.defaultProject ?? idp.projects[0] ?? null,
        identity: { login: user.login, userId: user.userId, name: user.name },
        role,
        idp: idp.tenant,
      };
    }
    const matched = tenants.filter((tenant) => user.groups.some((group) => tenant.hubGroups.includes(group)));
    if (matched.length === 0) throw new AuthError(403, "NO_SCOPES", `no scopes matched for user ${user.login}`);
    const scopes = [...new Set(matched.flatMap((tenant) => tenant.projects))];
    const defaultScope = matched.length === 1 ? matched[0].defaultProject ?? null : null;
    const role = roleFor(user.groups, roleGroups);
    if (!role) throw new AuthError(403, "NO_ROLE", `no role group for user ${user.login}`);
    return {
      tenant: matched.map((tenant) => tenant.tenant),
      scopes,
      defaultScope,
      identity: { login: user.login, userId: user.userId, name: user.name },
      role,
      idp: null,
    };
  }

  /** Active bound IdPs plus the default, in deterministic order. */
  async function allIdps() {
    const bound = idps === null ? [] : await idps.list();
    return [defaultIdp, ...bound.filter((idp) => idp?.status === "active")];
  }

  return {
    async authenticate(req) {
      const token = bearerToken(req);
      if (token === null) throw new AuthError(401, "MISSING_TOKEN", "missing bearer token");

      // Cache key from the raw asserted-login header — identical for bridge
      // and direct callers, so the lookup needs no IdP list and the store is
      // only read on a miss.
      const assertedLoginHeader = typeof req.headers?.["x-spec-user"] === "string" && req.headers["x-spec-user"].length > 0
        ? req.headers["x-spec-user"]
        : null;
      const key = cacheKey(sha256(token), assertedLoginHeader);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.ctx;

      const candidates = await allIdps();
      const sig = classifyRequest(req, candidates);
      const assertedLogin = sig.kind === "bridge" ? sig.assertedLogin : null;
      if (sig.kind === "bridge" && assertedLogin === null) {
        throw new AuthError(401, "MISSING_USER", "app bridge requests must carry the verified X-Spec-User header");
      }

      let user;
      let resolvedIdp;
      if (sig.kind === "bridge") {
        resolvedIdp = sig.idp;
        user = await fetchUserWithServiceToken(assertedLogin, sig.idp);
      } else {
        // Direct token: the optional X-Spec-Idp header reorders the candidate
        // list only — it is a routing hint, never authorization.
        const hint = typeof req.headers?.["x-spec-idp"] === "string" ? req.headers["x-spec-idp"] : null;
        const ordered = hint === null ? candidates
          : [...candidates.filter((idp) => idp.tenant === hint), ...candidates.filter((idp) => idp.tenant !== hint)];
        let identity = null;
        resolvedIdp = null;
        let unreachable = 0;
        for (const idp of ordered) {
          try {
            identity = await verifyTokenIdentity(token, idp);
          } catch (error) {
            // A dead IdP must not take the fan-out down — its failure is
            // scoped to its own tenant. Keep verifying against the rest;
            // if nothing verifies, the honest answer is UNAVAILABLE only
            // when a dead IdP might have been the token's issuer.
            if (error instanceof AuthError && error.status === 503) { unreachable += 1; continue; }
            throw error;
          }
          if (identity !== null) { resolvedIdp = idp; break; }
        }
        if (identity === null) {
          if (unreachable > 0) {
            throw new AuthError(503, "UNAVAILABLE", "the token could not be conclusively verified: at least one bound YouTrack is unreachable", { retryable: true });
          }
          throw new AuthError(401, "INVALID_TOKEN", "YouTrack rejected the token");
        }
        user = await fetchUserWithServiceToken(identity.login, resolvedIdp);
      }

      if (typeof req.headers?.["x-spec-author"] === "string" && req.headers["x-spec-author"].length > 0) {
        logger(`ignored retired X-Spec-Author header (verified login: ${user.login})`);
      }
      const ctx = resolveContext(user, resolvedIdp);
      cache.set(key, { ctx, expiresAt: Date.now() + cacheTtlMs });
      return ctx;
    },
    cacheSize: () => cache.size,
    clearCache: () => cache.clear(),
  };
}

/** Config validation for the auth block; throws AuthConfigError on any gap. */
export function parseAuthConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AuthConfigError("auth configuration is required; the service never runs unauthenticated");
  const { youtrack, appBridge, roleGroups } = raw;
  if (!youtrack || typeof youtrack.baseUrl !== "string" || youtrack.baseUrl.length === 0) throw new AuthConfigError("auth.youtrack.baseUrl is required");
  let baseUrl;
  try {
    baseUrl = new URL(youtrack.baseUrl);
  } catch {
    throw new AuthConfigError(`auth.youtrack.baseUrl is not a valid URL: ${youtrack.baseUrl}`);
  }
  const host = baseUrl.hostname;
  const isPrivateHost = host === "localhost" || host === "127.0.0.1" || !host.includes(".");
  if (baseUrl.protocol !== "https:" && !isPrivateHost) {
    throw new AuthConfigError(`auth.youtrack.baseUrl must use https (got ${baseUrl.protocol}//${host}); plain http is allowed only for private hosts`);
  }
  if (typeof youtrack.serviceToken !== "string" || youtrack.serviceToken.length < 16) throw new AuthConfigError("auth.youtrack.serviceToken is required (at least 16 characters)");
  if (!appBridge || typeof appBridge.token !== "string" || appBridge.token.length < 16) throw new AuthConfigError("auth.appBridge.token is required (at least 16 characters)");
  if (!roleGroups || typeof roleGroups !== "object" || Array.isArray(roleGroups)) throw new AuthConfigError("auth.roleGroups is required");
  const normalizedRoles = {};
  for (const role of ["owner", "writer", "reader"]) {
    const groups = roleGroups[role];
    if (groups === undefined) {
      normalizedRoles[role] = [];
      continue;
    }
    if (!Array.isArray(groups) || groups.some((group) => typeof group !== "string" || group.length === 0)) {
      throw new AuthConfigError(`auth.roleGroups.${role} must be an array of non-empty group names`);
    }
    normalizedRoles[role] = [...groups];
  }
  if (Object.values(normalizedRoles).every((groups) => groups.length === 0)) throw new AuthConfigError("auth.roleGroups must define at least one group across owner/writer/reader");
  return {
    youtrack: { baseUrl: baseUrl.toString().replace(/\/+$/, ""), serviceToken: youtrack.serviceToken },
    appBridgeToken: appBridge.token,
    roleGroups: normalizedRoles,
  };
}

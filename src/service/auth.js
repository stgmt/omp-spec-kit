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
 * AuthN/Z against the live YouTrack (TASK-12). Two verified credential paths:
 *   - app bridge: the YouTrack app backend authenticates with its own secret
 *     and asserts the session user (X-Spec-User); the service re-verifies that
 *     user with its own service token (`GET /api/users/{login}`);
 *   - direct: a user's YouTrack permanent token presented as the bearer
 *     credential, verified as itself (`GET /api/users/me`).
 * Both resolve `user -> groups -> tenant -> scopes` plus a role. Fail-closed:
 * YouTrack unreachable -> retryable UNAVAILABLE, never an unverified pass.
 */
export function createYouTrackAuth({ youtrack, appBridgeToken, tenants, roleGroups, cacheTtlMs = DEFAULT_CACHE_MS, fetchImpl = fetch, logger = () => {} }) {
  const bridgeHash = sha256(appBridgeToken);
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
   * Authorization data (groups) is resolved with the SERVICE token: Hub field
   * visibility hides a non-admin's group list from `users/me`, so the caller's
   * own token proves identity only — verified live on 2025.3.
   */
  async function fetchUserWithServiceToken(login) {
    const url = `${youtrack.baseUrl}/hub/api/rest/users?query=login:${encodeURIComponent(login)}&fields=${USER_FIELDS}`;
    const response = await fetchJson(url, youtrack.serviceToken);
    if (response.status === 401 || response.status === 403) throw new AuthError(503, "UNAVAILABLE", "YouTrack rejected the service token", { retryable: true });
    if (!response.ok) throw new AuthError(503, "UNAVAILABLE", `YouTrack user lookup failed (${response.status})`, { retryable: true });
    const page = await response.json();
    const raw = Array.isArray(page?.users) ? page.users[0] : null;
    if (!raw) throw new AuthError(401, "UNKNOWN_USER", `user is not known to YouTrack: ${login}`);
    const user = normalizeUser(raw);
    if (!user.login) throw new AuthError(503, "UNAVAILABLE", "YouTrack user lookup returned no login", { retryable: true });
    return user;
  }

  /** Identity proof: the caller's token must resolve to a real YouTrack user. */
  async function verifyTokenIdentity(token) {
    const url = `${youtrack.baseUrl}/hub/api/rest/users/me?fields=id,login,banned`;
    const response = await fetchJson(url, token);
    if (response.status === 401 || response.status === 403) throw new AuthError(401, "INVALID_TOKEN", "YouTrack rejected the token");
    if (!response.ok) throw new AuthError(503, "UNAVAILABLE", `YouTrack token verification failed (${response.status})`, { retryable: true });
    const raw = await response.json();
    if (typeof raw?.login !== "string" || raw.login.length === 0) {
      throw new AuthError(503, "UNAVAILABLE", "YouTrack token verification returned no login", { retryable: true });
    }
    return { login: raw.login, userId: raw.id ?? null, banned: raw.banned === true };
  }

  function roleFor(groups) {
    for (const role of ["owner", "writer", "reader"]) {
      const groupsForRole = roleGroups[role] ?? [];
      if (groups.some((group) => groupsForRole.includes(group))) return role;
    }
    return null;
  }

  function resolveContext(user) {
    if (user.banned) throw new AuthError(403, "BANNED", `user is banned in YouTrack: ${user.login}`);
    const matched = tenants.filter((tenant) => user.groups.some((group) => tenant.hubGroups.includes(group)));
    if (matched.length === 0) throw new AuthError(403, "NO_SCOPES", `no scopes matched for user ${user.login}`);
    const scopes = [...new Set(matched.flatMap((tenant) => tenant.projects))];
    const defaultScope = matched.length === 1 ? matched[0].defaultProject ?? null : null;
    const role = roleFor(user.groups);
    if (!role) throw new AuthError(403, "NO_ROLE", `no role group for user ${user.login}`);
    return {
      tenant: matched.map((tenant) => tenant.tenant),
      scopes,
      defaultScope,
      identity: { login: user.login, userId: user.userId, name: user.name },
      role,
    };
  }

  return {
    async authenticate(req) {
      const token = bearerToken(req);
      if (token === null) throw new AuthError(401, "MISSING_TOKEN", "missing bearer token");

      const tokenHash = sha256(token);
      const isBridge = hashesEqual(tokenHash, bridgeHash);
      const assertedLogin = isBridge && typeof req.headers?.["x-spec-user"] === "string" && req.headers["x-spec-user"].length > 0
        ? req.headers["x-spec-user"]
        : null;
      if (isBridge && assertedLogin === null) {
        throw new AuthError(401, "MISSING_USER", "app bridge requests must carry the verified X-Spec-User header");
      }

      const key = cacheKey(tokenHash, assertedLogin);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.ctx;

      let user;
      if (isBridge) {
        user = await fetchUserWithServiceToken(assertedLogin);
      } else {
        const identity = await verifyTokenIdentity(token);
        user = await fetchUserWithServiceToken(identity.login);
      }

      if (typeof req.headers?.["x-spec-author"] === "string" && req.headers["x-spec-author"].length > 0) {
        logger(`ignored retired X-Spec-Author header (verified login: ${user.login})`);
      }
      const ctx = resolveContext(user);
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

/**
 * Onboarding (TASK-8 / R-6 / R-7): the YouTrack app's "connect agent" action
 * asks the service for a credential. The service issues none of its own — it
 * mints a **YouTrack permanent token for the caller** with the service token
 * and returns it together with a ready `.mcp.json` snippet, so no credential is
 * ever issued by hand.
 *
 * Verified live before implementation (step 0, 2026-09-15, Bearer service
 * token against the test YouTrack): resolving the user, listing Hub services,
 * minting a token for another user, listing tokens and revoking all succeed.
 * The scope must cover every Hub service (YouTrack **and** Hub), or calls to
 * `/hub/api/rest/*` with the minted token answer 401.
 *
 * Policy: one token per (login, purpose) — a previous token with the same name
 * is revoked before a new one is minted, so repeated calls do not pile up
 * credentials. Only the fact of issuance is audited; the value never reaches
 * the store, the access log or the service log.
 */
export const ONBOARDING_TOKEN_NAME = "omp-spec-kit agent";
const UPSTREAM_TIMEOUT_MS = 15_000;

export class OnboardingError extends Error {
  constructor(message, { status = 500, code = "ONBOARDING_FAILED", retryable = false } = {}) {
    super(message);
    this.name = "OnboardingError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function buildManagedSnippet(serviceUrl, token) {
  return `${JSON.stringify(
    {
      $schema: "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json",
      mcpServers: {
        "omp-spec-kit": {
          type: "http",
          url: `${String(serviceUrl).replace(/\/+$/u, "")}/mcp`,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  )}\n`;
}

export function createOnboarding({ config, audit, logger = () => {}, fetchImpl = fetch }) {
  const youtrack = config.auth.youtrack;

  async function youtrackJson(path, { method = "GET", body } = {}) {
    let response;
    try {
      response = await fetchImpl(`${youtrack.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${youtrack.serviceToken}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      throw new OnboardingError(`YouTrack is unreachable: ${String(error?.message ?? error)}`, {
        status: 503,
        code: "UNAVAILABLE",
        retryable: true,
      });
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const retryable = response.status >= 500;
      throw new OnboardingError(`YouTrack ${method} ${path} failed: HTTP ${response.status} ${detail.slice(0, 200)}`, {
        status: retryable ? 503 : 502,
        code: retryable ? "UNAVAILABLE" : "UPSTREAM_ERROR",
        retryable,
      });
    }
    if (response.status === 204) return null;
    return response.json().catch(() => null);
  }

  return {
    /**
     * Mint (or re-mint) the caller's agent credential.
     * @param {{ ctx: { identity: { login: string }, role: string, tenant: string|string[]|null }, serviceUrl: string }} input
     */
    async issueToken({ ctx, serviceUrl }) {
      const login = ctx?.identity?.login;
      if (typeof login !== "string" || login.length === 0) {
        throw new OnboardingError("caller identity is missing", { status: 401, code: "UNAUTHENTICATED" });
      }
      const users = await youtrackJson(`/hub/api/rest/users?query=login:${encodeURIComponent(login)}&fields=id,login,banned`);
      const user = users?.users?.[0];
      if (!user?.id) {
        throw new OnboardingError(`YouTrack has no user ${login}`, { status: 404, code: "UNKNOWN_USER" });
      }
      if (user.banned === true) {
        throw new OnboardingError(`user ${login} is banned`, { status: 403, code: "BANNED" });
      }

      const services = await youtrackJson("/hub/api/rest/services?fields=id,applicationName");
      const scope = (services?.services ?? []).map((service) => ({ id: service.id }));
      if (scope.length === 0) {
        throw new OnboardingError("YouTrack returned no Hub services to scope the token", {
          status: 502,
          code: "UPSTREAM_ERROR",
        });
      }

      // One token per (login, purpose): revoke the previous one first.
      const listed = await youtrackJson(`/hub/api/rest/users/${user.id}/permanenttokens?fields=id,name`);
      const previous = (listed?.permanenttokens ?? []).filter((token) => token?.name === ONBOARDING_TOKEN_NAME);
      for (const token of previous) {
        await youtrackJson(`/hub/api/rest/users/${user.id}/permanenttokens/${token.id}`, { method: "DELETE" });
      }

      const minted = await youtrackJson(`/hub/api/rest/users/${user.id}/permanenttokens?fields=id,name,token`, {
        method: "POST",
        body: { name: ONBOARDING_TOKEN_NAME, scope },
      });
      if (typeof minted?.token !== "string" || minted.token.length === 0) {
        throw new OnboardingError("YouTrack returned no token value", { status: 502, code: "UPSTREAM_ERROR" });
      }

      const url = `${String(serviceUrl).replace(/\/+$/u, "")}/mcp`;
      logger(`onboarding: issued a YouTrack token for ${login} (scope: ${scope.length} services, revoked ${previous.length} previous)`);
      try {
        audit?.({
          tenant: Array.isArray(ctx?.tenant) ? ctx.tenant.join(",") : ctx?.tenant ?? null,
          login,
          role: ctx?.role ?? null,
          project: null,
          op: "onboarding",
          spec: null,
          requestId: null,
          result: `ok:token-issued:revoked-${previous.length}`,
        });
      } catch {}
      return { token: minted.token, url, mcpJson: buildManagedSnippet(serviceUrl, minted.token) };
    },
  };
}

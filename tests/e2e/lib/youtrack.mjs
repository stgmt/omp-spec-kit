import { YT_URL } from "./compose.mjs";

/**
 * Thin client over the live YouTrack admin APIs (Basic auth for the
 * bootstrap, permanent tokens afterwards). Shapes verified live on
 * YouTrack 2025.3.161254; every call throws on an unexpected status so a
 * version drift fails the E2E loudly instead of silently.
 */
export function createYouTrackAdmin({ login, password, logger = () => {} }) {
  const basic = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;

  async function call(method, pathname, { body, auth = basic, raw = false, expect = [200, 201] } = {}) {
    const response = await fetch(`${YT_URL}${pathname}`, {
      method,
      headers: {
        authorization: auth,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!expect.includes(response.status)) {
      throw new Error(`YouTrack ${method} ${pathname} -> ${response.status}: ${text.slice(0, 300)}`);
    }
    if (raw) return { status: response.status, text };
    try {
      return text.length > 0 ? JSON.parse(text) : null;
    } catch {
      throw new Error(`YouTrack ${method} ${pathname} returned non-JSON: ${text.slice(0, 200)}`);
    }
  }

  return {
    call,
    async me() {
      return call("GET", "/hub/api/rest/users/me?fields=id,login,name");
    },
    async meNative() {
      return call("GET", "/api/users/me?fields=id,login");
    },
    async youtrackServiceId() {
      const page = await call("GET", "/hub/api/rest/services?fields=id,name,applicationName");
      const service = page?.services?.find((entry) => entry.applicationName === "YouTrack");
      if (!service) throw new Error("YouTrack service is not registered in Hub");
      return service.id;
    },
    /**
     * Tokens used against the Hub REST API (users/me, users?query=) must carry
     * the Hub service in scope in addition to YouTrack — verified live:
     * a YouTrack-only token is rejected by /hub/api/rest/*.
     */
    async hubServiceId() {
      const page = await call("GET", "/hub/api/rest/services?fields=id,name,applicationName");
      const service = page?.services?.find((entry) => entry.applicationName === "Hub");
      if (!service) throw new Error("Hub service is not registered");
      return service.id;
    },
    async createGroup(name) {
      const existing = await call("GET", `/hub/api/rest/usergroups?query=name:${encodeURIComponent(name)}&fields=id,name`).catch(() => null);
      const found = existing?.usergroups?.find((group) => group.name === name);
      if (found) return found;
      const group = await call("POST", "/hub/api/rest/usergroups?fields=id,name", { body: { name } });
      logger(`created group ${name}`);
      return group;
    },
    async createUser({ login: userLogin, password: userPassword, email }) {
      const existing = await this.findUserByLogin(userLogin);
      if (existing) {
        // idempotent fixture provisioning: reset the password so re-runs work
        await call("POST", `/hub/api/rest/users/${existing.id}?fields=id,login`, { body: { password: userPassword } });
        return existing;
      }
      const user = await call("POST", "/hub/api/rest/users?fields=id,login", {
        body: { login: userLogin, password: userPassword, profile: { email: { email } } },
      });
      logger(`created user ${userLogin}`);
      return user;
    },
    async addUserToGroup(groupId, userId) {
      await call("POST", `/hub/api/rest/usergroups/${groupId}/users`, { body: { id: userId } });
    },
    /**
     * Sets a password through the credentials API the UI itself uses
     * (captured live from 2025.3): authenticate validates the credentials,
     * merge commits them into the user profile. Without this, Hub users have
     * no password and the browser login form cannot be exercised.
     */
    async setPassword({ userId, login: userLogin, password: userPassword }) {
      const existing = await call("GET", `/hub/api/rest/users/${userId}?fields=id,login,details(id,authModule(id,name))`).catch(() => null);
      const loginDetails = Array.isArray(existing?.details) ? existing.details : [];
      if (loginDetails.length > 0) {
        logger(`${userLogin} already has login credentials (kept)`);
        return;
      }
      const checked = await call("POST", "/hub/api/rest/mergedetails/authenticate?fields=foundUsers(id),noUserAttempts(id),createHubDetails(isAllowed,errorId)", {
        body: { credentials: { username: userLogin, password: userPassword }, userId },
      });
      if (checked?.createHubDetails?.isAllowed !== true) {
        throw new Error(`credential check rejected for ${userLogin}: ${JSON.stringify(checked).slice(0, 200)}`);
      }
      await call("POST", "/hub/api/rest/mergedetails/merge?fields=details(id)", {
        body: { createHubDetails: true, foundUsers: checked.foundUsers ?? [], noUserAttempts: checked.noUserAttempts ?? [], userId },
      });
      logger(`set password for ${userLogin}`);
    },
    async createPermanentToken({ userId, name, serviceIds }) {
      const token = await call("POST", `/hub/api/rest/users/${userId}/permanenttokens?fields=id,name,token`, {
        body: { name, scope: serviceIds.map((id) => ({ id })) },
      });
      if (typeof token?.token !== "string") throw new Error(`permanent token for ${name} has no token value`);
      return token;
    },
    async listPermanentTokens({ userId }) {
      // The Hub API pages at 100; a run must see every token to clean up.
      const all = [];
      for (let skip = 0; ; skip += 100) {
        const page = await call("GET", `/hub/api/rest/users/${userId}/permanenttokens?fields=id,name&$skip=${skip}`);
        const batch = page?.permanenttokens ?? [];
        all.push(...batch);
        if (batch.length < 100) break;
      }
      return all;
    },
    /**
     * Test lifecycle: a suite run must not pile up credentials, so the token it
     * is about to replace is revoked first. `name` matches exactly, `prefix`
     * matches the timestamped names earlier runs left behind.
     */
    async revokePermanentTokens({ userId, name, prefix }) {
      const tokens = await this.listPermanentTokens({ userId });
      const doomed = tokens.filter((token) => (name ? token.name === name : false) || (prefix ? String(token.name).startsWith(prefix) : false));
      for (const token of doomed) {
        await this.revokePermanentToken({ userId, tokenId: token.id });
      }
      return doomed.length;
    },
    async revokePermanentToken({ userId, tokenId }) {
      await call("DELETE", `/hub/api/rest/users/${userId}/permanenttokens/${tokenId}`, { expect: [200, 204] });
    },
    async findUserByLogin(userLogin) {
      const page = await call("GET", `/hub/api/rest/users?query=login:${encodeURIComponent(userLogin)}&fields=id,login,banned`);
      return page?.users?.[0] ?? null;
    },
    async banUser(userId, banned) {
      await call("POST", `/hub/api/rest/users/${userId}?fields=id,login,banned`, { body: { banned } });
    },
    async createProject({ name, shortName, leaderId }) {
      const existing = await call("GET", `/api/admin/projects?fields=id,name,shortName&query=${encodeURIComponent(shortName)}`).catch(() => null);
      const found = Array.isArray(existing) ? existing.find((project) => project.shortName === shortName) : null;
      if (found) return found;
      const project = await call("POST", "/api/admin/projects?fields=id,name,shortName", {
        body: { name, shortName, leader: { id: leaderId } },
      });
      logger(`created project ${shortName}`);
      return project;
    },
    async appById(appId) {
      return call("GET", `/api/admin/apps/${appId}?fields=id,name,version`);
    },
    /** The apps list paginates (~42 built-ins before user apps). */
    async appByName(name) {
      const apps = await call("GET", "/api/admin/apps?fields=id,name,version&$top=500");
      const app = (Array.isArray(apps) ? apps : []).find((entry) => entry.name === name);
      if (!app) throw new Error(`app not installed: ${name}`);
      return app;
    },
    /** Hub project id (the YouTrack REST id and the Hub id differ). */
    async hubProjectId(shortName) {
      const page = await call("GET", `/hub/api/rest/projects?query=${encodeURIComponent(shortName)}&fields=id,key,name`);
      const project = page?.projects?.find((entry) => entry.key === shortName);
      if (!project) throw new Error(`Hub project not found for ${shortName}`);
      return project.id;
    },
    async addUserToProjectTeam({ hubProjectId: projectId, userId }) {
      await call("POST", `/hub/api/rest/projects/${projectId}/team/users`, { body: { id: userId } });
    },
    /**
     * App settings live in the undocumented apps admin API: a JSON-encoded
     * string in `globalSettings`. Shape captured from the live 2025.3 UI.
     */
    async setAppSettings(appId, settings) {
      await call("POST", `/api/admin/apps/${appId}/globalConfig?fields=enabled,globalSettings`, {
        body: { globalSettings: JSON.stringify(settings) },
        expect: [200, 201],
      });
      logger("applied app settings (globalConfig)");
    },
    async attachAppToProject(appId, projectId) {
      await call("POST", `/api/admin/apps/${appId}/usages?fields=id,enabled,project(id,shortName)`, {
        body: { project: { id: projectId } },
        expect: [200, 201],
      });
      logger("attached app to project");
    },
    /**
     * Removes an installed app — the UI-BDD precondition "the app is not
     * installed" is set via the API so the scenario itself can test the
     * browser upload. 404 tolerated: the precondition is satisfied either way.
     */
    async uninstallApp(appId) {
      await call("DELETE", `/api/admin/apps/${appId}`, { expect: [200, 204, 404] });
      logger("uninstalled app");
    },
    async issueCount(projectShortName) {
      const issues = await call("GET", `/api/issues?query=project:${projectShortName}&fields=id,idReadable&$top=1`);
      return Array.isArray(issues) ? issues.length : 0;
    },
  };
}

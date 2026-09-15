import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { E2E_DIR, SERVICE_URL, YT_URL } from "./compose.mjs";
import { ADMIN_PASSWORD, USERS } from "./bootstrap.mjs";
import { isolateGitEnvironment } from "../../helpers/git-env.mjs";

const CONFIG_PATH = path.join(E2E_DIR, "artifacts", "projects.json");

/** Config written by the last run-live bootstrap (auth block included). */
export async function readLiveConfig() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8").catch(() => "null"));
  if (!config?.auth?.youtrack?.serviceToken) {
    throw new Error(`live config is missing at ${CONFIG_PATH}: run \`node tests/e2e/run-live.mjs\` first`);
  }
  return config;
}

/**
 * Live fixture for the service test suite. The test compose must already be
 * up (run-live.mjs brings it up and bootstraps); there is no offline mode —
 * authentication is YouTrack-backed by design.
 */
export async function loadLiveFixture() {
  // A hook-started run inherits GIT_DIR/GIT_INDEX_FILE, which would make the
  // suite commit into the product worktree instead of its temp repositories.
  isolateGitEnvironment();
  const health = await fetch(`${SERVICE_URL}/health`, { signal: AbortSignal.timeout(5_000) }).catch(() => null);
  if (!health?.ok) {
    throw new Error("live fixture is not running: start it with `node tests/e2e/run-live.mjs` (compose project spec-auth-e2e)");
  }
  const config = await readLiveConfig();
  const users = {};
  for (const login of Object.keys(USERS)) {
    const response = await fetch(`${YT_URL}/hub/api/rest/users?query=login:${login}&fields=id,login`, {
      headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`live fixture: cannot resolve ${login} (${response.status})`);
    users[login] = (await response.json()).users?.[0] ?? null;
    if (!users[login]) throw new Error(`live fixture: user ${login} is missing — re-run run-live.mjs`);
  }
  return {
    configPath: CONFIG_PATH,
    /** Config for an in-process service bound to a test-local specs repo. */
    serviceConfigFor(specsRepo, { projects = ["stgmt/alpha"], tenant = "alpha", hubGroups = ["spec-alpha"] } = {}) {
      return {
        specsRepo,
        branch: "main",
        projects: projects.map((id) => ({ id })),
        tenants: [{ tenant, projects, hubGroups, defaultProject: projects.length === 1 ? projects[0] : null }],
        // In-process services run on the host: YouTrack is reachable via the
        // published port, not the compose-internal name.
        auth: { ...config.auth, youtrack: { ...config.auth.youtrack, baseUrl: YT_URL } },
      };
    },
    async writeServiceConfig(specsRepo, options) {
      const target = path.join(E2E_DIR, "artifacts", `service-config-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`);
      await writeFile(target, JSON.stringify(this.serviceConfigFor(specsRepo, options), null, 2));
      return target;
    },
    users,
    async userToken(login) {
      const response = await fetch(`${YT_URL}/hub/api/rest/users?query=login:${login}&fields=id,login`, {
        headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      const user = (await response.json()).users?.[0];
      if (!user) throw new Error(`live fixture: user ${login} is missing`);
      const services = await fetch(`${YT_URL}/hub/api/rest/services?fields=id,applicationName`, {
        headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, accept: "application/json" },
      }).then((r) => r.json());
      const scope = services.services.map((service) => ({ id: service.id }));
      // The name is unique per process: test files run in parallel and must not
      // revoke each other's token. The bootstrap clears stale ones per run.
      const tokenResponse = await fetch(`${YT_URL}/hub/api/rest/users/${user.id}/permanenttokens?fields=token`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, "content-type": "application/json" },
        body: JSON.stringify({ name: `suite-${login}-${process.pid}-${Date.now()}`, scope }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!tokenResponse.ok) throw new Error(`live fixture: token minting failed for ${login} (${tokenResponse.status})`);
      return (await tokenResponse.json()).token;
    },
  };
}

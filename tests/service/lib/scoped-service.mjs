import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { startService } from "../../../src/service/index.js";
import { loadLiveFixture } from "../../e2e/lib/live-fixture.mjs";
import { seedSpecBranch } from "./spec-repo.mjs";

const execFileAsync = promisify(execFile);
const IDENTITY = { name: "spec-bot", email: "bot@example.invalid" };
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const SECRETS_KEY = "suite-secrets-key-0123456789";

const servers = [];
const services = [];
const tempDirs = [];

/** Close everything a scoped-service test started, in reverse order. */
export async function closeScopedServices() {
  for (const service of services.splice(0)) {
    service.sync?.stop();
    service.store?.close?.();
  }
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
}

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * One specs repo per project so a leak is visible in the data, not only in a
 * scope refusal. `unbound` drops that project's config binding while keeping
 * the project configured, which is exactly the "fresh setup" case.
 */
export async function setupScopedService({ projects = ["stgmt/alpha", "stgmt/beta"], tenants, unbound = [] } = {}) {
  const fixture = await loadLiveFixture();
  const base = await tempDir("spec-scope-");
  const repos = {};
  for (const project of projects) {
    const bare = path.join(base, `${project.replace("/", "-")}.git`);
    await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
    const slug = project === "stgmt/alpha" ? "spec-kernel" : `spec-${project.split("/")[1]}`;
    await seedSpecBranch(bare, {
      project,
      spec: slug,
      sourceDir: FIXTURE_SPEC,
      repoUrl: pathToFileURL(bare).href,
      files: { "README.md": `# ${project}\n\nStatus: ACTIVE\nVersion: 1.0.0\n` },
    });
    repos[project] = { bare, url: pathToFileURL(bare).href, spec: slug };
  }

  const config = fixture.serviceConfigFor(repos["stgmt/alpha"].bare, { projects });
  config.bindings = projects
    .filter((project) => !unbound.includes(project))
    .map((project) => ({ project, repoUrl: repos[project].url }));
  if (tenants) config.tenants = tenants;
  config.repoPolicy = { allowedHosts: ["file"] };
  const configPath = path.join(base, "projects.json");
  await writeFile(configPath, JSON.stringify(config, null, 2));

  const service = await startService({
    configPath,
    cloneDir: path.join(base, "clone"),
    storeFile: path.join(base, "registry.db"),
    port: 0,
    identity: IDENTITY,
    logger: () => {},
    env: { ...process.env, SPEC_REGISTRY_SECRETS_KEY: SECRETS_KEY },
  });
  servers.push(service.server);
  services.push(service);
  const api = `http://127.0.0.1:${service.server.address().port}`;
  return {
    fixture,
    repos,
    service,
    configPath,
    api,
    url: `${api}/mcp`,
    tokens: {
      alice: await fixture.userToken("alice"),
      bob: await fixture.userToken("bob"),
      frank: await fixture.userToken("frank"),
    },
  };
}

export async function rpc(url, token, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

export async function content(url, token, name, args, headers = {}) {
  const { json } = await rpc(url, token, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, headers);
  if (!json?.result) throw new Error(`${name} returned no result: ${JSON.stringify(json).slice(0, 300)}`);
  return json.result.structuredContent;
}

export async function tools(url, token) {
  const { json } = await rpc(url, token, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  return json.result.tools;
}

export async function restGet(api, route, token) {
  const response = await fetch(`${api}${route}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: response.status, json: await response.json().catch(() => null) };
}

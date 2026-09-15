import path from "node:path";
import { pathToFileURL } from "node:url";
import { GitClient, botIdentityFromEnv, gitAuthFromEnv } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";
import { createYouTrackAuth } from "./auth.js";
import { createServiceApp } from "./http.js";
import { createClaimStore } from "./claims.js";
import { createClaimOps, CLAIM_CONTRACTS } from "./ops/claim.js";
import { createRegistryOps, REGISTRY_CONTRACTS } from "./ops/registry.js";
import { createWritePipeline } from "./writepath.js";
import { createStore } from "./ledger.js";
import { buildRegistryIndex } from "./registry.js";
import { computeDrift } from "./drift.js";
import { startSync } from "./sync.js";
import { createOnboarding } from "./onboarding.js";

export async function bootService({ configPath, cloneDir, git = new GitClient({ gitAuth: gitAuthFromEnv() }), identity, logger = () => {} }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

export function buildServiceStack({ mounts, config, git, identity = botIdentityFromEnv(), logger = () => {}, store, syncIntervalMs = 0, env = process.env }) {
  const auth = createYouTrackAuth({
    youtrack: {
      baseUrl: env.SPEC_REGISTRY_YT_URL ?? config.auth.youtrack.baseUrl,
      serviceToken: env.SPEC_REGISTRY_YT_SERVICE_TOKEN ?? config.auth.youtrack.serviceToken,
    },
    appBridgeToken: env.SPEC_REGISTRY_APP_BRIDGE_TOKEN ?? config.auth.appBridgeToken,
    tenants: config.tenants,
    roleGroups: config.auth.roleGroups,
    cacheTtlMs: Number(env.SPEC_REGISTRY_AUTH_CACHE_MS ?? 60_000),
    logger,
  });
  const claims = createClaimStore({ store });
  const claimOps = createClaimOps({ claims });
  const registryIndex = () => buildRegistryIndex({ mounts, claims, ledger: store ?? { getLedger: () => [] }, git });
  const driftReport = async () => {
    // A drift report is only honest against a freshly fetched remote.
    await git.fetch({ cwd: mounts.cloneDir }).catch(() => {});
    return computeDrift({ git, branch: config.branch, identity, cwd: mounts.cloneDir });
  };
  const registryOps = createRegistryOps({ registryIndex, driftReport });
  const writePath = createWritePipeline({ mounts, claims, git, identity, logger });
  const onboarding = createOnboarding({ config, audit: (entry) => store?.logAccess?.(entry), logger });
  let sync = null;
  if (syncIntervalMs > 0) {
    sync = startSync({ mounts, git, branch: config.branch, identity, cwd: mounts.cloneDir, intervalMs: syncIntervalMs, logger });
  }
  return {
    auth,
    claims,
    sync,
    registryIndex,
    driftReport,
    authenticate: (req) => auth.authenticate(req),
    serviceOps: { specClaim: claimOps.specClaim, specRelease: claimOps.specRelease, specRegistry: registryOps.specRegistry, specDrift: registryOps.specDrift },
    serviceContracts: [...CLAIM_CONTRACTS, ...REGISTRY_CONTRACTS],
    wrappers: { specPatch: writePath.specPatch },
    endpoints: {
      registry: () => registryIndex(),
      drift: () => driftReport(),
      onboarding: (input) => onboarding.issueToken(input),
    },
    audit: (entry) => store?.logAccess?.(entry),
  };
}

export async function startService({ configPath, cloneDir, storeFile, syncIntervalMs = Number(process.env.SPEC_REGISTRY_SYNC_MS ?? 0), port = Number(process.env.SPEC_REGISTRY_PORT ?? 8642), host = process.env.SPEC_REGISTRY_HOST ?? "127.0.0.1", identity = botIdentityFromEnv(), logger = console.error, env = process.env }) {
  const git = new GitClient({ gitAuth: gitAuthFromEnv(env) });
  const { config, mounts } = await bootService({ configPath, cloneDir, git, identity, logger });
  const resolvedCloneDir = mounts.cloneDir;
  const store = await createStore({ file: storeFile ?? env.SPEC_REGISTRY_STORE ?? path.join(path.dirname(resolvedCloneDir), "registry.db") });
  const stack = buildServiceStack({ mounts, config, git, identity, logger, store, syncIntervalMs, env });
  const app = createServiceApp({ mounts, ...stack });
  const server = app.listen(port, host);
  await new Promise((resolve, reject) => {
    server.once("listening", () => {
      logger(`spec-registryd listening on http://${host}:${server.address().port}/mcp`);
      resolve();
    });
    server.once("error", reject);
  });
  return { mounts, auth: stack.auth, claims: stack.claims, store, sync: stack.sync, server, port: server.address().port, host };
}

export async function main() {
  const configPath = process.env.SPEC_REGISTRY_CONFIG ?? path.resolve("config/projects.json");
  const cloneDir = process.env.SPEC_REGISTRY_CLONE ?? undefined;
  const storeFile = process.env.SPEC_REGISTRY_STORE ?? undefined;
  const { server } = await startService({ configPath, cloneDir, storeFile });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`spec-registryd failed to start: ${error?.message ?? error}`);
    process.exit(1);
  });
}

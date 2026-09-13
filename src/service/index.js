import path from "node:path";
import { GitClient } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";
import { preAuthContext } from "./dispatch.js";
import { bearerToken, createServiceApp } from "./http.js";
import { createClaimStore } from "./claims.js";
import { createTenantDirectory, contextFor } from "./tenants.js";
import { createClaimOps, CLAIM_CONTRACTS } from "./ops/claim.js";
import { createRegistryOps, REGISTRY_CONTRACTS } from "./ops/registry.js";
import { createWritePipeline } from "./writepath.js";
import { createStore } from "./ledger.js";
import { buildRegistryIndex } from "./registry.js";
import { computeDrift } from "./drift.js";
import { startSync } from "./sync.js";

export async function bootService({ configPath, cloneDir, git = new GitClient(), identity, logger = () => {} }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

export function buildServiceStack({ mounts, config, git, identity, logger, store, syncIntervalMs = 0 }) {
  const tenants = createTenantDirectory({ tenants: config.tenants ?? [], store });
  const claims = createClaimStore({ store });
  const claimOps = createClaimOps({ claims });
  const registryIndex = () => buildRegistryIndex({ mounts, claims, ledger: store ?? { getLedger: () => [] } });
  const driftReport = async () => {
    // A drift report is only honest against a freshly fetched remote.
    await git.fetch({ cwd: mounts.cloneDir }).catch(() => {});
    return computeDrift({ git, branch: config.branch, identity, cwd: mounts.cloneDir });
  };
  const registryOps = createRegistryOps({ registryIndex, driftReport });
  const writePath = createWritePipeline({ mounts, claims, git, identity, logger });
  let sync = null;
  if (syncIntervalMs > 0) {
    sync = startSync({ mounts, git, branch: config.branch, identity, cwd: mounts.cloneDir, intervalMs: syncIntervalMs, logger });
  }
  return {
    tenants,
    claims,
    sync,
    registryIndex,
    driftReport,
    authenticate(req) {
      // No tenants seeded -> phase-1 dev mode on localhost (pre-auth context).
      if (tenants.size === 0) return preAuthContext(mounts);
      const token = bearerToken(req);
      const record = token === null ? null : tenants.resolve(token);
      if (!record) {
        const error = new Error("unknown or missing bearer token");
        error.status = 401;
        throw error;
      }
      return contextFor(record, req.headers?.["x-spec-author"]);
    },
    serviceOps: { specClaim: claimOps.specClaim, specRelease: claimOps.specRelease, specRegistry: registryOps.specRegistry, specDrift: registryOps.specDrift },
    serviceContracts: [...CLAIM_CONTRACTS, ...REGISTRY_CONTRACTS],
    wrappers: { specPatch: writePath.specPatch },
    endpoints: {
      registry: () => registryIndex(),
      drift: () => driftReport(),
    },
    audit: (entry) => store?.logAccess?.(entry),
  };
}

export async function startService({ configPath, cloneDir, storeFile, syncIntervalMs = Number(process.env.SPEC_REGISTRY_SYNC_MS ?? 0), port = Number(process.env.SPEC_REGISTRY_PORT ?? 8642), host = process.env.SPEC_REGISTRY_HOST ?? "127.0.0.1", identity, logger = console.error }) {
  const git = new GitClient();
  const { config, mounts } = await bootService({ configPath, cloneDir, git, identity, logger });
  const resolvedCloneDir = mounts.cloneDir;
  const store = await createStore({ file: storeFile ?? path.join(path.dirname(resolvedCloneDir), "registry.db") });
  const stack = buildServiceStack({ mounts, config, git, identity, logger, store, syncIntervalMs });
  const app = createServiceApp({ mounts, ...stack });
  const server = app.listen(port, host);
  await new Promise((resolve, reject) => {
    server.once("listening", () => {
      logger(`spec-registryd listening on http://${host}:${server.address().port}/mcp`);
      resolve();
    });
    server.once("error", reject);
  });
  return { mounts, tenants: stack.tenants, claims: stack.claims, store, sync: stack.sync, server, port: server.address().port, host };
}

export async function main() {
  const configPath = process.env.SPEC_REGISTRY_CONFIG ?? path.resolve("config/projects.json");
  const cloneDir = process.env.SPEC_REGISTRY_CLONE ?? undefined;
  const { server } = await startService({ configPath, cloneDir });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

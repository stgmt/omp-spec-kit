import path from "node:path";
import { GitClient } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";
import { preAuthContext } from "./dispatch.js";
import { bearerToken, createServiceApp } from "./http.js";
import { createClaimStore } from "./claims.js";
import { createTenantDirectory, contextFor } from "./tenants.js";
import { createClaimOps, CLAIM_CONTRACTS } from "./ops/claim.js";
import { createWritePipeline } from "./writepath.js";

export async function bootService({ configPath, cloneDir, git = new GitClient(), identity, logger = () => {} }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

export function buildServiceStack({ mounts, config, git, identity, logger }) {
  const tenants = createTenantDirectory({ tenants: config.tenants ?? [] });
  const claims = createClaimStore();
  const claimOps = createClaimOps({ claims });
  const writePath = createWritePipeline({ mounts, claims, git, identity, logger });
  return {
    tenants,
    claims,
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
    serviceOps: { specClaim: claimOps.specClaim, specRelease: claimOps.specRelease },
    serviceContracts: CLAIM_CONTRACTS,
    wrappers: { specPatch: writePath.specPatch },
  };
}

export async function startService({ configPath, cloneDir, port = Number(process.env.SPEC_REGISTRY_PORT ?? 8642), host = process.env.SPEC_REGISTRY_HOST ?? "127.0.0.1", identity, logger = console.error }) {
  const git = new GitClient();
  const { config, mounts } = await bootService({ configPath, cloneDir, git, identity, logger });
  const stack = buildServiceStack({ mounts, config, git, identity, logger });
  const app = createServiceApp({ mounts, ...stack });
  const server = app.listen(port, host);
  await new Promise((resolve, reject) => {
    server.once("listening", () => {
      logger(`spec-registryd listening on http://${host}:${server.address().port}/mcp`);
      resolve();
    });
    server.once("error", reject);
  });
  return { mounts, tenants: stack.tenants, claims: stack.claims, server, port: server.address().port, host };
}

export async function main() {
  const configPath = process.env.SPEC_REGISTRY_CONFIG ?? path.resolve("config/projects.json");
  const cloneDir = process.env.SPEC_REGISTRY_CLONE ?? undefined;
  const { server } = await startService({ configPath, cloneDir });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

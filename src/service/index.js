import path from "node:path";
import { GitClient } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";
import { preAuthContext } from "./dispatch.js";
import { bearerToken, createServiceApp } from "./http.js";

export async function bootService({ configPath, cloneDir, git = new GitClient(), identity, logger = () => {} }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

export async function startService({ configPath, cloneDir, port = Number(process.env.SPEC_REGISTRY_PORT ?? 8642), host = process.env.SPEC_REGISTRY_HOST ?? "127.0.0.1", identity, logger = console.error }) {
  const { mounts } = await bootService({ configPath, cloneDir, identity, logger });
  const authenticate = () => preAuthContext(mounts);
  const app = createServiceApp({ mounts, authenticate });
  const server = app.listen(port, host, () => logger(`spec-registryd listening on http://${host}:${port}/mcp`));
  return { mounts, server, port, host };
}

export async function main() {
  const configPath = process.env.SPEC_REGISTRY_CONFIG ?? path.resolve("config/projects.json");
  const cloneDir = process.env.SPEC_REGISTRY_CLONE ?? undefined;
  const { server } = await startService({ configPath, cloneDir });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

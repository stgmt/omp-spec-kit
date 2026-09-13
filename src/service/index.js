import path from "node:path";
import { GitClient } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";

export async function bootService({ configPath, cloneDir, git = new GitClient(), identity, logger = console.error }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

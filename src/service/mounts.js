import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSpecService } from "../adapters/query-service.js";
import { recoverInterruptedTransactions } from "../authoring/transactions.js";
import { GitClient, GitError, botIdentityFromEnv, commitMessage } from "./git.js";

const PROJECT_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const LOCK_FILE = ".omp-spec-kit-write.lock";

export class ConfigError extends Error {}

export function parseProjectsConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ConfigError("projects config must be a JSON object");
  const { specsRepo, branch = "main", projects, tenants } = raw;
  if (typeof specsRepo !== "string" || specsRepo.length === 0) throw new ConfigError("specsRepo is required");
  if (typeof branch !== "string" || branch.length === 0) throw new ConfigError("branch must be a non-empty string");
  if (!Array.isArray(projects) || projects.length === 0) throw new ConfigError("projects must be a non-empty array");
  const ids = projects.map((entry) => {
    const id = entry && typeof entry === "object" ? entry.id : entry;
    validateProjectId(id);
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new ConfigError("project ids must be unique");
  if (tenants !== undefined && !Array.isArray(tenants)) throw new ConfigError("tenants must be an array when present");
  return { specsRepo, branch, projects: ids, tenants: tenants ?? [] };
}

export async function loadProjectsConfig(configPath) {
  let raw;
  try {
    raw = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new ConfigError(`projects config is unreadable at ${configPath}: ${error.message}`);
  }
  return parseProjectsConfig(raw);
}

export function validateProjectId(id) {
  if (typeof id !== "string") throw new ConfigError("project id must be a string");
  const slash = id.indexOf("/");
  if (slash <= 0 || slash === id.length - 1) throw new ConfigError(`project id must be owner/project, got ${JSON.stringify(id)}`);
  const [owner, project] = [id.slice(0, slash), id.slice(slash + 1)];
  for (const segment of [owner, project]) {
    if (!PROJECT_ID_PATTERN.test(segment) || segment === "." || segment === "..") {
      throw new ConfigError(`project id segment is invalid: ${JSON.stringify(id)}`);
    }
  }
  return id;
}

/**
 * One clone of the specs repo; per-project kernel root = <clone>/<owner>/<project>.
 * The service is the only writer, so boot may create missing project skeletons
 * and push them as the bot.
 */
export class MountManager {
  constructor({ config, cloneDir, git = new GitClient(), identity = botIdentityFromEnv(), logger = () => {} }) {
    this.config = config;
    this.cloneDir = path.resolve(cloneDir);
    this.git = git;
    this.identity = identity;
    this.logger = logger;
    this.services = new Map();
  }

  get projects() {
    return this.config.projects;
  }

  resolveProjectRoot(projectId) {
    validateProjectId(projectId);
    const [owner, project] = projectId.split("/");
    const root = path.resolve(this.cloneDir, owner, project);
    if (root !== this.cloneDir && !root.startsWith(this.cloneDir + path.sep)) {
      throw new ConfigError(`project root escapes the specs clone: ${projectId}`);
    }
    return root;
  }

  requireConfigured(projectId) {
    if (!this.config.projects.includes(projectId)) {
      const error = new Error(`project is not configured on this service: ${projectId}`);
      error.code = "PROJECT_NOT_CONFIGURED";
      throw error;
    }
    return projectId;
  }

  async boot() {
    await this.ensureClone();
    const report = {};
    for (const projectId of this.config.projects) {
      const root = this.resolveProjectRoot(projectId);
      await this.ensureProjectSkeleton(projectId);
      await recoverInterruptedTransactions(root, path.join(root, ".specs", LOCK_FILE), null);
      const service = this.serviceFor(projectId);
      const state = await service.ensure();
      report[projectId] = { root, graphStatus: state.status };
      this.logger(`mount ${projectId} -> ${state.status}`);
    }
    return report;
  }

  async ensureClone() {
    const gitDir = path.join(this.cloneDir, ".git");
    let exists = false;
    try {
      exists = (await stat(gitDir)).isDirectory();
    } catch {}
    if (!exists) {
      await mkdir(path.dirname(this.cloneDir), { recursive: true });
      try {
        await this.git.clone(this.config.specsRepo, this.cloneDir, { branch: this.config.branch });
      } catch (error) {
        // A freshly provisioned specs repo has an unborn HEAD: plain clone
        // inherits the remote's initial branch, which is the configured one.
        if (!(error instanceof GitError) || !/Remote branch .* not found/u.test(error.stderr ?? "")) throw error;
        await this.git.clone(this.config.specsRepo, this.cloneDir);
      }
      this.logger(`cloned ${this.config.specsRepo} -> ${this.cloneDir}`);
    }
  }

  async ensureProjectSkeleton(projectId) {
    const root = this.resolveProjectRoot(projectId);
    const specsDir = path.join(root, ".specs");
    try {
      if ((await stat(specsDir)).isDirectory()) return false;
    } catch {}
    await mkdir(specsDir, { recursive: true });
    await writeFile(path.join(specsDir, ".gitkeep"), "");
    const relative = path.relative(this.cloneDir, path.join(specsDir, ".gitkeep")).split(path.sep).join("/");
    await this.git.add([relative], { cwd: this.cloneDir });
    await this.git.commit({
      message: commitMessage({ subject: `chore: init scope ${projectId}` }),
      authorName: this.identity.name,
      authorEmail: this.identity.email,
      cwd: this.cloneDir,
    });
    await this.git.push({ refspec: `HEAD:refs/heads/${this.config.branch}` }, { cwd: this.cloneDir });
    this.logger(`created skeleton for ${projectId}`);
    return true;
  }

  serviceFor(projectId) {
    this.requireConfigured(projectId);
    let service = this.services.get(projectId);
    if (!service) {
      service = createSpecService(this.resolveProjectRoot(projectId));
      this.services.set(projectId, service);
    }
    return service;
  }
}

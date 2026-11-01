/**
 * The one repo-local project selection record.
 *
 * A session's project is `<root>/.omp-spec-kit/project.json`, written once by
 * the installer for the workspace it configures. Every host reads it at call
 * time from the workspace that session is actually in, so a workspace switch
 * re-resolves only that session's project. There is no process-wide default,
 * no connection header and no value cached at install time.
 *
 * Shape (`.omp-spec-kit/project.json`):
 *
 *   { "schema": "omp-spec-kit/project-binding@1", "project": "owner/project" }
 *
 * The directory is the existing repo-local state convention (evidence streams
 * live beside it); only this file is git-ignored because it names one
 * workspace's binding.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PROJECT_BINDING_SCHEMA = "omp-spec-kit/project-binding@1";
export const PROJECT_BINDING_DIR = ".omp-spec-kit";
export const PROJECT_BINDING_FILE = "project.json";

/** `owner/project`: a registry identity, never a filesystem path. */
const PROJECT_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function isProjectIdentity(value) {
  return typeof value === "string" && PROJECT_IDENTITY.test(value.trim());
}

export function projectBindingPath(root) {
  return path.join(root, PROJECT_BINDING_DIR, PROJECT_BINDING_FILE);
}

/**
 * Read this workspace's project selection.
 * @returns {{project: string, file: string} | null} null when absent or malformed.
 */
export function readProjectBinding(root) {
  if (typeof root !== "string" || root === "") return null;
  const file = projectBindingPath(root);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed?.schema !== PROJECT_BINDING_SCHEMA) return null;
    if (!isProjectIdentity(parsed?.project)) return null;
    return { project: parsed.project.trim(), file };
  } catch {
    return null;
  }
}

/**
 * Write this workspace's project selection. The caller must have an explicit
 * `owner/project`; there is no default to fall back to.
 */
export function writeProjectBinding(root, project) {
  if (!isProjectIdentity(project)) {
    throw new Error(
      `PROJECT_REQUIRED: --project must be an owner/project registry identity, received ${JSON.stringify(project ?? null)}`,
    );
  }
  const dir = path.join(root, PROJECT_BINDING_DIR);
  mkdirSync(dir, { recursive: true });
  const file = projectBindingPath(root);
  writeFileSync(file, `${JSON.stringify({ schema: PROJECT_BINDING_SCHEMA, project: project.trim() }, null, 2)}\n`);
  return file;
}

/** The actionable refusal a spec call gets when this workspace has no record. */
export function projectRequiredMessage(root) {
  const file = projectBindingPath(root);
  return [
    "PROJECT_REQUIRED: this session's workspace has no project selection record.",
    `Write ${file} as {"schema":"${PROJECT_BINDING_SCHEMA}","project":"owner/project"} (or run the installer with --project owner/project),`,
    'then bind the repository: spec_repo {"action":"bind","project":"owner/project","repoUrl":"<git-url>","token":"<fine-grained-pat-with-contents-rw>"}.',
  ].join("\n");
}

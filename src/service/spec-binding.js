/**
 * Spec-per-branch binding model (3.0.0).
 *
 * A spec lives on an orphan branch named `spec-<slug>`; work-in-progress
 * branches are `spec-<slug>--<topic>`. A repository can host several projects,
 * so the branch alone cannot identify the project: `.spec-kit.json` at the
 * branch root is the single binding record.
 */
import { isValidSpecSlug } from "../kernel/identity.js";
import { claimKey } from "./claims.js";
import { isValidProjectId } from "./project-id.js";

export const SPEC_BRANCH_PREFIX = "spec-";
export const SPEC_WORK_SEPARATOR = "--";
export const SPEC_BINDING_SCHEMA = "omp-spec-kit/spec-binding@1";
export const SPEC_BINDING_KEYS = Object.freeze(["schema", "project", "spec", "repo", "branch", "createdAt", "owner", "demo"]);

// git limits a ref component to 255 bytes and the whole ref below 1024; keep a
// safe margin so a slug that passes validation cannot fail later at git.
const MAX_COMPONENT_BYTES = 120;
const MAX_REF_BYTES = 240;

function bytes(value) {
  return Buffer.byteLength(value, "utf8");
}

export function specBranchName(slug) {
  if (!isValidSpecSlug(slug)) throw new TypeError(`invalid spec slug: ${String(slug)}`);
  const branch = `${SPEC_BRANCH_PREFIX}${slug}`;
  if (bytes(slug) > MAX_COMPONENT_BYTES || bytes(branch) > MAX_REF_BYTES) {
    throw new TypeError(`spec slug is too long: ${bytes(slug)} bytes`);
  }
  return branch;
}

export function specWorkBranchName(slug, topic) {
  if (!isValidSpecSlug(topic)) throw new TypeError(`invalid spec work topic: ${String(topic)}`);
  const branch = `${specBranchName(slug)}${SPEC_WORK_SEPARATOR}${topic}`;
  if (bytes(topic) > MAX_COMPONENT_BYTES || bytes(branch) > MAX_REF_BYTES) {
    throw new TypeError(`spec work topic is too long: ${bytes(topic)} bytes`);
  }
  return branch;
}

/** `spec-<slug>` -> canonical, `spec-<slug>--<topic>` -> work, anything else -> null. */
export function parseSpecBranch(name) {
  if (typeof name !== "string" || !name.startsWith(SPEC_BRANCH_PREFIX)) return null;
  const rest = name.slice(SPEC_BRANCH_PREFIX.length);
  const separator = rest.indexOf(SPEC_WORK_SEPARATOR);
  if (separator < 0) {
    return isValidSpecSlug(rest) ? { kind: "spec", slug: rest, topic: null } : null;
  }
  const slug = rest.slice(0, separator);
  const topic = rest.slice(separator + SPEC_WORK_SEPARATOR.length);
  if (!isValidSpecSlug(slug) || !isValidSpecSlug(topic)) return null;
  return { kind: "work", slug, topic };
}

export function isCanonicalSpecBranch(name) {
  return parseSpecBranch(name)?.kind === "spec";
}

/** Lease key; the formula lives in claims.js, this is the binding-level name. */
export const bindingKey = claimKey;

function normalizeRepo(url) {
  let text = String(url).trim().replace(/\/+$/u, "").replace(/\.git$/iu, "");
  // Lower-case the scheme and host only: a repository path is case-sensitive
  // on git servers other than GitHub.
  const hierarchical = /^([a-z][a-z0-9+.-]*:\/\/)([^/]+)(\/.*)?$/iu.exec(text);
  if (hierarchical) return `${hierarchical[1].toLowerCase()}${hierarchical[2].toLowerCase()}${hierarchical[3] ?? ""}`;
  const scp = /^([^@]+@[^:]+:)(.*)$/u.exec(text);
  if (scp) return `${scp[1].toLowerCase()}${scp[2]}`;
  return text;
}

/**
 * Validate one `.spec-kit.json` against the ref and repository it was read
 * from. Returns every mismatch; callers fail closed with SPEC_BINDING_INVALID.
 */
export function validateSpecBinding(binding, { branch, repoUrl } = {}) {
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)) {
    return { ok: false, errors: ["binding must be an object"] };
  }
  const errors = [];
  for (const key of Object.keys(binding)) {
    if (!SPEC_BINDING_KEYS.includes(key)) errors.push(`unknown key: ${key}`);
  }
  if (binding.schema !== SPEC_BINDING_SCHEMA) errors.push(`schema must be ${SPEC_BINDING_SCHEMA}`);
  if (typeof binding.project !== "string" || !isValidProjectId(binding.project)) errors.push("project must be owner/project");
  if (!isValidSpecSlug(binding.spec)) errors.push("spec must be a valid slug");
  if (typeof binding.repo !== "string" || binding.repo.trim() === "") errors.push("repo is required");
  if (binding.createdAt !== undefined && typeof binding.createdAt !== "string") errors.push("createdAt must be a string");
  if (binding.owner !== undefined && typeof binding.owner !== "string") errors.push("owner must be a string");
  if (binding.demo !== undefined && typeof binding.demo !== "boolean") errors.push("demo must be a boolean");
  const parsed = parseSpecBranch(binding.branch);
  if (parsed === null || parsed.kind !== "spec") errors.push("branch must be spec-<slug>");
  if (parsed !== null && binding.spec !== parsed.slug) errors.push("spec and branch disagree");
  if (typeof branch === "string" && binding.branch !== branch) errors.push("branch does not match the ref");
  if (typeof repoUrl === "string" && typeof binding.repo === "string" && normalizeRepo(binding.repo) !== normalizeRepo(repoUrl)) {
    errors.push("repo does not match the binding");
  }
  return { ok: errors.length === 0, errors };
}

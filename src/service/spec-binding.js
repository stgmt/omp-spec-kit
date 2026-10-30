/**
 * Spec-per-branch binding model (3.0.0).
 *
 * A spec lives on an orphan branch named `spec-<slug>`; work-in-progress
 * branches are `spec-<slug>/<topic>`. A repository can host several projects,
 * so the branch alone cannot identify the project: `.spec-kit.json` at the
 * branch root is the single binding record.
 */
import { isValidSpecSlug } from "../kernel/identity.js";

export const SPEC_BRANCH_PREFIX = "spec-";
export const SPEC_BINDING_SCHEMA = "omp-spec-kit/spec-binding@1";

const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function specBranchName(slug) {
  if (!isValidSpecSlug(slug)) throw new TypeError(`invalid spec slug: ${String(slug)}`);
  return `${SPEC_BRANCH_PREFIX}${slug}`;
}

export function specWorkBranchName(slug, topic) {
  if (!isValidSpecSlug(topic)) throw new TypeError(`invalid spec work topic: ${String(topic)}`);
  return `${specBranchName(slug)}/${topic}`;
}

/** `spec-<slug>` -> canonical, `spec-<slug>/<topic>` -> work, anything else -> null. */
export function parseSpecBranch(name) {
  if (typeof name !== "string" || !name.startsWith(SPEC_BRANCH_PREFIX)) return null;
  const parts = name.slice(SPEC_BRANCH_PREFIX.length).split("/");
  if (parts.length < 1 || parts.length > 2) return null;
  const [slug, topic] = parts;
  if (!isValidSpecSlug(slug)) return null;
  if (parts.length === 2 && !isValidSpecSlug(topic)) return null;
  return parts.length === 1
    ? { kind: "spec", slug, topic: null }
    : { kind: "work", slug, topic };
}

export function isCanonicalSpecBranch(name) {
  return parseSpecBranch(name)?.kind === "spec";
}

export function bindingKey(project, spec) {
  return `${project}/${spec}`;
}

function normalizeRepo(url) {
  return String(url).trim().replace(/\.git$/iu, "").replace(/\/+$/u, "").toLowerCase();
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
  if (binding.schema !== SPEC_BINDING_SCHEMA) errors.push(`schema must be ${SPEC_BINDING_SCHEMA}`);
  if (typeof binding.project !== "string" || !PROJECT_ID.test(binding.project)) errors.push("project must be owner/project");
  if (!isValidSpecSlug(binding.spec)) errors.push("spec must be a valid slug");
  if (typeof binding.repo !== "string" || binding.repo.trim() === "") errors.push("repo is required");
  const parsed = parseSpecBranch(binding.branch);
  if (parsed === null || parsed.kind !== "spec") errors.push("branch must be spec-<slug>");
  if (parsed !== null && binding.spec !== parsed.slug) errors.push("spec and branch disagree");
  if (typeof branch === "string" && binding.branch !== branch) errors.push("branch does not match the ref");
  if (typeof repoUrl === "string" && typeof binding.repo === "string" && normalizeRepo(binding.repo) !== normalizeRepo(repoUrl)) {
    errors.push("repo does not match the binding");
  }
  return { ok: errors.length === 0, errors };
}

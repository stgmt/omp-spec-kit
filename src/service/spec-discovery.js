/**
 * Discovery of spec branches in one repository.
 *
 * The branch list is the index: every `spec-<slug>` branch is a candidate,
 * `.spec-kit.json` at its root is the binding record. Work branches
 * (`spec-<slug>--<topic>`) are deliberately ignored: they are unmerged work,
 * not canonical specs.
 */
import { parseSpecBranch, validateSpecBinding } from "./spec-binding.js";

export class SpecDiscoveryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SpecDiscoveryError";
    this.code = code;
    Object.assign(this, details);
  }
}

export async function listSpecBranches({ git, cwd, refPrefix = "refs/remotes/origin" }) {
  const { stdout } = await git.run(["for-each-ref", "--format=%(refname)", refPrefix], { cwd });
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((ref) => ({ ref, branch: ref.startsWith(`${refPrefix}/`) ? ref.slice(refPrefix.length + 1) : ref }))
    .map(({ ref, branch }) => ({ ref, branch, parsed: parseSpecBranch(branch) }))
    .filter(({ parsed }) => parsed?.kind === "spec")
    .map(({ ref, branch, parsed }) => ({ ref, branch, slug: parsed.slug }));
}

export async function readSpecBinding({ git, cwd, branch }) {
  let text;
  try {
    text = await git.show(branch, ".spec-kit.json", { cwd });
  } catch (error) {
    throw new SpecDiscoveryError("SPEC_BINDING_INVALID", `branch ${branch} has no readable .spec-kit.json`, { branch, cause: error });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SpecDiscoveryError("SPEC_BINDING_INVALID", `branch ${branch} has malformed .spec-kit.json`, { branch });
  }
}

/**
 * Resolve every canonical spec branch of a repository. Invalid branches are
 * returned in `invalid` with their reasons; callers must surface them instead
 * of silently dropping a spec.
 */
export async function discoverSpecBindings({ git, cwd, repoUrl, refPrefix = "refs/remotes/origin" }) {
  const branches = await listSpecBranches({ git, cwd, refPrefix });
  const bindings = [];
  const invalid = [];
  for (const { ref, branch } of branches) {
    let raw;
    try {
      raw = await readSpecBinding({ git, cwd, branch: ref });
    } catch (error) {
      invalid.push({ branch, project: null, errors: [error.message] });
      continue;
    }
    const result = validateSpecBinding(raw, { branch, repoUrl });
    if (!result.ok) {
      invalid.push({ branch, project: typeof raw?.project === "string" ? raw.project : null, errors: result.errors });
      continue;
    }
    bindings.push({ project: raw.project, spec: raw.spec, branch, ref, repo: raw.repo });
  }
  return { bindings, invalid };
}

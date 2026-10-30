/**
 * Branch policy for the specs repository.
 *
 * The service writes only to the configured branch. A per-project repository
 * binding may point at another repository, but not at another branch: a second
 * branch would become a second canonical store that drift, projection and the
 * ledger do not track.
 */
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/u;

export function isValidBranchName(branch) {
  if (typeof branch !== "string" || branch.length === 0) return false;
  if (!BRANCH_PATTERN.test(branch)) return false;
  if (branch.includes("..") || branch.includes("//") || branch.includes("@{") || branch.includes("\\")) return false;
  if (branch.endsWith("/") || branch.endsWith(".") || branch.endsWith(".lock")) return false;
  if (branch.split("/").some((part) => part === "" || part === "." || part === ".." || part.startsWith("."))) return false;
  return true;
}

export const DEFAULT_SPECS_BRANCH = "main";

export function configuredBranch(config) {
  const branch = typeof config?.branch === "string" && config.branch !== "" ? config.branch : DEFAULT_SPECS_BRANCH;
  return isValidBranchName(branch) ? branch : null;
}

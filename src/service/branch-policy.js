/**
 * Ref validation for the optional repository binding branch. Specs themselves
 * live on `spec-<slug>` branches; this only guards the remote branch a mirror
 * is rooted at (normally `main`).
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

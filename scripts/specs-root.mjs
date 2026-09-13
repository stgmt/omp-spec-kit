/**
 * Shared locator for the canonical `.specs/` corpus after the specs-branch
 * migration (spec-registry-service TASK-1). The corpus no longer lives on
 * code branches — it is checked out from the dedicated `specs` branch.
 *
 * Resolution order for the directory that CONTAINS `.specs/`:
 *   1. OMP_SPEC_KIT_ROOT (absolute) — explicit override, same semantics as
 *      the MCP server's repository-root resolution,
 *   2. <baseDir> itself when it carries `.specs/` (pre-migration checkouts,
 *      the `specs` branch worktree, fixtures),
 *   3. <baseDir>/.specs-worktree — the conventional nested worktree of the
 *      `specs` branch inside a code checkout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveSpecsBearingRoot({ baseDir = REPO_ROOT, env = process.env } = {}) {
  const raw = env?.OMP_SPEC_KIT_ROOT;
  if (typeof raw === "string" && raw.length > 0 && path.isAbsolute(raw) && fs.existsSync(path.join(raw, ".specs"))) {
    return raw;
  }
  if (fs.existsSync(path.join(baseDir, ".specs"))) return baseDir;
  const worktree = path.join(baseDir, ".specs-worktree");
  if (fs.existsSync(path.join(worktree, ".specs"))) return worktree;
  throw new Error(
    `no .specs corpus found under ${baseDir}: checkout the specs branch (\`git worktree add .specs-worktree specs\`) or set OMP_SPEC_KIT_ROOT`,
  );
}

/**
 * Copy the plugin's authoring skills into a host's global skills directory.
 *
 * Skills are product-owned: an install replaces the three shipped directories
 * and leaves every other skill on the host untouched.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

export function installSkills({ sourceRoot, targetSkillsDir }) {
  if (!existsSync(sourceRoot)) throw new Error(`skills source is missing: ${sourceRoot}`);
  const names = readdirSync(sourceRoot).filter((name) => statSync(path.join(sourceRoot, name)).isDirectory());
  if (names.length === 0) throw new Error(`skills source is empty: ${sourceRoot}`);
  mkdirSync(targetSkillsDir, { recursive: true });
  for (const name of names) {
    const target = path.join(targetSkillsDir, name);
    rmSync(target, { recursive: true, force: true });
    cpSync(path.join(sourceRoot, name), target, { recursive: true });
  }
  return names;
}

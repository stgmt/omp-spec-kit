#!/usr/bin/env node
/**
 * Run the live delivery Cucumber suite against the compose stack.
 *
 * The suite owns its bootstrap (like app-install-live), so it can run alone
 * after the tool/service gates without sharing their process state.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cucumber = path.join(repoRoot, "node_modules", "@cucumber", "cucumber", "bin", "cucumber-js");
const args = [
  cucumber,
  path.join(repoRoot, "tests", "features", "youtrack-spec-delivery.feature"),
  "--import",
  path.join(repoRoot, "tests", "step-definitions", "youtrack-spec-delivery.steps.mjs"),
  "--tags",
  "@delivery-live",
  "--format",
  "progress",
  "--force-exit",
  ...process.argv.slice(2),
];
const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, OMP_SPEC_KIT_DELIVERY_LIVE: "1" },
  timeout: 0,
});
process.exit(result.status ?? 1);

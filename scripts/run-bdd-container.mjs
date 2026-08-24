import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

if (
  process.env.OMP_SPEC_KIT_BDD_CONTAINER !== "1" ||
  process.platform !== "linux" ||
  !existsSync("/.dockerenv")
) {
  console.error("BDD execution is Docker-only. Run: bash scripts/docker-bdd.sh");
  process.exit(2);
}

const cucumber = path.join(
  process.cwd(),
  "node_modules",
  "@cucumber",
  "cucumber",
  "bin",
  "cucumber.js",
);
const result = spawnSync(process.execPath, [cucumber, "--config", "cucumber.mjs", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  stdio: "inherit",
});
if (result.error) {
  console.error("Failed to launch Cucumber inside the test container.");
  process.exit(2);
}
process.exit(result.status ?? 2);

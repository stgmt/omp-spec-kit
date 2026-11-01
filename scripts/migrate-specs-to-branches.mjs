// Migrate the 2.x shared corpus (`<project>/.specs/<slug>/`) into one orphan
// `spec-<slug>` branch per spec. Prints a JSON report; --dry-run writes nothing.
import { migrateSpecsToBranches } from "../src/service/spec-migration.js";

function value(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

const sourceRoot = value("--source");
const project = value("--project");
const repoUrl = value("--repo");
const dryRun = process.argv.includes("--dry-run");
if (!sourceRoot || !project || !repoUrl) {
  console.error("usage: node scripts/migrate-specs-to-branches.mjs --source <old-repo-worktree> --project owner/project --repo <target-repo-url> [--dry-run]");
  process.exit(2);
}

const identity = {
  name: process.env.SPEC_REGISTRY_BOT_NAME ?? "spec-bot",
  email: process.env.SPEC_REGISTRY_BOT_EMAIL ?? "bot@example.invalid",
};

try {
  const result = await migrateSpecsToBranches({
    sourceRoot,
    project,
    repoUrl,
    identity,
    dryRun,
    logger: (line) => console.error(line),
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`migration failed: ${error?.message ?? error}`);
  process.exit(1);
}

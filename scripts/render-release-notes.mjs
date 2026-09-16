import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs, readStrictJson } from "./release-candidate-utils.mjs";
import { evaluateRelease } from "./verify-release.mjs";

export async function renderReleaseNotes({ candidatePath, evidencePath, tag, repositoryRoot, resolveTagCommit }) {
  const eligibility = await evaluateRelease({ candidatePath, evidencePath, tag, repositoryRoot, resolveTagCommit });
  if (!eligibility.eligible) fail(`cannot render release notes for ineligible candidate: ${eligibility.blocking.join(", ")}`);
  const candidate = await readStrictJson(candidatePath, "candidate manifest");
  return [
    `# omp-spec-kit ${candidate.tag}`,
    "",
    "## Included changes",
    "",
    "- Moves canonical specifications out of product repositories into a dedicated service-owned specs repository; all specification reads and writes go through the `spec-registryd` MCP service with YouTrack-backed verified identity, roles, and project scopes.",
    "- Publishes an immutable annotated git tag `spec/<project>/<slug>/<version>` plus an insert-only ledger row when an authored `Status:` becomes `ACTIVE`; identical content no-ops, different content under an existing version is rejected and surfaced in `GET /drift`.",
    "- Adds versioned reads: `spec_documents(action:\"read\", version)` serves bytes from the tagged commit with digest re-verification and path containment.",
    "- Adds the onboarding API (per-user YouTrack token mint + ready `.mcp.json` snippet), managed remote plugin mode, and the YouTrack app packaged in CI via the official `youtrack-app` CLI.",
    "- Retires the in-repository `.specs` corpus: local trees are historical artifacts only — consumers and agents must go through the service.",
    "",
    "## Verified release",
    "",
    `- Candidate digest: \`${candidate.candidateDigest}\``,
    `- Package tree digest: \`${candidate.packageTreeDigest}\``,
    `- Archive SHA-256: \`${candidate.archive.sha256}\``,
    `- YouTrack app: \`${candidate.youtrackApp.file}\` (SHA-256 \`${candidate.youtrackApp.sha256}\`) — upload via Administration → Apps → Add app… → Upload ZIP file`,
    `- Peeled tag commit: \`${candidate.commit}\``,
    "- OMP runtime: `18.0.11`",
    "- Distribution evidence: lifecycle producers, Docker BDD, manager discovery, and nine closed MRI receipts.",
    "",
    "Install or upgrade at project scope, reload plugin metadata, then start a fresh OMP session before invoking MCP tools.",
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--candidate", "--evidence", "--tag", "--output"]);
  const candidatePath = args["--candidate"] ?? process.env.RELEASE_CANDIDATE;
  const evidencePath = args["--evidence"] ?? process.env.RELEASE_EVIDENCE;
  const tag = args["--tag"] ?? process.env.RELEASE_TAG;
  if (!candidatePath || !evidencePath || !tag) fail("--candidate, --evidence, and --tag are required");
  const notes = await renderReleaseNotes({ candidatePath: path.resolve(candidatePath), evidencePath: path.resolve(evidencePath), tag });
  if (args["--output"]) await writeFile(path.resolve(args["--output"]), notes, "utf8");
  process.stdout.write(notes);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

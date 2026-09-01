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
    "## Included correction",
    "",
    "- MCP launches against the active OMP project rather than package cwd.",
    "- Invalid JSON-RPC request objects receive terminal protocol errors.",
    "- Adds proposal-first safe authoring with exactly ten MCP tools: eight bounded reads plus `propose_patch` and `apply_proposed_patch`.",
    "",
    "## Verified release",
    "",
    `- Candidate digest: \`${candidate.candidateDigest}\``,
    `- Package tree digest: \`${candidate.packageTreeDigest}\``,
    `- Archive SHA-256: \`${candidate.archive.sha256}\``,
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

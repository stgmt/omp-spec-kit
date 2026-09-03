import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;

function parseArgs(argv) {
  const values = { tag: null, candidateDir: "release-candidate" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--tag") values.tag = argv[++index];
    else if (arg === "--candidate-dir") values.candidateDir = argv[++index];
    else if (arg === "--help") {
      console.log("Usage: node scripts/release-preflight.mjs --tag vX.Y.Z [--candidate-dir release-candidate]");
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return values;
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}
function run(label, command, args) {
  console.log(`\n[release-preflight] ${label}: ${commandText(command, args)}`);
  const result = spawnSync(command, args, { cwd: repositoryRoot, stdio: "inherit", shell: process.platform === "win32" && command === npmCommand });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}
function output(command, args) {
  return execFileSync(command, args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}
function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

const { tag, candidateDir } = parseArgs(process.argv.slice(2));
const rootPackage = readJson("package.json");
const expectedTag = tag ?? `v${rootPackage.version}`;
if (!/^v\d+\.\d+\.\d+$/.test(expectedTag)) throw new Error(`invalid release tag: ${expectedTag}`);
if (expectedTag !== `v${rootPackage.version}`) throw new Error(`tag ${expectedTag} does not match package version ${rootPackage.version}`);

const dirty = output("git", ["status", "--porcelain", "--untracked-files=all"]);
if (dirty) throw new Error(`worktree is not clean before release preflight:\n${dirty}`);
const head = output("git", ["rev-parse", "HEAD"]);
const tagCommit = output("git", ["rev-parse", `${expectedTag}^{commit}`]);
if (head !== tagCommit) throw new Error(`tag ${expectedTag} is not peeled to HEAD (${tagCommit} != ${head})`);

run("full local verification", npmCommand, ["test"]);
run("release-integrity scenarios", npmCommand, ["run", "test:release-integrity"]);
run("assemble candidate", nodeCommand, ["scripts/create-release-candidate.mjs", "--tag", expectedTag, "--output", candidateDir]);
run("verify public tree", nodeCommand, ["scripts/verify-public-tree.mjs", "--candidate", `${candidateDir}/candidate.json`, "--output", `${candidateDir}/public-safety.json`]);
const candidate = readJson(`${candidateDir}/candidate.json`);
const archivePath = path.join(candidateDir, candidate.archive.file);
run("smoke default archive", nodeCommand, ["scripts/smoke-release-archive.mjs", "--archive", archivePath]);

const result = {
  schema: "omp-spec-kit-release-preflight@1",
  status: "passed",
  version: candidate.version,
  tag: candidate.tag,
  commit: candidate.commit,
  candidateDigest: candidate.candidateDigest,
  packageTreeDigest: candidate.packageTreeDigest,
  archive: candidate.archive,
  checks: ["clean-worktree", "peeled-tag", "npm-test", "release-integrity", "candidate", "public-safety", "archive-default"],
  note: "GitHub attestation, publication, and installed dogfood remain separate post-preflight gates."
};
console.log(`\n${JSON.stringify(result, null, 2)}`);

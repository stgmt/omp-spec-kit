import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_VERSION } from "./verify-marketplace.mjs";
import {
  assertCommit,
  assertTag,
  candidateDigest,
  canonicalJson,
  collectRegularFiles,
  createDeterministicTar,
  fail,
  packageTreeDigest,
  parseArgs,
  sha256,
  toPublicFileRows,
} from "./release-candidate-utils.mjs";

const defaultRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function peelTagCommit(tag, repositoryRoot = defaultRepositoryRoot) {
  assertTag(tag);
  try {
    const commit = execFileSync("git", ["rev-parse", `${tag}^{}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return assertCommit(commit);
  } catch (error) {
    fail(`cannot peel release tag ${tag}: ${error.stderr?.toString("utf8").trim() || error.message}`);
  }
}

export function assertTaggedPackageCheckout(tag, commit, repositoryRoot = defaultRepositoryRoot) {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (head !== commit) fail(`HEAD ${head} does not equal peeled ${tag} commit ${commit}`);
    const dirty = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", "plugins/omp-spec-kit"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (dirty !== "") fail(`tagged package payload is dirty: ${dirty}`);
  } catch (error) {
    fail(`cannot verify tagged package checkout: ${error.stderr?.toString("utf8").trim() || error.message}`);
  }
}

export async function createReleaseCandidate({
  tag,
  outputDirectory,
  repositoryRoot = defaultRepositoryRoot,
  resolveTagCommit = peelTagCommit,
  verifyTaggedCheckout = assertTaggedPackageCheckout,
}) {
  assertTag(tag);
  if (tag.slice(1) !== PLUGIN_VERSION) fail(`tag ${tag} does not match package version ${PLUGIN_VERSION}`);
  if (!outputDirectory) fail("output directory is required");
  const commit = assertCommit(resolveTagCommit(tag, repositoryRoot));
  verifyTaggedCheckout(tag, commit, repositoryRoot);

  const packageRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit");
  const files = await collectRegularFiles(packageRoot);
  const tarBytes = await createDeterministicTar(files);
  const archiveName = `omp-spec-kit-${PLUGIN_VERSION}.tar`;
  await mkdir(outputDirectory, { recursive: true });
  const archivePath = path.join(outputDirectory, archiveName);
  await writeFile(archivePath, tarBytes);

  const withoutDigest = {
    schema: "omp-spec-kit-release-candidate@1",
    version: PLUGIN_VERSION,
    tag,
    commit,
    packageTreeDigest: packageTreeDigest(files),
    archive: { file: archiveName, sha256: sha256(tarBytes), bytes: tarBytes.length },
    files: toPublicFileRows(files),
  };
  const candidate = { ...withoutDigest, candidateDigest: candidateDigest(withoutDigest) };
  const manifestPath = path.join(outputDirectory, "candidate.json");
  await writeFile(manifestPath, canonicalJson(candidate), "utf8");
  return { candidate, manifestPath, archivePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--tag", "--output"]);
  const tag = args["--tag"] ?? process.env.RELEASE_TAG;
  const outputDirectory = args["--output"] ?? process.env.RELEASE_CANDIDATE_DIR;
  if (!tag || !outputDirectory) fail("--tag and --output are required");
  const { candidate } = await createReleaseCandidate({ tag, outputDirectory: path.resolve(outputDirectory) });
  process.stdout.write(canonicalJson(candidate));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

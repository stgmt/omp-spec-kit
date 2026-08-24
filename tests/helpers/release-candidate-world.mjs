import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createReleaseCandidate } from "../../scripts/create-release-candidate.mjs";
import { sha256 } from "../../scripts/release-candidate-utils.mjs";
import { evaluateRelease } from "../../scripts/verify-release.mjs";
import { verifyPublicTree } from "../../scripts/verify-public-tree.mjs";

const CANDIDATE_COMMIT = "a".repeat(40);
const PRIOR_COMMIT = "b".repeat(40);
const FR_SCENARIOS = Object.freeze({
  "FR-1": "SCEN-MRI-001",
  "FR-2": "SCEN-MRI-002",
  "FR-3": "SCEN-MRI-003",
  "FR-4": "SCEN-MRI-004",
  "FR-5": "SCEN-MRI-005",
  "FR-6": "SCEN-MRI-006",
});

function resolveTagCommit(tag) {
  if (tag === "v0.3.1") return CANDIDATE_COMMIT;
  if (tag === "v0.3.0") return PRIOR_COMMIT;
  throw new Error(`unexpected test tag ${tag}`);
}

async function writeReceipt(directory, name, value) {
  const relative = `receipts/${name}.json`;
  const absolute = path.join(directory, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await writeFile(absolute, bytes);
  return { status: "passed", path: relative, digest: sha256(bytes) };
}

function identity(candidate) {
  return {
    version: candidate.version,
    tag: candidate.tag,
    commit: candidate.commit,
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    archiveSha256: candidate.archive.sha256,
  };
}

export async function createCandidateWorld(repositoryRoot, tempRoot) {
  const candidateDirectory = path.join(tempRoot, "candidate");
  const { candidate, manifestPath, archivePath } = await createReleaseCandidate({
    tag: "v0.3.1",
    outputDirectory: candidateDirectory,
    repositoryRoot,
    resolveTagCommit,
    verifyTaggedCheckout() {},
  });
  const safety = await verifyPublicTree(manifestPath);
  const messageRelativePath = "messages/cucumber.ndjson";
  const messageBytes = await readFile(path.join(repositoryRoot, "tests", "fixtures", "release-candidate", "cucumber-messages.ndjson"));
  const messagePath = path.join(candidateDirectory, messageRelativePath);
  await mkdir(path.dirname(messagePath), { recursive: true });
  await writeFile(messagePath, messageBytes);
  const checks = {
    publicSafety: await writeReceipt(candidateDirectory, "public-safety", safety),
    dockerBdd: await writeReceipt(candidateDirectory, "docker-bdd", {
      schema: "omp-spec-kit-bdd-receipt@1",
      status: "passed",
      ...identity(candidate),
      messagePath: messageRelativePath,
      messageDigest: sha256(messageBytes),
      scenarioIds: ["SCEN-MRI-001", "SCEN-MRI-002", "SCEN-MRI-003", "SCEN-MRI-004", "SCEN-MRI-005", "SCEN-MRI-006", "SCEN-MRI-007"],
    }),
    priorV030: await writeReceipt(candidateDirectory, "prior-v030", {
      schema: "omp-spec-kit-tagged-source-proof@1",
      status: "passed",
      tag: "v0.3.0",
      commit: PRIOR_COMMIT,
      source: "public-tag",
    }),
    upgradeFromV030: await writeReceipt(candidateDirectory, "upgrade", {
      schema: "omp-spec-kit-lifecycle-receipt@1",
      status: "passed",
      ...identity(candidate),
      fromVersion: "0.3.0",
      fromTag: "v0.3.0",
      toVersion: "0.3.1",
      toTag: "v0.3.1",
      observedVersion: "0.3.1",
      freshSession: true,
      projectHashPreserved: true,
    }),
    rollbackToV030: await writeReceipt(candidateDirectory, "rollback", {
      schema: "omp-spec-kit-lifecycle-receipt@1",
      status: "passed",
      ...identity(candidate),
      fromVersion: "0.3.1",
      fromTag: "v0.3.1",
      toVersion: "0.3.0",
      toTag: "v0.3.0",
      observedVersion: "0.3.0",
      freshSession: true,
      projectHashPreserved: true,
    }),
  };
  const frReceipts = Object.create(null);
  for (const [requirement, scenarioId] of Object.entries(FR_SCENARIOS)) {
    frReceipts[requirement] = await writeReceipt(candidateDirectory, requirement, {
      schema: "omp-spec-kit-fr-receipt@1",
      status: "passed",
      ...identity(candidate),
      requirement,
      scenarioId,
    });
  }
  const evidence = {
    schema: "omp-spec-kit-release-evidence@2",
    ...identity(candidate),
    checks,
    frReceipts,
  };
  const evidencePath = path.join(candidateDirectory, "evidence.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { candidate, manifestPath, archivePath, evidencePath, candidateDirectory, resolveTagCommit };
}

export async function evaluateCandidate(world, repositoryRoot) {
  return evaluateRelease({
    candidatePath: world.manifestPath,
    evidencePath: world.evidencePath,
    tag: world.candidate.tag,
    repositoryRoot,
    resolveTagCommit: world.resolveTagCommit,
  });
}

export async function extractCandidate(world, destination) {
  await mkdir(destination, { recursive: true });
  const result = spawnSync("tar", ["-xf", world.archivePath, "-C", destination], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
  const launcher = path.join(destination, "bin", "omp-spec-kit-mcp");
  const mode = (await (await import("node:fs/promises")).lstat(launcher)).mode & 0o777;
  return { root: destination, launcher, mode };
}

export async function appendArchiveByte(world) {
  const original = await readFile(world.archivePath);
  await writeFile(world.archivePath, Buffer.concat([original, Buffer.from([0])])) ;
}

export async function replaceMessageWithMeta(world) {
  const evidence = JSON.parse(await readFile(world.evidencePath, "utf8"));
  const bddReceiptPath = path.join(world.candidateDirectory, evidence.checks.dockerBdd.path);
  const bddReceipt = JSON.parse(await readFile(bddReceiptPath, "utf8"));
  const messagePath = path.join(world.candidateDirectory, bddReceipt.messagePath);
  const bytes = Buffer.from('{"meta":{"protocolVersion":"33.0.4"}}\n');
  await writeFile(messagePath, bytes);
  bddReceipt.messageDigest = sha256(bytes);
  const receiptBytes = Buffer.from(`${JSON.stringify(bddReceipt, null, 2)}\n`);
  await writeFile(bddReceiptPath, receiptBytes);
  evidence.checks.dockerBdd.digest = sha256(receiptBytes);
  await writeFile(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

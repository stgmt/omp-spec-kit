import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReleaseCandidate } from "../../scripts/create-release-candidate.mjs";
import { sha256 } from "../../scripts/release-candidate-utils.mjs";
import { evaluateRelease } from "../../scripts/verify-release.mjs";
import { verifyPublicTree } from "../../scripts/verify-public-tree.mjs";

const CUCUMBER_FIXTURE_PROVENANCE = Object.freeze({
  schema: "omp-spec-kit-cucumber-fixture-provenance@1", fixture: "cucumber-messages.ndjson", sha256: "3f748539baa884a29b3c99e94d98087a1e8876257d924719238e89ab64f44335", repositoryCommit: "86a80f59d600d6c6f2c581c93d55fd3981a92989", dockerImageDigest: "sha256:75680db26398fa5250cbb349f523d8d481ed50aa91fa758c8b6e1c7298f6daab", cucumberVersion: "13.2.1", captureCommand: 'wsl.exe -e bash -lc "docker run --rm --env OMP_SPEC_KIT_BDD_MESSAGE_STDOUT=1 omp-spec-kit-bdd:local"', capturedAt: "2026-08-24", scenarioCount: 38, stepCount: 302,
});
const CANDIDATE_COMMIT = "a".repeat(40);
const PRIOR_COMMIT = "b".repeat(40);
const MRI_SCENARIOS = Object.freeze({ "mcp-release-integrity:FR-1": "SCEN-MRI-001", "mcp-release-integrity:FR-2": "SCEN-MRI-002", "mcp-release-integrity:FR-3": "SCEN-MRI-003", "mcp-release-integrity:FR-4": "SCEN-MRI-004", "mcp-release-integrity:FR-5": "SCEN-MRI-005", "mcp-release-integrity:FR-6": "SCEN-MRI-006" });
const DISTRIBUTION_REQUIREMENTS = Object.freeze(Array.from({ length: 12 }, (_, index) => `plugin-distribution:FR-${index + 1}`));
const DISTRIBUTION_CLAIMS = Object.freeze({
  "plugin-distribution:FR-1": ["marketplace-shape"],
  "plugin-distribution:FR-2": ["package-shape"],
  "plugin-distribution:FR-3": ["inventory"],
  "plugin-distribution:FR-4": ["install", "reload", "fresh-session-activation", "inventory"],
  "plugin-distribution:FR-5": ["clean-build", "package-shape", "deps-absent"],
  "plugin-distribution:FR-6": ["inventory-containment"],
  "plugin-distribution:FR-7": ["version-consistency", "upgrade"],
  "plugin-distribution:FR-8": ["uninstall-preservation", "reinstall", "rollback"],
  "plugin-distribution:FR-9": ["public-safety"],
  "plugin-distribution:FR-10": ["release-transaction"],
  "plugin-distribution:FR-11": ["evidence-honesty"],
  "plugin-distribution:FR-12": ["schema-containment"],
});
const PLATFORM = Object.freeze({ os: "linux", architecture: "x64", fixtureDigest: "c".repeat(64) });
const APPLICABILITY = Object.freeze({ releasePosition: "subsequent", upgrade: "mandatory", rollback: "mandatory", reinstall: "mandatory" });
const LIFECYCLE = Object.freeze({ upgrade: "passed", rollback: "passed", reinstall: "passed" });

export async function readVerifiedCucumberFixture(repositoryRoot) {
  const fixtureDirectory = path.join(repositoryRoot, "tests", "fixtures", "release-candidate");
  const [bytes, rawProvenance] = await Promise.all([readFile(path.join(fixtureDirectory, CUCUMBER_FIXTURE_PROVENANCE.fixture)), readFile(path.join(fixtureDirectory, "cucumber-messages.provenance.json"), "utf8")]);
  const provenance = JSON.parse(rawProvenance);
  assert.deepEqual(provenance, CUCUMBER_FIXTURE_PROVENANCE, "Cucumber fixture provenance must be complete and immutable");
  assert.equal(sha256(bytes), provenance.sha256, "Cucumber fixture bytes must match documented SHA-256");
  const frames = bytes.toString("utf8").trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
  assert.equal(frames.filter((frame) => frame.pickle !== undefined).length, provenance.scenarioCount, "Cucumber fixture scenario count must match provenance");
  assert.equal(frames.filter((frame) => frame.testStepFinished !== undefined).length, provenance.stepCount, "Cucumber fixture step count must match provenance");
  return bytes;
}
function resolveTagCommit(tag) { if (tag === "v0.3.1") return CANDIDATE_COMMIT; if (tag === "v0.3.0") return PRIOR_COMMIT; throw new Error(`unexpected test tag ${tag}`); }
async function writeBytes(directory, name, bytes) { const relative = `receipts/${name}`; const absolute = path.join(directory, relative); await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, bytes); return { status: "present", path: relative, digest: sha256(bytes) }; }
async function writeReceipt(directory, name, value) { return writeBytes(directory, `${name}.json`, Buffer.from(`${JSON.stringify(value, null, 2)}\n`)); }
function identity(candidate, catalogDigest) { return { version: candidate.version, tag: candidate.tag, commit: candidate.commit, candidateDigest: candidate.candidateDigest, packageTreeDigest: candidate.packageTreeDigest, archiveSha256: candidate.archive.sha256, catalogDigest }; }
function placeholderClaim(candidate, catalogDigest, requirement) { return { schema: "omp-spec-kit-distribution-evidence-receipt@1", status: "passed", ...identity(candidate, catalogDigest), requirement, claims: ["candidate-evidence"], ompRevision: "@oh-my-pi/pi-coding-agent@17.3.7#8500092296621a6826b7136e840f8a59ea338958", platform: structuredClone(PLATFORM), fixtureDigest: "d".repeat(64), applicability: structuredClone(APPLICABILITY), lifecycle: structuredClone(LIFECYCLE) }; }

export async function createCandidateWorld(repositoryRoot, tempRoot) {
  const candidateDirectory = path.join(tempRoot, "candidate");
  const { candidate, manifestPath, archivePath } = await createReleaseCandidate({ tag: "v0.3.1", outputDirectory: candidateDirectory, repositoryRoot, resolveTagCommit, verifyTaggedCheckout() {} });
  const catalogDigest = sha256(await readFile(path.join(repositoryRoot, ".omp-plugin", "marketplace.json")));
  const safety = await verifyPublicTree(manifestPath);
  const messageRelativePath = "messages/cucumber.ndjson"; const messageBytes = await readVerifiedCucumberFixture(repositoryRoot); const messagePath = path.join(candidateDirectory, messageRelativePath); await mkdir(path.dirname(messagePath), { recursive: true }); await writeFile(messagePath, messageBytes);
  const id = identity(candidate, catalogDigest);
  const checks = {
    publicSafety: await writeReceipt(candidateDirectory, "public-safety", safety),
    dockerBdd: await writeReceipt(candidateDirectory, "docker-bdd", { schema: "omp-spec-kit-bdd-receipt@1", status: "passed", ...id, messagePath: messageRelativePath, messageDigest: sha256(messageBytes), scenarioIds: ["SCEN-MRI-001", "SCEN-MRI-002", "SCEN-MRI-003", "SCEN-MRI-004", "SCEN-MRI-005", "SCEN-MRI-006", "SCEN-MRI-007"] }),
    priorV030: await writeReceipt(candidateDirectory, "prior-v030", { schema: "omp-spec-kit-tagged-source-proof@1", status: "passed", tag: "v0.3.0", commit: PRIOR_COMMIT, source: "public-tag" }),
    upgradeFromV030: await writeReceipt(candidateDirectory, "upgrade", { schema: "omp-spec-kit-lifecycle-receipt@1", status: "passed", ...id, fromVersion: "0.3.0", fromTag: "v0.3.0", toVersion: "0.3.1", toTag: "v0.3.1", observedVersion: "0.3.1", freshSession: true, projectHashPreserved: true }),
    rollbackToV030: await writeReceipt(candidateDirectory, "rollback", { schema: "omp-spec-kit-lifecycle-receipt@1", status: "passed", ...id, fromVersion: "0.3.1", fromTag: "v0.3.1", toVersion: "0.3.0", toTag: "v0.3.0", observedVersion: "0.3.0", freshSession: true, projectHashPreserved: true }),
  };
  const frReceipts = Object.create(null);
  for (const [requirement, scenarioId] of Object.entries(MRI_SCENARIOS)) frReceipts[requirement] = await writeReceipt(candidateDirectory, `mri-${requirement.slice(-4)}`, { schema: "omp-spec-kit-fr-receipt@1", status: "passed", ...id, requirement, scenarioId });
  const discoveryBytes = await readFile(path.join(repositoryRoot, "docs", "validation", "omp-discovery-v17.3.7.md"));
  const evidence = { schema: "omp-spec-kit-release-evidence@3", ...id, mri: { schema: "omp-spec-kit-mri-evidence@1", checks, frReceipts, discovery: await writeBytes(candidateDirectory, "omp-discovery.md", discoveryBytes) }, distribution: { schema: "omp-spec-kit-distribution-evidence-input@1", trust: "untrusted-self-attested", receipt: { status: "missing" } } };
  const evidencePath = path.join(candidateDirectory, "evidence.json"); await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { candidate, catalogDigest, manifestPath, archivePath, evidencePath, candidateDirectory, resolveTagCommit };
}
export async function writeSyntheticDistributionClaims(world) {
  const evidence = JSON.parse(await readFile(world.evidencePath, "utf8"));
  const mriDiscoveryDigest = evidence.mri.discovery.digest;
  const records = DISTRIBUTION_REQUIREMENTS.map((requirement) => placeholderClaim(world.candidate, world.catalogDigest, requirement));
  const input = { schema: "omp-spec-kit-distribution-evidence@1", ...identity(world.candidate, world.catalogDigest), ompRevision: records[0].ompRevision, platform: structuredClone(PLATFORM), applicability: structuredClone(APPLICABILITY), mriDiscoveryDigest, records };
  evidence.distribution.receipt = await writeReceipt(world.candidateDirectory, "distribution-evidence", input);
  await writeFile(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}
export async function writeStructurallyCompleteSelfAttestedDistributionEvidence(world) {
  const evidence = JSON.parse(await readFile(world.evidencePath, "utf8"));
  const ompRevision = "@oh-my-pi/pi-coding-agent@17.3.7#8500092296621a6826b7136e840f8a59ea338958";
  const records = [];
  let index = 0;
  for (const [requirement, claims] of Object.entries(DISTRIBUTION_CLAIMS)) {
    for (const claim of claims) {
      index += 1;
      const producerReceipt = {
        schema: "omp-spec-kit-distribution-producer-receipt@1",
        status: "passed",
        ...identity(world.candidate, world.catalogDigest),
        requirement,
        claim,
        fixtureDigest: PLATFORM.fixtureDigest,
        ompRevision,
        platform: structuredClone(PLATFORM),
        applicability: structuredClone(APPLICABILITY),
        lifecycle: structuredClone(LIFECYCLE),
        producer: { workflow: "distribution-lifecycle", runId: String(index) },
        observations: [{ id: `self-attested-${index}`, outcome: "passed", summary: "Fabricated structural observation", fixtureDigest: PLATFORM.fixtureDigest }],
      };
      records.push({ requirement, claim, receipt: await writeReceipt(world.candidateDirectory, `self-attested-${index}`, producerReceipt) });
    }
  }
  const input = {
    schema: "omp-spec-kit-distribution-evidence@1",
    ...identity(world.candidate, world.catalogDigest),
    ompRevision,
    platform: structuredClone(PLATFORM),
    applicability: structuredClone(APPLICABILITY),
    mriDiscoveryDigest: evidence.mri.discovery.digest,
    records,
  };
  evidence.distribution = {
    schema: "omp-spec-kit-distribution-evidence-input@1",
    trust: "untrusted-self-attested",
    receipt: await writeReceipt(world.candidateDirectory, "self-attested-distribution-evidence", input),
  };
  await writeFile(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

export async function writeStructurallyCompleteAttestationTrustedDistributionEvidence(world) {
  const evidence = JSON.parse(await readFile(world.evidencePath, "utf8"));
  const ompRevision = "@oh-my-pi/pi-coding-agent@17.3.7#8500092296621a6826b7136e840f8a59ea338958";
  const records = [];
  let index = 0;
  for (const [requirement, claims] of Object.entries(DISTRIBUTION_CLAIMS)) {
    for (const claim of claims) {
      index += 1;
      const producerReceipt = {
        schema: "omp-spec-kit-distribution-producer-receipt@1",
        status: "passed",
        ...identity(world.candidate, world.catalogDigest),
        requirement,
        claim,
        fixtureDigest: PLATFORM.fixtureDigest,
        ompRevision,
        platform: structuredClone(PLATFORM),
        applicability: structuredClone(APPLICABILITY),
        lifecycle: structuredClone(LIFECYCLE),
        producer: { workflow: "distribution-lifecycle", runId: String(index) },
        observations: [{ id: `attestation-trusted-${index}`, outcome: "passed", summary: "Fabricated structural observation", fixtureDigest: PLATFORM.fixtureDigest }],
      };
      records.push({ requirement, claim, receipt: await writeReceipt(world.candidateDirectory, `attestation-trusted-${index}`, producerReceipt) });
    }
  }
  const input = {
    schema: "omp-spec-kit-distribution-evidence@1",
    ...identity(world.candidate, world.catalogDigest),
    ompRevision,
    platform: structuredClone(PLATFORM),
    applicability: structuredClone(APPLICABILITY),
    mriDiscoveryDigest: evidence.mri.discovery.digest,
    records,
  };
  evidence.distribution = {
    schema: "omp-spec-kit-distribution-evidence-input@1",
    trust: "github-artifact-attestation",
    receipt: await writeReceipt(world.candidateDirectory, "attestation-trusted-distribution-evidence", input),
  };
  await writeFile(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}
export async function evaluateCandidate(world, repositoryRoot) { return evaluateRelease({ candidatePath: world.manifestPath, evidencePath: world.evidencePath, tag: world.candidate.tag, repositoryRoot, resolveTagCommit: world.resolveTagCommit }); }
export async function extractCandidate(world, destination) { await mkdir(destination, { recursive: true }); const result = spawnSync("tar", ["-xf", world.archivePath, "-C", destination], { encoding: "utf8" }); if (result.error) throw result.error; if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`); const launcher = path.join(destination, "bin", "omp-spec-kit-mcp"); const mode = (await (await import("node:fs/promises")).lstat(launcher)).mode & 0o777; return { root: destination, launcher, mode }; }
export async function appendArchiveByte(world) { const original = await readFile(world.archivePath); await writeFile(world.archivePath, Buffer.concat([original, Buffer.from([0])])); }
export async function replaceMessageWithMeta(world) { const evidence = JSON.parse(await readFile(world.evidencePath, "utf8")); const bddReceiptPath = path.join(world.candidateDirectory, evidence.mri.checks.dockerBdd.path); const bddReceipt = JSON.parse(await readFile(bddReceiptPath, "utf8")); const messagePath = path.join(world.candidateDirectory, bddReceipt.messagePath); const bytes = Buffer.from('{"meta":{"protocolVersion":"33.0.4"}}\n'); await writeFile(messagePath, bytes); bddReceipt.messageDigest = sha256(bytes); const receiptBytes = Buffer.from(`${JSON.stringify(bddReceipt, null, 2)}\n`); await writeFile(bddReceiptPath, receiptBytes); evidence.mri.checks.dockerBdd.digest = sha256(receiptBytes); await writeFile(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`); }

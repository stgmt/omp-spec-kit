import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReleaseCandidate } from "../../scripts/create-release-candidate.mjs";
import { sha256 } from "../../scripts/release-candidate-utils.mjs";
import { evaluateRelease } from "../../scripts/verify-release.mjs";
import { verifyPublicTree } from "../../scripts/verify-public-tree.mjs";

const CANDIDATE_COMMIT = "a".repeat(40);
const PRIOR_COMMIT = "b".repeat(40);
export const MRI_RELEASE_SCENARIOS = Object.freeze([
  "SCEN-mri-active-project-root",
  "SCEN-mri-terminal-json-rpc",
  "SCEN-mri-malformed-json-recovery",
  "SCEN-mri-all-tool-parity",
  "SCEN-mri-public-eligibility-separation",
  "SCEN-mri-meta-only-evidence-refusal",
  "SCEN-mri-semantic-cucumber-mutations",
  "SCEN-mri-artifact-mismatch-refusal",
  "SCEN-mri-public-communication-proof",
  "SCEN-mri-credential-mutation-refusal",
  "SCEN-mri-executable-launcher-archive",
  "SCEN-mri-synthetic-distribution-refusal",
  "SCEN-mri-self-attested-distribution-refusal",
  "SCEN-mri-unverified-attestation-refusal",
  "SCEN-mri-symlinked-evidence-refusal",
  "SCEN-mri-active-project-manager-receipt",
  "SCEN-mri-missing-payload-refusal",
  "SCEN-mri-lifecycle-receipt-refusal",
]);
const MRI_SCENARIOS = Object.freeze({ "plugin-distribution:FR-19": "SCEN-mri-active-project-root", "plugin-distribution:FR-20": "SCEN-mri-terminal-json-rpc", "plugin-distribution:FR-21": "SCEN-mri-all-tool-parity", "plugin-distribution:FR-22": "SCEN-mri-public-eligibility-separation", "plugin-distribution:FR-23": "SCEN-mri-artifact-mismatch-refusal", "plugin-distribution:FR-24": "SCEN-mri-public-communication-proof" });
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
// Mirrors the producer/verifier honest per-claim contract: an axis is
// "passed" only when the receipt's own claim IS that lifecycle proof,
// "inapplicable" when the profile marks it out of scope, else "not-run".
function lifecycleForClaim(claim, applicability) {
  const axisState = (axis) => (claim === axis ? "passed" : applicability[axis] === "inapplicable" ? "inapplicable" : "not-run");
  return { upgrade: axisState("upgrade"), rollback: axisState("rollback"), reinstall: axisState("reinstall") };
}

function exactKeys(value, expected, label) {
  assert.equal(value !== null && typeof value === "object" && !Array.isArray(value), true, `${label} must be an object`);
  assert.deepStrictEqual(Object.keys(value).sort(), [...expected].sort(), `${label} key set must be closed`);
}

export async function readVerifiedCucumberFixture(repositoryRoot) {
  const fixtureDirectory = path.join(repositoryRoot, "tests", "fixtures", "release-candidate");
  const rawProvenance = await readFile(path.join(fixtureDirectory, "cucumber-messages.provenance.json"), "utf8");
  const provenance = JSON.parse(rawProvenance);
  exactKeys(provenance, [
    "schema", "fixture", "sha256", "repositoryCommit", "sourceState", "parentFixtureSha256",
    "sourceManifest", "sourceManifestSha256", "sourceInputsSha256", "sourceInputCount",
    "dockerImageDigest", "cucumberVersion", "captureCommand", "capturedAt", "scenarioCount", "stepCount",
  ], "Cucumber fixture provenance");
  assert.equal(provenance.schema, "omp-spec-kit-cucumber-fixture-provenance@2");
  assert.equal(provenance.fixture, "cucumber-messages.ndjson");
  assert.match(provenance.sha256, /^[0-9a-f]{64}$/u);
  assert.match(provenance.repositoryCommit, /^[0-9a-f]{40}$/u);
  assert.equal(provenance.sourceState, "working-tree-content-addressed");
  assert.match(provenance.parentFixtureSha256, /^[0-9a-f]{64}$/u);
  assert.match(provenance.dockerImageDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(provenance.cucumberVersion, "13.2.1");
  assert.equal(provenance.captureCommand, "bash scripts/docker-bdd.sh");

  const [bytes, rawSourceManifest] = await Promise.all([
    readFile(path.join(fixtureDirectory, provenance.fixture)),
    readFile(path.join(fixtureDirectory, provenance.sourceManifest)),
  ]);
  assert.equal(sha256(bytes), provenance.sha256, "Cucumber fixture bytes must match documented SHA-256");
  assert.equal(sha256(rawSourceManifest), provenance.sourceManifestSha256, "source manifest bytes must match provenance");
  const sourceManifest = JSON.parse(rawSourceManifest);
  exactKeys(sourceManifest, ["schema", "algorithm", "aggregateSha256", "entries"], "Cucumber source-input manifest");
  assert.equal(sourceManifest.schema, "omp-spec-kit-cucumber-source-inputs@1");
  assert.equal(sourceManifest.algorithm, "sha256(path NUL sha256 NUL bytes LF), paths code-point sorted");
  assert.equal(sourceManifest.aggregateSha256, provenance.sourceInputsSha256);
  assert.equal(sourceManifest.entries.length, provenance.sourceInputCount);
  let priorPath = "";
  const aggregateRows = [];
  for (const entry of sourceManifest.entries) {
    exactKeys(entry, ["path", "bytes", "sha256"], `source input ${entry?.path ?? "<missing>"}`);
    assert.equal(typeof entry.path, "string");
    assert.equal(entry.path > priorPath, true, "source-input paths must be unique and code-point sorted");
    assert.equal(path.isAbsolute(entry.path) || entry.path.split("/").includes(".."), false, "source-input path must be contained");
    const absolute = path.resolve(repositoryRoot, ...entry.path.split("/"));
    assert.equal(absolute.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`), true, "source-input path must remain under repository root");
    const sourceBytes = await readFile(absolute);
    assert.equal(sourceBytes.length, entry.bytes, `source input ${entry.path} byte count must match`);
    assert.equal(sha256(sourceBytes), entry.sha256, `source input ${entry.path} hash must match`);
    aggregateRows.push(`${entry.path}\u0000${entry.sha256}\u0000${entry.bytes}\n`);
    priorPath = entry.path;
  }
  assert.equal(sha256(Buffer.from(aggregateRows.join(""), "utf8")), sourceManifest.aggregateSha256, "source-input aggregate must match");

  const frames = bytes.toString("utf8").trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
  assert.equal(frames.filter((frame) => frame.pickle !== undefined).length, provenance.scenarioCount, "Cucumber fixture scenario count must match provenance");
  assert.equal(frames.filter((frame) => frame.testStepFinished !== undefined).length, provenance.stepCount, "Cucumber fixture step count must match provenance");
  return bytes;
}

function resolveTagCommit(tag) { if (tag === "v0.3.2") return CANDIDATE_COMMIT; if (tag === "v0.3.0") return PRIOR_COMMIT; throw new Error(`unexpected test tag ${tag}`); }
async function writeBytes(directory, name, bytes) { const relative = `receipts/${name}`; const absolute = path.join(directory, relative); await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, bytes); return { status: "present", path: relative, digest: sha256(bytes) }; }
async function writeReceipt(directory, name, value) { return writeBytes(directory, `${name}.json`, Buffer.from(`${JSON.stringify(value, null, 2)}\n`)); }
function identity(candidate, catalogDigest) { return { version: candidate.version, tag: candidate.tag, commit: candidate.commit, candidateDigest: candidate.candidateDigest, packageTreeDigest: candidate.packageTreeDigest, archiveSha256: candidate.archive.sha256, catalogDigest }; }
function placeholderClaim(candidate, catalogDigest, requirement) { return { schema: "omp-spec-kit-distribution-evidence-receipt@1", status: "passed", ...identity(candidate, catalogDigest), requirement, claims: ["candidate-evidence"], ompRevision: "@oh-my-pi/pi-coding-agent@18.0.10#33cc6b9a043a74e00a157e72ca909272796d8461", platform: structuredClone(PLATFORM), fixtureDigest: "d".repeat(64), applicability: structuredClone(APPLICABILITY), lifecycle: lifecycleForClaim("candidate-evidence", APPLICABILITY) }; }

export async function createCandidateWorld(repositoryRoot, tempRoot, verifiedMessageBytes) {
  const candidateDirectory = path.join(tempRoot, "candidate");
  const { candidate, manifestPath, archivePath } = await createReleaseCandidate({ tag: "v0.3.2", outputDirectory: candidateDirectory, repositoryRoot, resolveTagCommit, verifyTaggedCheckout() {} });
  const catalogDigest = sha256(await readFile(path.join(repositoryRoot, ".omp-plugin", "marketplace.json")));
  const safety = await verifyPublicTree(manifestPath);
  const messageRelativePath = "messages/cucumber.ndjson"; const messageBytes = verifiedMessageBytes; const messagePath = path.join(candidateDirectory, messageRelativePath); await mkdir(path.dirname(messagePath), { recursive: true }); await writeFile(messagePath, messageBytes);
  const id = identity(candidate, catalogDigest);
  const checks = {
    publicSafety: await writeReceipt(candidateDirectory, "public-safety", safety),
    dockerBdd: await writeReceipt(candidateDirectory, "docker-bdd", { schema: "omp-spec-kit-bdd-receipt@1", status: "passed", ...id, messagePath: messageRelativePath, messageDigest: sha256(messageBytes), scenarioIds: Object.values(MRI_SCENARIOS) }),
    priorV030: await writeReceipt(candidateDirectory, "prior-v030", { schema: "omp-spec-kit-tagged-source-proof@1", status: "passed", tag: "v0.3.0", commit: PRIOR_COMMIT, source: "public-tag" }),
    upgradeFromV030: await writeReceipt(candidateDirectory, "upgrade", { schema: "omp-spec-kit-lifecycle-receipt@1", status: "passed", ...id, fromVersion: "0.3.0", fromTag: "v0.3.0", toVersion: "0.3.2", toTag: "v0.3.2", observedVersion: "0.3.2", freshSession: true, projectHashPreserved: true }),
    rollbackToV030: await writeReceipt(candidateDirectory, "rollback", { schema: "omp-spec-kit-lifecycle-receipt@1", status: "passed", ...id, fromVersion: "0.3.2", fromTag: "v0.3.2", toVersion: "0.3.0", toTag: "v0.3.0", observedVersion: "0.3.0", freshSession: true, projectHashPreserved: true }),
  };
  const frReceipts = Object.create(null);
  for (const [requirement, scenarioId] of Object.entries(MRI_SCENARIOS)) frReceipts[requirement] = await writeReceipt(candidateDirectory, `mri-${requirement.slice(-4)}`, { schema: "omp-spec-kit-fr-receipt@1", status: "passed", ...id, requirement, scenarioId });
  const discoveryBytes = await readFile(path.join(repositoryRoot, "docs", "validation", "omp-discovery-v18.0.10.md"));
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
  const ompRevision = "@oh-my-pi/pi-coding-agent@18.0.10#33cc6b9a043a74e00a157e72ca909272796d8461";
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
        lifecycle: lifecycleForClaim(claim, APPLICABILITY),
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
  const ompRevision = "@oh-my-pi/pi-coding-agent@18.0.10#33cc6b9a043a74e00a157e72ca909272796d8461";
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
        lifecycle: lifecycleForClaim(claim, APPLICABILITY),
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

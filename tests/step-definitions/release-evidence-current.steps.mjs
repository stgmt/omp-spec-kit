import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import { candidateDigest, canonicalJson, collectRegularFiles, createDeterministicTar, packageTreeDigest, sha256, toPublicFileRows } from "../../scripts/release-candidate-utils.mjs";
import { cucumberMessages, requiredScenarioMultiplicity } from "../../scripts/create-release-evidence.mjs";
import { evaluateRelease } from "../../scripts/verify-release.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const PREDECESSOR_STATUS = path.join(REPOSITORY_ROOT, "docs", "validation", "release-status-v0.3.2.json");
const RELEASE_FEATURE = path.join(REPOSITORY_ROOT, "tests", "features", "release-evidence.feature");
async function createGitFreeCandidate(outputDirectory) {
  const files = await collectRegularFiles(path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit"));
  const archiveBytes = await createDeterministicTar(files);
  const withoutDigest = {
    schema: "omp-spec-kit-release-candidate@1",
    version: "0.4.0",
    tag: "v0.4.0",
    commit: "5a01a8ac76d87f4a8cc600f763cbb3228375c199",
    packageTreeDigest: packageTreeDigest(files),
    archive: { file: "omp-spec-kit-0.4.0.tar", sha256: sha256(archiveBytes), bytes: archiveBytes.length },
    files: toPublicFileRows(files),
  };
  const candidate = { ...withoutDigest, candidateDigest: candidateDigest(withoutDigest) };
  const manifestPath = path.join(outputDirectory, "candidate.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(manifestPath, canonicalJson(candidate), "utf8");
  return { candidate, manifestPath };
}
Given("a v0.4.0 candidate and complete evidence record", async function () {
  const outputDirectory = path.join(this.mri.tempRoot, "current-candidate");
  this.currentCandidate = await createGitFreeCandidate(outputDirectory);
});

When("the current candidate message artifact contains only meta", async function () {
  const featureSource = await readFile(RELEASE_FEATURE, "utf8");
  const required = requiredScenarioMultiplicity(featureSource);
  try {
    cucumberMessages(Buffer.from(JSON.stringify({ meta: { protocolVersion: "22.0.0" } }) + "\n", "utf8"), required);
    assert.fail("meta-only Cucumber input must be rejected");
  } catch (error) {
    this.currentCandidateEvidenceError = error;
  }
});

Then("the current candidate is refused for nonsemantic Cucumber evidence", function () {
  assert.equal(this.currentCandidateEvidenceError?.code, "META_ONLY_STREAM");
  assert.match(this.currentCandidateEvidenceError.message, /meta|semantic|scenario/u);
});

Given("the bounded v0.3.2 predecessor release status record", async function () {
  this.predecessorStatus = JSON.parse(await readFile(PREDECESSOR_STATUS, "utf8"));
});

When("the predecessor publication identities are reconciled", function () {
  const status = this.predecessorStatus;
  assert.equal(status.tag, "v0.3.2");
  assert.equal(status.releaseUrl, "https://github.com/stgmt/omp-spec-kit/releases/tag/v0.3.2");
  assert.equal(status.distributionAttestation.sourceRef, "refs/tags/v0.3.2");
  this.predecessorReconciled = true;
});

Then("the predecessor record contains one exact published archive identity", function () {
  assert.equal(this.predecessorReconciled, true);
  const archiveInNotes = /Archive SHA-256: .([0-9a-f]{64})./u.exec(this.predecessorStatus.releaseNotes.body)?.[1];
  assert.match(this.predecessorStatus.archive.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(this.predecessorStatus.archive.sha256, archiveInNotes);
});

Given("a v0.4.0 candidate without live distribution provenance", async function () {
  const outputDirectory = path.join(this.mri.tempRoot, "current-candidate-without-distribution");
  this.currentCandidate = await createGitFreeCandidate(outputDirectory);
});

When("current publish verification sees a different archive identity", async function () {
  this.currentReleaseResult = await evaluateRelease({
    candidatePath: this.currentCandidate.manifestPath,
    evidencePath: path.join(this.mri.tempRoot, "missing-distribution-evidence.json"),
    tag: "v0.4.0",
    repositoryRoot: REPOSITORY_ROOT,
  });
});

Then("current publication is refused before release mutation", function () {
  assert.equal(this.currentReleaseResult.eligible, false);
  assert.ok(this.currentReleaseResult.blocking.some((item) => /evidence|distribution|missing|invalid/u.test(item)));
});

Then("the predecessor record proves a trusted public release for its exact candidate", function () {
  assert.equal(this.predecessorReconciled, true);
  assert.equal(this.predecessorStatus.schema, "omp-spec-kit-public-release-status@1");
  assert.equal(this.predecessorStatus.status.state, "SHIPPED");
  const candidateInNotes = /Candidate digest: .([0-9a-f]{64})./u.exec(this.predecessorStatus.releaseNotes.body)?.[1];
  assert.equal(this.predecessorStatus.candidateDigest, candidateInNotes);
});

Then("predecessor public guidance retains the v0.3.0 advisory", async function () {
  const advisory = await readFile(path.join(REPOSITORY_ROOT, "docs", "advisories", "v0.3.0-mcp-root.md"), "utf8");
  assert.match(advisory, /v0.3.0|MCP|active project/u);
});

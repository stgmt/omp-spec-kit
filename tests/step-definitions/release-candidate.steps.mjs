import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { renderReleaseNotes } from "../../scripts/render-release-notes.mjs";
import { CucumberEvidenceError, cucumberMessages, requiredScenarioMultiplicity } from "../../scripts/create-release-evidence.mjs";
import { verifyPublicTree } from "../../scripts/verify-public-tree.mjs";
import { sha256 } from "../../scripts/release-candidate-utils.mjs";
import { loadPinnedCorpusGraph, spawnMcpServer, writeCorpus } from "../helpers/mcp-world.mjs";
import {
  appendArchiveByte,
  createCandidateWorld,
  evaluateCandidate,
  extractCandidate,
  MRI_RELEASE_SCENARIOS,
  readVerifiedCucumberFixture,
  replaceMessageWithMeta,
  writeStructurallyCompleteAttestationTrustedDistributionEvidence,
  writeStructurallyCompleteSelfAttestedDistributionEvidence,
  writeSyntheticDistributionClaims,
} from "../helpers/release-candidate-world.mjs";

function repositoryRoot() {
  return path.resolve(import.meta.dirname, "..", "..");
}


function parseFixtureFrames(bytes) {
  return bytes
    .toString("utf8")
    .trimEnd()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
}

function serializeFixtureFrames(frames) {
  return Buffer.from(`${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`);
}

function releaseEvidenceChain(frames) {
  const pickleIndex = frames.findIndex((frame) => frame.pickle?.tags?.some((tag) => tag.name === "@id:SCEN-mri-active-project-root"));
  assert.notEqual(pickleIndex, -1, "real fixture must contain SCEN-mri-active-project-root pickle");
  const pickleId = frames[pickleIndex].pickle.id;
  const testCaseIndex = frames.findIndex((frame) => frame.testCase?.pickleId === pickleId);
  assert.notEqual(testCaseIndex, -1, "real fixture must contain SCEN-mri-active-project-root testCase");
  const testCaseId = frames[testCaseIndex].testCase.id;
  const startIndex = frames.findIndex((frame) => frame.testCaseStarted?.testCaseId === testCaseId);
  assert.notEqual(startIndex, -1, "real fixture must contain SCEN-mri-active-project-root testCaseStarted");
  const startId = frames[startIndex].testCaseStarted.id;
  const stepIndexes = frames.flatMap((frame, index) => (frame.testStepFinished?.testCaseStartedId === startId ? [index] : []));
  assert.notEqual(stepIndexes.length, 0, "real fixture must contain SCEN-mri-active-project-root testStepFinished");
  const finishIndex = frames.findIndex((frame) => frame.testCaseFinished?.testCaseStartedId === startId);
  assert.notEqual(finishIndex, -1, "real fixture must contain SCEN-mri-active-project-root testCaseFinished");
  return { pickleIndex, testCaseIndex, startIndex, startId, stepIndexes, finishIndex };
}

function mutateCucumberEvidence(bytes, fault) {
  if (fault === "corrupt-line") {
    const corruptLine = bytes.toString("utf8").split(/\r?\n/u).length;
    return { bytes: Buffer.from(`${bytes.toString("utf8")}not-json\n`), corruptLine };
  }
  if (fault === "meta-only") return { bytes: Buffer.from('{"meta":{"protocolVersion":"33.0.4"}}\n') };

  const frames = parseFixtureFrames(bytes);
  const chain = releaseEvidenceChain(frames);
  if (fault === "missing-pickle") frames.splice(chain.pickleIndex, 1);
  else if (fault === "missing-test-case") frames.splice(chain.testCaseIndex, 1);
  else if (fault === "missing-test-case-started") frames.splice(chain.startIndex, 1);
  else if (fault === "missing-test-step-finished") {
    return { bytes: serializeFixtureFrames(frames.filter((frame) => frame.testStepFinished?.testCaseStartedId !== chain.startId)), startId: chain.startId };
  } else if (fault === "missing-test-case-finished") frames.splice(chain.finishIndex, 1);
  else if (fault === "failed-final-step") frames[chain.stepIndexes.at(-1)].testStepFinished.testStepResult.status = "FAILED";
  else if (fault === "retry-only") frames[chain.finishIndex].testCaseFinished.willBeRetried = true;
  else if (fault === "missing-outline-expansion") {
    const outlinePickles = frames.filter((frame) =>
      frame.pickle?.tags?.some((tag) => tag.name === "@id:SCEN-mri-semantic-cucumber-mutations"),
    );
    assert.equal(outlinePickles.length, 12, "real fixture must contain all semantic-mutation outline pickles");
    const removedPickleId = outlinePickles[1].pickle.id;
    const removedTestCaseIds = new Set(
      frames.flatMap((frame) => frame.testCase?.pickleId === removedPickleId ? [frame.testCase.id] : []),
    );
    const removedStartIds = new Set(
      frames.flatMap((frame) => removedTestCaseIds.has(frame.testCaseStarted?.testCaseId) ? [frame.testCaseStarted.id] : []),
    );
    return {
      bytes: serializeFixtureFrames(frames.filter((frame) =>
        frame.pickle?.id !== removedPickleId &&
        !removedTestCaseIds.has(frame.testCase?.id) &&
        !removedStartIds.has(frame.testCaseStarted?.id) &&
        !removedStartIds.has(frame.testStepStarted?.testCaseStartedId) &&
        !removedStartIds.has(frame.testStepFinished?.testCaseStartedId) &&
        !removedStartIds.has(frame.testCaseFinished?.testCaseStartedId)
      )),
    };
  } else if (fault === "duplicate-terminal-frame") frames.splice(chain.finishIndex + 1, 0, structuredClone(frames[chain.finishIndex]));
  else if (fault === "duplicate-test-run-finished") {
    const runFinish = frames.find((frame) => frame.testRunFinished !== undefined);
    assert.notEqual(runFinish, undefined, "real fixture must contain testRunFinished");
    frames.push(structuredClone(runFinish));
  } else {
    throw new Error(`unknown Cucumber evidence fault ${fault}`);
  }
  return { bytes: serializeFixtureFrames(frames), startId: chain.startId };
}
async function seedCandidate(world) {
  world.release = await createCandidateWorld(repositoryRoot(), world.releaseTempRoot, world.verifiedCucumberFixture);
}

Before({ tags: "@mcp-release-integrity" }, async function () {
  this.releaseTempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-release-bdd-"));
  this.verifiedCucumberFixture = await readVerifiedCucumberFixture(repositoryRoot());
  this.release = null;
  this.releaseServer = null;
  this.publicTreeOriginal = null;
});

After({ tags: "@mcp-release-integrity" }, async function () {
  if (this.publicTreeOriginal !== null) await writeFile(this.publicTreeOriginal.path, this.publicTreeOriginal.bytes);
  if (this.releaseServer !== null) await this.releaseServer.close();
  if (this.releaseTempRoot !== null) await rm(this.releaseTempRoot, { recursive: true, force: true, maxRetries: 3 });
});

Given(/^a v0\.3\.2 candidate and complete evidence record$/, async function () {
  await seedCandidate(this);
});

When("the release evaluator checks the candidate", async function () {
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("the MRI gate is independently eligible while public release remains blocked without distribution evidence", function () {
  assert.equal(this.releaseResult.mri.schema, "mri-release-eligibility@1");
  assert.equal(this.releaseResult.mri.eligible, true, this.releaseResult.mri.blocking.join(", "));
  assert.equal(this.releaseResult.distribution.schema, "distribution-release-eligibility@1");
  assert.equal(this.releaseResult.distribution.outcome, "blocked");
  assert.equal(this.releaseResult.blocking.includes("distribution:distribution-evidence-missing"), true);
});

Given("the bounded current v0.3.2 public release status record", async function () {
  const root = repositoryRoot();
  this.currentReleaseStatus = JSON.parse(
    await readFile(path.join(root, "docs", "validation", "release-status-v0.3.2.json"), "utf8"),
  );
  this.currentReleaseGuidance = {
    rootReadme: await readFile(path.join(root, "README.md"), "utf8"),
    packageReadme: await readFile(path.join(root, "plugins", "omp-spec-kit", "README.md"), "utf8"),
    changelog: await readFile(path.join(root, "CHANGELOG.md"), "utf8"),
    advisory: await readFile(path.join(root, "docs", "advisories", "v0.3.0-mcp-root.md"), "utf8"),
  };
});

When("the recorded publication identities are reconciled", function () {
  const status = this.currentReleaseStatus;
  assert.equal(status.schema, "omp-spec-kit-public-release-status@1");
  assert.equal(status.version, "0.3.2");
  assert.equal(status.tag, "v0.3.2");
  assert.equal(status.status.public, true);
  assert.equal(status.status.installable, true);
  assert.match(status.candidateDigest, /^[0-9a-f]{64}$/u);
  assert.match(status.packageTreeDigest, /^[0-9a-f]{64}$/u);
  assert.match(status.archive.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(status.evidence.schema, "omp-spec-kit-release-evidence@3");
  assert.equal(status.attestation.workflowCommit, status.tagCommit);
  assert.equal(status.distributionAttestation.workflowCommit, status.tagCommit);
  assert.equal(status.distributionAttestation.subjectSha256, status.evidence.distributionReceiptDigest);
  this.currentReleaseArchiveAssets = status.releaseAssets.filter((asset) => asset.name.endsWith(".tar"));
});

Then("the bounded record proves a trusted public release for the exact candidate", function () {
  const status = this.currentReleaseStatus;
  assert.equal(status.attestation.verified, true);
  assert.equal(status.distributionAttestation.verified, true);
  assert.equal(status.distributionAttestation.subject, "distribution-evidence.json");
  assert.equal(status.distributionAttestation.repository, "stgmt/omp-spec-kit");
  assert.equal(
    status.distributionAttestation.signerWorkflow,
    "https://github.com/stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml@refs/tags/v0.3.2",
  );
  assert.equal(status.distributionAttestation.sourceRef, "refs/tags/v0.3.2");
  assert.equal(status.releaseUrl, "https://github.com/stgmt/omp-spec-kit/releases/tag/v0.3.2");
});

Then("the bounded record contains one exact published archive identity without a rebuild claim", function () {
  const status = this.currentReleaseStatus;
  assert.equal(this.currentReleaseArchiveAssets.length, 1);
  assert.deepStrictEqual(this.currentReleaseArchiveAssets[0], {
    name: status.archive.name,
    bytes: status.archive.bytes,
    sha256: status.archive.sha256,
  });
  assert.equal(status.archive.name, "omp-spec-kit-0.3.2.tar");
  assert.equal(status.attestation.workflowCommit, status.tagCommit);
});

Then("current public guidance and captured release notes match v0.3.2 and retain the v0.3.0 advisory", function () {
  const guidance = this.currentReleaseGuidance;
  const releaseNotes = this.currentReleaseStatus.releaseNotes;
  assert.equal(sha256(Buffer.from(releaseNotes.body, "utf8")), releaseNotes.bodySha256);
  assert.equal(releaseNotes.source, this.currentReleaseStatus.releaseUrl);
  assert.match(releaseNotes.body, /# omp-spec-kit v0\.3\.2/u);
  assert.match(releaseNotes.body, /Archive SHA-256: `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`/u);
  assert.match(guidance.rootReadme, /Current status: v0\.3\.2 published; v0\.3\.0 MCP advisory remains/u);
  assert.match(guidance.packageReadme, /omp-spec-kit` v0\.3\.2/u);
  assert.match(guidance.changelog, /## 0\.3\.2 — 2026-08-28/u);
  assert.match(guidance.advisory, /# v0\.3\.0 MCP advisory/u);
  assert.match(guidance.advisory, /current public release is v0\.3\.2/u);
});

When("the lifecycle evidence is {string}", async function (fault) {
  const evidence = JSON.parse(await readFile(this.release.evidencePath, "utf8"));
  const refs = evidence.mri.checks;
  if (fault === "missing-upgrade") {
    refs.upgradeFromV030 = { status: "missing" };
    this.expectedLifecycleBlocker = "missing-receipt:upgradeFromV030";
  } else if (fault === "missing-rollback") {
    refs.rollbackToV030 = { status: "missing" };
    this.expectedLifecycleBlocker = "missing-receipt:rollbackToV030";
  } else if (fault === "foreign-candidate") {
    const receiptPath = path.join(this.release.candidateDirectory, refs.upgradeFromV030.path);
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    receipt.candidateDigest = "f".repeat(64);
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    await writeFile(receiptPath, bytes);
    refs.upgradeFromV030.digest = sha256(bytes);
    this.expectedLifecycleBlocker = "invalid-lifecycle-receipt:upgradeFromV030";
  } else {
    assert.fail(`unknown lifecycle evidence fault: ${fault}`);
  }
  await writeFile(this.release.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("MRI eligibility is false with {string}", function (code) {
  const codeToBlocker = {
    LIFECYCLE_RECEIPT_MISSING: this.expectedLifecycleBlocker,
    CANDIDATE_IDENTITY_MISMATCH: "invalid-lifecycle-receipt:upgradeFromV030",
  };
  const expected = codeToBlocker[code];
  assert.equal(typeof expected, "string", `unknown lifecycle assertion code: ${code}`);
  assert.equal(this.releaseResult.mri.eligible, false, "MRI must fail for incomplete or foreign lifecycle evidence");
  assert.equal(this.releaseResult.mri.blocking.includes(expected), true, this.releaseResult.mri.blocking.join(", "));
});

When("the candidate message artifact contains only meta", async function () {
  await replaceMessageWithMeta(this.release);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});
Then("the candidate is refused for nonsemantic Cucumber evidence", function () {
  const mriBlocker = "invalid-cucumber-messages:release-candidate: Cucumber Message artifact contains only meta frames";
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.mri.blocking.includes(mriBlocker), true, this.releaseResult.mri.blocking.join(", "));
  assert.equal(this.releaseResult.blocking.includes(`mri:${mriBlocker}`), true, this.releaseResult.blocking.join(", "));
});

Given("the captured real Cucumber message fixture", async function () {
  this.cucumberFixture = this.verifiedCucumberFixture;
  this.mriScenarioMultiplicities = requiredScenarioMultiplicity(
    await readFile(path.join(repositoryRoot(), ".specs", "mcp-release-integrity", "mcp-release-integrity.feature"), "utf8"),
  );
});

When("the Cucumber evidence stream is {string}", function (fault) {
  const mutation = mutateCucumberEvidence(this.cucumberFixture, fault);
  this.cucumberEvidence = mutation.bytes;
  this.cucumberEvidenceStartId = mutation.startId;
  this.cucumberEvidenceCorruptLine = mutation.corruptLine;
});

Then(
  "the semantic Cucumber evidence parser rejects it as {string} with {string}",
  async function (code, expectedMessage) {
    const message = expectedMessage
      .replace("{startId}", this.cucumberEvidenceStartId ?? "{startId}")
      .replace("{line}", String(this.cucumberEvidenceCorruptLine ?? "{line}"));
    assert.throws(
      () => cucumberMessages(this.cucumberEvidence, this.mriScenarioMultiplicities),
      (error) => {
        assert.equal(error instanceof CucumberEvidenceError, true, "semantic evidence errors must have the CucumberEvidenceError class");
        assert.equal(error.code, code, "semantic evidence error code must identify the rejected contract");
        assert.equal(error.message, `release-candidate: Cucumber Message artifact ${message}`, "semantic evidence error message must identify the rejected contract");
        return true;
      },
    );
    const reloadedFixture = await readVerifiedCucumberFixture(repositoryRoot());
    assert.deepEqual(reloadedFixture, this.cucumberFixture, "in-memory mutations must not alter the captured fixture bytes");
  },
);

Given("a candidate artifact without live distribution provenance", async function () {
  await seedCandidate(this);
  const result = await evaluateCandidate(this.release, repositoryRoot());
  assert.equal(result.mri.eligible, true, result.mri.blocking.join(", "));
  assert.equal(result.distribution.outcome, "blocked");
  assert.equal(result.blocking.includes("distribution:distribution-evidence-missing"), true);
});

When("the publish verification sees a different archive or existing release asset", async function () {
  await appendArchiveByte(this.release);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("publication is refused before release mutation", function () {
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.blocking.includes("archive-digest-mismatch"), true);
});

Given(/^a candidate artifact and a v0\.3\.0 advisory without live distribution provenance$/, async function () {
  await seedCandidate(this);
  const result = await evaluateCandidate(this.release, repositoryRoot());
  assert.equal(result.mri.eligible, true, result.mri.blocking.join(", "));
  assert.equal(result.eligible, false);
  this.advisoryPath = path.join(repositoryRoot(), "docs", "advisories", "v0.3.0-mcp-root.md");
});

When("release notes are rendered", async function () {
  await assert.rejects(
    renderReleaseNotes({
      candidatePath: this.release.manifestPath,
      evidencePath: this.release.evidencePath,
      tag: this.release.candidate.tag,
      repositoryRoot: repositoryRoot(),
      resolveTagCommit: this.release.resolveTagCommit,
    }),
    /distribution:distribution-evidence-missing/u,
  );
});

Then("release notes remain withheld pending live distribution provenance", async function () {
  const advisory = await readFile(this.advisoryPath, "utf8");
  assert.match(advisory, /v0\.3\.1/u);
});

When("the candidate archive is extracted into a clean project", async function () {
  const extracted = await extractCandidate(this.release, path.join(this.releaseTempRoot, "extracted-package"));
  const projectRoot = path.join(this.releaseTempRoot, "extracted-project");
  const pinned = await loadPinnedCorpusGraph(repositoryRoot());
  await writeCorpus(projectRoot, pinned.files);
  this.extracted = { ...extracted, projectRoot };
  this.releaseServer = spawnMcpServer({ command: extracted.launcher, cwd: projectRoot });
  await this.releaseServer.request("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "candidate-bdd", version: "1" } });
  this.extractedOverview = await this.releaseServer.request("tools/call", {
    name: "spec_overview",
    arguments: { specSlugs: ["product"], requestId: "candidate-extract-overview", schemaVersion: "spec-kernel@1" },
  });
});

Then("the extracted launcher is executable and serves the active project", function () {
  assert.equal(this.extracted.mode & 0o111, 0o111);
  assert.equal(this.extractedOverview.result.isError, false);
  assert.equal(this.extractedOverview.result.structuredContent.data.counts.acceptedDocuments > 0, true);
});

Given("a v0.3.2 candidate with complete MRI evidence but no distribution evidence", async function () {
  await seedCandidate(this);
  const result = await evaluateCandidate(this.release, repositoryRoot());
  assert.equal(result.mri.eligible, true, result.mri.blocking.join(", "));
  assert.equal(result.distribution.outcome, "blocked");
});

When("the distribution evidence is {string}", async function (fault) {
  if (fault === "placeholder-claims") await writeSyntheticDistributionClaims(this.release);
  else if (fault === "structurally-complete-self-attested") await writeStructurallyCompleteSelfAttestedDistributionEvidence(this.release);
  else if (fault === "structurally-complete-attestation-trusted") await writeStructurallyCompleteAttestationTrustedDistributionEvidence(this.release);
  else assert.fail(`unexpected distribution evidence fixture: ${fault}`);
  this.distributionEvidenceFault = fault;
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("the public release is blocked by an attestation-unverified reason while MRI remains independently named", function () {
  assert.equal(this.releaseResult.mri.schema, "mri-release-eligibility@1");
  assert.equal(this.releaseResult.mri.eligible, true, this.releaseResult.mri.blocking.join(", "));
  assert.equal(this.releaseResult.distribution.schema, "distribution-release-eligibility@1");
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(
    this.releaseResult.distribution.blockingReasons.some((reason) => reason.startsWith("distribution-producer-attestation-unverified:")),
    true,
    this.releaseResult.distribution.blockingReasons.join(", "),
  );
});

Then("the public release is blocked by {string} while MRI remains independently named", function (reason) {
  assert.equal(this.releaseResult.mri.schema, "mri-release-eligibility@1");
  assert.equal(this.releaseResult.mri.eligible, true, this.releaseResult.mri.blocking.join(", "));
  assert.equal(this.releaseResult.distribution.schema, "distribution-release-eligibility@1");
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.blocking.includes(`distribution:${reason}`), true, this.releaseResult.blocking.join(", "));
  if (this.distributionEvidenceFault === "placeholder-claims") {
    assert.equal(
      this.releaseResult.distribution.blockingReasons.includes("unexpected-distribution-claim:plugin-distribution:FR-1:missing"),
      true,
      this.releaseResult.distribution.blockingReasons.join(", "),
    );
  }
});

When("the evidence {string} directory has a symlinked parent", async function (directory) {
  assert.equal(["receipts", "messages"].includes(directory), true);
  const source = path.join(this.release.candidateDirectory, directory);
  const external = path.join(this.releaseTempRoot, `${directory}-external`);
  await rename(source, external);
  await symlink(external, source, process.platform === "win32" ? "junction" : "dir");
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("the release evaluator reports {string} before reading evidence bytes", function (code) {
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.blocking.some((finding) => finding.includes(code)), true, this.releaseResult.blocking.join(", "));
});

Given("the packaged README contains synthetic {string}", async function (sentinel) {
  const packageReadme = path.join(repositoryRoot(), "plugins", "omp-spec-kit", "README.md");
  const bytes = await readFile(packageReadme);
  this.publicTreeOriginal = { path: packageReadme, bytes };
  await writeFile(packageReadme, Buffer.concat([bytes, Buffer.from(`\n${sentinel}\n`)]));
});

When("a candidate is assembled and public safety is evaluated", async function () {
  await seedCandidate(this);
  this.publicSafety = await verifyPublicTree(this.release.manifestPath);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("public safety reports {string} and public release remains blocked", function (category) {
  assert.equal(this.publicSafety.findings.includes(`secret-like-content:${category}:README.md`), true, this.publicSafety.findings.join(", "));
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.mri.blocking.includes("invalid-public-safety-receipt"), true);
});

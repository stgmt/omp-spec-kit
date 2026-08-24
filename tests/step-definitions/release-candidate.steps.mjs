import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { renderReleaseNotes } from "../../scripts/render-release-notes.mjs";
import { cucumberMessages } from "../../scripts/create-release-evidence.mjs";
import { loadPinnedCorpusGraph, spawnMcpServer, writeCorpus } from "../helpers/mcp-world.mjs";
import { appendArchiveByte, createCandidateWorld, evaluateCandidate, extractCandidate, replaceMessageWithMeta } from "../helpers/release-candidate-world.mjs";

function repositoryRoot() {
  return path.resolve(import.meta.dirname, "..", "..");
}

async function seedCandidate(world) {
  world.release = await createCandidateWorld(repositoryRoot(), world.releaseTempRoot);
}

Before({ tags: "@mcp-release-integrity" }, async function () {
  this.releaseTempRoot = await mkdtemp(path.join(tmpdir(), "omp-spec-kit-release-bdd-"));
  this.release = null;
  this.releaseServer = null;
});

After({ tags: "@mcp-release-integrity" }, async function () {
  if (this.releaseServer !== null) await this.releaseServer.close();
  if (this.releaseTempRoot !== null) await rm(this.releaseTempRoot, { recursive: true, force: true, maxRetries: 3 });
});

Given(/^a v0\.3\.1 candidate and complete evidence record$/, async function () {
  await seedCandidate(this);
});

When("the release evaluator checks the candidate", async function () {
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("the candidate is eligible only when every identity and lifecycle record agrees", function () {
  assert.equal(this.releaseResult.eligible, true, this.releaseResult.blocking.join(", "));
});

When("the candidate message artifact contains only meta", async function () {
  await replaceMessageWithMeta(this.release);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("the candidate is refused for nonsemantic Cucumber evidence", function () {
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(
    this.releaseResult.blocking.some((finding) => finding.startsWith("invalid-cucumber-messages:")),
    true,
  );
});

Given("the captured real Cucumber message fixture", async function () {
  this.cucumberFixture = await readFile(
    path.join(repositoryRoot(), "tests", "fixtures", "release-candidate", "cucumber-messages.ndjson"),
  );
});

When("the Cucumber evidence stream is {string}", function (fault) {
  const text = this.cucumberFixture.toString("utf8");
  if (fault === "corrupt-line") {
    this.cucumberEvidence = Buffer.from(`${text}not-json\n`);
    return;
  }
  const finalLine = text.trimEnd().split(/\r?\n/u).at(-1);
  if (fault === "duplicate-finish") {
    this.cucumberEvidence = Buffer.from(`${text}${finalLine}\n`);
    return;
  }
  if (fault === "retried-without-terminal") {
    this.cucumberEvidence = Buffer.from(text.replaceAll('"willBeRetried":false', '"willBeRetried":true'));
    return;
  }
  throw new Error(`unknown Cucumber evidence fault ${fault}`);
});

Then("the semantic Cucumber evidence parser rejects it", function () {
  assert.throws(
    () =>
      cucumberMessages(this.cucumberEvidence, [
        "SCEN-MRI-001",
        "SCEN-MRI-002",
        "SCEN-MRI-003",
        "SCEN-MRI-004",
        "SCEN-MRI-005",
        "SCEN-MRI-006",
        "SCEN-MRI-007",
      ]),
  );
});

Given("an eligible candidate artifact", async function () {
  await seedCandidate(this);
  const result = await evaluateCandidate(this.release, repositoryRoot());
  assert.equal(result.eligible, true, result.blocking.join(", "));
});

When("the publish verification sees a different archive or existing release asset", async function () {
  await appendArchiveByte(this.release);
  this.releaseResult = await evaluateCandidate(this.release, repositoryRoot());
});

Then("publication is refused before release mutation", function () {
  assert.equal(this.releaseResult.eligible, false);
  assert.equal(this.releaseResult.blocking.includes("archive-digest-mismatch"), true);
});

Given(/^an eligible candidate and a v0\.3\.0 advisory$/, async function () {
  await seedCandidate(this);
  const result = await evaluateCandidate(this.release, repositoryRoot());
  assert.equal(result.eligible, true, result.blocking.join(", "));
  this.advisoryPath = path.join(repositoryRoot(), "docs", "advisories", "v0.3.0-mcp-root.md");
});

When("release notes are rendered", async function () {
  this.notes = await renderReleaseNotes({
    candidatePath: this.release.manifestPath,
    evidencePath: this.release.evidencePath,
    tag: this.release.candidate.tag,
    repositoryRoot: repositoryRoot(),
    resolveTagCommit: this.release.resolveTagCommit,
  });
});

Then("the notes name only the candidate version and verified evidence", async function () {
  const advisory = await (await import("node:fs/promises")).readFile(this.advisoryPath, "utf8");
  assert.match(advisory, /v0\.3\.1/u);
  assert.match(this.notes, /^# omp-spec-kit v0\.3\.1$/mu);
  assert.match(this.notes, new RegExp(this.release.candidate.archive.sha256, "u"));
  assert.equal(this.notes.includes("v0.1.0"), false);
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

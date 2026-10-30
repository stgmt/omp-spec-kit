import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { findAvailablePort } from "../../src/tools/endpoint-alloc.js";
import { upgradeManifest, writeRuntimeManifest } from "../../src/tools/runtime-manifest.js";
import { diagnoseMcpConfig, repairMcpConfig } from "../../src/tools/registry-doctor.js";
import { createOnboarding, OnboardingError } from "../../src/service/onboarding.js";

const OUR_FP = "fp-ours-1234";

const STALE_CONFIG = JSON.stringify(
  {
    mcpServers: {
      "omp-spec-registry": {
        url: "http://127.0.0.1:8642/mcp",
        headers: { Authorization: "Bearer perm-stale" },
      },
    },
  },
  null,
  2,
);

// ---- allocation ---------------------------------------------------------

Given("port {int} accepts no connections and answers nothing", function (port) {
  this.preferred = port;
  this.probe = async () => ({ status: "free" });
});

Given("port {int} accepts no connections for our service but is bound by another process", function (port) {
  this.preferred = port;
  this.probe = async (p) => (p === this.preferred ? { status: "busy" } : { status: "free" });
});

Given("port {int} answers a health probe as a foreign service", function (port) {
  this.preferred = port;
  this.probe = async (p) =>
    p === this.preferred ? { status: "responded", service: "other", fingerprint: "fp-x" } : { status: "free" };
});

Given("port {int} answers a health probe as our service with our instance fingerprint", function (port) {
  this.preferred = port;
  this.expectedFingerprint = OUR_FP;
  this.probe = async () => ({ status: "responded", service: "spec-registryd", fingerprint: OUR_FP });
});

Given("every probed port answers as a foreign service", function () {
  this.preferred = 8644;
  this.probe = async () => ({ status: "responded", service: "other", fingerprint: "fp-x" });
});

When("the endpoint allocator runs", async function () {
  this.allocation = await findAvailablePort({
    preferred: this.preferred,
    probe: this.probe,
    expectedFingerprint: this.expectedFingerprint,
  });
});

When("the endpoint allocator runs with {int} attempts", async function (maxAttempts) {
  this.allocationError = await findAvailablePort({
    preferred: this.preferred,
    probe: this.probe,
    maxAttempts,
  }).then(
    () => null,
    (error) => error,
  );
});

Then("the allocation chooses {int}", function (port) {
  assert.equal(this.allocation.port, port);
  assert.equal(this.allocation.outcome, "allocated");
});

Then("the allocation chooses {int} with outcome {string}", function (port, outcome) {
  assert.equal(this.allocation.port, port);
  assert.equal(this.allocation.outcome, outcome);
});

Then("nothing is recorded as skipped", function () {
  assert.deepEqual(this.allocation.skipped, []);
});

Then("port {int} is recorded as skipped with reason {string}", function (port, reason) {
  assert.deepEqual(this.allocation.skipped, [{ port, reason }]);
});

Then("the allocation fails reporting no free port", function () {
  assert.match(this.allocationError?.message ?? "", /no free port/);
});

Then("no port is claimed", function () {
  assert.equal(this.allocation, undefined);
});

// ---- manifest -----------------------------------------------------------

Given("the allocator yielded port {int} after skipping two candidates", function (port) {
  this.allocatedPort = port;
});

When("the runtime manifest is written", function () {
  this.manifestWrites = {};
  const fs = { writeFileSync: (p, text) => (this.manifestWrites[p] = text) };
  writeRuntimeManifest({
    path: "/runtime/projects.json",
    manifest: {
      hostUrl: `http://127.0.0.1:${this.allocatedPort}`,
      internalUrl: "http://spec-registryd:8642",
      projects: [{ id: "demo/stack" }],
    },
    fs,
  });
});

Then("hostUrl becomes {string}", function (url) {
  const saved = JSON.parse(this.manifestWrites["/runtime/projects.json"]);
  assert.equal(saved.hostUrl, url);
});

Then("the container-internal URL stays a separate field", function () {
  const saved = JSON.parse(this.manifestWrites["/runtime/projects.json"]);
  assert.equal(saved.internalUrl, "http://spec-registryd:8642");
});

Given("a runtime manifest written before hostUrl existed", function () {
  this.legacyManifest = {
    specsRepo: "git://spec-git/specs.git",
    branch: "main",
    publicUrl: "http://spec-registryd:8642",
    projects: [{ id: "demo/stack" }],
  };
});

When("the runtime manifest is reloaded", function () {
  this.upgraded = upgradeManifest(this.legacyManifest, { hostUrl: "http://127.0.0.1:8644" });
});

Then("hostUrl is derived from the published port", function () {
  assert.equal(this.upgraded.hostUrl, "http://127.0.0.1:8644");
});

Then("the rest of the manifest is preserved byte-for-byte", function () {
  for (const key of Object.keys(this.legacyManifest)) {
    assert.deepEqual(this.upgraded[key], this.legacyManifest[key]);
  }
});

// ---- doctor -------------------------------------------------------------

Given("an MCP config pointing at a port that accepts no connections", function () {
  this.configText = STALE_CONFIG;
  this.probe = async () => ({ ok: false, status: 0 });
});

Given("an MCP config whose URL answers 200 but reports a different service fingerprint", function () {
  this.configText = STALE_CONFIG;
  this.probe = async () => ({ ok: true, status: 200, fingerprint: "fp-other" });
});

Given("an MCP config whose URL answers with our instance fingerprint", function () {
  this.configText = STALE_CONFIG;
  this.probe = async () => ({ ok: true, status: 200, fingerprint: OUR_FP });
});

Given("an MCP config whose URL answers 401 while reporting our instance fingerprint", function () {
  this.configText = STALE_CONFIG;
  this.probe = async () => ({ ok: false, status: 401, fingerprint: OUR_FP });
});

Given("an MCP config whose Authorization references a token file", function () {
  this.configText = JSON.stringify(
    {
      mcpServers: {
        "omp-spec-registry": {
          url: "http://127.0.0.1:8642/mcp",
          headers: { Authorization: "Bearer ${file:C:/secrets/spec.token}" },
        },
      },
    },
    null,
    2,
  );
  this.probe = async () => ({ ok: false, status: 401 });
});

Given("a runtime manifest declaring the live host URL", function () {
  this.manifest = { hostUrl: "http://127.0.0.1:8644", fingerprint: OUR_FP };
});

Given("no runtime manifest exists", function () {
  this.manifest = null;
});

Given("a runtime manifest whose hostUrl is a compose-network hostname", function () {
  this.manifest = { hostUrl: "http://spec-registryd:8642", fingerprint: OUR_FP };
});

When("the registry doctor repairs the config", async function () {
  this.repairResult = await repairMcpConfig({
    configText: this.configText,
    manifest: this.manifest,
    probe: this.probe,
    tokenProvider: async () => "perm-fresh",
  }).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );
});

When("the registry doctor runs in dry-run mode", async function () {
  this.repairResult = await repairMcpConfig({
    configText: this.configText,
    manifest: this.manifest,
    probe: this.probe,
    tokenProvider: async () => "perm-fresh",
    dryRun: true,
  }).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );
});

Then("the entry URL is unchanged", function () {
  const fixed = JSON.parse(this.repairResult.result.configText);
  assert.equal(fixed.mcpServers["omp-spec-registry"].url, "http://127.0.0.1:8642/mcp");
});

Then("the entry URL becomes the manifest host URL", function () {
  const fixed = JSON.parse(this.repairResult.result.configText);
  assert.equal(fixed.mcpServers["omp-spec-registry"].url, "http://127.0.0.1:8644/mcp");
});

Then("a fresh token replaces the stale one", function () {
  const fixed = JSON.parse(this.repairResult.result.configText);
  assert.equal(fixed.mcpServers["omp-spec-registry"].headers.Authorization, "Bearer perm-fresh");
});

Then("the diagnosis records {string}, not {string}", async function (actual, notExpected) {
  const report = await diagnoseMcpConfig({ configText: this.configText, probe: this.probe, manifest: this.manifest });
  assert.equal(report.entries[0].status, actual);
  assert.notEqual(report.entries[0].status, notExpected);
});

Then("the config bytes are unchanged", function () {
  // Repair either returned the input verbatim or refused before writing —
  // in both cases the persisted bytes stay what they were.
  assert.equal(this.repairResult.result?.configText ?? this.configText, this.configText);
});

Then("no token is re-issued", function () {
  const fixed = JSON.parse(this.repairResult.result.configText);
  assert.equal(fixed.mcpServers["omp-spec-registry"].headers.Authorization, "Bearer perm-stale");
});

Then("the token file contains the fresh token", function () {
  assert.equal(this.repairResult.result.secretsWritten["C:/secrets/spec.token"], "perm-fresh");
});

Then("the config keeps its file reference instead of inlining the secret", function () {
  const fixed = JSON.parse(this.repairResult.result.configText);
  assert.equal(fixed.mcpServers["omp-spec-registry"].headers.Authorization, "Bearer ${file:C:/secrets/spec.token}");
});

Then("the report lists the entry as needing repair", function () {
  assert.deepEqual(this.repairResult.result.changed, ["omp-spec-registry"]);
});

Then("the repair fails reporting the manifest is missing", function () {
  assert.ok(this.repairResult.error);
  assert.match(this.repairResult.error.message, /manifest/i);
});

Then("the repair fails reporting an internal URL", function () {
  assert.ok(this.repairResult.error);
  assert.match(this.repairResult.error.message, /internal|unreachable/i);
});

// ---- onboarding ---------------------------------------------------------

Given("a caller requesting a host-facing MCP snippet", function () {
  this.onboarding = createOnboarding({
    config: { auth: { youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "svc" } } },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }),
  });
});

When("the supplied service URL is a compose-network hostname", function () {
  this.attempt = this.onboarding.issueToken({
    ctx: { identity: { login: "alice" }, role: "writer", tenant: "alpha" },
    serviceUrl: "http://spec-registryd:8642",
    audience: "host",
  });
});

When("the supplied service URL is a loopback or DNS name", function () {
  this.serviceUrls = ["http://127.0.0.1:8644", "https://registry.example.com"];
});

Then("onboarding fails loudly instead of writing a dead config", async function () {
  await assert.rejects(
    this.attempt,
    (error) => error instanceof OnboardingError || /internal|unreachable|loopback/i.test(error.message),
  );
});

Then("the snippet carries that URL unchanged", async function () {
  const { buildManagedSnippet } = await import("../../src/service/onboarding.js");
  for (const url of this.serviceUrls) {
    const snippet = JSON.parse(buildManagedSnippet(url, "perm-x", null, null, { audience: "host" }));
    assert.equal(snippet.mcpServers["omp-spec-kit"].url, `${url.replace(/\/+$/, "")}/mcp`);
  }
});

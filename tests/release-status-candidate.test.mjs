import assert from "node:assert/strict";
import test from "node:test";

import { assertCandidateSurface } from "../scripts/candidate-status.mjs";
import { expectedManagerToolCount } from "../scripts/verify-release.mjs";
import { TOOL_CONTRACTS } from "../src/adapters/tool-contracts.js";

const TEN_TOOL_CANDIDATE = Object.freeze({
  tag: "v2.8.0",
  status: {
    state: "CANDIDATE",
    public: false,
    installable: false,
    surface: "SAFE_AUTHORING",
    toolCount: 10,
  },
});

test("candidate surface gate accepts a 2.8.x CANDIDATE release-status fixture", () => {
  assert.doesNotThrow(() => assertCandidateSurface("2.8.0", TEN_TOOL_CANDIDATE));
  assert.doesNotThrow(() => assertCandidateSurface("2.8.1", TEN_TOOL_CANDIDATE));
});

test("candidate surface gate rejects a version outside the whitelist", () => {
  assert.throws(
    () => assertCandidateSurface("2.9.9", TEN_TOOL_CANDIDATE),
    /evidence\/navigation surface/iu,
  );
});

test("candidate surface gate rejects a whitelisted version with drifted surface", () => {
  const drifted = {
    ...TEN_TOOL_CANDIDATE,
    status: { ...TEN_TOOL_CANDIDATE.status, public: true },
  };
  assert.throws(
    () => assertCandidateSurface("2.8.0", drifted),
    /10-tool consolidated surface/u,
  );
});

test("expectedManagerToolCount(2.8.x) matches the live manager tool catalog", () => {
  assert.equal(expectedManagerToolCount("2.8.0"), TOOL_CONTRACTS.length);
  assert.equal(expectedManagerToolCount("2.8.1"), TOOL_CONTRACTS.length);
  assert.equal(TOOL_CONTRACTS.length, 10);
});

test("expectedManagerToolCount falls back for unknown versions", () => {
  assert.equal(expectedManagerToolCount("9.9.9"), 8);
});

const candidateFixture = (overrides = {}) => ({
  tag: "v-test",
  status: {
    state: "CANDIDATE",
    public: false,
    installable: false,
    surface: "SAFE_AUTHORING",
    toolCount: 10,
    ...overrides,
  },
});

test("candidate surface gate accepts the 0.10.1 ten-tool arm", () => {
  assert.doesNotThrow(() => assertCandidateSurface("0.10.1", candidateFixture()));
  assert.throws(
    () => assertCandidateSurface("0.10.1", candidateFixture({ public: true })),
    /10-tool consolidated surface/u,
  );
});

test("candidate surface gate accepts the 0.8.x eleven-tool arm", () => {
  const elevenTool = candidateFixture({ toolCount: 11 });
  assert.doesNotThrow(() => assertCandidateSurface("0.8.1", elevenTool));
  assert.doesNotThrow(() => assertCandidateSurface("0.8.2", elevenTool));
  assert.throws(
    () => assertCandidateSurface("0.8.1", candidateFixture({ toolCount: 10 })),
    /11-tool consolidated surface/u,
  );
});

test("candidate surface gate accepts the 0.6/0.7 forty-nine-tool arm", () => {
  const fortyNineTool = candidateFixture({ toolCount: 49 });
  assert.doesNotThrow(() => assertCandidateSurface("0.6.0", fortyNineTool));
  assert.doesNotThrow(() => assertCandidateSurface("0.7.0", fortyNineTool));
  assert.throws(
    () => assertCandidateSurface("0.6.0", candidateFixture({ installable: true })),
    /49-tool safe authoring surface/u,
  );
});

test("candidate surface gate falls through to the v0.5 EVIDENCE_NAVIGATION arm", () => {
  const v05 = candidateFixture({ surface: "EVIDENCE_NAVIGATION", toolCount: 27 });
  assert.doesNotThrow(() => assertCandidateSurface("0.5.4", v05));
  assert.throws(
    () => assertCandidateSurface("0.5.4", candidateFixture()),
    /evidence\/navigation surface/iu,
  );
});

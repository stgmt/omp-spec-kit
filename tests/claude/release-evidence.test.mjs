import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createCandidateWorld, evaluateCandidate, readVerifiedCucumberFixture } from "../helpers/release-candidate-world.mjs";

// Drives the release evaluator over a real candidate world and checks the
// evidence identity gate: the schema, the exact top-level key set, and the
// tag/commit identity that every evidence file must carry.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const IDENTITY_BLOCKER = "evidence-identity-mismatch";
const { version } = JSON.parse(readFileSync(path.join(repositoryRoot, "plugins", "omp-spec-kit", "package.json"), "utf8"));
let tempRoot;
let world;
let original;

before(async () => {
  tempRoot = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-evidence-")));
  world = await createCandidateWorld(repositoryRoot, tempRoot, await readVerifiedCucumberFixture(repositoryRoot), `v${version}`);
  original = readFileSync(world.evidencePath, "utf8");
});

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

async function evaluateWithEvidence(mutate) {
  const evidence = JSON.parse(original);
  mutate(evidence);
  writeFileSync(world.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  try {
    return await evaluateCandidate(world, repositoryRoot);
  } finally {
    writeFileSync(world.evidencePath, original);
  }
}

describe("release evidence identity gate", () => {
  it("does not raise the identity blocker for evidence that matches the candidate", async () => {
    const result = await evaluateWithEvidence(() => {});
    assert.equal(result.blocking.includes(IDENTITY_BLOCKER), false, JSON.stringify(result.blocking));
  });

  it("rejects evidence whose schema is not omp-spec-kit-release-evidence@3", async () => {
    const result = await evaluateWithEvidence((evidence) => {
      evidence.schema = "omp-spec-kit-release-evidence@2";
    });
    assert.equal(result.eligible, false);
    assert.ok(result.blocking.includes(IDENTITY_BLOCKER), JSON.stringify(result.blocking));
  });

  it("rejects evidence that carries an extra top-level key", async () => {
    const result = await evaluateWithEvidence((evidence) => {
      evidence.note = "unreviewed";
    });
    assert.equal(result.eligible, false);
    assert.ok(result.blocking.includes(IDENTITY_BLOCKER), JSON.stringify(result.blocking));
  });

  it("rejects evidence whose tag differs from the candidate tag", async () => {
    const result = await evaluateWithEvidence((evidence) => {
      evidence.tag = "v9.9.9";
    });
    assert.equal(result.eligible, false);
    assert.ok(result.blocking.includes(IDENTITY_BLOCKER), JSON.stringify(result.blocking));
  });

  it("rejects evidence whose peeled commit differs from the candidate commit", async () => {
    const result = await evaluateWithEvidence((evidence) => {
      evidence.commit = "f".repeat(40);
    });
    assert.equal(result.eligible, false);
    assert.ok(result.blocking.includes(IDENTITY_BLOCKER), JSON.stringify(result.blocking));
  });
});

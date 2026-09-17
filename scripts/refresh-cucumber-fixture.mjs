// Regenerate tests/fixtures/release-candidate/cucumber-messages.* from the
// canonical stream produced by `bash scripts/docker-bdd.sh`
// (.omp-spec-kit/evidence/last-test-run.ndjson). Rebuilds the source-input
// manifest (every tracked producer input under the Dockerfile COPY roots,
// minus this fixture directory, generated build output, and vendored trees
// pinned by their lockfiles) and the closed v2 provenance receipt, then
// refreshes the README evidence table. Run after any producer-side change;
// the @release-candidate-regression loader re-hashes every listed input.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "release-candidate");
const CANONICAL_STREAM = path.join(ROOT, ".omp-spec-kit", "evidence", "last-test-run.ndjson");
const FIXTURE_NAME = "cucumber-messages.ndjson";
const MANIFEST_NAME = "cucumber-messages.inputs.json";
const PROVENANCE_NAME = "cucumber-messages.provenance.json";
const DOCKER_IMAGE = "omp-spec-kit-bdd:local";
const CAPTURE_COMMAND = "bash scripts/docker-bdd.sh";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const tracked = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);

// Single-file COPY sources in tests/distribution/Dockerfile (lines whose
// sources are files rather than directories).
const dockerfileSingles = () => {
  const dockerfile = readFileSync(path.join(ROOT, "tests", "distribution", "Dockerfile"), "utf8");
  const singles = new Set();
  for (const line of dockerfile.split(/\r?\n/)) {
    const match = /^COPY\s+(.+?)\s+\.\/?(.*)$/u.exec(line.trim());
    if (!match || line.startsWith("COPY --from=")) continue;
    for (const source of match[1].split(/\s+/u)) {
      if (source.endsWith("/")) continue;
      singles.add(source);
    }
  }
  return singles;
};

const isProducerInput = (repoPath, singles) => {
  if (singles.has(repoPath)) return true;
  if (!/^(?:\.omp-plugin|plugins|scripts|src|tests)\//u.test(repoPath)) return false;
  if (repoPath.startsWith("tests/fixtures/release-candidate/")) return false;
  if (repoPath.startsWith("plugins/omp-spec-kit/dist/")) return false;
  if (repoPath.startsWith("tests/fixtures/omp-discovery-runtime/")) {
    return ["package.json", "bun.lock"].includes(path.basename(repoPath));
  }
  return true;
};

const main = () => {
  const streamBytes = readFileSync(CANONICAL_STREAM);
  const prior = JSON.parse(readFileSync(path.join(FIXTURE_DIR, PROVENANCE_NAME), "utf8"));
  const singles = dockerfileSingles();
  const entries = tracked()
    .filter((repoPath) => isProducerInput(repoPath, singles))
    .sort()
    .map((repoPath) => {
      const bytes = readFileSync(path.join(ROOT, repoPath));
      return { path: repoPath, bytes: bytes.length, sha256: sha256(bytes) };
    });
  const aggregateSha256 = sha256(
    Buffer.from(entries.map((e) => `${e.path}\0${e.sha256}\0${e.bytes}\n`).join(""), "utf8"),
  );
  const manifest = JSON.stringify(
    {
      schema: "omp-spec-kit-cucumber-source-inputs@1",
      algorithm: "sha256(path NUL sha256 NUL bytes LF), paths code-point sorted",
      aggregateSha256,
      entries,
    },
    null,
    2,
  ) + "\n";

  const frames = streamBytes.toString("utf8").trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
  const meta = frames.find((frame) => frame.meta !== undefined);
  const cucumberVersion = meta?.meta?.implementation?.version;
  if (!cucumberVersion) throw new Error("canonical stream is missing the meta implementation version");
  const imageId = execFileSync("docker", ["image", "inspect", DOCKER_IMAGE, "--format", "{{.Id}}"], {
    encoding: "utf8",
  }).trim();
  if (!/^sha256:[0-9a-f]{64}$/u.test(imageId)) throw new Error(`unexpected image id ${imageId}`);

  const provenance = JSON.stringify(
    {
      schema: "omp-spec-kit-cucumber-fixture-provenance@2",
      fixture: FIXTURE_NAME,
      sha256: sha256(streamBytes),
      repositoryCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
      sourceState: "working-tree-content-addressed",
      parentFixtureSha256: prior.sha256,
      sourceManifest: MANIFEST_NAME,
      sourceManifestSha256: sha256(Buffer.from(manifest, "utf8")),
      sourceInputsSha256: aggregateSha256,
      sourceInputCount: entries.length,
      dockerImageDigest: imageId,
      cucumberVersion,
      captureCommand: CAPTURE_COMMAND,
      capturedAt: new Date().toISOString().slice(0, 10),
      scenarioCount: frames.filter((frame) => frame.pickle !== undefined).length,
      stepCount: frames.filter((frame) => frame.testStepFinished !== undefined).length,
    },
    null,
    2,
  ) + "\n";

  copyFileSync(CANONICAL_STREAM, path.join(FIXTURE_DIR, FIXTURE_NAME));
  writeFileSync(path.join(FIXTURE_DIR, MANIFEST_NAME), manifest);
  writeFileSync(path.join(FIXTURE_DIR, PROVENANCE_NAME), provenance);
  const parsed = JSON.parse(provenance);

  const readmePath = path.join(FIXTURE_DIR, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const table = [
    `| Fixture SHA-256 | \`${parsed.sha256}\` |`,
    `| Repository base commit | \`${parsed.repositoryCommit}\` |`,
    "| Source state | `working-tree-content-addressed` |",
    `| Parent fixture SHA-256 | \`${parsed.parentFixtureSha256}\` |`,
    `| Source inputs | ${parsed.sourceInputCount} files; aggregate \`${parsed.sourceInputsSha256}\` |`,
    `| Source manifest SHA-256 | \`${parsed.sourceManifestSha256}\` |`,
    `| Docker image digest | \`${parsed.dockerImageDigest}\` |`,
    `| Cucumber version | \`@cucumber/cucumber\` \`${parsed.cucumberVersion}\` |`,
    `| Capture command | \`${parsed.captureCommand}\` |`,
    `| Capture date | \`${parsed.capturedAt}\` |`,
    `| Executed scenarios | \`${parsed.scenarioCount}\` |`,
    `| Completed steps | \`${parsed.stepCount}\` |`,
  ].join("\n");
  const updated = readme.replace(/\| Fixture SHA-256.*?\| Completed steps \|[^\n]*\|/us, table);
  if (updated === readme) throw new Error("README evidence table did not match the expected rows");
  writeFileSync(readmePath, updated);

  console.log(`[cucumber-fixture] ${parsed.scenarioCount} scenarios / ${parsed.stepCount} steps, ${entries.length} inputs, stream ${parsed.sha256.slice(0, 12)}…`);
};

main();

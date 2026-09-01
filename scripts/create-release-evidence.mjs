import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCandidateShape, canonicalJson, fail, isSha256, parseArgs, readStrictJson, resolveContainedRegularFile, sha256 } from "./release-candidate-utils.mjs";

const MRI_REQUIREMENTS = Object.freeze(Array.from({ length: 6 }, (_, index) => `plugin-distribution:FR-${index + 19}`));

export class CucumberEvidenceError extends Error {
  constructor(code, message) {
    super(`release-candidate: Cucumber Message artifact ${message}`);
    this.name = "CucumberEvidenceError";
    this.code = code;
  }
}

function cucumberEvidenceFail(code, message) {
  throw new CucumberEvidenceError(code, message);
}

function identity(candidate, catalogDigest) {
  return {
    version: candidate.version,
    tag: candidate.tag,
    commit: candidate.commit,
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    archiveSha256: candidate.archive.sha256,
    catalogDigest,
  };
}

async function copyReceipt(source, outputDirectory, outputName) {
  const targetRelative = `receipts/${outputName}`;
  const target = path.join(outputDirectory, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { force: false, errorOnExist: true, dereference: false });
  const bytes = await readFile(target);
  return { status: "present", path: targetRelative, digest: sha256(bytes) };
}

async function optionalReceipt(source, outputDirectory, outputName) {
  if (!source) return { status: "missing" };
  return copyReceipt(source, outputDirectory, outputName);
}


export async function copyUntrustedDistributionEvidenceBundle(source, outputDirectory) {
  if (!source) return { status: "missing" };
  const sourceDirectory = path.dirname(source);
  const input = await readStrictJson(source, "distribution evidence");
  if (!Array.isArray(input.records)) return copyReceipt(source, outputDirectory, "distribution-evidence.json");
  const copied = structuredClone(input);
  for (const [index, record] of copied.records.entries()) {
    const ref = record?.receipt;
    if (!ref || ref.status !== "present" || typeof ref.path !== "string" || !isSha256(ref.digest)) continue;
    // Byte-identity with the attested subject: every receipt is copied
    // byte-for-byte to its canonical name, but when the producer already used
    // the canonical scheme the record's reference is left untouched, so the
    // copied bundle serializes byte-identically to the signed subject and
    // gh attestation verify checks exactly these bytes. Legacy (never
    // attested) naming schemes get their references rewritten as before.
    const sourceReceipt = await resolveContainedRegularFile(sourceDirectory, ref.path, `distribution receipt ${index}`);
    const bytes = await readFile(sourceReceipt);
    if (sha256(bytes) !== ref.digest) fail(`distribution receipt ${index} digest does not match its declaration`);
    const canonicalTargetRelative = `receipts/distribution/${index}-${ref.digest}.json`;
    const target = path.join(outputDirectory, canonicalTargetRelative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    if (ref.path !== canonicalTargetRelative) {
      record.receipt = { status: "present", path: canonicalTargetRelative, digest: ref.digest };
    }
  }
  const targetRelative = "receipts/distribution-evidence.json";
  const target = path.join(outputDirectory, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, canonicalJson(copied), "utf8");
  const bytes = await readFile(target);
  return { status: "present", path: targetRelative, digest: sha256(bytes) };
}

export function requiredScenarioMultiplicity(featureSource) {
  const required = new Map();
  let pendingTags = [];
  let current = null;

  const finish = () => {
    if (current === null) return;
    const count = current.outline ? current.exampleRows : 1;
    if (count < 1) fail(`release-evidence outline ${current.scenarioId} has no example rows`);
    if (required.has(current.scenarioId)) fail(`duplicate release-evidence scenario id ${current.scenarioId}`);
    required.set(current.scenarioId, count);
    current = null;
  };

  for (const rawLine of featureSource.split(/\r?\n/u)) {
    const trimmed = rawLine.trim();
    const indent = rawLine.length - rawLine.trimStart().length;
    if (trimmed.startsWith("@") && indent <= 2) {
      finish();
      pendingTags = trimmed.split(/\s+/u).filter((tag) => tag.startsWith("@"));
      continue;
    }
    const scenario = trimmed.match(/^Scenario( Outline)?:/u);
    if (scenario) {
      finish();
      if (pendingTags.includes("@release-evidence")) {
        const scenarioId = pendingTags.find((tag) => tag.startsWith("@id:"))?.slice(4);
        if (!scenarioId) fail(`release-evidence scenario has no id near ${trimmed}`);
        current = { scenarioId, outline: scenario[1] !== undefined, exampleRows: 0, inExamples: false, headerSeen: false };
      }
      pendingTags = [];
      continue;
    }
    if (current === null || !current.outline) continue;
    if (/^Examples:/u.test(trimmed)) {
      current.inExamples = true;
      current.headerSeen = false;
      continue;
    }
    if (current.inExamples && trimmed.startsWith("|")) {
      if (current.headerSeen) current.exampleRows += 1;
      else current.headerSeen = true;
    }
  }
  finish();
  if (required.size === 0) fail("release BDD feature must contain release-evidence scenarios");
  return new Map([...required.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

export function cucumberMessages(bytes, requiredScenarioCounts) {
  const required = requiredScenarioCounts instanceof Map
    ? new Map(requiredScenarioCounts)
    : new Map([...requiredScenarioCounts].map((scenarioId) => [scenarioId, 1]));
  for (const [scenarioId, count] of required) {
    if (typeof scenarioId !== "string" || !Number.isInteger(count) || count < 1) {
      cucumberEvidenceFail("INVALID_REQUIRED_SCENARIO_SET", `has invalid required multiplicity for ${String(scenarioId)}`);
    }
  }
  const messages = [];
  for (const [index, line] of bytes.toString("utf8").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      cucumberEvidenceFail("MALFORMED_NDJSON_FRAME", `is not strict NDJSON at line ${index + 1}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      cucumberEvidenceFail("NON_OBJECT_FRAME", `has a non-object frame at line ${index + 1}`);
    }
    messages.push(parsed);
  }
  if (messages.length === 0) cucumberEvidenceFail("EMPTY_STREAM", "is empty");
  if (messages.every((envelope) => Object.keys(envelope).length === 1 && envelope.meta !== undefined)) {
    cucumberEvidenceFail("META_ONLY_STREAM", "contains only meta frames");
  }

  const pickles = new Map();
  const testCases = new Map();
  const starts = new Map();
  const statuses = new Map();
  const finished = new Map();
  const runStarts = new Map();
  const runFinished = [];
  const setUnique = (map, id, value, code, label) => {
    if (typeof id !== "string" || id.length === 0 || map.has(id)) {
      cucumberEvidenceFail(code, `has duplicate or missing ${label} id ${String(id)}`);
    }
    map.set(id, value);
  };
  for (const [sequence, envelope] of messages.entries()) {
    if (envelope.pickle) setUnique(pickles, envelope.pickle.id, envelope.pickle, "DUPLICATE_PICKLE", "pickle");
    if (envelope.testCase) setUnique(testCases, envelope.testCase.id, envelope.testCase, "DUPLICATE_TEST_CASE", "testCase");
    if (envelope.testCaseStarted) setUnique(starts, envelope.testCaseStarted.id, { ...envelope.testCaseStarted, sequence }, "DUPLICATE_TEST_CASE_STARTED", "testCaseStarted");
    if (envelope.testStepFinished) {
      const id = envelope.testStepFinished.testCaseStartedId;
      const list = statuses.get(id) ?? [];
      list.push(envelope.testStepFinished.testStepResult?.status);
      statuses.set(id, list);
    }
    if (envelope.testCaseFinished) {
      const id = envelope.testCaseFinished.testCaseStartedId;
      if (finished.has(id)) cucumberEvidenceFail("DUPLICATE_TEST_CASE_FINISHED", `has duplicate testCaseFinished for ${id}`);
      finished.set(id, envelope.testCaseFinished);
    }
    if (envelope.testRunStarted) setUnique(runStarts, envelope.testRunStarted.id, envelope.testRunStarted, "DUPLICATE_TEST_RUN_STARTED", "testRunStarted");
    if (envelope.testRunFinished) runFinished.push({ ...envelope.testRunFinished, sequence });
  }
  if (runFinished.length > 1) cucumberEvidenceFail("DUPLICATE_TEST_RUN_FINISHED", "has more than one testRunFinished");
  if (
    runFinished.length !== 1 ||
    runFinished[0].success !== true ||
    !runStarts.has(runFinished[0].testRunStartedId) ||
    runFinished[0].sequence !== messages.length - 1
  ) {
    cucumberEvidenceFail("INVALID_FINAL_TEST_RUN", "lacks one final successful testRunFinished");
  }

  const passed = [];
  for (const [scenarioId, expectedPickleCount] of required) {
    const scenarioPickles = [...pickles.values()].filter((value) =>
      value.tags?.some((tag) => tag.name === `@id:${scenarioId}`),
    );
    if (scenarioPickles.length === 0) {
      cucumberEvidenceFail("MISSING_PICKLE", `has no pickle for ${scenarioId}`);
    }
    if (scenarioPickles.length !== expectedPickleCount) {
      cucumberEvidenceFail(
        "SCENARIO_MULTIPLICITY_MISMATCH",
        `expected ${expectedPickleCount} pickles for ${scenarioId} but found ${scenarioPickles.length}`,
      );
    }
    for (const pickle of scenarioPickles) {
      const matchingTestCases = [...testCases.values()].filter((value) => value.pickleId === pickle.id);
      if (matchingTestCases.length === 0) {
        cucumberEvidenceFail("MISSING_TEST_CASE", `has no testCase for ${scenarioId}`);
      }
      if (matchingTestCases.length > 1) {
        cucumberEvidenceFail("DUPLICATE_TEST_CASE", `has ${matchingTestCases.length} testCases for ${scenarioId} pickle ${pickle.id}`);
      }
      const testCase = matchingTestCases[0];
      const attempts = [...starts.entries()].filter(([, start]) => start.testCaseId === testCase.id);
      if (attempts.length === 0) cucumberEvidenceFail("MISSING_TEST_CASE_STARTED", `has no testCaseStarted for ${scenarioId}`);
      const completedAttempts = attempts.filter(([startId]) => finished.has(startId));
      if (completedAttempts.length === 0) cucumberEvidenceFail("MISSING_TEST_CASE_FINISHED", `has no testCaseFinished for ${scenarioId}`);
      const terminalAttempts = completedAttempts
        .filter(([startId]) => finished.get(startId).willBeRetried === false)
        .sort(([, left], [, right]) => (right.attempt ?? 0) - (left.attempt ?? 0) || right.sequence - left.sequence);
      if (terminalAttempts.length === 0) cucumberEvidenceFail("RETRY_ONLY_TERMINAL_PATH", `has no non-retried terminal attempt for ${scenarioId}`);
      if (terminalAttempts.length > 1) cucumberEvidenceFail("MULTIPLE_TERMINAL_ATTEMPTS", `has ${terminalAttempts.length} terminal attempts for ${scenarioId}`);
      const [startId] = terminalAttempts[0];
      const stepStatuses = statuses.get(startId) ?? [];
      if (stepStatuses.length === 0) cucumberEvidenceFail("MISSING_TEST_STEP_FINISHED", `has no testStepFinished for ${scenarioId}`);
      if (stepStatuses.some((status) => status !== "PASSED")) cucumberEvidenceFail("NON_PASSING_TERMINAL_STEP", `records a non-passing terminal step for ${scenarioId}`);
    }
    passed.push(scenarioId);
  }
  return passed;
}

export async function createReleaseEvidence({
  candidatePath,
  publicSafetyPath,
  cucumberMessagesPath,
  lifecycleDirectory,
  outputDirectory,
  mriDiscoveryPath,
  distributionEvidencePath,
  distributionTrust = "untrusted-self-attested",
  repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
}) {
  if (!["untrusted-self-attested", "github-artifact-attestation"].includes(distributionTrust)) fail(`unsupported --distribution-trust value: ${distributionTrust}`);
  const candidate = assertCandidateShape(await readStrictJson(candidatePath, "candidate manifest"), "candidate manifest");
  await mkdir(outputDirectory, { recursive: true });
  const catalogDigest = sha256(await readFile(path.join(repositoryRoot, ".omp-plugin", "marketplace.json")));
  const requiredScenarios = requiredScenarioMultiplicity(await readFile(path.join(repositoryRoot, ".specs", "plugin-distribution", "plugin-distribution.feature"), "utf8"));
  const sourceMessageBytes = await readFile(cucumberMessagesPath);
  const scenarioIds = cucumberMessages(sourceMessageBytes, requiredScenarios);
  const messageRelativePath = "messages/cucumber.ndjson";
  const messagePath = path.join(outputDirectory, messageRelativePath);
  await mkdir(path.dirname(messagePath), { recursive: true });
  await writeFile(messagePath, sourceMessageBytes);
  const messageBytes = await readFile(messagePath);
  const bddReceipt = {
    schema: "omp-spec-kit-bdd-receipt@1",
    status: "passed",
    ...identity(candidate, catalogDigest),
    messagePath: messageRelativePath,
    messageDigest: sha256(messageBytes),
    scenarioIds,
  };
  const bddReceiptPath = path.join(outputDirectory, "receipts", "docker-bdd.json");
  await mkdir(path.dirname(bddReceiptPath), { recursive: true });
  await writeFile(bddReceiptPath, canonicalJson(bddReceipt), "utf8");
  const checks = {
    publicSafety: await copyReceipt(publicSafetyPath, outputDirectory, "public-safety.json"),
    dockerBdd: await copyReceipt(bddReceiptPath, outputDirectory, "docker-bdd-copy.json"),
    priorV030: await copyReceipt(path.join(lifecycleDirectory, "prior-v0.3.0.json"), outputDirectory, "prior-v0.3.0.json"),
    upgradeFromV030: await copyReceipt(path.join(lifecycleDirectory, "upgrade-from-v0.3.0.json"), outputDirectory, "upgrade-from-v0.3.0.json"),
    rollbackToV030: await copyReceipt(path.join(lifecycleDirectory, "rollback-to-v0.3.0.json"), outputDirectory, "rollback-to-v0.3.0.json"),
  };
  const frReceipts = Object.create(null);
  for (const requirement of MRI_REQUIREMENTS) {
    const localRequirement = requirement.slice(requirement.lastIndexOf(":") + 1);
    frReceipts[requirement] = await copyReceipt(path.join(lifecycleDirectory, "fr", `${localRequirement}.json`), outputDirectory, `mri-${localRequirement}.json`);
  }
  const mriDiscovery = await optionalReceipt(mriDiscoveryPath, outputDirectory, "omp-discovery.json");
  const untrustedDistributionEvidence = await copyUntrustedDistributionEvidenceBundle(distributionEvidencePath, outputDirectory);
  const evidence = {
    schema: "omp-spec-kit-release-evidence@3",
    ...identity(candidate, catalogDigest),
    mri: { schema: "omp-spec-kit-mri-evidence@1", checks, frReceipts, discovery: mriDiscovery },
    distribution: { schema: "omp-spec-kit-distribution-evidence-input@1", trust: distributionTrust, receipt: untrustedDistributionEvidence },
  };
  const outputPath = path.join(outputDirectory, "evidence.json");
  await writeFile(outputPath, canonicalJson(evidence), "utf8");
  return { evidence, outputPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--candidate", "--public-safety", "--cucumber-messages", "--lifecycle-dir", "--output", "--mri-discovery", "--distribution-evidence", "--distribution-trust"]);
  for (const flag of ["--candidate", "--public-safety", "--cucumber-messages", "--lifecycle-dir", "--output", "--mri-discovery"]) {
    if (!args[flag]) fail(`${flag} is required`);
  }
  const distributionTrust = args["--distribution-trust"] ?? "untrusted-self-attested";
  if (!["untrusted-self-attested", "github-artifact-attestation"].includes(distributionTrust)) fail(`unsupported --distribution-trust value: ${distributionTrust}`);
  const { evidence } = await createReleaseEvidence({
    candidatePath: path.resolve(args["--candidate"]),
    publicSafetyPath: path.resolve(args["--public-safety"]),
    cucumberMessagesPath: path.resolve(args["--cucumber-messages"]),
    lifecycleDirectory: path.resolve(args["--lifecycle-dir"]),
    outputDirectory: path.resolve(args["--output"]),
    mriDiscoveryPath: path.resolve(args["--mri-discovery"]),
    distributionEvidencePath: args["--distribution-evidence"] ? path.resolve(args["--distribution-evidence"]) : undefined,
    distributionTrust,
  });
  process.stdout.write(canonicalJson(evidence));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

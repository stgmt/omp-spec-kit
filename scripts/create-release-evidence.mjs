import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCandidateShape, canonicalJson, fail, parseArgs, readStrictJson, sha256 } from "./release-candidate-utils.mjs";

const REQUIRED_FRS = Object.freeze(["FR-1", "FR-2", "FR-3", "FR-4", "FR-5", "FR-6"]);

function identity(candidate) {
  return {
    version: candidate.version,
    tag: candidate.tag,
    commit: candidate.commit,
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    archiveSha256: candidate.archive.sha256,
  };
}

async function copyReceipt(source, outputDirectory, outputName) {
  const targetRelative = `receipts/${outputName}`;
  const target = path.join(outputDirectory, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { force: false, errorOnExist: true, dereference: false });
  const bytes = await readFile(target);
  return { status: "passed", path: targetRelative, digest: sha256(bytes) };
}

function requiredScenarioIds(featureSource) {
  const ids = [];
  let tags = [];
  for (const line of featureSource.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@")) {
      tags = trimmed.split(/\s+/u).filter((tag) => tag.startsWith("@"));
      continue;
    }
    if (!/^Scenario(?: Outline)?:/u.test(trimmed)) continue;
    if (tags.includes("@release-evidence")) {
      const id = tags.find((tag) => tag.startsWith("@id:"))?.slice(4);
      if (!id) fail(`release-evidence scenario has no id near ${trimmed}`);
      ids.push(id);
    }
    tags = [];
  }
  if (ids.length === 0 || new Set(ids).size !== ids.length) fail("release BDD feature must contain unique release-evidence scenario ids");
  return ids.sort();
}

export function cucumberMessages(bytes, requiredIds) {
  const messages = [];
  for (const [index, line] of bytes.toString("utf8").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      fail(`Cucumber Message artifact is not strict NDJSON at line ${index + 1}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail(`Cucumber Message artifact has a non-object frame at line ${index + 1}`);
    }
    messages.push(parsed);
  }
  if (messages.length === 0) fail("Cucumber Message artifact is empty");

  const pickles = new Map();
  const testCases = new Map();
  const starts = new Map();
  const statuses = new Map();
  const finished = new Map();
  const runStarts = new Map();
  const runFinished = [];
  for (const [sequence, envelope] of messages.entries()) {
    if (envelope.pickle) pickles.set(envelope.pickle.id, envelope.pickle);
    if (envelope.testCase) testCases.set(envelope.testCase.id, envelope.testCase);
    if (envelope.testCaseStarted) starts.set(envelope.testCaseStarted.id, { ...envelope.testCaseStarted, sequence });
    if (envelope.testStepFinished) {
      const id = envelope.testStepFinished.testCaseStartedId;
      const list = statuses.get(id) ?? [];
      list.push(envelope.testStepFinished.testStepResult?.status);
      statuses.set(id, list);
    }
    if (envelope.testCaseFinished) finished.set(envelope.testCaseFinished.testCaseStartedId, envelope.testCaseFinished);
    if (envelope.testRunStarted) runStarts.set(envelope.testRunStarted.id, envelope.testRunStarted);
    if (envelope.testRunFinished) runFinished.push({ ...envelope.testRunFinished, sequence });
  }
  if (
    runFinished.length !== 1 ||
    runFinished[0].success !== true ||
    !runStarts.has(runFinished[0].testRunStartedId) ||
    runFinished[0].sequence !== messages.length - 1
  ) {
    fail("Cucumber Message artifact lacks one final successful testRunFinished");
  }

  const passed = [];
  for (const scenarioId of requiredIds) {
    const pickle = [...pickles.values()].find((value) => value.tags?.some((tag) => tag.name === `@id:${scenarioId}`));
    if (!pickle) fail(`Cucumber Message artifact has no pickle for ${scenarioId}`);
    const testCase = [...testCases.values()].find((value) => value.pickleId === pickle.id);
    if (!testCase) fail(`Cucumber Message artifact has no test case for ${scenarioId}`);
    const terminalAttempts = [...starts.entries()]
      .filter(([, start]) => start.testCaseId === testCase.id && finished.get(start.id)?.willBeRetried === false)
      .sort(([, left], [, right]) => (right.attempt ?? 0) - (left.attempt ?? 0) || right.sequence - left.sequence);
    if (terminalAttempts.length !== 1) {
      fail(`Cucumber Message artifact has ${terminalAttempts.length} terminal attempts for ${scenarioId}`);
    }
    const [startId] = terminalAttempts[0];
    const stepStatuses = statuses.get(startId) ?? [];
    if (stepStatuses.length === 0 || stepStatuses.some((status) => status !== "PASSED")) {
      fail(`Cucumber Message artifact records a non-passing terminal attempt for ${scenarioId}`);
    }
    passed.push(scenarioId);
  }
  return passed;
}

export async function createReleaseEvidence({ candidatePath, publicSafetyPath, cucumberMessagesPath, lifecycleDirectory, outputDirectory }) {
  const candidate = assertCandidateShape(await readStrictJson(candidatePath, "candidate manifest"), "candidate manifest");
  await mkdir(outputDirectory, { recursive: true });
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const requiredIds = requiredScenarioIds(await readFile(path.join(sourceRoot, ".specs", "mcp-release-integrity", "mcp-release-integrity.feature"), "utf8"));
  const sourceMessageBytes = await readFile(cucumberMessagesPath);
  const scenarioIds = cucumberMessages(sourceMessageBytes, requiredIds);
  const messageRelativePath = "messages/cucumber.ndjson";
  const messagePath = path.join(outputDirectory, messageRelativePath);
  await mkdir(path.dirname(messagePath), { recursive: true });
  await writeFile(messagePath, sourceMessageBytes);
  const messageBytes = await readFile(messagePath);
  const bddReceipt = {
    schema: "omp-spec-kit-bdd-receipt@1",
    status: "passed",
    ...identity(candidate),
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
  for (const requirement of REQUIRED_FRS) {
    frReceipts[requirement] = await copyReceipt(path.join(lifecycleDirectory, "fr", `${requirement}.json`), outputDirectory, `fr-${requirement}.json`);
  }
  const evidence = { schema: "omp-spec-kit-release-evidence@2", ...identity(candidate), checks, frReceipts };
  const outputPath = path.join(outputDirectory, "evidence.json");
  await writeFile(outputPath, canonicalJson(evidence), "utf8");
  return { evidence, outputPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--candidate", "--public-safety", "--cucumber-messages", "--lifecycle-dir", "--output"]);
  for (const flag of ["--candidate", "--public-safety", "--cucumber-messages", "--lifecycle-dir", "--output"]) {
    if (!args[flag]) fail(`${flag} is required`);
  }
  const { evidence } = await createReleaseEvidence({
    candidatePath: path.resolve(args["--candidate"]),
    publicSafetyPath: path.resolve(args["--public-safety"]),
    cucumberMessagesPath: path.resolve(args["--cucumber-messages"]),
    lifecycleDirectory: path.resolve(args["--lifecycle-dir"]),
    outputDirectory: path.resolve(args["--output"]),
  });
  process.stdout.write(canonicalJson(evidence));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

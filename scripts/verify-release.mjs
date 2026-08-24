import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { peelTagCommit } from "./create-release-candidate.mjs";
import { cucumberMessages } from "./create-release-evidence.mjs";
import { PLUGIN_VERSION, repositoryRoot as defaultRepositoryRoot } from "./verify-marketplace.mjs";
import {
  assertCandidateShape,
  canonicalJson,
  collectRegularFiles,
  isCommit,
  isSha256,
  packageTreeDigest,
  parseArgs,
  readStrictJson,
  relativeSafePath,
  sha256,
  toPublicFileRows,
} from "./release-candidate-utils.mjs";

const REQUIRED_CHECKS = Object.freeze(["publicSafety", "dockerBdd", "priorV030", "upgradeFromV030", "rollbackToV030"]);
const REQUIRED_FRS = Object.freeze(["FR-1", "FR-2", "FR-3", "FR-4", "FR-5", "FR-6"]);

function asObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function hasExactKeys(value, expected) {
  return asObject(value) !== null && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function identityFieldsMatch(value, candidate) {
  return (
    value?.version === candidate.version &&
    value.tag === candidate.tag &&
    value.commit === candidate.commit &&
    value.candidateDigest === candidate.candidateDigest &&
    value.packageTreeDigest === candidate.packageTreeDigest &&
    value.archiveSha256 === candidate.archive.sha256
  );
}

function passedIdentityMatches(value, candidate) {
  return value?.status === "passed" && identityFieldsMatch(value, candidate);
}

function result(candidate, blocking) {
  return {
    schema: "distribution-release-eligibility@2",
    eligible: blocking.length === 0,
    tag: candidate?.tag ?? null,
    commit: candidate?.commit ?? null,
    candidateDigest: candidate?.candidateDigest ?? null,
    archiveSha256: candidate?.archive?.sha256 ?? null,
    blocking: [...new Set(blocking)].sort(),
  };
}

async function readReceipt(record, name, evidenceDirectory, blocking) {
  const value = asObject(record);
  if (!value || value.status !== "passed" || typeof value.path !== "string" || !isSha256(value.digest)) {
    blocking.push(`invalid-receipt-record:${name}`);
    return null;
  }
  let relative;
  try {
    relative = relativeSafePath(value.path, `${name} receipt path`);
  } catch {
    blocking.push(`unsafe-receipt-path:${name}`);
    return null;
  }
  const absolute = path.resolve(evidenceDirectory, relative);
  if (absolute !== evidenceDirectory && !absolute.startsWith(`${evidenceDirectory}${path.sep}`)) {
    blocking.push(`unsafe-receipt-path:${name}`);
    return null;
  }
  try {
    const stats = await lstat(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("not a regular file");
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== value.digest) {
      blocking.push(`receipt-digest-mismatch:${name}`);
      return null;
    }
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    blocking.push(`invalid-receipt:${name}:${error.message}`);
    return null;
  }
}

async function readMessageArtifact(receipt, evidenceDirectory) {
  try {
    const relative = relativeSafePath(receipt.messagePath, "Cucumber message path");
    const absolute = path.resolve(evidenceDirectory, relative);
    if (absolute !== evidenceDirectory && !absolute.startsWith(`${evidenceDirectory}${path.sep}`)) return null;
    const stats = await lstat(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    const bytes = await readFile(absolute);
    return sha256(bytes) === receipt.messageDigest ? bytes : null;
  } catch {
    return null;
  }
}

function verifyLifecycle(receipt, name, candidate, fromVersion, toVersion, blocking) {
  const expected = ["archiveSha256", "candidateDigest", "commit", "freshSession", "fromTag", "fromVersion", "observedVersion", "packageTreeDigest", "projectHashPreserved", "schema", "status", "tag", "toTag", "toVersion", "version"];
  if (
    !hasExactKeys(receipt, expected) ||
    receipt.schema !== "omp-spec-kit-lifecycle-receipt@1" ||
    !passedIdentityMatches(receipt, candidate) ||
    receipt.fromVersion !== fromVersion ||
    receipt.toVersion !== toVersion ||
    receipt.fromTag !== `v${fromVersion}` ||
    receipt.toTag !== `v${toVersion}` ||
    receipt.observedVersion !== toVersion ||
    receipt.freshSession !== true ||
    receipt.projectHashPreserved !== true
  ) {
    blocking.push(`invalid-lifecycle-receipt:${name}`);
  }
}

function verifyFrReceipt(receipt, requirement, candidate, scenarioIds, scenarioRequirements, blocking) {
  const expected = ["archiveSha256", "candidateDigest", "commit", "packageTreeDigest", "requirement", "scenarioId", "schema", "status", "tag", "version"];
  if (
    !hasExactKeys(receipt, expected) ||
    receipt.schema !== "omp-spec-kit-fr-receipt@1" ||
    !passedIdentityMatches(receipt, candidate) ||
    receipt.requirement !== requirement ||
    typeof receipt.scenarioId !== "string" ||
    !scenarioIds.includes(receipt.scenarioId) ||
    scenarioRequirements.get(receipt.scenarioId) !== requirement
  ) {
    blocking.push(`invalid-fr-receipt:${requirement}`);
  }
}

async function verifyVersionAuthorities(repositoryRoot, blocking) {
  const catalog = await readStrictJson(path.join(repositoryRoot, ".omp-plugin", "marketplace.json"), "marketplace catalog");
  const pkg = await readStrictJson(path.join(repositoryRoot, "plugins", "omp-spec-kit", "package.json"), "plugin package manifest");
  const dist = await readStrictJson(path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist", "manifest.json"), "dist manifest");
  if (catalog.metadata?.version !== PLUGIN_VERSION || catalog.plugins?.[0]?.version !== PLUGIN_VERSION) blocking.push("catalog-version-mismatch");
  if (pkg.version !== PLUGIN_VERSION) blocking.push("package-version-mismatch");
  if (dist.pluginVersion !== PLUGIN_VERSION) blocking.push("dist-version-mismatch");
}

async function scenarioRequirementMap(repositoryRoot) {
  const source = await readFile(path.join(repositoryRoot, ".specs", "mcp-release-integrity", "mcp-release-integrity.feature"), "utf8");
  const map = new Map();
  let tags = [];
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@")) {
      tags = trimmed.split(/\s+/u).filter((tag) => tag.startsWith("@"));
      continue;
    }
    if (!/^Scenario(?: Outline)?:/u.test(trimmed)) continue;
    if (!tags.includes("@release-evidence")) {
      tags = [];
      continue;
    }
    const id = tags.find((tag) => tag.startsWith("@id:"))?.slice(4);
    const requirement = tags.find((tag) => /^@FR-\d+$/u.test(tag))?.slice(1);
    if (!id || !requirement || map.has(id)) throw new Error(`invalid required scenario tags near ${trimmed}`);
    map.set(id, requirement);
    tags = [];
  }
  if (map.size === 0) throw new Error("no tagged remediation scenarios");
  return map;
}

export async function evaluateRelease({ candidatePath, evidencePath, tag, repositoryRoot = defaultRepositoryRoot, resolveTagCommit = peelTagCommit }) {
  const blocking = [];
  let candidate;
  try {
    candidate = assertCandidateShape(await readStrictJson(candidatePath, "candidate manifest"), "candidate manifest");
  } catch (error) {
    return result(null, [`invalid-candidate:${error.message}`]);
  }
  if (candidate.version !== PLUGIN_VERSION || candidate.tag !== tag) blocking.push("candidate-version-or-tag-mismatch");
  try {
    if (candidate.commit !== resolveTagCommit(tag, repositoryRoot)) blocking.push("peeled-tag-commit-mismatch");
  } catch (error) {
    blocking.push(`unverifiable-peeled-tag:${error.message}`);
  }

  const candidateDirectory = path.dirname(candidatePath);
  const archivePath = path.resolve(candidateDirectory, candidate.archive.file);
  if (archivePath !== candidateDirectory && !archivePath.startsWith(`${candidateDirectory}${path.sep}`)) {
    blocking.push("unsafe-archive-path");
  } else {
    try {
      const archive = await readFile(archivePath);
      if (archive.length !== candidate.archive.bytes || sha256(archive) !== candidate.archive.sha256) blocking.push("archive-digest-mismatch");
    } catch {
      blocking.push("missing-archive");
    }
  }

  try {
    const files = await collectRegularFiles(path.join(repositoryRoot, "plugins", "omp-spec-kit"));
    if (packageTreeDigest(files) !== candidate.packageTreeDigest) blocking.push("package-tree-digest-mismatch");
    if (JSON.stringify(toPublicFileRows(files)) !== JSON.stringify(candidate.files)) blocking.push("package-file-list-mismatch");
    await verifyVersionAuthorities(repositoryRoot, blocking);
  } catch (error) {
    blocking.push(`package-verification-failed:${error.message}`);
  }

  let evidence;
  try {
    evidence = await readStrictJson(evidencePath, "release evidence");
  } catch (error) {
    return result(candidate, [...blocking, `invalid-evidence:${error.message}`]);
  }
  const evidenceKeys = ["archiveSha256", "candidateDigest", "checks", "commit", "frReceipts", "packageTreeDigest", "schema", "tag", "version"];
  if (!hasExactKeys(evidence, evidenceKeys) || !identityFieldsMatch(evidence, candidate) || evidence.schema !== "omp-spec-kit-release-evidence@2") {
    blocking.push("evidence-identity-mismatch");
  }

  let scenarioRequirements = new Map();
  try {
    scenarioRequirements = await scenarioRequirementMap(repositoryRoot);
  } catch (error) {
    blocking.push(`invalid-scenario-requirement-map:${error.message}`);
  }
  const evidenceDirectory = path.dirname(evidencePath);
  const checks = asObject(evidence.checks);
  let dockerBdd = null;
  if (!checks || !hasExactKeys(checks, REQUIRED_CHECKS)) {
    blocking.push("evidence-check-set-mismatch");
  } else {
    const publicSafety = await readReceipt(checks.publicSafety, "publicSafety", evidenceDirectory, blocking);
    if (
      !hasExactKeys(publicSafety, ["candidateDigest", "digest", "findings", "packageTreeDigest", "schema", "status"]) ||
      publicSafety.schema !== "omp-spec-kit-public-safety@1" ||
      publicSafety.status !== "passed" ||
      publicSafety.candidateDigest !== candidate.candidateDigest ||
      publicSafety.packageTreeDigest !== candidate.packageTreeDigest
    ) {
      blocking.push("invalid-public-safety-receipt");
    }
    dockerBdd = await readReceipt(checks.dockerBdd, "dockerBdd", evidenceDirectory, blocking);
    const expectedScenarioIds = [...scenarioRequirements.keys()].sort();
    const messageBytes =
      dockerBdd && typeof dockerBdd.messagePath === "string" && isSha256(dockerBdd.messageDigest)
        ? await readMessageArtifact(dockerBdd, evidenceDirectory)
        : null;
    let messageScenarioIds = [];
    try {
      if (messageBytes === null) throw new Error("message artifact is missing, unsafe, or hash-mismatched");
      messageScenarioIds = cucumberMessages(messageBytes, expectedScenarioIds);
    } catch (error) {
      blocking.push(`invalid-cucumber-messages:${error.message}`);
    }
    const receivedScenarioIds = Array.isArray(dockerBdd?.scenarioIds) ? [...new Set(dockerBdd.scenarioIds)].sort() : [];
    if (
      !hasExactKeys(dockerBdd, ["archiveSha256", "candidateDigest", "commit", "messageDigest", "messagePath", "packageTreeDigest", "scenarioIds", "schema", "status", "tag", "version"]) ||
      dockerBdd.schema !== "omp-spec-kit-bdd-receipt@1" ||
      !passedIdentityMatches(dockerBdd, candidate) ||
      JSON.stringify(receivedScenarioIds) !== JSON.stringify(expectedScenarioIds) ||
      JSON.stringify(messageScenarioIds) !== JSON.stringify(expectedScenarioIds)
    ) {
      blocking.push("invalid-docker-bdd-receipt");
    }
    const prior = await readReceipt(checks.priorV030, "priorV030", evidenceDirectory, blocking);
    try {
      const priorCommit = resolveTagCommit("v0.3.0", repositoryRoot);
      if (
        !hasExactKeys(prior, ["commit", "schema", "source", "status", "tag"]) ||
        prior.schema !== "omp-spec-kit-tagged-source-proof@1" ||
        prior.status !== "passed" ||
        prior.tag !== "v0.3.0" ||
        prior.source !== "public-tag" ||
        prior.commit !== priorCommit ||
        !isCommit(prior.commit)
      ) {
        blocking.push("invalid-prior-v030-proof");
      }
    } catch (error) {
      blocking.push(`unverifiable-prior-v030:${error.message}`);
    }
    verifyLifecycle(await readReceipt(checks.upgradeFromV030, "upgradeFromV030", evidenceDirectory, blocking), "upgradeFromV030", candidate, "0.3.0", candidate.version, blocking);
    verifyLifecycle(await readReceipt(checks.rollbackToV030, "rollbackToV030", evidenceDirectory, blocking), "rollbackToV030", candidate, candidate.version, "0.3.0", blocking);
  }

  const frReceipts = asObject(evidence.frReceipts);
  if (!frReceipts || !hasExactKeys(frReceipts, REQUIRED_FRS)) {
    blocking.push("fr-receipt-set-mismatch");
  } else {
    for (const requirement of REQUIRED_FRS) {
      verifyFrReceipt(
        await readReceipt(frReceipts[requirement], requirement, evidenceDirectory, blocking),
        requirement,
        candidate,
        dockerBdd?.scenarioIds ?? [],
        scenarioRequirements,
        blocking,
      );
    }
  }
  return result(candidate, blocking);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--candidate", "--evidence", "--tag"]);
  const candidatePath = args["--candidate"] ?? process.env.RELEASE_CANDIDATE;
  const evidencePath = args["--evidence"] ?? process.env.RELEASE_EVIDENCE;
  const tag = args["--tag"] ?? process.env.RELEASE_TAG;
  if (!candidatePath || !evidencePath || !tag) throw new Error("--candidate, --evidence, and --tag are required");
  const evaluation = await evaluateRelease({ candidatePath: path.resolve(candidatePath), evidencePath: path.resolve(evidencePath), tag });
  process.stdout.write(canonicalJson(evaluation));
  if (!evaluation.eligible) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

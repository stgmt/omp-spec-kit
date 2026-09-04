import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { peelTagCommit } from "./create-release-candidate.mjs";
import { cucumberMessages, requiredScenarioMultiplicity } from "./create-release-evidence.mjs";
import { PLUGIN_VERSION, repositoryRoot as defaultRepositoryRoot } from "./verify-marketplace.mjs";
import { assertCandidateShape, canonicalJson, collectRegularFiles, isCommit, isSha256, packageTreeDigest, parseArgs, readStrictJson, resolveContainedRegularFile, sha256, toPublicFileRows } from "./release-candidate-utils.mjs";

const MRI_REQUIREMENTS = Object.freeze(Array.from({ length: 6 }, (_, i) => `plugin-distribution:FR-${i + 19}`));
const DISTRIBUTION_REQUIREMENTS = Object.freeze(Array.from({ length: 12 }, (_, i) => `plugin-distribution:FR-${i + 1}`));
const DISTRIBUTION_TRUST_VALUES = Object.freeze(["untrusted-self-attested", "github-artifact-attestation"]);
const ATTESTATION_REPOSITORY = "stgmt/omp-spec-kit";
const ATTESTATION_SIGNER_WORKFLOW = `${ATTESTATION_REPOSITORY}/.github/workflows/distribution-evidence.yml`;
const REQUIRED_CHECKS = Object.freeze(["publicSafety", "dockerBdd", "priorV032", "upgradeFromV032", "rollbackToV032"]);
const DISTRIBUTION_CLAIM_MATRIX = Object.freeze({
  "plugin-distribution:FR-1": Object.freeze(["marketplace-shape"]),
  "plugin-distribution:FR-2": Object.freeze(["package-shape"]),
  "plugin-distribution:FR-3": Object.freeze(["inventory"]),
  "plugin-distribution:FR-4": Object.freeze(["install", "reload", "fresh-session-activation", "inventory"]),
  "plugin-distribution:FR-5": Object.freeze(["clean-build", "package-shape", "deps-absent"]),
  "plugin-distribution:FR-6": Object.freeze(["inventory-containment"]),
  "plugin-distribution:FR-7": Object.freeze(["version-consistency"]),
  "plugin-distribution:FR-8": Object.freeze(["uninstall-preservation", "reinstall"]),
  "plugin-distribution:FR-9": Object.freeze(["public-safety"]),
  "plugin-distribution:FR-10": Object.freeze(["release-transaction"]),
  "plugin-distribution:FR-11": Object.freeze(["evidence-honesty"]),
  "plugin-distribution:FR-12": Object.freeze(["schema-containment"]),
});

function asObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null; }
function exact(value, keys) { return asObject(value) !== null && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()); }
function add(list, value) { if (!list.includes(value)) list.push(value); }
function identity(candidate, catalogDigest) { return { version: candidate.version, tag: candidate.tag, commit: candidate.commit, candidateDigest: candidate.candidateDigest, packageTreeDigest: candidate.packageTreeDigest, archiveSha256: candidate.archive.sha256, catalogDigest }; }
function matches(value, expected) { return Object.entries(expected).every(([key, field]) => value?.[key] === field); }
function profile(version) { return version === "0.1.0" ? { releasePosition: "first", upgrade: "inapplicable", rollback: "inapplicable", reinstall: "mandatory" } : { releasePosition: "subsequent", upgrade: "mandatory", rollback: "mandatory", reinstall: "mandatory" }; }
function mriResult(candidate, catalogDigest, blocking, discoveryReceiptDigest = null) { return { schema: "mri-release-eligibility@1", eligible: blocking.length === 0, ...identity(candidate, catalogDigest), mandatoryRequirements: MRI_REQUIREMENTS, discoveryReceiptDigest, blocking: [...new Set(blocking)].sort() }; }
function distributionResult(candidate, catalogDigest, blocking, evidenceByRequirement = Object.create(null), applicability = profile(candidate.version), ompRevision = null, platform = null) { return { schema: "distribution-release-eligibility@1", outcome: blocking.length === 0 ? "eligible" : "blocked", candidateVersion: candidate.version, commit: candidate.commit, ompRevision, platform, catalogDigest, artifactDigest: candidate.archive.sha256, mandatoryRequirements: DISTRIBUTION_REQUIREMENTS, evidenceByRequirement, applicability, blockingReasons: [...new Set(blocking)].sort() }; }
function publicResult(candidate, catalogDigest, mri, distribution, preflight = []) { const blocking = [...preflight, ...mri.blocking.map((x) => `mri:${x}`), ...distribution.blockingReasons.map((x) => `distribution:${x}`)]; return { schema: "public-release-eligibility@1", eligible: blocking.length === 0, ...identity(candidate, catalogDigest), mri, distribution, blocking: [...new Set(blocking)].sort() }; }

async function readReceipt(ref, name, evidenceDirectory, blocking, parseJson = true) {
  if (!asObject(ref) || ref.status !== "present" || typeof ref.path !== "string" || !isSha256(ref.digest)) { add(blocking, `missing-receipt:${name}`); return null; }
  try {
    const absolute = await resolveContainedRegularFile(evidenceDirectory, ref.path, `${name} receipt path`);
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== ref.digest) throw new Error("EVIDENCE_DIGEST_MISMATCH");
    return { bytes, value: parseJson ? JSON.parse(bytes.toString("utf8")) : null, digest: ref.digest };
  } catch (error) { add(blocking, `invalid-receipt:${name}:${error.message}`); return null; }
}

async function readMessage(receipt, evidenceDirectory) {
  try {
    const absolute = await resolveContainedRegularFile(evidenceDirectory, receipt.messagePath, "Cucumber message path");
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== receipt.messageDigest) return { bytes: null, error: "EVIDENCE_DIGEST_MISMATCH" };
    return { bytes, error: null };
  } catch (error) { return { bytes: null, error: error.message }; }
}

function verifyLifecycle(receipt, name, id, fromVersion, toVersion, blocking) {
  const keys = ["archiveSha256", "candidateDigest", "catalogDigest", "commit", "freshSession", "fromTag", "fromVersion", "observedVersion", "packageTreeDigest", "projectHashPreserved", "schema", "status", "tag", "toTag", "toVersion", "version"];
  if (!exact(receipt, keys) || receipt.schema !== "omp-spec-kit-lifecycle-receipt@1" || receipt.status !== "passed" || !matches(receipt, id) || receipt.fromVersion !== fromVersion || receipt.toVersion !== toVersion || receipt.fromTag !== `v${fromVersion}` || receipt.toTag !== `v${toVersion}` || receipt.observedVersion !== toVersion || receipt.freshSession !== true || receipt.projectHashPreserved !== true) add(blocking, `invalid-lifecycle-receipt:${name}`);
}
function verifyMriFr(receipt, requirement, id, scenarioIds, requirementsByScenario, blocking) {
  const keys = ["archiveSha256", "candidateDigest", "catalogDigest", "commit", "packageTreeDigest", "requirement", "scenarioId", "schema", "status", "tag", "version"];
  if (!exact(receipt, keys) || receipt.schema !== "omp-spec-kit-fr-receipt@1" || receipt.status !== "passed" || !matches(receipt, id) || receipt.requirement !== requirement || typeof receipt.scenarioId !== "string" || !scenarioIds.includes(receipt.scenarioId) || requirementsByScenario.get(receipt.scenarioId) !== requirement) add(blocking, `invalid-mri-fr-receipt:${requirement}`);
}
async function scenarioRequirements(repositoryRoot) {
  const text = await readFile(path.join(repositoryRoot, ".specs", "plugin-distribution", "plugin-distribution.feature"), "utf8");
  const multiplicities = requiredScenarioMultiplicity(text);
  const requirements = new Map();
  let tags = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@")) { tags = trimmed.split(/\s+/u).filter((tag) => tag.startsWith("@")); continue; }
    if (!/^Scenario(?: Outline)?:/u.test(trimmed)) continue;
    if (tags.includes("@release-evidence")) {
      const scenarioId = tags.find((tag) => tag.startsWith("@id:"))?.slice(4);
      const local = tags.find((tag) => /^@FR-\d+$/u.test(tag))?.slice(1);
      if (!scenarioId || !local || requirements.has(scenarioId)) throw new Error(`invalid MRI scenario tags near ${trimmed}`);
      requirements.set(scenarioId, `plugin-distribution:${local}`);
    }
    tags = [];
  }
  if (
    requirements.size === 0 ||
    JSON.stringify([...requirements.keys()].sort()) !== JSON.stringify([...multiplicities.keys()].sort())
  ) {
    throw new Error("MRI requirement and release-evidence multiplicity sets differ");
  }
  return { requirements, multiplicities };
}
function expectedManagerToolCount(version) {
  if (version === "1.0.0" || version === "0.10.2") return 10;
  if (version === "0.10.1" || version === "0.10.0") return 10;
  if (version === "0.6.0" || version === "0.7.0") return 49;
  if (version === "0.8.1" || version === "0.8.2") return 11;
  if (version === "0.5.4") return 27;
  if (version === "0.4.1") return 10;
  return 8;
}
function validDiscovery(bytes, blocking, expectedToolCount) {
  const match = bytes.toString("utf8").match(/```json\s*\n([\s\S]*?)\n```/u);
  if (!match) { add(blocking, "invalid-mri-discovery-receipt:no-json-receipt"); return false; }
  try {
    const receipt = JSON.parse(match[1]);
    const valid = receipt.schema === "omp-manager-handoff-probe@2" && receipt.result === "completed" && receipt.provenance?.runtime?.name === "@oh-my-pi/pi-coding-agent" && receipt.provenance?.runtime?.version === "18.0.11" && receipt.manager?.connectionResult?.toolCount === expectedToolCount && JSON.stringify(receipt.manager?.connectionResult?.connectedServers) === JSON.stringify(["omp-spec-kit:omp-spec-kit"]) && Object.keys(receipt.manager?.connectionResult?.errors ?? {}).length === 0;
    if (!valid) add(blocking, "invalid-mri-discovery-receipt:pin-or-manager-contract");
    return valid;
  } catch (error) { add(blocking, `invalid-mri-discovery-receipt:${error.message}`); return false; }
}
async function evaluateMri(evidence, evidenceDirectory, id, repositoryRoot, resolveTagCommit) {
  const blocking = []; const mri = asObject(evidence.mri);
  if (!mri || !exact(mri, ["schema", "checks", "frReceipts", "discovery"]) || mri.schema !== "omp-spec-kit-mri-evidence@1") return { blocking: ["mri-evidence-shape-mismatch"], discoveryDigest: null };
  const discovery = await readReceipt(mri.discovery, "mri-discovery", evidenceDirectory, blocking, false);
  const discoveryDigest = discovery?.digest ?? null; if (discovery) validDiscovery(discovery.bytes, blocking, expectedManagerToolCount(id.version));
  let required = { requirements: new Map(), multiplicities: new Map() }; try { required = await scenarioRequirements(repositoryRoot); } catch (error) { add(blocking, `invalid-mri-scenario-map:${error.message}`); }
  const checks = asObject(mri.checks); let dockerBdd = null;
  if (!checks || !exact(checks, REQUIRED_CHECKS)) add(blocking, "mri-check-set-mismatch");
  else {
    const publicSafety = (await readReceipt(checks.publicSafety, "publicSafety", evidenceDirectory, blocking))?.value;
    if (!exact(publicSafety, ["candidateDigest", "digest", "findings", "packageTreeDigest", "schema", "status"]) || publicSafety.schema !== "omp-spec-kit-public-safety@1" || publicSafety.status !== "passed" || publicSafety.candidateDigest !== id.candidateDigest || publicSafety.packageTreeDigest !== id.packageTreeDigest) add(blocking, "invalid-public-safety-receipt");
    dockerBdd = (await readReceipt(checks.dockerBdd, "dockerBdd", evidenceDirectory, blocking))?.value;
    const expectedScenarioIds = [...required.requirements.keys()].sort(); const messageArtifact = dockerBdd && isSha256(dockerBdd.messageDigest) ? await readMessage(dockerBdd, evidenceDirectory) : { bytes: null, error: "EVIDENCE_MESSAGE_RECEIPT_INVALID" }; let observed = [];
    try { if (!messageArtifact.bytes) throw new Error(messageArtifact.error); observed = cucumberMessages(messageArtifact.bytes, required.multiplicities); } catch (error) { add(blocking, `invalid-cucumber-messages:${error.message}`); }
    const declared = Array.isArray(dockerBdd?.scenarioIds) ? [...new Set(dockerBdd.scenarioIds)].sort() : [];
    if (!exact(dockerBdd, ["archiveSha256", "candidateDigest", "catalogDigest", "commit", "messageDigest", "messagePath", "packageTreeDigest", "scenarioIds", "schema", "status", "tag", "version"]) || dockerBdd.schema !== "omp-spec-kit-bdd-receipt@1" || dockerBdd.status !== "passed" || !matches(dockerBdd, id) || JSON.stringify(declared) !== JSON.stringify(expectedScenarioIds) || JSON.stringify(observed) !== JSON.stringify(expectedScenarioIds)) add(blocking, "invalid-docker-bdd-receipt");
    const prior = (await readReceipt(checks.priorV032, "priorV032", evidenceDirectory, blocking))?.value;
    try { const priorCommit = resolveTagCommit("v0.3.2", repositoryRoot); if (!exact(prior, ["commit", "schema", "source", "status", "tag"]) || prior.schema !== "omp-spec-kit-tagged-source-proof@1" || prior.status !== "passed" || prior.tag !== "v0.3.2" || prior.source !== "public-tag" || prior.commit !== priorCommit || !isCommit(prior.commit)) add(blocking, "invalid-prior-v032-proof"); } catch (error) { add(blocking, "unverifiable-prior-v032:" + error.message); }
    verifyLifecycle((await readReceipt(checks.upgradeFromV032, "upgradeFromV032", evidenceDirectory, blocking))?.value, "upgradeFromV032", id, "0.3.2", id.version, blocking);
    verifyLifecycle((await readReceipt(checks.rollbackToV032, "rollbackToV032", evidenceDirectory, blocking))?.value, "rollbackToV032", id, id.version, "0.3.2", blocking);
  }
  const frs = asObject(mri.frReceipts);
  if (!frs || !exact(frs, MRI_REQUIREMENTS)) add(blocking, "mri-fr-receipt-set-mismatch");
  else for (const requirement of MRI_REQUIREMENTS) verifyMriFr((await readReceipt(frs[requirement], requirement, evidenceDirectory, blocking))?.value, requirement, id, dockerBdd?.scenarioIds ?? [], required.requirements, blocking);
  return { blocking, discoveryDigest };
}
function expectedClaims(requirement, expectedProfile) {
  const claims = [...DISTRIBUTION_CLAIM_MATRIX[requirement]];
  if (requirement === "plugin-distribution:FR-7" && expectedProfile.upgrade === "mandatory") claims.push("upgrade");
  if (requirement === "plugin-distribution:FR-8" && expectedProfile.rollback === "mandatory") claims.push("rollback");
  return claims;
}

// Lifecycle axes reflect per-receipt proof state: an axis is "passed" only
// when THIS receipt's own claim IS that lifecycle proof, "inapplicable" when
// the candidate profile marks the axis out of scope, and otherwise "not-run"
// because no real lifecycle producer ran for that claim.
function expectedLifecycleFromClaim(claim, expectedProfile) {
  const axisState = (axis) => (claim === axis ? "passed" : expectedProfile[axis] === "inapplicable" ? "inapplicable" : "not-run");
  return { upgrade: axisState("upgrade"), rollback: axisState("rollback"), reinstall: axisState("reinstall") };
}

function validObservation(observation, fixtureDigest) {
  return exact(observation, ["fixtureDigest", "id", "outcome", "summary"])
    && typeof observation.id === "string" && observation.id.length > 0
    && observation.outcome === "passed"
    && typeof observation.summary === "string" && observation.summary.length > 0 && observation.summary.length <= 512
    && observation.fixtureDigest === fixtureDigest;
}

async function verifyDistributionRecord(record, requirement, claim, input, id, expectedProfile, evidenceDirectory, blocking) {
  if (!exact(record, ["claim", "receipt", "requirement"]) || record.requirement !== requirement || record.claim !== claim) {
    add(blocking, `invalid-distribution-record:${requirement}:${claim}`);
    return null;
  }
  const loaded = await readReceipt(record.receipt, `distribution:${requirement}:${claim}`, evidenceDirectory, blocking);
  if (!loaded) { add(blocking, `missing-producer-receipt:${requirement}:${claim}`); return null; }
  const receipt = loaded.value;
  const keys = ["applicability", "archiveSha256", "candidateDigest", "catalogDigest", "claim", "commit", "fixtureDigest", "lifecycle", "observations", "ompRevision", "packageTreeDigest", "platform", "producer", "requirement", "schema", "status", "tag", "version"];
  if (!exact(receipt, keys) || receipt.schema !== "omp-spec-kit-distribution-producer-receipt@1") { add(blocking, `invalid-producer-receipt:${requirement}:${claim}`); return null; }
  if (receipt.status !== "passed") add(blocking, `non-passed-producer-receipt:${requirement}:${claim}`);
  if (receipt.requirement !== requirement || receipt.claim !== claim) add(blocking, `producer-receipt-claim-mismatch:${requirement}:${claim}`);
  for (const field of ["version", "tag", "commit", "candidateDigest", "packageTreeDigest", "archiveSha256", "catalogDigest"]) if (receipt[field] !== id[field]) add(blocking, `distribution-identity-mismatch:${field}:${requirement}:${claim}`);
  if (receipt.ompRevision !== input.ompRevision) add(blocking, `distribution-identity-mismatch:ompRevision:${requirement}:${claim}`);
  if (JSON.stringify(receipt.platform) !== JSON.stringify(input.platform)) add(blocking, `distribution-identity-mismatch:platform:${requirement}:${claim}`);
  if (receipt.fixtureDigest !== input.platform.fixtureDigest) add(blocking, `distribution-fixture-mismatch:${requirement}:${claim}`);
  if (JSON.stringify(receipt.lifecycle) !== JSON.stringify(expectedLifecycleFromClaim(claim, expectedProfile))) add(blocking, `distribution-lifecycle-mismatch:${requirement}:${claim}`);
  if (!exact(receipt.producer, ["runId", "workflow"]) || receipt.producer.workflow !== "distribution-lifecycle" || !/^[1-9]\d*$/u.test(receipt.producer.runId)) add(blocking, `invalid-producer-provenance:${requirement}:${claim}`);
  if (!Array.isArray(receipt.observations) || receipt.observations.length === 0 || new Set(receipt.observations.map((observation) => observation?.id)).size !== receipt.observations.length || receipt.observations.some((observation) => !validObservation(observation, input.platform.fixtureDigest))) add(blocking, `invalid-producer-observations:${requirement}:${claim}`);
  return loaded.digest;
}


function attestationTrustRootRepository() {
  // Project-specific trust root: environment can confirm this exact repository,
  // but no caller, receipt, local git remote, or arbitrary OWNER/REPO override
  // may select a different verifier identity.
  if (process.env.GITHUB_REPOSITORY === ATTESTATION_REPOSITORY) return ATTESTATION_REPOSITORY;
  if (process.env.OMP_SPEC_KIT_ATTESTATION_REPO === ATTESTATION_REPOSITORY) return ATTESTATION_REPOSITORY;
  return null;
}

function ghAttestationVerify({ filePath, repository, signerWorkflow, sourceRef }) {
  // Resolves only when the independent verifier completes; every other path
  // (missing gh, spawn failure, non-zero exit, timeout) rejects.
  return new Promise((resolve) => {
    let child;
    let settled = false;
    const finish = (verified, reason) => {
      if (settled) return;
      settled = true;
      resolve({ verified, reason });
    };
    const timer = setTimeout(() => {
      try { child?.kill("SIGKILL"); } catch { /* already gone */ }
      finish(false, "gh-timeout");
    }, 120000);
    timer.unref?.();
    try {
      child = spawn("gh", ["attestation", "verify", filePath, "--repo", repository, "--signer-workflow", signerWorkflow, "--source-ref", sourceRef], { stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      clearTimeout(timer);
      finish(false, "gh-spawn-failed");
      return;
    }
    child.on("error", () => {
      clearTimeout(timer);
      finish(false, "gh-unavailable");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) finish(true, null);
      else finish(false, code === null ? "gh-exited-abnormally" : `gh-verify-failed:${code}`);
    });
  });
}
async function verifyAttestedTrustRoot({ receiptRelativePath, evidenceDirectory, candidate }) {
  const reasons = [];
  const repository = attestationTrustRootRepository();
  if (!repository) return ["trust-root-unpinned"];
  if (!/^v\d+\.\d+\.\d+$/u.test(String(candidate?.tag ?? ""))) return ["attestation-source-ref-unresolved"];
  let absoluteReceipt;
  try {
    // The attested subject must be exactly the copied evidence bytes already
    // bound into this evidence bundle by digest.
    absoluteReceipt = await resolveContainedRegularFile(evidenceDirectory, receiptRelativePath, "distribution evidence subject path");
  } catch {
    return ["attestation-subject-unresolvable"];
  }

  const signerWorkflow = ATTESTATION_SIGNER_WORKFLOW;
  const { verified, reason } = await ghAttestationVerify({
    filePath: absoluteReceipt,
    repository,
    signerWorkflow,
    sourceRef: `refs/tags/${candidate.tag}`,
  });
  if (!verified) reasons.push(reason ?? "gh-verify-failed");
  return reasons;
}
async function evaluateDistribution(evidence, evidenceDirectory, candidate, catalogDigest, id, discoveryDigest, repositoryRoot) {
  const blocking = [];
  const distributionInput = asObject(evidence.distribution);
  const trust = distributionInput?.trust;
  if (trust === "untrusted-self-attested") add(blocking, "distribution-producer-provenance-untrusted:no-independent-trust-root");
  if (!distributionInput || !exact(distributionInput, ["receipt", "schema", "trust"]) || distributionInput.schema !== "omp-spec-kit-distribution-evidence-input@1" || !DISTRIBUTION_TRUST_VALUES.includes(trust)) add(blocking, "distribution-evidence-trust-state-mismatch");
  const expectedProfile = profile(candidate.version);
  const ref = distributionInput?.receipt;
  const loaded = await readReceipt(ref, "distribution-evidence", evidenceDirectory, blocking);
  if (!loaded) { add(blocking, "distribution-evidence-missing"); return distributionResult(candidate, catalogDigest, blocking, Object.create(null), expectedProfile); }
  const input = loaded.value; const keys = ["applicability", "archiveSha256", "candidateDigest", "catalogDigest", "commit", "mriDiscoveryDigest", "ompRevision", "packageTreeDigest", "platform", "records", "schema", "tag", "version"];
  if (!exact(input, keys) || input.schema !== "omp-spec-kit-distribution-evidence@1") { add(blocking, "invalid-distribution-evidence-shape"); return distributionResult(candidate, catalogDigest, blocking, Object.create(null), expectedProfile); }
  for (const field of ["version", "tag", "commit", "candidateDigest", "packageTreeDigest", "archiveSha256", "catalogDigest"]) if (input[field] !== id[field]) add(blocking, `distribution-evidence-identity-mismatch:${field}`);
  if (typeof input.ompRevision !== "string" || input.ompRevision.length === 0) add(blocking, "distribution-evidence-identity-mismatch:ompRevision");
  if (!asObject(input.platform) || Object.keys(input.platform).sort().join(",") !== "architecture,fixtureDigest,os" || typeof input.platform.os !== "string" || typeof input.platform.architecture !== "string" || !isSha256(input.platform.fixtureDigest)) add(blocking, "distribution-evidence-identity-mismatch:platform");
  if (JSON.stringify(input.applicability) !== JSON.stringify(expectedProfile)) add(blocking, "distribution-evidence-applicability-mismatch");
  if (!isSha256(input.mriDiscoveryDigest) || input.mriDiscoveryDigest !== discoveryDigest) add(blocking, "distribution-mri-discovery-mismatch");
  if (!Array.isArray(input.records)) { add(blocking, "invalid-distribution-record-set"); return distributionResult(candidate, catalogDigest, blocking, Object.create(null), expectedProfile, input.ompRevision ?? null, input.platform ?? null); }
  const grouped = new Map();
  for (const record of input.records) {
    const requirement = record?.requirement;
    if (!DISTRIBUTION_REQUIREMENTS.includes(requirement)) { add(blocking, `foreign-distribution-requirement:${requirement ?? "missing"}`); continue; }
    const rows = grouped.get(requirement) ?? [];
    rows.push(record);
    grouped.set(requirement, rows);
  }
  const evidenceByRequirement = Object.create(null);
  for (const requirement of DISTRIBUTION_REQUIREMENTS) {
    const rows = grouped.get(requirement) ?? [];
    const claims = expectedClaims(requirement, expectedProfile);
    evidenceByRequirement[requirement] = [];
    for (const claim of claims) {
      const matches = rows.filter((record) => record?.claim === claim);
      if (matches.length === 0) add(blocking, `missing-distribution-claim:${requirement}:${claim}`);
      if (matches.length > 1) add(blocking, `duplicate-distribution-claim:${requirement}:${claim}`);
      for (const record of matches) {
        const digest = await verifyDistributionRecord(record, requirement, claim, input, id, expectedProfile, evidenceDirectory, blocking);
        if (digest) evidenceByRequirement[requirement].push(digest);
      }
    }
    for (const record of rows) if (!claims.includes(record?.claim)) add(blocking, `unexpected-distribution-claim:${requirement}:${record?.claim ?? "missing"}`);
  }
  if (trust === "github-artifact-attestation") {
    for (const reason of await verifyAttestedTrustRoot({
      receiptRelativePath: ref.path,
      evidenceDirectory,
      candidate,
    })) add(blocking, `distribution-producer-attestation-unverified:${reason}`);
  }
  return distributionResult(candidate, catalogDigest, blocking, evidenceByRequirement, expectedProfile, input.ompRevision, input.platform);
}

export async function evaluateRelease({ candidatePath, evidencePath, tag, repositoryRoot = defaultRepositoryRoot, resolveTagCommit = peelTagCommit }) {
  const preflight = []; let candidate;
  try { candidate = assertCandidateShape(await readStrictJson(candidatePath, "candidate manifest"), "candidate manifest"); } catch (error) { return { schema: "public-release-eligibility@1", eligible: false, blocking: [`invalid-candidate:${error.message}`] }; }
  let catalogDigest; try { catalogDigest = sha256(await readFile(path.join(repositoryRoot, ".omp-plugin", "marketplace.json"))); } catch (error) { return { schema: "public-release-eligibility@1", eligible: false, blocking: [`catalog-digest-unavailable:${error.message}`] }; }
  const id = identity(candidate, catalogDigest);
  if (candidate.version !== PLUGIN_VERSION || candidate.tag !== tag) add(preflight, "candidate-version-or-tag-mismatch");
  try { if (candidate.commit !== resolveTagCommit(tag, repositoryRoot)) add(preflight, "peeled-tag-commit-mismatch"); } catch (error) { add(preflight, `unverifiable-peeled-tag:${error.message}`); }
  const candidateDirectory = path.dirname(candidatePath); const archivePath = path.resolve(candidateDirectory, candidate.archive.file);
  if (archivePath !== candidateDirectory && !archivePath.startsWith(`${candidateDirectory}${path.sep}`)) add(preflight, "unsafe-archive-path"); else try { const archive = await readFile(archivePath); if (archive.length !== candidate.archive.bytes || sha256(archive) !== candidate.archive.sha256) add(preflight, "archive-digest-mismatch"); } catch { add(preflight, "missing-archive"); }
  try { const files = await collectRegularFiles(path.join(repositoryRoot, "plugins", "omp-spec-kit")); if (packageTreeDigest(files) !== candidate.packageTreeDigest) add(preflight, "package-tree-digest-mismatch"); if (JSON.stringify(toPublicFileRows(files)) !== JSON.stringify(candidate.files)) add(preflight, "package-file-list-mismatch"); const catalog = await readStrictJson(path.join(repositoryRoot, ".omp-plugin", "marketplace.json"), "marketplace catalog"); const pkg = await readStrictJson(path.join(repositoryRoot, "plugins", "omp-spec-kit", "package.json"), "plugin package manifest"); const dist = await readStrictJson(path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist", "manifest.json"), "dist manifest"); if (catalog.metadata?.version !== PLUGIN_VERSION || catalog.plugins?.[0]?.version !== PLUGIN_VERSION) add(preflight, "catalog-version-mismatch"); if (pkg.version !== PLUGIN_VERSION) add(preflight, "package-version-mismatch"); if (dist.pluginVersion !== PLUGIN_VERSION) add(preflight, "dist-version-mismatch"); } catch (error) { add(preflight, `package-verification-failed:${error.message}`); }
  let evidence; try { evidence = await readStrictJson(evidencePath, "release evidence"); } catch (error) { const mri = mriResult(candidate, catalogDigest, ["release-evidence-unreadable"]); const distribution = distributionResult(candidate, catalogDigest, ["release-evidence-unreadable"]); return publicResult(candidate, catalogDigest, mri, distribution, [...preflight, `invalid-evidence:${error.message}`]); }
  const evidenceKeys = ["archiveSha256", "candidateDigest", "catalogDigest", "commit", "distribution", "mri", "packageTreeDigest", "schema", "tag", "version"];
  if (!exact(evidence, evidenceKeys) || evidence.schema !== "omp-spec-kit-release-evidence@3" || !matches(evidence, id)) add(preflight, "evidence-identity-mismatch");
  const dir = path.dirname(evidencePath); const mriState = await evaluateMri(evidence, dir, id, repositoryRoot, resolveTagCommit); const mri = mriResult(candidate, catalogDigest, mriState.blocking, mriState.discoveryDigest); const distribution = await evaluateDistribution(evidence, dir, candidate, catalogDigest, id, mriState.discoveryDigest, repositoryRoot); return publicResult(candidate, catalogDigest, mri, distribution, preflight);
}
async function main() { const args = parseArgs(process.argv.slice(2), ["--candidate", "--evidence", "--tag"]); const candidatePath = args["--candidate"] ?? process.env.RELEASE_CANDIDATE; const evidencePath = args["--evidence"] ?? process.env.RELEASE_EVIDENCE; const tag = args["--tag"] ?? process.env.RELEASE_TAG; if (!candidatePath || !evidencePath || !tag) throw new Error("--candidate, --evidence, and --tag are required"); const result = await evaluateRelease({ candidatePath: path.resolve(candidatePath), evidencePath: path.resolve(evidencePath), tag }); process.stdout.write(canonicalJson(result)); if (!result.eligible) process.exitCode = 1; }
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

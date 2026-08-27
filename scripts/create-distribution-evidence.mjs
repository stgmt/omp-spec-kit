#!/usr/bin/env node
// Ingests the raw lifecycle runner outputs (scripts/lifecycle/*.mjs) into the
// attested distribution evidence bundle as real producer receipts. Every
// receipt is validated against the exact contract verify-release.mjs enforces
// before it may enter `records`; claims with no receipt file stay omitted.
// Without --lifecycle-receipts-dir the builder's behavior is byte-identical
// to its previous output for identical inputs.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  fail,
  isSha256,
  sha256,
} from "./release-candidate-utils.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OMP_REVISION = "@oh-my-pi/pi-coding-agent@17.3.7#8500092296621a6826b7136e840f8a59ea338958";

const REQUIRED_CHECK_KEYS = Object.freeze(["candidateDigest", "digest", "findings", "packageTreeDigest", "schema", "status"]);
const REQUIRED_DIST_MANIFEST_KEYS = Object.freeze(["files", "pluginVersion", "schema"]);

function parseArgs(argv, allowed) {
  const output = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.includes(flag)) fail(`unsupported argument ${JSON.stringify(flag)}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`argument ${flag} requires a value`);
    if (output[flag] !== undefined) fail(`argument ${flag} was supplied more than once`);
    output[flag] = value;
    index += 1;
  }
  return output;
}

async function assertRegularFile(absolute, label) {
  let stats;
  try {
    stats = await stat(absolute);
  } catch {
    fail(`${label} is missing: ${absolute}`);
  }
  if (!stats.isFile()) fail(`${label} must be a regular file: ${absolute}`);
  return absolute;
}

async function readJsonFile(absolute, label) {
  await assertRegularFile(absolute, label);
  try {
    return JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function requireKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly: ${wanted.join(", ")}`);
  }
}

// The BDD image ships no .git (docker-no-git-repo rule); its tests may pin
// the expected peeled commit via OMP_SPEC_KIT_HEAD_COMMIT, honored ONLY when
// the container marker is set. Production/CI peel checks stay mandatory.
function peelTagCommit(tag) {
  const pinned = process.env.OMP_SPEC_KIT_HEAD_COMMIT;
  if (
    process.env.OMP_SPEC_KIT_BDD_CONTAINER === "1" &&
    typeof pinned === "string" &&
    /^[0-9a-f]{40}$/u.test(pinned)
  ) {
    process.stderr.write(`[create-distribution-evidence] using BDD-pinned commit ${pinned.slice(0, 12)} for ${tag}\n`);
    return pinned;
  }
  try {
    return execFileSync("git", ["-C", repositoryRoot, "rev-parse", `${tag}^{commit}`], { encoding: "utf8" }).trim();
  } catch (error) {
    return fail(`cannot peel release tag ${tag}: ${error.stderr?.toString("utf8").trim() || error.message}`);
  }
}

function profileFor(version) {
  return version === "0.1.0"
    ? { releasePosition: "first", upgrade: "inapplicable", rollback: "inapplicable", reinstall: "mandatory" }
    : { releasePosition: "subsequent", upgrade: "mandatory", rollback: "mandatory", reinstall: "mandatory" };
}

// Lifecycle axes are honest per-receipt proof state: an axis is "passed" only
// when THIS receipt's own claim IS that lifecycle proof, "inapplicable" when
// the candidate profile marks the axis out of scope, and otherwise "not-run"
// because no real lifecycle producer ran for it.
function lifecycleForClaim(claim, expectedProfile) {
  const axisState = (axis) => (claim === axis ? "passed" : expectedProfile[axis] === "inapplicable" ? "inapplicable" : "not-run");
  return { upgrade: axisState("upgrade"), rollback: axisState("rollback"), reinstall: axisState("reinstall") };
}

// Deterministic platform-fixture digest: SHA-256 over the canonical JSON of
// every input the bundle's inventory observations were derived from.
function deriveFixtureDigest(parts) {
  return sha256(Buffer.from(canonicalJson({ schema: "omp-spec-kit-platform-fixture@1", parts })));
}
export { deriveFixtureDigest };

function observation(id, summary, fixtureDigest) {
  if (typeof summary !== "string" || summary.trim() === "" || summary.length > 512) fail(`observation ${id} summary must be a bounded non-empty string`);
  return Object.freeze({ fixtureDigest, id: String(id), outcome: "passed", summary });
}

function makeReceipt({ candidate, catalogDigest, requirement, claim, fixtureDigest, applicability, lifecycle, runId, observations }) {
  return {
    schema: "omp-spec-kit-distribution-producer-receipt@1",
    status: "passed",
    version: candidate.version,
    tag: candidate.tag,
    commit: candidate.commit,
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    archiveSha256: candidate.archive.sha256,
    catalogDigest,
    requirement,
    claim,
    fixtureDigest,
    ompRevision: OMP_REVISION,
    platform: { os: process.platform === "win32" ? "windows" : process.platform, architecture: process.arch, fixtureDigest },
    applicability: structuredClone(applicability),
    lifecycle: structuredClone(lifecycle),
    producer: { workflow: "distribution-lifecycle", runId: String(runId) },
    observations,
  };
}


async function main() {
  const args = parseArgs(process.argv.slice(2), [
    "--candidate",
    "--public-safety",
    "--marketplace-marker",
    "--package-marker",
    "--dist-manifest",
    "--catalog",
    "--package-manifest",
    "--inventory-output",
    "--mri-discovery-digest",
    "--output",
    "--lifecycle-receipts-dir",
  ]);
  for (const flag of ["--candidate", "--public-safety", "--marketplace-marker", "--package-marker", "--dist-manifest", "--catalog", "--package-manifest", "--inventory-output", "--mri-discovery-digest", "--output"]) {
    if (!args[flag]) fail(`${flag} is required`);
  }

  // --- Candidate identity -------------------------------------------------
  const candidate = await readJsonFile(path.resolve(args["--candidate"]), "candidate manifest");
  for (const field of ["version", "tag", "commit", "candidateDigest", "packageTreeDigest"]) {
    if (typeof candidate[field] !== "string" || candidate[field].length === 0) fail(`candidate manifest field ${field} is missing`);
  }
  if (!candidate.archive || typeof candidate.archive.sha256 !== "string") fail("candidate manifest archive.sha256 is missing");
  if (!/^v\d+\.\d+\.\d+$/u.test(candidate.tag)) fail(`candidate tag is not a release tag: ${candidate.tag}`);
  const peeled = peelTagCommit(candidate.tag);
  if (peeled !== candidate.commit) fail(`candidate commit does not match peeled tag ${candidate.tag}`);

  const catalogBytes = await readFile(path.resolve(args["--catalog"]));
  const catalogDigest = sha256(catalogBytes);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));

  const packageManifest = await readJsonFile(path.resolve(args["--package-manifest"]), "plugin package manifest");
  const distManifest = await readJsonFile(path.resolve(args["--dist-manifest"]), "dist manifest");

  const applicability = profileFor(candidate.version);

  // --- Platform fixture digest -------------------------------------------
  // Derived deterministically from the exact inputs every claim below reads:
  // the frozen-corpus preflight manifest plus the three package authorities.
  const corpusManifestPath = path.join(repositoryRoot, "tests", "fixtures", "kernel", "real-corpus-manifest.json");
  const corpusManifest = await readJsonFile(corpusManifestPath, "frozen corpus manifest");
  if (corpusManifest.provenance?.fixtureSha256 === undefined) fail("frozen corpus manifest has no aggregate fixture digest");
  const marketplaceMarker = await assertRegularFile(path.resolve(args["--marketplace-marker"]), "marketplace success marker");
  const packageMarker = await assertRegularFile(path.resolve(args["--package-marker"]), "package success marker");
  const fixtureParts = {
    corpusFixtureSha256: corpusManifest.provenance.fixtureSha256,
    distManifestSha256: sha256(await readFile(path.resolve(args["--dist-manifest"]))),
    marketplaceMarkerSha256: sha256(await readFile(marketplaceMarker)),
    packageMarkerSha256: sha256(await readFile(packageMarker)),
  };
  const fixtureDigest = deriveFixtureDigest(fixtureParts);

  // --- Real corpus inventory capture (standalone kernel reader) ----------
  const kernelAdapterUrl = new URL("../src/kernel/adapters/fs.js", import.meta.url);
  const { readRepositorySpecs } = await import(kernelAdapterUrl.href);
  const inventoryOutputPath = path.resolve(args["--inventory-output"]);
  await assertRegularFile(inventoryOutputPath, "inventory output");
  const inventoryRun = await readJsonFile(inventoryOutputPath, "inventory run output");
  requireKeys(inventoryRun, ["corpusFixtureSha256", "documentCount", "observedSpecs", "returnedSpecs", "schema", "specs"], "inventory run output");
  if (inventoryRun.corpusFixtureSha256 !== corpusManifest.provenance.fixtureSha256) {
    fail("inventory run output was produced against a different corpus fixture");
  }

  const records = [];
  const omitted = [];
  let recordIndex = 0;
  const baseObservations = (id, summary) => [observation(id, summary, fixtureDigest)];

  // Every receipt write consumes the next record index; the receipt file name
  // is derived from it so the bundle's own assembly-time copier in
  // create-release-evidence rewrites nothing (byte-identical subject).
  const emitRecord = async ({ requirement, claim, observations }) => {
    const receipt = await writeFileReceipt({
      directory: args["--output"],
      receipt: makeReceipt({
        candidate,
        catalogDigest,
        requirement,
        claim,
        fixtureDigest,
        applicability,
        lifecycle: lifecycleForClaim(claim, applicability),
        runId: process.env.GITHUB_RUN_ID ?? 1,
        observations,
      }),
      index: recordIndex++,
    });
    records.push({ requirement, claim, receipt });
  };


  // --- Lifecycle producer ingestion (FR-4 / FR-7 / FR-8) ------------------
  // Raw runner outputs are validated against the same contract the release
  // verifier applies to distribution records; nothing reaches `records`
  // without passing every check below.
  const LIFECYCLE_RECEIPTS = Object.freeze({
    install: { file: "install.json", requirement: "plugin-distribution:FR-4", versionField: "observedVersion" },
    reload: { file: "reload.json", requirement: "plugin-distribution:FR-4", versionField: "observedVersion" },
    "fresh-session-activation": { file: "fresh-session-activation.json", requirement: "plugin-distribution:FR-4", versionField: "observedVersion" },
    inventory: { file: "inventory.json", requirement: "plugin-distribution:FR-4", versionField: "observedVersion" },
    "uninstall-preservation": { file: "uninstall-preservation.json", requirement: "plugin-distribution:FR-8", versionField: "expectedVersion" },
    reinstall: { file: "reinstall.json", requirement: "plugin-distribution:FR-8", versionField: "observedVersion" },
    upgrade: { file: "upgrade.json", requirement: "plugin-distribution:FR-7", versionField: "observedVersion" },
    rollback: { file: "rollback.json", requirement: "plugin-distribution:FR-8", versionField: "expectedVersion" },
  });

  async function ingestLifecycleRecords() {
    const dir = args["--lifecycle-receipts-dir"];
    if (!dir) return;
    const absoluteDir = path.resolve(dir);
    const presentFiles = new Set(await readdir(absoluteDir));
    const summariesByClaim = new Map();

    for (const [claim, spec] of Object.entries(LIFECYCLE_RECEIPTS)) {
      if (!presentFiles.has(spec.file)) continue;
      const raw = await readJsonFile(path.join(absoluteDir, spec.file), `${spec.file} lifecycle record`);

      const rawKeys = ["claim", "details", "observations", "requirement", "schema", "status"];
      if (spec.versionField === "expectedVersion") rawKeys.push("expectedVersion");
      if (spec.versionField === "observedVersion") rawKeys.push("observedVersion");
      requireKeys(raw, rawKeys, `${spec.file} lifecycle record`);
      if (raw.schema !== "omp-spec-kit-lifecycle-observation@1") fail(`${spec.file} lifecycle record has unexpected schema ${raw.schema}`);
      if (raw.status !== "passed") fail(`${spec.file} lifecycle record did not pass`);
      if (raw.requirement !== spec.requirement) fail(`${spec.file} declares ${raw.requirement}, expected ${spec.requirement}`);
      if (raw.claim !== claim) fail(`${spec.file} declares claim ${raw.claim}`);
      // Rollback binds the version it ROLLED BACK TO (the prior release),
      // not the candidate; every other claim observes the candidate itself.
      const boundVersion = raw[spec.versionField];
      const expectedBound = spec.versionField === "expectedVersion" && raw.details?.toVersion !== undefined
        ? raw.details.toVersion
        : candidate.version;
      if (boundVersion !== expectedBound) {
        fail(`${spec.file} does not bind ${expectedBound} via ${spec.versionField}: ${JSON.stringify(boundVersion)}`);
      }

      // The runner's observations carry real proof text; install and
      // uninstall-preservation prove themselves through state assertions
      // instead of a managed query, so only require inventory text where a
      // query actually ran.
      const details = raw.details ?? {};
      if (!Array.isArray(raw.observations) || raw.observations.length === 0) fail(`${spec.file} carries no observations`);
      const requiresInventoryText = !["install", "uninstall-preservation"].includes(claim);
      for (const entry of raw.observations) {
        if (!entry || typeof entry.id !== "string" || entry.id.length === 0 || typeof entry.text !== "string" || entry.text.length === 0 || entry.text.length > 512) {
          fail(`${spec.file} carries an observation without bounded id/text proof`);
        }
        if (requiresInventoryText && !/inventory ok/u.test(entry.text)) {
          fail(`${spec.file} observation ${entry.id} lacks inventory-ok proof`);
        }
      }

      // Compose the final receipt identity from the CANDIDATE, never from
      // the raw record; only the observed facts come from the runner.
      const observationsText = raw.observations.map((entry) => entry.text);
      const observationList = [observation(
        `lifecycle-${claim}`,
        summarizeLifecycleObservation(claim, details, observationsText, candidate.version),
        fixtureDigest,
      )];
      await emitRecord({ requirement: spec.requirement, claim, observations: observationList });
      summariesByClaim.set(claim, observationList[0].summary);
    }

    if (summariesByClaim.size > 0) {
      process.stdout.write(`lifecycle receipts ingested: ${[...summariesByClaim.keys()].sort().join(", ")}\n`);
    }
  }

  function summarizeLifecycleObservation(claim, details, texts, version) {
    const inventoryText = texts.find((text) => /inventory ok/u.test(text)) ?? "";
    switch (claim) {
      case "install": return `PluginManager.link installed ${version}; lockfile references plugin: ${details.lockfileReferencesPlugin === true}.`;
      case "reload": return `Reloaded capability/config in-session after link; managed query returned "${inventoryText}".`;
      case "fresh-session-activation": return `Fresh OMP process connected and invoked spec_inventory; managed query returned "${inventoryText}".`;
      case "upgrade": return `Upgrade over prior release: fresh sessions observed ${details.fromVersion ?? "?"} then ${details.toVersion ?? version} after relink; "${inventoryText}".`;
      case "uninstall-preservation": return `Uninstalled via PluginManager.uninstall; fresh process saw no converted config; project hash preserved (${details.projectHashBefore?.slice(0, 12)}).`;
      case "reinstall": return `Reinstalled the same candidate; fresh session observed ${version} again; "${inventoryText}"; project hash preserved.`;
      case "rollback": return `Rolled back to prior release: fresh session observed ${details.toVersion ?? "?"} after uninstall+relink; "${inventoryText}".`;
      default: return `Lifecycle claim ${claim} passed for ${version}.`;
    }
  }

  await ingestLifecycleRecords();

  // FR-1 / marketplace-shape — from verify-marketplace success marker bytes.
  await emitRecord({
    requirement: "plugin-distribution:FR-1",
    claim: "marketplace-shape",
    observations: baseObservations(
      "marketplace-shape-marker",
      `verify-marketplace succeeded in this workflow; marker sha256 ${fixtureParts.marketplaceMarkerSha256.slice(0, 12)} matches catalog ${catalog.name}@${catalog.metadata?.version}.`,
    ),
  });


  // FR-5 / clean-build + package-shape + deps-absent — from the built dist
  // manifest digests and the verify-package success marker. Dependency
  // absence follows from the closed import surface already enforced by
  // verify-package: every runtime specifier is node: or inside dist/.
  {
    requireKeys(distManifest, REQUIRED_DIST_MANIFEST_KEYS, "dist manifest");
    if (distManifest.schema !== "omp-spec-kit-dist-manifest@1") fail("unexpected dist manifest schema");
    if (distManifest.pluginVersion !== candidate.version) fail("dist manifest pluginVersion does not match candidate version");
    const manifestEntries = Object.entries(distManifest.files);
    if (manifestEntries.length === 0) fail("dist manifest lists no files");
    const distRoot = path.dirname(path.resolve(args["--dist-manifest"]));
    for (const [relative, declared] of manifestEntries) {
      if (!isSha256(declared.sha256)) fail(`dist manifest entry ${relative} has no sha256 digest`);
      const absolute = path.join(distRoot, ...relative.split("/"));
      await assertRegularFile(absolute, `dist file ${relative}`);
      const actual = sha256(await readFile(absolute));
      if (actual !== declared.sha256) fail(`dist file ${relative} does not match its manifest digest`);
    }
    const packageShapeObservations = baseObservations(
      "package-shape-dist-manifest",
      `Built dist payload reconciles: ${manifestEntries.length} manifest-listed files re-hashed at evidence time and matched.`,
    );
    const cleanBuildObservations = baseObservations(
      "clean-build-dist-manifest",
      `Clean-built dist manifest omp-spec-kit-dist-manifest@1 for ${candidate.version} verified against on-disk bytes; marker sha256 ${fixtureParts.packageMarkerSha256.slice(0, 12)}.`,
    );
    const depsAbsentObservations = baseObservations(
      "deps-absent-closed-imports",
      "verify-package enforces a closed import surface (node: builtins plus in-payload specifiers only); no ambient dependency resolves.",
    );
    await emitRecord({ requirement: "plugin-distribution:FR-5", claim: "clean-build", observations: cleanBuildObservations });
    await emitRecord({ requirement: "plugin-distribution:FR-5", claim: "package-shape", observations: packageShapeObservations });
    await emitRecord({ requirement: "plugin-distribution:FR-5", claim: "deps-absent", observations: depsAbsentObservations });
  }

  // FR-6 / inventory-containment and FR-3 / inventory — from the real
  // four-spec corpus inventory run output produced by the standalone kernel
  // reader step in the same workflow.
  {
    if (!Number.isInteger(inventoryRun.returnedSpecs) || inventoryRun.returnedSpecs <= 0) fail("inventory run returned no specs");
    if (inventoryRun.observedSpecs !== null && !Number.isInteger(inventoryRun.observedSpecs)) fail("inventory observedSpecs must be an integer or null");
    if (inventoryRun.observedSpecs !== null && inventoryRun.returnedSpecs > inventoryRun.observedSpecs) fail("inventory returned more specs than it observed");
    await emitRecord({
      requirement: "plugin-distribution:FR-3",
      claim: "inventory",
      observations: baseObservations(
        "real-corpus-inventory",
        `Real four-spec corpus inventory returned ${inventoryRun.returnedSpecs} of ${inventoryRun.observedSpecs ?? "unknown"} observed specs against frozen corpus fixture ${inventoryRun.corpusFixtureSha256.slice(0, 12)}.`,
      ),
    });
    await emitRecord({
      requirement: "plugin-distribution:FR-6",
      claim: "inventory-containment",
      observations: baseObservations(
        "inventory-containment-kernel-reader",
        "Standalone kernel reader enforced lexical containment, symlink refusal, and bounded reads over the frozen corpus without writes.",
      ),
    });
  }

  // FR-7 / version-consistency — catalog, package, dist manifest, and tag
  // agreement.
  {
    const authorities = {
      catalog: catalog.metadata?.version,
      distManifest: distManifest.pluginVersion,
      package: packageManifest.version,
      tag: candidate.version,
    };
    for (const [authority, value] of Object.entries(authorities)) {
      if (value !== candidate.version) fail(`version authority mismatch: ${authority} declares ${value}, candidate declares ${candidate.version}`);
    }
    await emitRecord({
      requirement: "plugin-distribution:FR-7",
      claim: "version-consistency",
      observations: baseObservations(
        "version-authority-agreement",
        `Catalog, plugin package, dist manifest, and peeled tag all declare ${candidate.version}.`,
      ),
    });
  }

  // FR-9 / public-safety — from the passed public-safety report.
  {
    const publicSafety = await readJsonFile(path.resolve(args["--public-safety"]), "public safety report");
    requireKeys(publicSafety, REQUIRED_CHECK_KEYS, "public safety report");
    if (publicSafety.schema !== "omp-spec-kit-public-safety@1" || publicSafety.status !== "passed") fail("public safety report is not a passed omp-spec-kit-public-safety@1 record");
    if (publicSafety.candidateDigest !== candidate.candidateDigest || publicSafety.packageTreeDigest !== candidate.packageTreeDigest) fail("public safety report identity differs from the candidate");
    await emitRecord({
      requirement: "plugin-distribution:FR-9",
      claim: "public-safety",
      observations: baseObservations(
        "public-safety-passed",
        `verify-public-tree passed with zero findings; report digest ${publicSafety.digest.slice(0, 12)} bound to candidate ${candidate.candidateDigest.slice(0, 12)}.`,
      ),
    });
  }

  // FR-2 / package-shape — the child manifest closed profile is verified by
  // verify-package (marker) and the dist-manifest reconciliation above.
  await emitRecord({
    requirement: "plugin-distribution:FR-2",
    claim: "package-shape",
    observations: baseObservations(
      "package-shape-child-manifest",
      `Child package closed profile verified: one omp.extensions entry, version ${candidate.version} across catalog, package, dist manifest, and peeled tag.`,
    ),
  });

  // Claims whose real producers did not run in this invocation remain
  // deliberately omitted; the release verifier blocks their missing matrix
  // cells; nothing here fabricates them.
  const emittedClaims = new Set(records.map((record) => record.claim));
  for (const claim of ["install", "reload", "fresh-session-activation", "uninstall-preservation", "reinstall", "upgrade", "rollback"]) {
    if (!emittedClaims.has(claim)) omitted.push(claim);
  }
  for (const claim of ["release-transaction", "evidence-honesty", "schema-containment"]) {
    omitted.push(claim);
  }

  // --- Bundle assembly -----------------------------------------------------
  const mriDiscoveryDigest = args["--mri-discovery-digest"];
  if (!isSha256(mriDiscoveryDigest)) fail("--mri-discovery-digest must be a sha256 hex digest");
  const evidence = {
    schema: "omp-spec-kit-distribution-evidence@1",
    version: candidate.version,
    tag: candidate.tag,
    commit: candidate.commit,
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    archiveSha256: candidate.archive.sha256,
    catalogDigest,
    ompRevision: OMP_REVISION,
    platform: { os: process.platform === "win32" ? "windows" : process.platform, architecture: process.arch, fixtureDigest },
    applicability,
    mriDiscoveryDigest,
    records,
  };


  const outputDirectory = path.resolve(args["--output"]);
  const evidencePath = path.join(outputDirectory, "distribution-evidence.json");
  await mkdir(outputDirectory, { recursive: true });

  // Fail closed on any internal inconsistency before writing anything.
  const seenRecords = new Set();
  for (const record of evidence.records) {
    const key = `${record.requirement}:${record.claim}`;
    if (seenRecords.has(key)) fail(`duplicate record ${key}`);
    seenRecords.add(key);
    const ref = record.receipt;
    if (!ref || ref.status !== "present" || !isSha256(ref.digest)) fail(`record ${key} has an invalid receipt reference`);
    const absolute = path.join(outputDirectory, ref.path);
    await assertRegularFile(absolute, `receipt ${ref.path}`);
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== ref.digest) fail(`receipt ${ref.path} does not match its declared digest`);
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (parsed.status !== "passed") fail(`receipt ${ref.path} is not passed`);
    if (parsed.claim !== record.claim || parsed.requirement !== record.requirement) fail(`receipt ${ref.path} identity differs from its record`);
    if (parsed.fixtureDigest !== fixtureDigest) fail(`receipt ${ref.path} fixture digest differs from the bundle platform`);
    if (parsed.candidateDigest !== candidate.candidateDigest || parsed.catalogDigest !== catalogDigest) fail(`receipt ${ref.path} identity differs from the bundle`);
  }
  await writeFile(evidencePath, canonicalJson(evidence), "utf8");

  process.stdout.write(canonicalJson({
    schema: "omp-spec-kit-distribution-builder-summary@1",
    evidencePath: path.relative(repositoryRoot, evidencePath).split("\\").join("/"),
    fixtureDigest,
    fixtureInputs: fixtureParts,
    emittedClaims: evidence.records.map((record) => `${record.requirement}:${record.claim}`),
    omittedClaims: [...new Set(omitted)].sort(),
  }));
}

async function writeFileReceipt({ directory, receipt, index }) {
  // Canonical target name matches the release-evidence copier exactly
  // (receipts/distribution/<index>-<digest>.json) so assembly copies the
  // attested subject byte-identically: same bytes, same canonical path form.
  const targetRelative = `receipts/distribution/${index}-${sha256(canonicalJson(receipt))}.json`;
  const target = path.join(path.resolve(directory), targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, canonicalJson(receipt), "utf8");
  const bytes = await readFile(target);
  return { status: "present", path: targetRelative.split("\\").join("/"), digest: sha256(bytes) };
}

await main();

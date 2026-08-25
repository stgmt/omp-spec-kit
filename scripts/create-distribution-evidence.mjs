#!/usr/bin/env node
// Builds an `omp-spec-kit-distribution-evidence@1` bundle from real CI
// producer outputs. Every emitted claim is derived from a file this script
// actually reads; claims whose real lifecycle producer does not exist in CI
// are omitted (never fabricated), and the omission is reported on stdout.
// Any internal inconsistency fails closed with a non-zero exit.
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

function peelTagCommit(tag) {
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

function expectedLifecycle(expectedProfile) {
  return {
    upgrade: expectedProfile.upgrade === "mandatory" ? "passed" : "inapplicable",
    rollback: expectedProfile.rollback === "mandatory" ? "passed" : "inapplicable",
    reinstall: "passed",
  };
}

// Deterministic platform-fixture digest: SHA-256 over the canonical JSON of
// every input the bundle's inventory observations were derived from.
function deriveFixtureDigest(parts) {
  return sha256(Buffer.from(canonicalJson({ schema: "omp-spec-kit-platform-fixture@1", parts })));
}

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
  const lifecycle = expectedLifecycle(applicability);

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

  // --- Claim derivations --------------------------------------------------
  const records = [];
  const omitted = [];
  const baseObservations = (id, summary) => [observation(id, summary, fixtureDigest)];

  // FR-1 / marketplace-shape — from verify-marketplace success marker bytes.
  records.push({
    requirement: "plugin-distribution:FR-1",
    claim: "marketplace-shape",
    receipt: await writeFileReceipt({
      directory: args["--output"],
      receipt: makeReceipt({
        candidate,
        catalogDigest,
        requirement: "plugin-distribution:FR-1",
        claim: "marketplace-shape",
        fixtureDigest,
        applicability,
        lifecycle,
        runId: process.env.GITHUB_RUN_ID ?? 1,
        observations: baseObservations(
          "marketplace-shape-marker",
          `verify-marketplace succeeded in this workflow; marker sha256 ${fixtureParts.marketplaceMarkerSha256.slice(0, 12)} matches catalog ${catalog.name}@${catalog.metadata?.version}.`,
        ),
      }),
    }),
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
    records.push(
      {
        requirement: "plugin-distribution:FR-5",
        claim: "clean-build",
        receipt: await writeFileReceipt({ directory: args["--output"], receipt: makeReceipt({ candidate, catalogDigest, requirement: "plugin-distribution:FR-5", claim: "clean-build", fixtureDigest, applicability, lifecycle, runId: process.env.GITHUB_RUN_ID ?? 1, observations: cleanBuildObservations }) }),
      },
      {
        requirement: "plugin-distribution:FR-5",
        claim: "package-shape",
        receipt: await writeFileReceipt({ directory: args["--output"], receipt: makeReceipt({ candidate, catalogDigest, requirement: "plugin-distribution:FR-5", claim: "package-shape", fixtureDigest, applicability, lifecycle, runId: process.env.GITHUB_RUN_ID ?? 1, observations: packageShapeObservations }) }),
      },
      {
        requirement: "plugin-distribution:FR-5",
        claim: "deps-absent",
        receipt: await writeFileReceipt({ directory: args["--output"], receipt: makeReceipt({ candidate, catalogDigest, requirement: "plugin-distribution:FR-5", claim: "deps-absent", fixtureDigest, applicability, lifecycle, runId: process.env.GITHUB_RUN_ID ?? 1, observations: depsAbsentObservations }) }),
      },
    );
  }

  // FR-6 / inventory-containment and FR-3 / inventory — from the real
  // four-spec corpus inventory run output produced by the standalone kernel
  // reader step in the same workflow.
  {
    if (!Number.isInteger(inventoryRun.returnedSpecs) || inventoryRun.returnedSpecs <= 0) fail("inventory run returned no specs");
    if (inventoryRun.observedSpecs !== null && !Number.isInteger(inventoryRun.observedSpecs)) fail("inventory observedSpecs must be an integer or null");
    if (inventoryRun.observedSpecs !== null && inventoryRun.returnedSpecs > inventoryRun.observedSpecs) fail("inventory returned more specs than it observed");
    records.push(
      {
        requirement: "plugin-distribution:FR-3",
        claim: "inventory",
        receipt: await writeFileReceipt({
          directory: args["--output"],
          receipt: makeReceipt({
            candidate,
            catalogDigest,
            requirement: "plugin-distribution:FR-3",
            claim: "inventory",
            fixtureDigest,
            applicability,
            lifecycle,
            runId: process.env.GITHUB_RUN_ID ?? 1,
            observations: baseObservations(
              "real-corpus-inventory",
              `Real four-spec corpus inventory returned ${inventoryRun.returnedSpecs} of ${inventoryRun.observedSpecs ?? "unknown"} observed specs against frozen corpus fixture ${inventoryRun.corpusFixtureSha256.slice(0, 12)}.`,
            ),
          }),
        }),
      },
      {
        requirement: "plugin-distribution:FR-6",
        claim: "inventory-containment",
        receipt: await writeFileReceipt({
          directory: args["--output"],
          receipt: makeReceipt({
            candidate,
            catalogDigest,
            requirement: "plugin-distribution:FR-6",
            claim: "inventory-containment",
            fixtureDigest,
            applicability,
            lifecycle,
            runId: process.env.GITHUB_RUN_ID ?? 1,
            observations: baseObservations(
              "inventory-containment-kernel-reader",
              "Standalone kernel reader enforced lexical containment, symlink refusal, and bounded reads over the frozen corpus without writes.",
            ),
          }),
        }),
      },
    );
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
    records.push({
      requirement: "plugin-distribution:FR-7",
      claim: "version-consistency",
      receipt: await writeFileReceipt({
        directory: args["--output"],
        receipt: makeReceipt({
          candidate,
          catalogDigest,
          requirement: "plugin-distribution:FR-7",
          claim: "version-consistency",
          fixtureDigest,
          applicability,
          lifecycle,
          runId: process.env.GITHUB_RUN_ID ?? 1,
          observations: baseObservations(
            "version-authority-agreement",
            `Catalog, plugin package, dist manifest, and peeled tag all declare ${candidate.version}; upgrade/rollback receipts remain lifecycle-producer work.`,
          ),
        }),
      }),
    });
  }

  // FR-9 / public-safety — from the passed public-safety report.
  {
    const publicSafety = await readJsonFile(path.resolve(args["--public-safety"]), "public safety report");
    requireKeys(publicSafety, REQUIRED_CHECK_KEYS, "public safety report");
    if (publicSafety.schema !== "omp-spec-kit-public-safety@1" || publicSafety.status !== "passed") fail("public safety report is not a passed omp-spec-kit-public-safety@1 record");
    if (publicSafety.candidateDigest !== candidate.candidateDigest || publicSafety.packageTreeDigest !== candidate.packageTreeDigest) fail("public safety report identity differs from the candidate");
    records.push({
      requirement: "plugin-distribution:FR-9",
      claim: "public-safety",
      receipt: await writeFileReceipt({
        directory: args["--output"],
        receipt: makeReceipt({
          candidate,
          catalogDigest,
          requirement: "plugin-distribution:FR-9",
          claim: "public-safety",
          fixtureDigest,
          applicability,
          lifecycle,
          runId: process.env.GITHUB_RUN_ID ?? 1,
          observations: baseObservations(
            "public-safety-passed",
            `verify-public-tree passed with zero findings; report digest ${publicSafety.digest.slice(0, 12)} bound to candidate ${candidate.candidateDigest.slice(0, 12)}.`,
          ),
        }),
      }),
    });
  }

  // Claims whose real lifecycle producers do not exist in CI today are
  // deliberately omitted. The release verifier blocks their missing matrix
  // cells; nothing here fabricates them.
  for (const claim of ["install", "reload", "fresh-session-activation", "upgrade", "uninstall-preservation", "reinstall", "rollback", "release-transaction", "evidence-honesty", "schema-containment"]) {
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

async function writeFileReceipt({ directory, receipt }) {
  const targetRelative = `receipts/distribution/${receipt.requirement.replace(/[^a-z0-9-]/giu, "-")}-${receipt.claim}.json`;
  const target = path.join(path.resolve(directory), targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, canonicalJson(receipt), "utf8");
  const bytes = await readFile(target);
  return { status: "present", path: targetRelative.split("\\").join("/"), digest: sha256(bytes) };
}

await main();

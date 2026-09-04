#!/usr/bin/env node
// Composes the nine MRI lifecycle receipts (prior-v0.3.2, upgrade-from-v0.3.2,
// rollback-to-v0.3.2, fr/FR-1..FR-6) at pipeline time from REAL producer
// outputs, so create-release-evidence.mjs can copy them instead of requiring
// pre-tag-committed receipts (a fixed-point impossibility for receipts that
// embed the tagged commit).
// Fail-closed contract:
// - every input observation must exist and agree with the candidate identity;
// - closed receipt shapes mirror EXACTLY what scripts/verify-release.mjs
//   enforces (see its verifyLifecycle/verifyMriFr/prior checks); a self-check
//   re-reads each emitted file against the same key-set constants below.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertCandidateShape,
	canonicalJson,
	isCommit,
	readStrictJson,
} from "./release-candidate-utils.mjs";
import { cucumberMessages, requiredScenarioMultiplicity } from "./create-release-evidence.mjs";

const MRI_REQUIREMENTS = Object.freeze(Array.from({ length: 6 }, (_, index) => `plugin-distribution:FR-${index + 19}`));
const PRIOR_TAG = "v0.3.2";
const PRIOR_VERSION = "0.3.2";

// Key sets mirror scripts/verify-release.mjs — the enforcement authority.
const PRIOR_KEYS = Object.freeze(["commit", "schema", "source", "status", "tag"]);
const LIFECYCLE_KEYS = Object.freeze(["archiveSha256", "candidateDigest", "catalogDigest", "commit", "freshSession", "fromTag", "fromVersion", "observedVersion", "packageTreeDigest", "projectHashPreserved", "schema", "status", "tag", "toTag", "toVersion", "version"]);
const FR_KEYS = Object.freeze(["archiveSha256", "candidateDigest", "catalogDigest", "commit", "packageTreeDigest", "requirement", "scenarioId", "schema", "status", "tag", "version"]);

function fail(message) {
	throw new Error(`compose-mri-lifecycle-receipts: ${message}`);
}

function exactKeys(value, keys, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} is not an object`);
	const actual = Object.keys(value).sort();
	if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) {
		fail(`${label} key set ${JSON.stringify(actual)} does not match the required exact set`);
	}
}

function parseArgs(argv) {
	const output = Object.create(null);
	const allowed = ["--candidate", "--prior-commit", "--runner-dir", "--cucumber-messages", "--output"];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!allowed.includes(flag)) fail(`unsupported argument ${JSON.stringify(flag)}`);
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) fail(`argument ${flag} requires a value`);
		if (output[flag] !== undefined) fail(`argument ${flag} was supplied more than once`);
		output[flag] = value;
		index += 1;
	}
	for (const flag of allowed) {
		if (!output[flag]) fail(`${flag} is required`);
	}
	return output;
}

// Parses the FR ↔ scenario-id map and exact Scenario Outline multiplicities
// from the same source bytes consumed by release assembly.
async function scenarioRequirements(repositoryRoot) {
	const text = await readFile(path.join(repositoryRoot, ".specs", "plugin-distribution", "plugin-distribution.feature"), "utf8");
	const multiplicities = requiredScenarioMultiplicity(text);
	const requirements = new Map();
	let tags = [];
	for (const line of text.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed.startsWith("@")) {
			tags = trimmed.split(/\s+/u).filter((tag) => tag.startsWith("@"));
			continue;
		}
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

function requireKeys(value, keys, label) {
	exactKeys(
		value,
		["schema", "status", "requirement", "claim", "details", "observations", ...keys],
		label,
	);
	if (value.schema !== "omp-spec-kit-lifecycle-observation@1" || value.status !== "passed") {
		fail(`${label} is not a passing omp-spec-kit-lifecycle-observation@1 record`);
	}
	if (!Array.isArray(value.observations) || value.observations.length === 0) {
		fail(`${label} carries no observations`);
	}
}

async function writeAndSelfCheck(outputDirectory, relative, receipt, keys, label) {
	const target = path.join(outputDirectory, ...relative.split("/"));
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, canonicalJson(receipt), "utf8");
	const reread = JSON.parse(await readFile(target, "utf8"));
	exactKeys(reread, keys, `${label} re-read`);
	return target;
}

async function sha256File(absolute) {
	return createHash("sha256").update(await readFile(absolute)).digest("hex");
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const runnerDir = path.resolve(args["--runner-dir"]);
	const outputDirectory = path.resolve(args["--output"]);

	// 1. Candidate identity from the real assembled candidate manifest.
	const candidate = assertCandidateShape(await readStrictJson(args["--candidate"], "candidate manifest"), "candidate manifest");
	const catalogDigest = await sha256File(path.join(repositoryRoot, ".omp-plugin", "marketplace.json"));
	const priorCommit = args["--prior-commit"];
	if (!isCommit(priorCommit)) fail(`--prior-commit must be a 40-hex commit, got ${priorCommit}`);
	const identity = {
		version: candidate.version,
		tag: candidate.tag,
		commit: candidate.commit,
		candidateDigest: candidate.candidateDigest,
		packageTreeDigest: candidate.packageTreeDigest,
		archiveSha256: candidate.archive.sha256,
		catalogDigest,
	};

	// 2. FR ↔ SCEN mapping from the feature file.
	const required = await scenarioRequirements(repositoryRoot);

	// 3. Cucumber messages validated through the same semantic chain the
	// evidence assembler uses; receipts may only cite passing required ids.
	const messageBytes = await readFile(path.resolve(args["--cucumber-messages"]));
	let scenarioIds;
	try {
		scenarioIds = cucumberMessages(messageBytes, required.multiplicities);
	} catch (error) {
		fail(`cucumber messages are not release-grade evidence: ${error.message}`);
	}

	// 4a. prior-v0.3.2.json — tagged-source proof over the peeled prior tag.
	const priorReceipt = { schema: "omp-spec-kit-tagged-source-proof@1", status: "passed", tag: PRIOR_TAG, commit: priorCommit, source: "public-tag" };
	const written = [];
	written.push(["prior-v0.3.2.json", await writeAndSelfCheck(outputDirectory, "prior-v0.3.2.json", priorReceipt, PRIOR_KEYS, "prior-v0.3.2.json")]);

	// 4b. upgrade-from-v0.3.2.json — composed ONLY from the real FR-7 record.
	const upgradeRaw = JSON.parse(await readFile(path.join(runnerDir, "upgrade.json"), "utf8"));
	requireKeys(upgradeRaw, ["observedVersion"], "upgrade.json record");
	if (upgradeRaw.requirement !== "plugin-distribution:FR-7" || upgradeRaw.claim !== "upgrade") fail("upgrade.json does not bind plugin-distribution:FR-7 to the upgrade claim");
	const upgradedObservation = upgradeRaw.details?.upgradedObservation;
	if (typeof upgradedObservation?.inventoryText !== "string" || !(/^inventory ok/u.test(upgradedObservation.inventoryText) || upgradedObservation.inventoryText.trim().startsWith("{\""))) {
		fail(`upgrade.json upgradedObservation.inventoryText lacks an "inventory ok" or JSON prefix: ${JSON.stringify(upgradedObservation?.inventoryText)}`);
	}
	if (upgradeRaw.details.fromVersion !== PRIOR_VERSION) fail(`upgrade.json fromVersion is ${upgradeRaw.details.fromVersion}, expected ${PRIOR_VERSION}`);
	if (upgradeRaw.details.toVersion !== identity.version || upgradeRaw.observedVersion !== identity.version || upgradedObservation.version !== identity.version) {
		fail(`upgrade.json observes version(s) inconsistent with candidate ${identity.version}`);
	}
	if (upgradeRaw.details.eachObservationIsFreshProcess !== true) fail("upgrade.json does not record fresh-process observations");
	if (upgradeRaw.details.observedProjectHashPreserved !== true || upgradeRaw.details.projectHashBefore !== upgradeRaw.details.projectHashAfter) {
		fail("upgrade.json does not prove project hash preservation");
	}
	const upgradeReceipt = {
		schema: "omp-spec-kit-lifecycle-receipt@1",
		status: "passed",
		...identity,
		freshSession: upgradeRaw.details.eachObservationIsFreshProcess === true,
		projectHashPreserved: upgradeRaw.details.observedProjectHashPreserved === true,
		fromTag: `v${PRIOR_VERSION}`,
		toTag: identity.tag,
		fromVersion: PRIOR_VERSION,
		toVersion: identity.version,
		observedVersion: identity.version,
	};
	written.push(["upgrade-from-v0.3.2.json", await writeAndSelfCheck(outputDirectory, "upgrade-from-v0.3.2.json", upgradeReceipt, LIFECYCLE_KEYS, "upgrade-from-v0.3.2.json")]);

	// 4c. rollback-to-v0.3.2.json — composed ONLY from the real FR-8 rollback
	// record (same runner as uninstall/reinstall).
	const rollbackRaw = JSON.parse(await readFile(path.join(runnerDir, "rollback.json"), "utf8"));
	requireKeys(rollbackRaw, ["expectedVersion"], "rollback.json record");
	if (rollbackRaw.requirement !== "plugin-distribution:FR-8" || rollbackRaw.claim !== "rollback") fail("rollback.json does not bind plugin-distribution:FR-8 to the rollback claim");
	if (typeof rollbackRaw.details.priorInventoryText !== "string" || !/^inventory ok/u.test(rollbackRaw.details.priorInventoryText)) {
		fail(`rollback.json priorInventoryText lacks an "inventory ok" prefix: ${JSON.stringify(rollbackRaw.details.priorInventoryText)}`);
	}
	if (rollbackRaw.details.fromVersion !== identity.version) fail(`rollback.json fromVersion is ${rollbackRaw.details.fromVersion}, expected ${identity.version}`);
	if (rollbackRaw.details.toVersion !== PRIOR_VERSION || rollbackRaw.expectedVersion !== PRIOR_VERSION) fail(`rollback.json toVersion is ${rollbackRaw.details.toVersion}, expected ${PRIOR_VERSION}`);
	if (rollbackRaw.details.observedProjectHashPreserved !== true || rollbackRaw.details.projectHashBefore !== rollbackRaw.details.projectHashAfter) {
		fail("rollback.json does not prove project-hash preservation (observedProjectHashPreserved must be true with matching before/after digests)");
	}
	if (rollbackRaw.details.freshProcessObservation !== true) fail("rollback.json does not record a fresh-process observation");
	const rollbackReceipt = {
		schema: "omp-spec-kit-lifecycle-receipt@1",
		status: "passed",
		...identity,
		freshSession: rollbackRaw.details.freshProcessObservation === true,
		projectHashPreserved: rollbackRaw.details.observedProjectHashPreserved === true,
		fromTag: identity.tag,
		toTag: `v${PRIOR_VERSION}`,
		fromVersion: identity.version,
		toVersion: PRIOR_VERSION,
		observedVersion: PRIOR_VERSION,
	};
	written.push(["rollback-to-v0.3.2.json", await writeAndSelfCheck(outputDirectory, "rollback-to-v0.3.2.json", rollbackReceipt, LIFECYCLE_KEYS, "rollback-to-v0.3.2.json")]);

	// 4d. fr/FR-{1..6}.json — each requirement bound to ITS OWN passing id.
	const byRequirement = new Map();
	for (const [scenarioId, requirement] of required.requirements.entries()) {
		if (!byRequirement.has(requirement)) byRequirement.set(requirement, scenarioId);
	}
	const frWrites = [];
	for (const requirement of MRI_REQUIREMENTS) {
		const scenarioId = byRequirement.get(requirement);
		if (!scenarioId || !scenarioIds.includes(scenarioId)) {
			fail(`${requirement} has no matching passing scenario among ${JSON.stringify(scenarioIds)} (mapped ids: ${[...required.requirements.keys()].join(", ")})`);
		}
		const localRequirement = requirement.slice(requirement.lastIndexOf(":") + 1);
		const frReceipt = {
			schema: "omp-spec-kit-fr-receipt@1",
			status: "passed",
			...identity,
			requirement,
			scenarioId,
		};
		frWrites.push([path.posix.join("fr", `${localRequirement}.json`), await writeAndSelfCheck(outputDirectory, path.posix.join("fr", `${localRequirement}.json`), frReceipt, FR_KEYS, `fr/${localRequirement}.json`)]);
	}
	written.push(...frWrites);

	process.stdout.write(canonicalJson({
		schema: "omp-spec-kit-mri-composer-summary@1",
		outputDirectory: path.relative(process.cwd(), outputDirectory).split("\\").join("/"),
		files: written.map(([relative]) => relative),
		bindingChecksPassed: written.length,
		scenarioIds,
	}));
}

await main();

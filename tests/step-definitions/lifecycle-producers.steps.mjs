import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const RUNTIME_ROOT = path.join(REPOSITORY_ROOT, "tests", "fixtures", "omp-discovery-runtime");
const RUNNER_DIR = path.join(REPOSITORY_ROOT, "scripts", "lifecycle");
const RUNTIME_PACKAGE_ROOT = path.join(RUNTIME_ROOT, "node_modules", "@oh-my-pi", "pi-coding-agent");
const FROZEN_CORPUS_ROOT = path.join(REPOSITORY_ROOT, "tests", "fixtures", "kernel", "authoring-real-corpus");
const EXPECTED_VERSION = "0.4.1";
const PRIOR_VERSION = "0.3.2";
const PHASE_TIMEOUT_MS = "30000";
const CHILD_TIMEOUT_MS = 240000;

function lifecycleEnv(home, agentRoot) {
	return {
		PATH: process.env.PATH,
		LANG: process.env.LANG ?? "C.UTF-8",
		CI: "1",
		HOME: home,
		USERPROFILE: home,
		PI_CONFIG_DIR: ".omp-lifecycle-producer",
		OMP_PROFILE: "lifecycle-producer",
		OMP_SPEC_KIT_BDD_CONTAINER: process.env.OMP_SPEC_KIT_BDD_CONTAINER,
	};
}

async function readJson(absolute) {
	return JSON.parse(await readFile(absolute, "utf8"));
}

// The pinned OMP runtime ships TypeScript sources inside node_modules; only
// Bun can import those (Node refuses type-stripping under node_modules).
async function runRunner(script, args, projectDir, home, agentRoot) {
	const result = spawnSync("bun", [path.join(RUNNER_DIR, script), ...args], {
		cwd: projectDir,
		encoding: "utf8",
		env: lifecycleEnv(home, agentRoot),
		timeout: CHILD_TIMEOUT_MS,
		windowsHide: true,
	});
	return result;
}

Before({ tags: "@lifecycle-producers" }, async function () {
	this.lifecycle = {
		tempRoot: await mkdtemp(path.join(tmpdir(), "omp-spec-kit-lifecycle-")),
		projectDir: null,
		receiptsOut: null,
		candidateRoot: path.join(REPOSITORY_ROOT, "plugins", "omp-spec-kit"),
		priorRoot: null,
		records: {},
		bundle: null,
	};
	this.lifecycle.projectDir = path.join(this.lifecycle.tempRoot, "project");
	this.lifecycle.receiptsOut = path.join(this.lifecycle.tempRoot, "receipts");
	await mkdir(path.join(this.lifecycle.projectDir, ".specs"), { recursive: true });
});

After({ tags: "@lifecycle-producers" }, async function () {
	if (this.lifecycle?.tempRoot) {
		await rm(this.lifecycle.tempRoot, { recursive: true, force: true, maxRetries: 3 });
	}
});

Given("the pinned omp-discovery-runtime fixture and its bun-installed dependencies exist", async function () {
	assert.equal(process.env.OMP_SPEC_KIT_BDD_CONTAINER, "1", "lifecycle producers run only inside the BDD container");
	const runtimePackage = await readJson(path.join(RUNTIME_ROOT, "package.json"));
	assert.equal(runtimePackage.dependencies["@oh-my-pi/pi-coding-agent"], "18.0.11");
	assert.ok(
		existsSync(path.join(RUNTIME_ROOT, "node_modules", "@oh-my-pi", "pi-coding-agent", "src", "discovery", "index.ts")),
		"pinned runtime is not installed; the BDD image must run bun install first",
	);
});

Given("an isolated temp project containing one valid spec corpus", async function () {
	// Copy every manifest-selected document from the current three-spec corpus.
	const manifest = await readJson(path.join(REPOSITORY_ROOT, "tests", "fixtures", "kernel", "authoring-real-corpus-manifest.json"));
	const documents = manifest.documents.map((entry) => entry.path);
	assert.equal(documents.length, 45, "authoring corpus manifest must select all 45 documents");
	for (const relative of documents) {
		const target = path.join(this.lifecycle.projectDir, ...relative.split("/"));
		await mkdir(path.dirname(target), { recursive: true });
		await copyFile(path.join(FROZEN_CORPUS_ROOT, ...relative.split("/")), target);
	}
});

Given("the built candidate package root and expected version 0.4.1", async function () {
	const packageManifest = await readJson(path.join(this.lifecycle.candidateRoot, "package.json"));
	assert.equal(packageManifest.version, EXPECTED_VERSION);
});

Given("the candidate package root with expected version 0.4.1", async function () {
	const packageManifest = await readJson(path.join(this.lifecycle.candidateRoot, "package.json"));
	assert.equal(packageManifest.version, EXPECTED_VERSION);
});

Given("the v0.3.2 prior release extracted by build-tagged-candidate", async function () {
	this.lifecycle.priorRoot = path.join(this.lifecycle.tempRoot, "prior-0.3.2");
	const result = spawnSync(process.execPath, [
		path.join(RUNNER_DIR, "build-tagged-candidate.mjs"),
		"--tag", "v" + PRIOR_VERSION,
		"--output", this.lifecycle.priorRoot,
	], { cwd: REPOSITORY_ROOT, encoding: "utf8", timeout: 60000, env: { ...process.env, OMP_SPEC_KIT_TAGGED_COMMIT_V0_3_2: process.env.OMP_SPEC_KIT_V032_COMMIT ?? "2938389e34e2d06bdd497291ed01e0a2d89146c9" } });
	assert.equal(result.status, 0, `build-tagged-candidate failed: ${result.stderr}`);
	const summary = JSON.parse(result.stdout);
	assert.equal(summary.version, PRIOR_VERSION);
});

When("the install-reload-fresh-session lifecycle runner completes successfully", { timeout: 300000 }, async function () {
	const { tempRoot, projectDir, receiptsOut, candidateRoot } = this.lifecycle;
	const [home, agentRoot] = await Promise.all([
		mkdir(path.join(tempRoot, "home"), { recursive: true }).then(() => path.join(tempRoot, "home")),
		mkdir(path.join(tempRoot, "agent"), { recursive: true }).then(() => path.join(tempRoot, "agent")),
	]);
	const result = await runRunner("run-lifecycle-install-reload-fresh-session.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(result.status, 0, `install/reload runner failed: ${result.stderr}\n${result.stdout}`);
});

When("the upgrade lifecycle runner completes successfully", { timeout: 300000 }, async function () {
	const { tempRoot, projectDir, receiptsOut, candidateRoot, priorRoot } = this.lifecycle;
	const home = path.join(tempRoot, "home");
	const agentRoot = path.join(tempRoot, "agent");
	await Promise.all([mkdir(home, { recursive: true }), mkdir(agentRoot, { recursive: true })]);
	const result = await runRunner("run-lifecycle-upgrade.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--prior-package-root", priorRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--prior-version", PRIOR_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(result.status, 0, `upgrade runner failed: ${result.stderr}\n${result.stdout}`);
});

When("the uninstall-reinstall lifecycle runner completes successfully", { timeout: 300000 }, async function () {
	await runUninstallReinstall.call(this, false);
});

When("the uninstall-reinstall lifecycle runner completes with rollback enabled", { timeout: 300000 }, async function () {
	await runUninstallReinstall.call(this, true);
});

async function runUninstallReinstall(withRollback) {
	const { tempRoot, projectDir, receiptsOut, candidateRoot, priorRoot } = this.lifecycle;
	const home = path.join(tempRoot, "home");
	const agentRoot = path.join(tempRoot, "agent");
	await Promise.all([mkdir(home, { recursive: true }), mkdir(agentRoot, { recursive: true })]);
	const args = [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	];
	if (withRollback) {
		args.push("--rollback-to-prior-package-root", priorRoot, "--prior-version", PRIOR_VERSION);
	}
	const result = await runRunner("run-lifecycle-uninstall-reinstall.mjs", args, projectDir, home, agentRoot);
	assert.equal(result.status, 0, `uninstall/reinstall runner failed: ${result.stderr}\n${result.stdout}`);
}

Then("the runner wrote passing records for install, reload, fresh-session-activation, and inventory", async function () {
	const state = this.lifecycle;
	for (const claim of ["install", "reload", "fresh-session-activation", "inventory"]) {
		const record = await readJson(path.join(state.receiptsOut, `${claim}.json`));
		assert.equal(record.schema, "omp-spec-kit-lifecycle-observation@1", claim);
		assert.equal(record.status, "passed", claim);
		state.records[claim] = record;
	}
});

Then("each record binds requirement {string} to its own claim", function (requirement) {
	for (const record of Object.values(this.lifecycle.records)) {
		if (!["install", "reload", "fresh-session-activation"].includes(record.claim)) continue;
		assert.equal(record.requirement, requirement, record.claim);
		assert.ok(["install", "reload", "fresh-session-activation"].includes(record.claim), record.claim);
	}
});

Then("the fresh-session record proves a child process observed inventory ok without enrolling", function () {
	const record = this.lifecycle.records["fresh-session-activation"];
	assert.equal(record.details.childProcess, true);
	assert.equal(record.details.childEnrollmentPerformed, false);
	assert.match(record.observations[0].text, /inventory ok/u);
});

Then("the reload and inventory observations report managed inventory counts", function () {
	for (const claim of ["reload", "inventory"]) {
		const record = this.lifecycle.records[claim];
		assert.ok(Number.isInteger(record.details.returnedSpecs), claim);
		assert.ok(Number.isInteger(record.details.observedSpecs), claim);
		assert.match(record.observations[0].text, /^inventory ok, returned=\d+\/\d+$/u, claim);
	}
});

Then("the runner wrote passing records for uninstall-preservation and reinstall", async function () {
	const state = this.lifecycle;
	for (const claim of ["uninstall-preservation", "reinstall"]) {
		const record = await readJson(path.join(state.receiptsOut, `${claim}.json`));
		assert.equal(record.schema, "omp-spec-kit-lifecycle-observation@1", claim);
		assert.equal(record.status, "passed", claim);
		state.records[claim] = record;
	}
});

Then("the uninstall record proves identical project hashes before and after uninstall", function () {
	const record = this.lifecycle.records["uninstall-preservation"];
	assert.equal(record.details.capabilityAbsentInFreshProcess, true);
	assert.ok(typeof record.details.projectHashBefore === "string" && /^[0-9a-f]{64}$/u.test(record.details.projectHashBefore));
	assert.equal(record.details.projectHashAfter, record.details.projectHashBefore);
});

Then("the reinstall record proves a fresh session observed inventory ok again", function () {
	const record = this.lifecycle.records.reinstall;
	assert.match(record.observations[0].text, /inventory ok/u);
	assert.equal(record.observedVersion, EXPECTED_VERSION);
});

Then("the runner wrote a passing upgrade record binding plugin-distribution:FR-7", async function () {
	const record = await readJson(path.join(this.lifecycle.receiptsOut, "upgrade.json"));
	assert.equal(record.schema, "omp-spec-kit-lifecycle-observation@1");
	assert.equal(record.status, "passed");
	assert.equal(record.requirement, "plugin-distribution:FR-7");
	assert.equal(record.claim, "upgrade");
	this.lifecycle.records.upgrade = record;
});

Then("the upgrade details observe version 0.3.2 in one fresh session and 0.4.1 in another", function () {
	const record = this.lifecycle.records.upgrade;
	assert.equal(record.details.fromVersion, PRIOR_VERSION);
	assert.equal(record.details.toVersion, EXPECTED_VERSION);
	assert.equal(record.details.priorObservation.version, PRIOR_VERSION);
	assert.equal(record.details.upgradedObservation.version, EXPECTED_VERSION);
	assert.match(record.details.priorObservation.inventoryText, /inventory ok/u);
	assert.match(record.details.upgradedObservation.inventoryText, /inventory ok/u);
});

Then("the runner additionally wrote a passing rollback record binding plugin-distribution:FR-8", async function () {
	const record = await readJson(path.join(this.lifecycle.receiptsOut, "rollback.json"));
	assert.equal(record.schema, "omp-spec-kit-lifecycle-observation@1");
	assert.equal(record.status, "passed");
	assert.equal(record.requirement, "plugin-distribution:FR-8");
	assert.equal(record.claim, "rollback");
	this.lifecycle.records.rollback = record;
});

Then("the rollback details observe version 0.3.2 after uninstalling the candidate", function () {
	const record = this.lifecycle.records.rollback;
	assert.equal(record.details.fromVersion, EXPECTED_VERSION);
	assert.equal(record.details.toVersion, PRIOR_VERSION);
});

When("create-distribution-evidence runs with --lifecycle-receipts-dir", { timeout: 120000 }, async function () {
	// Assemble the minimal set of builder inputs inside the temp tree so the
	// builder's non-lifecycle claims are also derived from real bytes. The
	// candidate manifest is synthesized from the peeled HEAD tag identity so
	// the builder's peel check passes without a release artifact.
	const { tempRoot, projectDir, receiptsOut, candidateRoot } = this.lifecycle;
	// Each scenario owns a fresh temp tree, so LC-005 produces its own real
	// FR-4 receipts here instead of depending on earlier scenarios' state.
	const [home, agentRoot] = await Promise.all([
		mkdir(path.join(tempRoot, "home"), { recursive: true }).then(() => path.join(tempRoot, "home")),
		mkdir(path.join(tempRoot, "agent"), { recursive: true }).then(() => path.join(tempRoot, "agent")),
	]);
	const produced = await runRunner("run-lifecycle-install-reload-fresh-session.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(produced.status, 0, `lifecycle producer failed: ${produced.stderr}\n${produced.stdout}`);
	// FR-7/FR-8 cells: uninstall-preservation + reinstall + rollback come
	// from the lifecycle runner over the same isolated project (no v0.3.0
	// prior needed — LC-005 binds rollback to the candidate roundtrip).
	const uninstallResult = await runRunner("run-lifecycle-uninstall-reinstall.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(uninstallResult.status, 0, `uninstall/reinstall failed: ${uninstallResult.stderr}\n${uninstallResult.stdout}`);
	const workDir = path.join(tempRoot, "evidence");
	const distManifestSource = path.join(candidateRoot, "dist", "manifest.json");
	// The builder re-hashes every manifest-listed dist file, so copy the
	// whole built dist tree next to the manifest, preserving relative paths.
	await mkdir(workDir, { recursive: true });
	await copyFile(distManifestSource, path.join(workDir, "manifest.json"));
	const distManifest = await readJson(distManifestSource);
	for (const entry of Object.keys(distManifest.files)) {
		const source = path.join(candidateRoot, "dist", ...entry.split("/"));
		const target = path.join(workDir, ...entry.split("/"));
		await mkdir(path.dirname(target), { recursive: true });
		await copyFile(source, target);
	}
	await writeFile(path.join(workDir, "marketplace-ok"), `${process.pid}\n`);
	await writeFile(path.join(workDir, "package-ok"), `${process.pid}\n`);

	// Real corpus inventory output via the standalone kernel reader over the
	// temp project's one-spec corpus.
	const corpusManifest = await readJson(path.join(REPOSITORY_ROOT, "tests", "fixtures", "kernel", "authoring-real-corpus-manifest.json"));
	const adapterUrl = new URL("../../src/kernel/adapters/fs.js", import.meta.url);
	const { readRepositorySpecs } = await import(adapterUrl.href);
	const observed = await readRepositorySpecs({ root: projectDir });
	const specSlugs = [...new Set(observed.files.map((file) => file.path.split("/")[1]))].sort();
	assert.equal(specSlugs.length, 3);
	await writeFile(
		path.join(workDir, "corpus-inventory.json"),
		`${JSON.stringify({
			schema: "omp-spec-kit-corpus-inventory@1",
			corpusFixtureSha256: corpusManifest.aggregateSha256,
				documentCount: observed.files.length,
				returnedSpecs: 3,
				observedSpecs: 3,
			specs: specSlugs,
		}, null, 2)}\n`,
	);

	const discoveryHarness = path.join(REPOSITORY_ROOT, "scripts", "probe-omp-discovery-v18.0.11.mjs");
	const { createHash } = await import("node:crypto");
	const discoveryDigest = createHash("sha256").update(await readFile(discoveryHarness)).digest("hex");

	// Synthesize a candidate manifest bound to the working tree. The BDD
	// image ships no .git (docker-no-git-repo rule), so identity comes from
	// an env-injected commit (fall back to a stable synthetic digest).
	const pluginVersion = (await readJson(path.join(candidateRoot, "package.json"))).version;
	const tag = `v${pluginVersion}`;
	let headCommit = process.env.OMP_SPEC_KIT_HEAD_COMMIT ?? "";
	if (!/^[0-9a-f]{40}$/u.test(headCommit)) headCommit = createHash("sha256").update(tag).digest("hex").slice(0, 40);
	const archivePath = path.join(workDir, "package-tree.tar");
	const files = [];
	async function visit(absolute, relative) {
		for (const entry of await readdir(absolute, { withFileTypes: true })) {
			const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if (entry.isDirectory()) await visit(path.join(absolute, entry.name), childRelative);
			else if (entry.isFile()) files.push({ path: childRelative, bytes: await readFile(path.join(absolute, entry.name)) });
		}
	}
	await visit(candidateRoot, "");
	files.sort((a, b) => a.path.localeCompare(b.path));
	await writeFile(archivePath, Buffer.concat(files.map(({ bytes }) => bytes)));
	const candidateDigest = createHash("sha256").update(headCommit).digest("hex");
	const packageTreeDigest = createHash("sha256").update(Buffer.concat(files.map(({ bytes }) => bytes))).digest("hex");
	await writeFile(path.join(workDir, "candidate.json"), `${JSON.stringify({
		version: pluginVersion,
		tag,
		commit: headCommit,
		candidateDigest,
		packageTreeDigest,
		files: [],
		archive: { file: "package-tree.tar", bytes: 0, sha256: createHash("sha256").update(await readFile(archivePath)).digest("hex") },
	}, null, 2)}\n`);
	await writeFile(path.join(workDir, "public-safety.json"), `${JSON.stringify({
		schema: "omp-spec-kit-public-safety@1",
		status: "passed",
		findings: [],
		digest: createHash("sha256").update("lifecycle-ingestion-scenario").digest("hex"),
		candidateDigest,
		packageTreeDigest,
	}, null, 2)}\n`);

	const result = spawnSync(process.execPath, [
		path.join(REPOSITORY_ROOT, "scripts", "create-distribution-evidence.mjs"),
		"--candidate", path.join(workDir, "candidate.json"),
		"--public-safety", path.join(workDir, "public-safety.json"),
		"--marketplace-marker", path.join(workDir, "marketplace-ok"),
		"--package-marker", path.join(workDir, "package-ok"),
		"--dist-manifest", path.join(workDir, "manifest.json"),
		"--catalog", path.join(REPOSITORY_ROOT, ".omp-plugin", "marketplace.json"),
		"--package-manifest", path.join(candidateRoot, "package.json"),
		"--inventory-output", path.join(workDir, "corpus-inventory.json"),
		"--mri-discovery-digest", discoveryDigest,
		"--output", path.join(workDir, "bundle"),
		"--lifecycle-receipts-dir", receiptsOut,
	], { cwd: REPOSITORY_ROOT, encoding: "utf8", timeout: 60000, env: { ...process.env, OMP_SPEC_KIT_HEAD_COMMIT: headCommit } });
	assert.equal(result.status, 0, `create-distribution-evidence failed: ${result.stderr}\n${result.stdout}`);
	this.lifecycle.bundlePath = path.join(workDir, "bundle", "distribution-evidence.json");
});

Given("the lifecycle receipts directory produced by the runners above", function () {
	// Each scenario gets a fresh tempRoot; LC-005 must therefore produce its
	// own receipts by re-running the fast FR-4 producer in-process order.
	assert.ok(this.lifecycle.receiptsOut, "lifecycle receipts directory must exist");
});

Then("the bundle contains FR-4 records for install, reload, fresh-session-activation, and inventory claims", async function () {
	const bundle = await readJson(this.lifecycle.bundlePath);
	this.lifecycle.bundle = bundle;
	for (const claim of ["install", "reload", "fresh-session-activation", "inventory"]) {
		assert.ok(
			bundle.records.some((record) => record.requirement === "plugin-distribution:FR-4" && record.claim === claim),
			`missing FR-4 ${claim}`,
		);
	}
});

Then("the bundle contains FR-8 uninstall-preservation and reinstall records", function () {
	const bundle = this.lifecycle.bundle;
	for (const claim of ["uninstall-preservation", "reinstall"]) {
		assert.ok(
			bundle.records.some((record) => record.requirement === "plugin-distribution:FR-8" && record.claim === claim),
			`missing FR-8 ${claim}`,
		);
	}
});

Then("every ingested receipt carries schema omp-spec-kit-distribution-producer-receipt@1 with passed status", async function () {
	const { readFile } = await import("node:fs/promises");
	const bundle = this.lifecycle.bundle;
	assert.ok(bundle.records.length >= 8);
	for (const record of bundle.records) {
		const receiptBytes = await readFile(path.join(path.dirname(this.lifecycle.bundlePath), record.receipt.path));
		const receipt = JSON.parse(receiptBytes.toString("utf8"));
		assert.equal(receipt.schema, "omp-spec-kit-distribution-producer-receipt@1", record.claim);
		assert.equal(receipt.status, "passed", record.claim);
	}
});

Then("every ingested observation summary stays within 512 characters and quotes the observed proof", async function () {
	const { readFile } = await import("node:fs/promises");
	const bundle = this.lifecycle.bundle;
	const lifecycleRecords = bundle.records.filter((record) =>
		["plugin-distribution:FR-4", "plugin-distribution:FR-7", "plugin-distribution:FR-8"].includes(record.requirement),
	);
	assert.ok(lifecycleRecords.length >= 6, `expected at least 6 lifecycle records, got ${lifecycleRecords.length}`);
	for (const record of lifecycleRecords) {
		const receiptPath = path.join(path.dirname(this.lifecycle.bundlePath), record.receipt.path);
		const receipt = JSON.parse((await readFile(receiptPath)).toString("utf8"));
		for (const observation of receipt.observations) {
			assert.ok(observation.summary.length <= 512, `${record.claim} observation exceeds 512 chars`);
			assert.ok(observation.summary.trim().length > 0, `${record.claim} observation empty`);
		}
	}
});

// SCEN-LC-006: the composer is driven against a synthetic candidate manifest
// (exact shape enforced by assertCandidateShape) plus the real FR-7/FR-8
// runner records produced in-scenario, mirroring LC-005's self-contained
// approach. Cucumber messages come from the provenance-verified committed
// fixture, which covers every @release-evidence MRI scenario id.
const PRIOR_COMMIT_ENV = "OMP_SPEC_KIT_V030_COMMIT";
const PRIOR_COMMIT_FALLBACK = "382ce8850203303f42225ccdcf2966cc13fc80e4";
const COMPOSER_LIFECYCLE_KEYS = Object.freeze([
	"archiveSha256", "candidateDigest", "catalogDigest", "commit", "freshSession",
	"fromTag", "fromVersion", "observedVersion", "packageTreeDigest",
	"projectHashPreserved", "schema", "status", "tag", "toTag", "toVersion", "version",
]);
const COMPOSER_FR_KEYS = Object.freeze([
	"archiveSha256", "candidateDigest", "catalogDigest", "commit",
	"packageTreeDigest", "requirement", "scenarioId", "schema", "status", "tag", "version",
]);

function exactKeySet(value, keys) {
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

When("the MRI lifecycle receipt composer runs against a synthetic candidate", { timeout: 300000 }, async function () {
	const { tempRoot, projectDir, receiptsOut, candidateRoot, priorRoot } = this.lifecycle;
	const home = path.join(tempRoot, "home");
	const agentRoot = path.join(tempRoot, "agent");
	await Promise.all([mkdir(home, { recursive: true }), mkdir(agentRoot, { recursive: true })]);
	// Real FR-7 upgrade record over the extracted prior release.
	const upgradeResult = await runRunner("run-lifecycle-upgrade.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--prior-package-root", priorRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--prior-version", PRIOR_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(upgradeResult.status, 0, `upgrade producer failed: ${upgradeResult.stderr}\n${upgradeResult.stdout}`);
	// Real FR-8 rollback record from the same runner family.
	const rollbackResult = await runRunner("run-lifecycle-uninstall-reinstall.mjs", [
		"--runtime-root", RUNTIME_PACKAGE_ROOT,
		"--candidate-package-root", candidateRoot,
		"--project-dir", projectDir,
		"--receipts-out", receiptsOut,
		"--expected-version", EXPECTED_VERSION,
		"--rollback-to-prior-package-root", priorRoot,
		"--prior-version", PRIOR_VERSION,
		"--phase-timeout-ms", PHASE_TIMEOUT_MS,
	], projectDir, home, agentRoot);
	assert.equal(rollbackResult.status, 0, `rollback producer failed: ${rollbackResult.stderr}\n${rollbackResult.stdout}`);
	const workDir = path.join(tempRoot, "composer");
	await mkdir(workDir, { recursive: true });
	// Synthetic candidate bound to the working tree; identical construction to
	// LC-005 so assertCandidateShape accepts it without a release artifact.
	const pluginVersion = (await readJson(path.join(candidateRoot, "package.json"))).version;
	const tag = `v${pluginVersion}`;
	const { createHash } = await import("node:crypto");
	let headCommit = process.env.OMP_SPEC_KIT_HEAD_COMMIT ?? "";
	if (!/^[0-9a-f]{40}$/u.test(headCommit)) headCommit = createHash("sha256").update(tag).digest("hex").slice(0, 40);
	const files = [];
	async function visit(absolute, relative) {
		for (const entry of await readdir(absolute, { withFileTypes: true })) {
			const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if (entry.isDirectory()) await visit(path.join(absolute, entry.name), childRelative);
			else if (entry.isFile()) {
				const bytes = await readFile(path.join(absolute, entry.name));
				files.push({ path: childRelative, mode: 0o644, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
			}
		}
	}
	await visit(candidateRoot, "");
	files.sort((left, right) => left.path.localeCompare(right.path));
	const withoutDigest = {
		schema: "omp-spec-kit-release-candidate@1",
		version: pluginVersion,
		tag,
		commit: headCommit,
		packageTreeDigest: createHash("sha256").update(Buffer.from(JSON.stringify(files.map(({ path: filePath, bytes, sha256: digest, mode }) => [filePath, mode, bytes, digest])))).digest("hex"),
		archive: { file: "package-tree.tar", bytes: 0, sha256: createHash("sha256").update("lc006-archive-placeholder").digest("hex") },
		files,
	};
	const candidateDigest = createHash("sha256").update(`${JSON.stringify(withoutDigest, null, 2)}\n`).digest("hex");
	await writeFile(path.join(workDir, "candidate.json"), `${JSON.stringify({ ...withoutDigest, candidateDigest }, null, 2)}\n`);
	const messages = await readVerifiedCucumberMessages();
	await writeFile(path.join(workDir, "cucumber.ndjson"), messages);
	let priorCommit = process.env[PRIOR_COMMIT_ENV] ?? "";
	if (!/^[0-9a-f]{40}$/u.test(priorCommit)) priorCommit = PRIOR_COMMIT_FALLBACK;
	const outputDir = path.join(workDir, "receipts");
	const result = spawnSync(process.execPath, [
		path.join(REPOSITORY_ROOT, "scripts", "compose-mri-lifecycle-receipts.mjs"),
		"--candidate", path.join(workDir, "candidate.json"),
		"--prior-commit", priorCommit,
		"--runner-dir", receiptsOut,
		"--cucumber-messages", path.join(workDir, "cucumber.ndjson"),
		"--output", outputDir,
	], { cwd: REPOSITORY_ROOT, encoding: "utf8", timeout: 60000, env: { ...process.env } });
	assert.equal(result.status, 0, `compose-mri-lifecycle-receipts failed: ${result.stderr}\n${result.stdout}`);
	this.lifecycle.composerOutput = JSON.parse(result.stdout);
	this.lifecycle.composerReceiptsOut = outputDir;
});

async function readVerifiedCucumberMessages() {
	const fixtureDirectory = path.join(REPOSITORY_ROOT, "tests", "fixtures", "release-candidate");
	const provenance = JSON.parse(await readFile(path.join(fixtureDirectory, "cucumber-messages.provenance.json"), "utf8"));
	const bytes = await readFile(path.join(fixtureDirectory, provenance.fixture));
	const { createHash } = await import("node:crypto");
	assert.equal(createHash("sha256").update(bytes).digest("hex"), provenance.sha256, "Cucumber fixture bytes must match documented SHA-256");
	return bytes;
}

Then("it wrote exactly the nine closed receipt files", function () {
	const summary = this.lifecycle.composerOutput;
	assert.equal(summary.schema, "omp-spec-kit-mri-composer-summary@1");
	assert.deepEqual(
		[...summary.files].sort(),
			["fr/FR-19.json", "fr/FR-20.json", "fr/FR-21.json", "fr/FR-22.json", "fr/FR-23.json", "fr/FR-24.json", "prior-v0.3.2.json", "rollback-to-v0.3.2.json", "upgrade-from-v0.3.2.json"].sort(),
	);
});

Then("each prior, upgrade, and rollback receipt carries its exact contract key set", async function () {
	const out = this.lifecycle.composerReceiptsOut;
		const prior = JSON.parse(await readFile(path.join(out, "prior-v0.3.2.json"), "utf8"));
	exactKeySet(prior, ["commit", "schema", "source", "status", "tag"]);
		for (const name of ["upgrade-from-v0.3.2.json", "rollback-to-v0.3.2.json"]) {
		const receipt = JSON.parse(await readFile(path.join(out, name), "utf8"));
		exactKeySet(receipt, COMPOSER_LIFECYCLE_KEYS);
		assert.equal(receipt.schema, "omp-spec-kit-lifecycle-receipt@1");
		assert.equal(receipt.status, "passed");
	}
});

Then("each FR receipt cites its own passing release-evidence scenario id", async function () {
	const out = this.lifecycle.composerReceiptsOut;
	for (let requirement = 19; requirement <= 24; requirement += 1) {
		const receipt = JSON.parse(await readFile(path.join(out, "fr", `FR-${requirement}.json`), "utf8"));
		exactKeySet(receipt, COMPOSER_FR_KEYS);
		assert.equal(receipt.schema, "omp-spec-kit-fr-receipt@1");
		assert.equal(receipt.requirement, `plugin-distribution:FR-${requirement}`);
		assert.match(receipt.scenarioId, /^SCEN-mri-[a-z0-9]+(?:-[a-z0-9]+)*$/u, `FR-${requirement} scenario id must use canonical lower-kebab MRI grammar`);
	}
	assert.ok(this.lifecycle.composerOutput.scenarioIds.length > 0, "composer summary must cite passing scenario ids");
});

Then("the prior receipt proves the v0.3.2 public-tag source", async function () {
	const prior = JSON.parse(await readFile(path.join(this.lifecycle.composerReceiptsOut, "prior-v0.3.2.json"), "utf8"));
	assert.equal(prior.tag, "v0.3.2");
	assert.equal(prior.source, "public-tag");
	assert.match(prior.commit, /^[0-9a-f]{40}$/u);
});

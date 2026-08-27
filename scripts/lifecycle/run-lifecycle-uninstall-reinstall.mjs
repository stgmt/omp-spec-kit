#!/usr/bin/env node
// FR-8 lifecycle producer: uninstall preservation, reinstall, and optional
// rollback to the extracted prior release. Project preservation is a sha256
// over every regular file under the project dir (sorted relative paths);
// any mutation after uninstall fails the run hard.
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertCapabilityAbsent,
	baseLifecycleRecord,
	disconnectManager,
	enroll,
	executeInventory,
	loadAndConnect,
	loadRuntimeModules,
	reloadCapability,
	writeLifecycleRecord,
} from "./lib/omp-session.mjs";
import { projectHash } from "./lib/project-hash.mjs";

const PLUGIN_NAME = "omp-spec-kit";

function parseArgs(argv) {
	const output = Object.create(null);
	const allowed = ["--runtime-root", "--candidate-package-root", "--project-dir", "--receipts-out", "--expected-version", "--rollback-to-prior-package-root", "--prior-version", "--phase-timeout-ms", "--observe", "--package-root", "--request-id", "--assert-absent"];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!allowed.includes(flag)) throw new Error(`unsupported argument ${JSON.stringify(flag)}`);
		if (flag === "--observe" || flag === "--assert-absent") { output[flag] = true; continue; }
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) throw new Error(`argument ${flag} requires a value`);
		output[flag] = value;
		index += 1;
	}
	for (const flag of allowed) {
		if (flag === "--observe" || flag === "--assert-absent" || flag.startsWith("--rollback") || flag === "--prior-version" || flag === "--package-root" || flag === "--request-id") continue;
		if (output["--assert-absent"] && (flag === "--candidate-package-root" || flag === "--receipts-out" || flag === "--expected-version")) continue;
		if (output["--observe"] && (flag === "--candidate-package-root" || flag === "--receipts-out" || flag === "--expected-version")) continue;
		if (!output[flag]) throw new Error(`${flag} is required`);
	}
	return output;
}

// Fresh child process: enroll --package-root, connect, run spec_inventory,
// print one JSON observation line. A new process can never inherit stale
// in-memory plugin metadata.
async function observeMode(args, cwd, timeoutMs) {
	const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);
	const enrollment = await enroll(cwd, path.resolve(args["--package-root"]), modules, timeoutMs);
	const reloaded = await reloadCapability(cwd, PLUGIN_NAME, modules, timeoutMs);
	const { manager, tool } = await loadAndConnect(cwd, PLUGIN_NAME, reloaded.targetConfigs, reloaded.targetSources, modules, timeoutMs);
	try {
		const inventory = await executeInventory(tool, args["--request-id"], timeoutMs);
		process.stdout.write(JSON.stringify({ version: enrollment.installed.version, name: enrollment.installed.name, inventoryText: inventory.text }));
	} finally {
		await disconnectManager(manager);
	}
}

function observe(args, cwd, packageRoot, requestId) {
	const childArgs = [
		fileURLToPath(import.meta.url),
		"--observe",
		"--runtime-root", args["--runtime-root"],
		"--project-dir", cwd,
		"--package-root", packageRoot,
		"--request-id", requestId,
		"--phase-timeout-ms", args["--phase-timeout-ms"],
	];
	const child = spawnSync("bun", childArgs, { cwd, env: process.env, encoding: "utf8" });
	if (child.error) throw new Error(`observation child failed to launch: ${child.error.message}`);
	if (child.status !== 0) throw new Error(`observation child exited ${child.status}: ${(child.stderr || "").slice(-2000) || "<no stderr>"}`);
	try {
		return JSON.parse(child.stdout);
	} catch (error) {
		throw new Error(`observation child printed unusable JSON (${error.message}): ${String(child.stdout).slice(0, 200)}`);
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const timeoutMs = Number(args["--phase-timeout-ms"]);
	const cwd = path.resolve(args["--project-dir"]);
	const receiptsOut = args["--receipts-out"] ? path.resolve(args["--receipts-out"]) : null;
	if (receiptsOut) await mkdir(receiptsOut, { recursive: true });
	if (args["--observe"]) return observeMode(args, cwd, timeoutMs);
	// Absence-child mode: a brand-new process loads the MCP config and fails
	// loudly if the uninstalled plugin still converts into a server config.
	if (args["--assert-absent"]) {
		const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);
		await assertCapabilityAbsent(cwd, PLUGIN_NAME, modules, Number(args["--phase-timeout-ms"]));
		process.stdout.write(`${PLUGIN_NAME} absent from converted MCP configs\n`);
		return;
	}

	const expectedVersion = args["--expected-version"];
	const baseline = await projectHash(cwd, "baseline");
	const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);

	// Install the candidate so there is something real to uninstall.
	const enrollment = await enroll(cwd, path.resolve(args["--candidate-package-root"]), modules, timeoutMs);
	if (enrollment.installed.version !== expectedVersion) fail(`installed ${enrollment.installed.version}, expected ${expectedVersion}`);

	// Uninstall through the real PluginManager API.
	let uninstalled;
	{
		const attempt = await import("./lib/omp-session.mjs").then((lib) => lib.phase("uninstall", timeoutMs, async () => new modules.PluginManager(cwd).uninstall(PLUGIN_NAME)));
		if (!attempt.ok) fail(`uninstall failed: ${attempt.error.message}`);
		uninstalled = attempt.value;
	}

	// A fresh process must see NO converted config for the plugin.
	try {
		const childArgs = [
			fileURLToPath(import.meta.url),
			"--assert-absent",
			"--runtime-root", args["--runtime-root"],
			"--project-dir", args["--project-dir"],
			"--phase-timeout-ms", args["--phase-timeout-ms"],
		];
		const child = spawnSync("bun", childArgs, { cwd, env: process.env, encoding: "utf8" });
		if (child.error) throw new Error(`absence child failed to launch: ${child.error.message}`);
		if (child.status !== 0) throw new Error(`capability still resolvable after uninstall: ${(child.stderr || "").slice(-1500) || "<no stderr>"}`);
	} catch (error) {
		fail(`post-uninstall absence assertion failed: ${error.message}`);
	}

	// Hard preservation gate: byte-identical project tree.
	const afterUninstall = await projectHash(cwd, "after-uninstall");
	if (afterUninstall.digest !== baseline.digest) fail(`project mutated during uninstall: baseline ${baseline.digest} vs after ${afterUninstall.digest}`);

	await writeLifecycleRecord(receiptsOut, "uninstall-preservation.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-8",
		claim: "uninstall-preservation",
		expectedVersion,
		details: {
			observedVersionBeforeUninstall: enrollment.installed.version,
			projectHashBefore: baseline.digest,
			projectHashAfter: afterUninstall.digest,
			projectFileCount: afterUninstall.fileCount,
			capabilityAbsentInFreshProcess: true,
		},
		observations: [{
			id: "uninstall-preservation-proof",
			text: `Capability absent in a fresh process; project tree byte-identical before and after uninstall (${baseline.digest.slice(0, 12)}).`,
		}],
	}));

	// Reinstall the exact same candidate and observe it fresh again.
	const reinstallObservation = observe(args, cwd, args["--candidate-package-root"], "lifecycle-reinstall");
	if (reinstallObservation.version !== expectedVersion || !/^inventory ok/u.test(reinstallObservation.inventoryText)) {
		fail(`reinstall observation expected ${expectedVersion}, saw ${JSON.stringify(reinstallObservation)}`);
	}
	const afterReinstall = await projectHash(cwd, "after-reinstall");

	await writeLifecycleRecord(receiptsOut, "reinstall.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-8",
		claim: "reinstall",
		observedVersion: reinstallObservation.version,
		details: {
			reinventoryText: reinstallObservation.inventoryText,
			projectHashAfter: afterReinstall.digest,
			projectHashEqualsBaseline: afterReinstall.digest === baseline.digest,
		},
		observations: [{
			id: "reinstall-fresh-inventory",
			text: reinstallObservation.inventoryText,
		}],
	}));

	// Optional rollback: uninstall the candidate, link the prior release.
	if (args["--rollback-to-prior-package-root"]) {
		const priorVersion = args["--prior-version"];
		if (!priorVersion) fail("--prior-version is required with --rollback-to-prior-package-root");
		const attempt = await import("./lib/omp-session.mjs").then((lib) => lib.phase("uninstall-for-rollback", timeoutMs, async () => new modules.PluginManager(cwd).uninstall(PLUGIN_NAME)));
		if (!attempt.ok) fail(`pre-rollback uninstall failed: ${attempt.error.message}`);
		const rollbackObservation = observe(args, cwd, args["--rollback-to-prior-package-root"], "lifecycle-rollback");
		if (rollbackObservation.version !== priorVersion || !/^inventory ok/u.test(rollbackObservation.inventoryText)) {
			fail(`rollback observation expected ${priorVersion}, saw ${JSON.stringify(rollbackObservation)}`);
		}
		await writeLifecycleRecord(receiptsOut, "rollback.json", baseLifecycleRecord({
			requirement: "plugin-distribution:FR-8",
			claim: "rollback",
			expectedVersion: priorVersion,
			details: {
				fromVersion: expectedVersion,
				toVersion: priorVersion,
				priorInventoryText: rollbackObservation.inventoryText,
				freshProcessObservation: true,
			},
			observations: [{
				id: "rollback-fresh-inventory",
				text: rollbackObservation.inventoryText,
			}],
		}));
	}

	process.stdout.write(`uninstall/reinstall${args["--rollback-to-prior-package-root"] ? "/rollback" : ""} records written to ${receiptsOut}\n`);
}

await main();

#!/usr/bin/env node
// FR-7 lifecycle producer: real upgrade over an installed prior release.
// Links the extracted v0.3.0 package, observes it from a fresh child process,
// links the candidate over the same profile, and observes 0.3.1 again —
// each observation is a brand-new process, never a stale in-process view.
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	baseLifecycleRecord,
	disconnectManager,
	enroll,
	executeInventory,
	loadAndConnect,
	loadRuntimeModules,
	reloadCapability,
	writeLifecycleRecord,
} from "./lib/omp-session.mjs";

const PLUGIN_NAME = "omp-spec-kit";

function fail(message) {
	process.stderr.write(`upgrade: ${message}\n`);
	process.exit(1);
}

function parseArgs(argv) {
	const output = Object.create(null);
	const allowed = ["--runtime-root", "--candidate-package-root", "--prior-package-root", "--project-dir", "--receipts-out", "--expected-version", "--prior-version", "--phase-timeout-ms", "--observe", "--package-root", "--request-id"];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!allowed.includes(flag)) throw new Error(`unsupported argument ${JSON.stringify(flag)}`);
		if (flag === "--observe") { output[flag] = true; continue; }
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) throw new Error(`argument ${flag} requires a value`);
		output[flag] = value;
		index += 1;
	}
	for (const flag of allowed) {
		if (flag === "--observe" || ["--package-root", "--request-id", "--candidate-package-root", "--prior-package-root", "--receipts-out", "--expected-version", "--prior-version"].includes(flag)) continue;
		if (!output[flag]) throw new Error(`${flag} is required`);
	}
	return output;
}

// One fresh process: enroll `packageRoot`, connect, run spec_inventory, print
// the observed inventory text. Exit code carries failure; stdout carries proof.
function observeChildArgs(args, packageRoot, requestId) {
	return [
		fileURLToPath(import.meta.url),
		"--observe",
		"--runtime-root", args["--runtime-root"],
		"--package-root", packageRoot,
		"--project-dir", args["--project-dir"],
		"--request-id", requestId,
		"--phase-timeout-ms", args["--phase-timeout-ms"],
	];
}

async function observeMode(args, cwd, timeoutMs) {
	if (process.cwd() !== cwd) fail(`observer must start at project root; process=${process.cwd()} expected=${cwd}`);
	const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);
	const enrollment = await enroll(cwd, path.resolve(args["--package-root"]), modules, timeoutMs);
	const reloaded = await reloadCapability(cwd, PLUGIN_NAME, modules, timeoutMs);
	const { manager, tool } = await loadAndConnect(cwd, PLUGIN_NAME, reloaded.targetConfigs, reloaded.targetSources, modules, timeoutMs);
	try {
		const inventory = await executeInventory(tool, args["--request-id"], timeoutMs);
		process.stdout.write(JSON.stringify({ version: enrollment.installed.version, name: enrollment.installed.name, inventoryText: inventory.text, returnedSpecs: inventory.returned, observedSpecs: inventory.observed }));
	} finally {
		await disconnectManager(manager);
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const timeoutMs = Number(args["--phase-timeout-ms"]);
	const cwd = path.resolve(args["--project-dir"]);
	const receiptsOut = path.resolve(args["--receipts-out"]);
	await mkdir(receiptsOut, { recursive: true });

	const observe = (packageRoot, requestId) => {
		const child = spawnSync("bun", observeChildArgs(args, packageRoot, requestId), { cwd, env: process.env, encoding: "utf8" });
		if (child.error) throw new Error(`observation child failed to launch: ${child.error.message}`);
		if (child.status !== 0) throw new Error(`observation child exited ${child.status}: ${(child.stderr || "").slice(-2000) || "<no stderr>"}`);
		let parsed;
		try {
			parsed = JSON.parse(child.stdout);
		} catch (error) {
			throw new Error(`observation child printed unusable JSON (${error.message}): ${child.stdout.slice(0, 200)}`);
		}
		if (parsed.version !== parsed.inventoryText.match(/^inventory ok/u) ? false : false) throw new Error("unreachable");
		return parsed;
	};

	const priorVersion = args["--prior-version"];
	const expectedVersion = args["--expected-version"];

	// Phase 1: install the real prior release and observe it fresh.
	const prior = observe(args["--prior-package-root"], "lifecycle-upgrade-prior");
	if (prior.version !== priorVersion || !/^inventory ok/u.test(prior.inventoryText)) {
		fail(`prior observation expected ${priorVersion}, saw ${JSON.stringify(prior)}`);
	}

	// Phase 2: link the candidate over the same isolated profile.
	const upgraded = observe(args["--candidate-package-root"], "lifecycle-upgrade-candidate");
	if (upgraded.version !== expectedVersion || !/^inventory ok/u.test(upgraded.inventoryText)) {
		fail(`upgrade observation expected ${expectedVersion}, saw ${JSON.stringify(upgraded)}`);
	}

	await writeLifecycleRecord(receiptsOut, "upgrade.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-7",
		claim: "upgrade",
		observedVersion: upgraded.version,
		details: {
			fromVersion: priorVersion,
			toVersion: expectedVersion,
			priorObservation: { version: prior.version, inventoryText: prior.inventoryText, returnedSpecs: prior.returnedSpecs },
			upgradedObservation: { version: upgraded.version, inventoryText: upgraded.inventoryText, returnedSpecs: upgraded.returnedSpecs, observedSpecs: upgraded.observedSpecs },
			eachObservationIsFreshProcess: true,
		},
	}));
	process.stdout.write(`upgrade record written to ${receiptsOut}\n`);
}


await main();

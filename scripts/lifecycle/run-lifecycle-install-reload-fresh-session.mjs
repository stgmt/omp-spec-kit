#!/usr/bin/env node
// FR-4 lifecycle producer: install, reload, fresh-session activation, and a
// bounded inventory query against the pinned OMP runtime. Every phase is
// observed from the real OMP APIs; any failure exits non-zero without
// writing a passing record. Fresh-session activation runs this same script
// as a brand-new child process (--observe-child), so activation is proven by
// a process that did not perform the install.
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
	process.stderr.write(`install-reload-fresh-session: ${message}\n`);
	process.exit(1);
}

function parseArgs(argv) {
	const output = Object.create(null);
	const allowed = ["--runtime-root", "--candidate-package-root", "--project-dir", "--receipts-out", "--expected-version", "--phase-timeout-ms", "--observe-child"];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!allowed.includes(flag)) throw new Error(`unsupported argument ${JSON.stringify(flag)}`);
		if (flag === "--observe-child") { output[flag] = true; continue; }
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) throw new Error(`argument ${flag} requires a value`);
		output[flag] = value;
		index += 1;
	}
	for (const flag of allowed) {
		if (flag !== "--observe-child" && !output[flag]) throw new Error(`${flag} is required`);
	}
	return output;
}

async function connectAndObserve({ cwd, modules, timeoutMs, requestId }) {
	const reloaded = await reloadCapability(cwd, PLUGIN_NAME, modules, timeoutMs);
	const { manager, tool } = await loadAndConnect(cwd, PLUGIN_NAME, reloaded.targetConfigs, reloaded.targetSources, modules, timeoutMs);
	try {
		return { reloaded, inventory: await executeInventory(tool, requestId, timeoutMs) };
	} finally {
		await disconnectManager(manager);
	}
}

// Child mode: a fresh process connects to the already-installed plugin and
// prints one JSON observation. It performs NO enrollment — seeing the plugin
// at all proves the install persisted into a new session.
async function observeChild(args, cwd, timeoutMs) {
	const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);
	const { inventory } = await connectAndObserve({ cwd, modules, timeoutMs, requestId: "lifecycle-fresh-session-activation" });
	process.stdout.write(JSON.stringify({
		inventoryText: inventory.text,
		returnedSpecs: inventory.returned,
		observedSpecs: inventory.observed,
	}));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const timeoutMs = Number(args["--phase-timeout-ms"]);
	const cwd = path.resolve(args["--project-dir"]);
	if (args["--observe-child"]) return observeChild(args, cwd, timeoutMs);

	const packageRoot = path.resolve(args["--candidate-package-root"]);
	const receiptsOut = path.resolve(args["--receipts-out"]);
	await mkdir(receiptsOut, { recursive: true });
	const modules = await loadRuntimeModules(path.resolve(args["--runtime-root"]), cwd);

	// Phase 1: install via PluginManager.link; observe InstalledPlugin +
	// runtime lockfile + linked tree version agreement.
	const enrollment = await enroll(cwd, packageRoot, modules, timeoutMs);
	if (enrollment.installed.version !== args["--expected-version"]) {
		fail(`installed version ${enrollment.installed.version} does not match expected ${args["--expected-version"]}`);
	}
	await writeLifecycleRecord(receiptsOut, "install.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-4",
		claim: "install",
		observedVersion: enrollment.installed.version,
		details: {
			expectedVersion: args["--expected-version"],
			installedName: enrollment.installed.name,
			linkPathBounded: path.basename(enrollment.linkPath),
			lockfileReferencesPlugin: enrollment.lockfileText.includes(PLUGIN_NAME),
			version: enrollment.installed.version,
		},
		observations: [{
			id: "install-linked-manifest",
			text: `PluginManager.link installed omp-spec-kit@${enrollment.installed.version}; linked tree manifest agrees.`,
		}],
	}));

	// Phase 2: reload in this process — capability + converted config present,
	// managed spec_inventory answers.
	const first = await connectAndObserve({ cwd, modules, timeoutMs, requestId: "lifecycle-reload-inventory" });
	await writeLifecycleRecord(receiptsOut, "reload.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-4",
		claim: "reload",
		observedVersion: args["--expected-version"],
		details: {
			capabilityId: first.reloaded.capability?.id ?? null,
			loadedConfigNames: first.reloaded.loadedNames,
			returnedSpecs: first.inventory.returned,
			observedSpecs: first.inventory.observed,
		},
		observations: [{ id: "reload-managed-query", text: first.inventory.text }],
	}));

	// Phase 3: fresh-session activation — spawn SELF as a new process.
	const child = spawnSync("bun", [
		fileURLToPath(import.meta.url),
		"--runtime-root", args["--runtime-root"],
		"--candidate-package-root", args["--candidate-package-root"],
		"--project-dir", args["--project-dir"],
		"--receipts-out", args["--receipts-out"],
		"--expected-version", args["--expected-version"],
		"--phase-timeout-ms", args["--phase-timeout-ms"],
		"--observe-child",
	], { cwd, env: process.env, encoding: "utf8" });
	if (child.error) fail(`fresh-session child failed to launch: ${child.error.message}`);
	if (child.status !== 0) fail(`fresh-session child exited ${child.status}: ${(child.stderr || "").slice(-2000) || "<no stderr>"}`);
	let childObservation;
	try {
		childObservation = JSON.parse(child.stdout);
	} catch (error) {
		fail(`fresh-session child printed unusable JSON (${error.message}): ${String(child.stdout).slice(0, 200)}`);
	}
	await writeLifecycleRecord(receiptsOut, "fresh-session-activation.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-4",
		claim: "fresh-session-activation",
		observedVersion: args["--expected-version"],
		details: {
			childExitCode: child.status,
			childProcess: true,
			childEnrollmentPerformed: false,
			returnedSpecs: childObservation.returnedSpecs,
			observedSpecs: childObservation.observedSpecs,
		},
		observations: [{ id: "fresh-session-child-query", text: childObservation.inventoryText }],
	}));

	// Phase 4: one more bounded managed inventory query in the parent.
	const second = await connectAndObserve({ cwd, modules, timeoutMs, requestId: "lifecycle-inventory-final" });
	await writeLifecycleRecord(receiptsOut, "inventory.json", baseLifecycleRecord({
		requirement: "plugin-distribution:FR-4",
		claim: "inventory",
		observedVersion: args["--expected-version"],
		details: {
			returnedSpecs: second.inventory.returned,
			observedSpecs: second.inventory.observed,
		},
		observations: [{ id: "final-managed-query", text: second.inventory.text }],
	}));

	process.stdout.write(`install/reload/fresh-session/inventory records written to ${receiptsOut}\n`);
}

await main();

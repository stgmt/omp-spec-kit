// Shared helpers for the real distribution lifecycle producers. Every helper
// drives the pinned OMP 17.3.7 runtime exactly the way
// scripts/probe-omp-discovery-v17.3.7.mjs does: bounded phases, fresh HOME
// isolation supplied by the caller, and no fabricated observations.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function fail(message) {
	throw new Error(`lifecycle: ${message}`);
}
export const DEFAULT_PHASE_TIMEOUT_MS = 30000;
export const MAX_PHASE_TIMEOUT_MS = 120000;

export function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export class PhaseTimeout extends Error {
	constructor(name, timeoutMs) {
		super(`Phase ${name} exceeded ${timeoutMs}ms`);
		this.name = "PhaseTimeout";
	}
}

export function resolvePhaseTimeoutMs(value) {
	const parsed = Number(value ?? String(DEFAULT_PHASE_TIMEOUT_MS));
	if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PHASE_TIMEOUT_MS) {
		throw new Error(`phase timeout must be an integer from 1 through ${MAX_PHASE_TIMEOUT_MS}`);
	}
	return parsed;
}

export async function phase(name, timeoutMs, operation) {
	const started = Date.now();
	let timeoutId;
	try {
		const value = await Promise.race([
			Promise.resolve().then(operation),
			new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new PhaseTimeout(name, timeoutMs)), timeoutMs); }),
		]);
		return { ok: true, value };
	} catch (error) {
		return { ok: false, error };
	} finally {
		clearTimeout(timeoutId);
	}
}

// The pinned runtime ships TypeScript sources; the probe passes the package
// root (…/node_modules/@oh-my-pi/pi-coding-agent), not the fixture host, and
// resolves pi-utils from that package's own dependency tree.
export async function loadRuntimeModules(runtimePackageRoot, cwd) {
	const fromRuntime = (relative) => import(pathToFileURL(path.join(runtimePackageRoot, relative)).href);
	const [discovery, capabilityModule, configModule, managerModule, pluginsModule] = await Promise.all([
		fromRuntime("src/discovery/index.ts"),
		fromRuntime("src/capability/mcp.ts"),
		fromRuntime("src/mcp/config.ts"),
		fromRuntime("src/mcp/manager.ts"),
		fromRuntime("src/extensibility/plugins/manager.ts"),
	]);
	const piUtils = await import(pathToFileURL(path.join(runtimePackageRoot, "node_modules", "@oh-my-pi", "pi-utils", "src", "index.ts")).href).catch(async () => {
		const fixtureHost = path.resolve(runtimePackageRoot, "..", "..", "..");
		return import(pathToFileURL(path.join(fixtureHost, "node_modules", "@oh-my-pi", "pi-utils", "src", "index.ts")).href);
	});
	if (process.cwd() !== cwd || piUtils.getProjectDir() !== cwd) {
		fail(`session must start at project root; process=${process.cwd()} project=${piUtils.getProjectDir()} expected=${cwd}`);
	}
	return { discovery, mcpCapability: capabilityModule.mcpCapability, loadAllMCPConfigs: configModule.loadAllMCPConfigs, MCPManager: managerModule.MCPManager, PluginManager: pluginsModule.PluginManager, piUtils };
}

// Installs a plugin package into the isolated profile via PluginManager.link.
export async function enroll(cwd, packageRoot, modules, timeoutMs = DEFAULT_PHASE_TIMEOUT_MS) {
	const result = await phase("enroll", timeoutMs, async () => {
		const installed = await new modules.PluginManager(cwd).link(packageRoot);
		const lockfilePath = modules.piUtils.getPluginsLockfile();
		const linkPath = path.join(modules.piUtils.getPluginsNodeModules(), installed.name);
		const lockfileText = await readFile(lockfilePath, "utf8");
		const linkedManifest = JSON.parse(await readFile(path.join(linkPath, "package.json"), "utf8"));
		if (!installed || typeof installed.version !== "string" || typeof installed.name !== "string") {
			fail("PluginManager.link returned no usable InstalledPlugin identity");
		}
		if (linkedManifest.version !== installed.version) {
			fail(`linked tree declares version ${linkedManifest.version}, InstalledPlugin reports ${installed.version}`);
		}
		if (!lockfileText.includes(installed.name)) {
			fail(`plugins lockfile does not reference ${installed.name}`);
		}
		return { installed, lockfilePath, linkPath, lockfileText };
	});
	if (!result.ok) fail(`enrollment failed: ${result.error.message}`);
	return result.value;
}

// Re-runs capability discovery plus the full MCP config load and asserts the
// target plugin's converted config/source are present — the reload observable.
export async function reloadCapability(cwd, targetName, modules, timeoutMs = DEFAULT_PHASE_TIMEOUT_MS) {
	const result = await phase("reload", timeoutMs, async () => {
		const capability = await modules.discovery.loadCapability(modules.mcpCapability.id, { cwd });
		const configLoad = await modules.loadAllMCPConfigs(cwd, { enableProjectConfig: true, filterExa: true, filterBrowser: false });
		const loadedNames = Object.keys(configLoad.configs).sort();
		if (!(targetName in configLoad.configs) || !(targetName in configLoad.sources)) {
			fail(`reloaded config/source missing ${targetName}; loaded: ${loadedNames.join(", ") || "<none>"}`);
		}
		return {
			capability,
			targetConfigs: { [targetName]: configLoad.configs[targetName] },
			targetSources: { [targetName]: configLoad.sources[targetName] },
			loadedNames,
		};
	});
	if (!result.ok) fail(`reload failed: ${result.error.message}`);
	return result.value;
}

// Asserts the converted MCP config for `targetName` is ABSENT after uninstall.
export async function assertCapabilityAbsent(cwd, targetName, modules, timeoutMs = DEFAULT_PHASE_TIMEOUT_MS) {
	const result = await phase("assert-absent", timeoutMs, async () => {
		const configLoad = await modules.loadAllMCPConfigs(cwd, { enableProjectConfig: true, filterExa: true, filterBrowser: false });
		const loadedNames = Object.keys(configLoad.configs).sort();
		if (targetName in configLoad.configs || targetName in configLoad.sources) {
			fail(`${targetName} still present after uninstall; loaded: ${loadedNames.join(", ") || "<none>"}`);
		}
		return { loadedNames };
	});
	if (!result.ok) fail(`absence assertion failed: ${result.error.message}`);
	return result.value;
}

// Connects only the target server through a fresh MCPManager and returns its
// spec_inventory tool handle. Caller owns disconnect().
export async function loadAndConnect(cwd, targetName, targetConfigs, targetSources, modules, timeoutMs = DEFAULT_PHASE_TIMEOUT_MS) {
	const manager = new modules.MCPManager(cwd);
	const result = await phase("connect", timeoutMs, async () => {
		const connectionResult = await manager.connectServers(targetConfigs, targetSources, () => {});
		if (!(connectionResult.connectedServers ?? []).includes(targetName)) {
			throw new Error(`server ${targetName} did not connect; connected: ${(connectionResult.connectedServers ?? []).join(", ") || "<none>"}`);
		}
		const tool = manager.getTools().find((candidate) =>
			candidate.mcpServerName === targetName && candidate.mcpToolName === "spec_inventory",
		);
		if (!tool) throw new Error(`OMP manager did not expose ${targetName}/spec_inventory`);
		return { tool, toolCount: connectionResult.tools.length };
	});
	if (!result.ok) throw new Error(`connect failed: ${result.error.message}`);
	return { manager, ...result.value };
}

// Executes spec_inventory and parses the documented text result.
export async function executeInventory(tool, requestId, timeoutMs = DEFAULT_PHASE_TIMEOUT_MS) {
	const args = {
		schemaVersion: "spec-kernel@1",
		requestId,
		specSlugs: [],
		includeDocuments: false,
		limit: 50,
		cursor: null,
	};
	const result = await phase("inventory", timeoutMs, async () => {
		const outcome = await tool.execute(requestId, args, undefined, {});
		const content = outcome.content;
		if (
			outcome.isError ||
			!Array.isArray(content) ||
			content.length !== 1 ||
			content[0]?.type !== "text" ||
			typeof content[0].text !== "string"
		) {
			throw new Error(`spec_inventory did not return its documented text result: ${JSON.stringify(outcome)}`);
		}
		const text = content[0].text;
		const inventoryMatch = /^inventory ok, returned=(\d+)\/(\d+)$/u.exec(text);
		if (!inventoryMatch) throw new Error(`spec_inventory returned unexpected text: ${JSON.stringify(text)}`);
		const returned = Number(inventoryMatch[1]);
		const observed = Number(inventoryMatch[2]);
		if (!Number.isSafeInteger(returned) || !Number.isSafeInteger(observed) || returned > observed) {
			throw new Error(`spec_inventory returned invalid counts: ${text}`);
		}
		return { text, args, returned, observed };
	});
	if (!result.ok) throw new Error(`inventory failed: ${result.error.message}`);
	return result.value;
}

export async function disconnectManager(manager) {
	try {
		await manager.disconnectAll();
	} catch {
		// Best-effort teardown; producers report their own phase failures.
	}
}

// Binds one receipt observation to the bundle fixture digest.
export function boundObservation(id, summary, fixtureDigest) {
	const text = summary.length > 512 ? `${summary.slice(0, 511)}…` : summary;
	if (typeof text !== "string" || text.trim() === "") fail(`observation ${id} needs a non-empty summary`);
	return Object.freeze({ fixtureDigest, id: String(id), outcome: "passed", summary: text });
}

// Canonical raw-record shape every runner writes and the evidence builder
// validates: schema, status, FR binding, expected/observed versions, free-form
// bounded details, and observation entries carrying real proof text.
export function baseLifecycleRecord({ requirement, claim, expectedVersion, observedVersion, details = {}, observations = [] }) {
	const record = {
		schema: "omp-spec-kit-lifecycle-observation@1",
		status: "passed",
		requirement,
		claim,
		details,
		observations,
	};
	if (expectedVersion !== undefined) record.expectedVersion = expectedVersion;
	if (observedVersion !== undefined) record.observedVersion = observedVersion;
	return record;
}

// Raw producer output written by every lifecycle runner. The distribution
// evidence builder composes these into final producer receipts bound to the
// candidate identity and the bundle fixture digest; nothing here fabricates
// identity fields it cannot observe.
export async function writeLifecycleRecord(receiptsOut, fileName, record) {
	const { mkdir, writeFile } = await import("node:fs/promises");
	await mkdir(receiptsOut, { recursive: true });
	const target = path.join(receiptsOut, fileName);
	await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, "utf8");
	return target;
}

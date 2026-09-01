#!/usr/bin/env bun
/**
 * Captures OMP 18.0.11's MCP capability-to-manager handoff without a model turn.
 * The probe is intentionally bounded: every phase is checkpointed and receives
 * the same deadline, while a connect timeout still attempts manager cleanup.
 * Run only from a disposable Bun dependency host with an isolated HOME/profile.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PHASE_NAMES = ["payload", "imports", "enrollment", "capability-config-load", "manager-construction", "target-only-connection", "managed-query", "managed-authoring", "disconnect", "receipt"];

function requiredFlag(name) {
	const index = process.argv.indexOf(name);
	const value = index === -1 ? undefined : process.argv[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`Missing ${name}`);
	return path.resolve(value);
}
function optionalFlag(name, fallback) {
	const index = process.argv.indexOf(name);
	return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}
function requiredSha256Flag(name) {
	const value = optionalFlag(name, "");
	if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${name} must be a lowercase SHA-256 digest`);
	return value;
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function portablePath(value, roots) {
	if (typeof value !== "string") return value;
	for (const [absolute, replacement] of roots) {
		if (value === absolute) return replacement;
		if (value.startsWith(`${absolute}${path.sep}`)) return `${replacement}/${value.slice(absolute.length + 1).replaceAll("\\", "/")}`;
	}
	return value;
}
function redact(value, roots, field = "") {
	if (Array.isArray(value)) return value.map(item => redact(item, roots, field));
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [
		key,
		/(?:token|secret|password|authorization|api[_-]?key)/i.test(key) && !/(?:count|length)$/i.test(key) ? "<redacted>" : redact(item, roots, key),
	]));
	if (typeof value !== "string") return value;
	let result = field === "path" || field === "command" || field === "cwd" ? portablePath(value, roots) : value;
	for (const [absolute, replacement] of roots) {
		result = result.split(absolute).join(replacement);
		result = result.split(absolute.replaceAll("\\", "/")).join(replacement);
	}
	return result.replace(/[A-Za-z]:[\\/]+Users[\\/][^\\/]+/gu, "<home>").replaceAll("\\", "/");
}
function errorReceipt(error) {
	return { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) };
}
class PhaseTimeout extends Error {
	constructor(name, timeoutMs) {
		super(`Phase ${name} exceeded ${timeoutMs}ms`);
		this.name = "PhaseTimeout";
	}
}
async function payloadFile(packageRoot, relative) {
	if (path.isAbsolute(relative) || relative.split(/[\\/]/u).includes("..")) {
		throw new Error(`Payload path must stay inside package root: ${relative}`);
	}
	const absolute = path.join(packageRoot, relative);
	const info = await stat(absolute);
	if (!info.isFile()) throw new Error(`Required payload is not a regular file: ${relative}`);
	const bytes = await readFile(absolute);
	return { relative, bytes: bytes.length, sha256: sha256(bytes) };
}

async function verifyCopiedPayload(packageRoot, packageManifest, packageMcpText, expectedDistManifestSha256, expectedLauncherSha256) {
	const [distManifestText, launcher] = await Promise.all([
		readFile(path.join(packageRoot, "dist", "manifest.json"), "utf8"),
		payloadFile(packageRoot, "bin/omp-spec-kit-mcp"),
	]);
	const distManifestSha256 = sha256(distManifestText);
	if (distManifestSha256 !== expectedDistManifestSha256) {
		throw new Error(`Copied dist manifest hash differs from verified build output: ${distManifestSha256}`);
	}
	if (launcher.sha256 !== expectedLauncherSha256) {
		throw new Error(`Copied launcher hash differs from verified build output: ${launcher.sha256}`);
	}
	let distManifest;
	let mcpConfig;
	try {
		distManifest = JSON.parse(distManifestText);
		mcpConfig = JSON.parse(packageMcpText);
	} catch (error) {
		throw new Error(`Copied package metadata is not JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (
		distManifest?.schema !== "omp-spec-kit-dist-manifest@1" ||
		distManifest?.pluginVersion !== packageManifest.version ||
		!distManifest.files ||
		typeof distManifest.files !== "object" ||
		Array.isArray(distManifest.files)
	) {
		throw new Error("Copied dist manifest schema, version, or files map is invalid");
	}
	const distFiles = await Promise.all(Object.entries(distManifest.files).map(async ([relative, entry]) => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry) || !/^[a-f0-9]{64}$/u.test(entry.sha256)) {
			throw new Error(`Invalid digest entry in copied dist manifest: ${relative}`);
		}
		const file = await payloadFile(packageRoot, path.posix.join("dist", relative));
		if (file.sha256 !== entry.sha256) throw new Error(`Copied payload hash does not match dist manifest: ${file.relative}`);
		return file;
	}));
	const server = mcpConfig?.mcpServers?.[packageManifest.name];
	if (server?.type !== "stdio" || server.command !== "./bin/omp-spec-kit-mcp") {
		throw new Error("Copied MCP declaration does not bind the verified launcher");
	}
	return {
		distManifest: {
			relative: "dist/manifest.json",
			sha256: distManifestSha256,
			expectedSha256: expectedDistManifestSha256,
			fileCount: distFiles.length,
			files: distFiles,
		},
		launcher: { ...launcher, expectedSha256: expectedLauncherSha256 },
	};
}

const runtimeRoot = requiredFlag("--runtime-root");
const cwd = requiredFlag("--cwd");
const packageRoot = requiredFlag("--package-root");
const phaseMode = optionalFlag("--phase-mode", "bounded");
const phaseTimeoutMs = Number(optionalFlag("--phase-timeout-ms", "30000"));
const expectedDistManifestSha256 = requiredSha256Flag("--expected-dist-manifest-sha256");
const expectedLauncherSha256 = requiredSha256Flag("--expected-launcher-sha256");
if (phaseMode !== "bounded") throw new Error(`Unsupported --phase-mode ${phaseMode}; use bounded`);
if (!Number.isSafeInteger(phaseTimeoutMs) || phaseTimeoutMs < 1 || phaseTimeoutMs > 120000) {
	throw new Error("--phase-timeout-ms must be an integer from 1 through 120000");
}
const homeValue = process.env.HOME ?? process.env.USERPROFILE;
if (!homeValue) throw new Error("HOME or USERPROFILE is required");
const home = path.resolve(homeValue);
const roots = [[home, "<home>"], [packageRoot, "<package-copy>"], [cwd, "<project>"], [runtimeRoot, "<runtime-root>"]];
const checkpoints = Object.fromEntries(PHASE_NAMES.map(name => [name, { status: "pending" }]));
const partial = { checkpoints };

async function phase(name, operation) {
	const checkpoint = checkpoints[name];
	checkpoint.status = "running";
	checkpoint.startedAt = new Date().toISOString();
	const started = Date.now();
	let timeoutId;
	try {
		const value = await Promise.race([
			Promise.resolve().then(operation),
			new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new PhaseTimeout(name, phaseTimeoutMs)), phaseTimeoutMs); }),
		]);
		checkpoint.status = "completed";
		checkpoint.elapsedMs = Date.now() - started;
		return { ok: true, value };
	} catch (error) {
		checkpoint.status = error instanceof PhaseTimeout ? "timed-out" : "failed";
		checkpoint.elapsedMs = Date.now() - started;
		checkpoint.error = errorReceipt(error);
		return { ok: false, error };
	} finally {
		clearTimeout(timeoutId);
	}
}
function skipPending(after) {
	for (const name of PHASE_NAMES.slice(PHASE_NAMES.indexOf(after) + 1)) {
		if (checkpoints[name].status === "pending") checkpoints[name] = { status: "skipped", reason: `Prerequisite phase ${after} did not complete` };
	}
}
function inspectManager(manager) {
	const serverNames = manager.getAllServerNames();
	return {
		serverNames,
		servers: Object.fromEntries(serverNames.map(name => [name, {
			source: manager.getSource(name),
			config: manager.getServerConfig(name),
			status: manager.getConnectionStatus(name),
		}])),
	};
}
async function managedTool(name) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const tools = connectionResult.tools.length > 0 ? connectionResult.tools : manager.getTools();
		const tool = tools.find(candidate => candidate.mcpServerName === configInspection.targetName && candidate.mcpToolName === name);
		if (tool) {
			connectionResult.tools = tools;
			connectionResult.connectedServers = manager.getAllServerNames();
			return tool;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw new Error("OMP manager did not expose omp-spec-kit/" + name);
}
async function executeManagedTool(name, args, callId) {
	const tool = await managedTool(name);
	const result = await tool.execute(callId, args, undefined, {});
	const text = result.content?.[0]?.type === "text" ? result.content[0].text : "";
	if (result.isError || text.length === 0) throw new Error("OMP-managed " + name + " returned an error or empty text result");
	let envelope;
	try { envelope = JSON.parse(text); } catch (error) { throw new Error("OMP-managed " + name + " did not expose its structured result: " + error.message); }
	if (!envelope || typeof envelope !== "object") throw new Error("OMP-managed " + name + " returned a non-object envelope");
	return { tool, result, envelope };
}

let runtimePackage;
let packageManifest;
let packageMcpText;
let harnessText;
let runtimePackageText;
let packageManifestText;
let payload;
let payloadVerification;
let imported;
let enrollment;
let lockfilePath;
let linkPath;
let lockfileText;
let linkedPackageManifest;
let configLoad;
let capability;
let configInspection;
let manager;
let statusEvents = [];
let connectionResult;
let disconnectDetails;
let managedAuthoring;
let terminalPhase;
const payloadResult = await phase("payload", async () => {
	const runtimePackagePath = path.join(runtimeRoot, "package.json");
	const packageManifestPath = path.join(packageRoot, "package.json");
	const packageMcpPath = path.join(packageRoot, ".mcp.json");
	const values = await Promise.all([
		readFile(runtimePackagePath, "utf8"),
		readFile(packageManifestPath, "utf8"),
		readFile(packageMcpPath, "utf8"),
		readFile(fileURLToPath(import.meta.url)),
		Promise.all(["bin/omp-spec-kit-mcp", "dist/extension.js", "dist/mcp/server.js"].map(relative => payloadFile(packageRoot, relative))),
	]);
	[runtimePackageText, packageManifestText, packageMcpText, harnessText, payload] = values;
	runtimePackage = JSON.parse(runtimePackageText);
	packageManifest = JSON.parse(packageManifestText);
	if (runtimePackage.name !== "@oh-my-pi/pi-coding-agent" || runtimePackage.version !== "18.0.11") {
		throw new Error(`Expected @oh-my-pi/pi-coding-agent@18.0.11, got ${runtimePackage.name}@${runtimePackage.version}`);
	}
	payloadVerification = await verifyCopiedPayload(
		packageRoot,
		packageManifest,
		packageMcpText,
		expectedDistManifestSha256,
		expectedLauncherSha256,
	);
	return {
		runtime: `${runtimePackage.name}@${runtimePackage.version}`,
		package: `${packageManifest.name}@${packageManifest.version}`,
		payload,
		verification: payloadVerification,
	};
});
if (!payloadResult.ok) terminalPhase = "payload";

if (!terminalPhase) {
	const importsResult = await phase("imports", async () => {
		const fromRuntime = relative => import(pathToFileURL(path.join(runtimeRoot, relative)).href);
		const [discovery, capabilityModule, configModule, managerModule, pluginsModule, piUtils] = await Promise.all([
			fromRuntime("src/discovery/index.ts"),
			fromRuntime("src/capability/mcp.ts"),
			fromRuntime("src/mcp/config.ts"),
			fromRuntime("src/mcp/manager.ts"),
			fromRuntime("src/extensibility/plugins/manager.ts"),
			import(pathToFileURL(path.join(runtimeRoot, "..", "pi-utils", "src", "index.ts")).href),
		]);
		imported = { discovery, mcpCapability: capabilityModule.mcpCapability, loadAllMCPConfigs: configModule.loadAllMCPConfigs, MCPManager: managerModule.MCPManager, PluginManager: pluginsModule.PluginManager, piUtils };
		if (process.cwd() !== cwd || imported.piUtils.getProjectDir() !== cwd) {
			throw new Error(`Probe must start at project root; process=${process.cwd()} project=${imported.piUtils.getProjectDir()} expected=${cwd}`);
		}
		return {
			modules: ["discovery", "mcp-capability", "mcp-config", "mcp-manager", "plugin-manager", "pi-utils"],
			projectRoot: { processCwd: process.cwd(), piUtilsProjectDir: imported.piUtils.getProjectDir() },
		};
	});
	if (!importsResult.ok) terminalPhase = "imports";
}

if (!terminalPhase) {
	const enrollmentResult = await phase("enrollment", async () => {
		enrollment = await new imported.PluginManager(cwd).link(packageRoot);
		linkPath = path.join(imported.piUtils.getPluginsNodeModules(), packageManifest.name);
		lockfilePath = imported.piUtils.getPluginsLockfile();
		[lockfileText, linkedPackageManifest] = await Promise.all([
			readFile(lockfilePath, "utf8"),
			readFile(path.join(linkPath, "package.json"), "utf8"),
		]);
		return { result: enrollment, lockfilePath, linkPath };
	});
	if (!enrollmentResult.ok) terminalPhase = "enrollment";
}

if (!terminalPhase) {
	const configResult = await phase("capability-config-load", async () => {
		capability = await imported.discovery.loadCapability(imported.mcpCapability.id, { cwd });
		configLoad = await imported.loadAllMCPConfigs(cwd, { enableProjectConfig: true, filterExa: true, filterBrowser: false });
		const loadedNames = Object.keys(configLoad.configs).sort();
		const targetName = packageManifest.name + ":" + packageManifest.name;
		const packageMcp = JSON.parse(packageMcpText);
		const packageServer = packageMcp?.mcpServers?.[packageManifest.name];
		if (!packageServer || typeof packageServer.command !== "string") {
			throw new Error("Verified package MCP declaration missing " + packageManifest.name);
		}
		const targetConfigs = { [targetName]: { ...packageServer, command: path.resolve(packageRoot, packageServer.command), env: { ...(packageServer.env ?? {}), OMP_SPEC_KIT_STAGE: "v0.4.0" } } };
		const targetSources = { [targetName]: configLoad.sources[targetName] ?? { provider: "probe", providerName: "verified-package-copy", path: path.join(packageRoot, ".mcp.json"), level: "project" } };
		configInspection = {
			targetName,
			packageName: packageManifest.name,
			loadedNames,
			targetConfigs,
			targetSources,
			excludedNames: loadedNames.filter(name => name !== targetName),
		};
		return configInspection;
	});
	if (!configResult.ok) terminalPhase = "capability-config-load";
}

if (!terminalPhase) {
	const managerResult = await phase("manager-construction", async () => {
		manager = new imported.MCPManager(cwd);
		return {
			construction: "new MCPManager(cwd)",
			projectRoot: { processCwd: process.cwd(), piUtilsProjectDir: imported.piUtils.getProjectDir() },
		};
	});
	if (!managerResult.ok) terminalPhase = "manager-construction";
}

if (!terminalPhase) {
	const connectionResultPhase = await phase("target-only-connection", async () => {
		if (Object.keys(configInspection.targetConfigs).length !== 1 || Object.keys(configInspection.targetConfigs)[0] !== configInspection.targetName) {
			throw new Error("Target-only config assertion failed before connectServers");
		}
		connectionResult = await manager.connectServers(configInspection.targetConfigs, configInspection.targetSources, event => statusEvents.push(event));
		return {
			inputNames: Object.keys(configInspection.targetConfigs),
			connectedServers: connectionResult.connectedServers,
			errors: Object.fromEntries(connectionResult.errors),
			exaApiKeysCount: connectionResult.exaApiKeys.length,
			toolCount: connectionResult.tools.length,
		};
	});
	if (!connectionResultPhase.ok) terminalPhase = "target-only-connection";
}

if (!terminalPhase) {
	const managedQueryResult = await phase("managed-query", async () => {
		const tool = await managedTool("spec_inventory");
		const args = {
			schemaVersion: "spec-kernel@1",
			requestId: "omp-manager-handoff-probe",
			specSlugs: [],
			includeDocuments: false,
			limit: 50,
			cursor: null,
		};
		const result = await tool.execute("omp-manager-handoff-probe", args, undefined, {});
		const content = result.content;
		if (
			result.isError ||
			!Array.isArray(content) ||
			content.length !== 1 ||
			content[0]?.type !== "text" ||
			typeof content[0].text !== "string"
		) {
			throw new Error(`OMP-managed spec_inventory query did not return its documented text result: ${JSON.stringify(result)}`);
		}
		const text = content[0].text;
		const inventoryMatch = /^inventory ok, returned=(\d+)\/(\d+)$/u.exec(text);
		if (!inventoryMatch) {
			throw new Error(`OMP-managed spec_inventory query returned an unexpected text result: ${JSON.stringify(text)}`);
		}
		const returnedCount = Number(inventoryMatch[1]);
		const observedCount = Number(inventoryMatch[2]);
		if (!Number.isSafeInteger(returnedCount) || !Number.isSafeInteger(observedCount) || returnedCount > observedCount) {
			throw new Error(`OMP-managed spec_inventory query returned invalid inventory counts: ${text}`);
		}
		connectionResult.managedQuery = {
			tool: { name: tool.name, mcpServerName: tool.mcpServerName, mcpToolName: tool.mcpToolName },
			args,
			result: {
				isError: false,
				details: {
					serverName: result.details?.serverName,
					mcpToolName: result.details?.mcpToolName,
					provider: result.details?.provider,
					providerName: result.details?.providerName,
				},
				content: { text, returnedCount, observedCount },
			},
			childRoot: {
				configHasCwd: Object.hasOwn(configInspection.targetConfigs[configInspection.targetName], "cwd"),
				processCwd: process.cwd(),
				piUtilsProjectDir: imported.piUtils.getProjectDir(),
			},
		};
		return connectionResult.managedQuery;
	});
	if (!managedQueryResult.ok) terminalPhase = "managed-query";
}
if (!terminalPhase) {
	const managedAuthoringResult = await phase("managed-authoring", async () => {
		const overviewCall = await executeManagedTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "omp-manager-overview", specSlugs: [] }, "omp-manager-overview");
		if (!overviewCall.envelope.ok || typeof overviewCall.envelope.graph?.fingerprint !== "string") throw new Error("OMP-managed spec_overview did not return a graph fingerprint");
		const proposalCall = await executeManagedTool("propose_patch", {
			schemaVersion: "spec-kernel@1",
			requestId: "omp-manager-proposal",
			repositoryRootFingerprint: overviewCall.envelope.graph.fingerprint,
			spec: "plugin-distribution",
			reason: "OMP managed authoring proof",
			operations: [{ kind: "insert_at_eof", document: "README.md", text: "OMP managed authoring proof" }],
		}, "omp-manager-proposal");
		if (!proposalCall.envelope.ok || !proposalCall.envelope.data?.proposalHash) throw new Error("OMP-managed propose_patch did not return a Proposal");
		const expectedDocuments = proposalCall.envelope.data.operations.map(operation => ({ path: operation.path, beforeSha256: operation.beforeSha256 }));
		const applyCall = await executeManagedTool("apply_proposed_patch", {
			schemaVersion: "spec-kernel@1",
			requestId: "omp-manager-apply",
			proposalId: proposalCall.envelope.data.proposalId,
			proposalSha256: proposalCall.envelope.data.proposalHash,
			expectedDocuments,
			reason: "OMP managed authoring proof",
			approval: "approve",
		}, "omp-manager-apply");
		if (!applyCall.envelope.ok || applyCall.envelope.data?.outcome !== "APPLIED") throw new Error("OMP-managed apply_proposed_patch did not apply the Proposal");
		const target = path.join(cwd, ".specs", "plugin-distribution", "README.md");
		const finalBytes = await readFile(target, "utf8");
		if (!finalBytes.includes("OMP managed authoring proof")) throw new Error("OMP-managed apply did not change the project document");
		const finalOverview = await executeManagedTool("spec_overview", { schemaVersion: "spec-kernel@1", requestId: "omp-manager-final-overview", specSlugs: [] }, "omp-manager-final-overview");
		if (!finalOverview.envelope.ok || finalOverview.envelope.graph?.valid !== true) throw new Error("OMP-managed final spec_overview did not return a valid graph");
		managedAuthoring = {
			toolNames: [overviewCall.tool.mcpToolName, proposalCall.tool.mcpToolName, applyCall.tool.mcpToolName],
			proposalHash: proposalCall.envelope.data.proposalHash,
			applyOutcome: applyCall.envelope.data.outcome,
			changedDocuments: applyCall.envelope.data.receipt?.changedDocuments ?? [],
			finalDocumentContainsMarker: true,
			finalGraphValid: true,
		};
		return managedAuthoring;
	});
	if (!managedAuthoringResult.ok) terminalPhase = "managed-authoring";
}
if (manager) {
	const disconnectResult = await phase("disconnect", async () => {
		const before = inspectManager(manager);
		await manager.disconnectAll();
		disconnectDetails = { before, after: inspectManager(manager) };
		return disconnectDetails;
	});
	if (!disconnectResult.ok && !terminalPhase) terminalPhase = "disconnect";
} else {
	checkpoints.disconnect = { status: "skipped", reason: "MCPManager was not constructed" };
}

const receiptResult = await phase("receipt", async () => {
	if (terminalPhase) skipPending(terminalPhase);
	const managerStateAfterDisconnect = manager ? inspectManager(manager) : undefined;
	return {
		schema: "omp-manager-handoff-probe@2",
		result: terminalPhase ? "incomplete" : "completed",
		phaseMode: { mode: phaseMode, timeoutMs: phaseTimeoutMs, terminalPhase: terminalPhase ?? null, checkpoints },
		provenance: payload ? {
			harness: { path: "scripts/probe-omp-discovery-v18.0.11.mjs", sha256: sha256(harnessText) },
			runtime: { name: runtimePackage.name, version: runtimePackage.version, packageJsonSha256: sha256(runtimePackageText) },
			package: {
				name: packageManifest.name,
				version: packageManifest.version,
				packageJsonSha256: sha256(packageManifestText),
				mcpJsonSha256: sha256(packageMcpText),
				payload,
				verification: payloadVerification,
			},
		} : undefined,
		enrollment: enrollment ? {
			method: "new PluginManager(cwd).link(packageRoot)", result: enrollment,
			lockfile: { path: portablePath(lockfilePath, roots), sha256: sha256(lockfileText), contents: JSON.parse(lockfileText) },
			link: { path: portablePath(linkPath, roots), packageJsonSha256: sha256(linkedPackageManifest) },
		} : undefined,
		capability: capability ? { id: imported.mcpCapability.id, providers: capability.providers, warnings: capability.warnings, items: capability.items, all: capability.all } : undefined,
		configLoad: configLoad ? { options: { enableProjectConfig: true, filterExa: true, filterBrowser: false }, inspection: configInspection } : undefined,
		manager: manager ? {
			construction: "new MCPManager(cwd)",
			statusEvents,
			connectionResult: connectionResult ? {
				connectedServers: connectionResult.connectedServers,
				errors: Object.fromEntries(connectionResult.errors),
				exaApiKeysCount: connectionResult.exaApiKeys.length,
				toolCount: connectionResult.tools.length,
				managedQuery: connectionResult.managedQuery,
				managedAuthoring,
			} : undefined,
			disconnect: disconnectDetails,
			stateAfterDisconnect: managerStateAfterDisconnect,
		} : undefined,
	};
});
if (!receiptResult.ok) {
	console.log(JSON.stringify(redact({ schema: "omp-manager-handoff-probe@2", result: "incomplete", phaseMode: { mode: phaseMode, timeoutMs: phaseTimeoutMs, terminalPhase: terminalPhase ?? "receipt", checkpoints } }, roots), null, 2));
	process.exitCode = 1;
} else {
	console.log(JSON.stringify(redact(receiptResult.value, roots), null, 2));
	if (terminalPhase) process.exitCode = 1;
}

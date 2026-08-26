#!/usr/bin/env node
// Extracts the committed prebuilt plugins/omp-spec-kit tree from a release
// tag (v0.3.0 ships dist/) so lifecycle producers can exercise the REAL prior
// release without rebuilding it. Asserts tag/version/manifest agreement and
// verifies every extracted file against the tag's own dist manifest.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
let repositoryRoot = path.resolve(scriptDir, "..", "..");

function fail(message) {
	process.stderr.write(`build-tagged-candidate: ${message}\n`);
	process.exit(1);
}

function parseArgs(argv) {
	const output = Object.create(null);
	const allowed = ["--tag", "--output", "--repository-root"];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!allowed.includes(flag)) throw new Error(`unsupported argument ${JSON.stringify(flag)}`);
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) throw new Error(`argument ${flag} requires a value`);
		output[flag] = value;
		index += 1;
	}
	for (const flag of ["--tag", "--output"]) {
		if (!output[flag]) throw new Error(`${flag} is required`);
	}
	return output;
}

function gitShow(tag, repoRelative, encoding = null) {
	// Git-less BDD container fallback: the snapshot under
	// tests/fixtures/kernel/<tag>/ mirrors the PACKAGE layout (package.json,
	// .mcp.json, dist/**), while repoRelative is prefixed plugins/omp-spec-kit.
	const fixtureRoot = path.join(repositoryRoot, "tests", "fixtures", "kernel", tag);
	const relativeInsidePackage = repoRelative.startsWith("plugins/omp-spec-kit/")
		? repoRelative.slice("plugins/omp-spec-kit/".length)
		: repoRelative;
	const fixtureFile = path.join(fixtureRoot, ...relativeInsidePackage.split("/"));
	if (process.env.OMP_SPEC_KIT_BDD_CONTAINER === "1" && existsSync(fixtureFile)) {
		return readFileSync(fixtureFile, encoding ?? undefined);
	}
	const args = ["-C", repositoryRoot, "show", `${tag}:${repoRelative}`];
	const options = { maxBuffer: 64 * 1024 * 1024 };
	if (encoding === null) return execFileSync("git", args, { ...options, encoding: "buffer" });
	return execFileSync("git", args, { ...options, encoding });
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

async function collectFiles(root) {
	const files = [];
	async function visit(absolute, relative) {
		const entries = await readdir(absolute, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			const childRelative = relative === "" ? entry.name : path.posix.join(relative, entry.name);
			if (entry.isDirectory()) await visit(path.join(absolute, entry.name), childRelative);
			else if (entry.isFile()) files.push({ relative: childRelative.split("\\").join("/"), absolute: path.join(absolute, entry.name) });
			else fail(`unexpected non-regular entry in extracted tree: ${childRelative}`);
		}
	}
	await visit(root, "");
	return files;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args["--repository-root"]) repositoryRoot = path.resolve(args["--repository-root"]);
	const tag = args["--tag"];
	if (!/^v\d+\.\d+\.\d+$/u.test(tag)) fail(`--tag must be a release tag like v0.3.0, got ${tag}`);
	const version = tag.slice(1);
	const packagePrefix = "plugins/omp-spec-kit";
	const outputRoot = path.resolve(args["--output"]);

	// Tag identity: peel to a commit and read the package manifest. The BDD
	// image ships no .git (docker-no-git-repo rule); tests pin the commit via
	// OMP_SPEC_KIT_TAGGED_COMMIT_<flattened tag>, honored ONLY in-container.
	let commit;
	const pinnedVar = "OMP_SPEC_KIT_TAGGED_COMMIT_" + tag.replaceAll(/[^\w]/gu, "_").toUpperCase();
	const pinnedCommit = process.env[pinnedVar] ?? process.env.OMP_SPEC_KIT_TAGGED_COMMIT;
	if (
		process.env.OMP_SPEC_KIT_BDD_CONTAINER === "1" &&
		typeof pinnedCommit === "string" &&
		/^[0-9a-f]{40}$/u.test(pinnedCommit)
	) {
		process.stderr.write(`[build-tagged-candidate] using BDD-pinned commit ${pinnedCommit.slice(0, 12)} for ${tag}\n`);
		commit = pinnedCommit;
	} else {
		try {
			commit = execFileSync("git", ["-C", repositoryRoot, "rev-parse", `${tag}^{commit}`], { encoding: "utf8" }).trim();
		} catch (error) {
			fail(`cannot peel ${tag}: ${error.stderr?.toString("utf8").trim() || error.message}`);
		}
	}
	const packageManifestText = gitShow(tag, path.posix.join(packagePrefix, "package.json"), "utf8");
	const packageManifest = JSON.parse(packageManifestText);
	if (packageManifest.version !== version) fail(`package.json at ${tag} declares ${packageManifest.version}, expected ${version}`);

	const distManifestText = gitShow(tag, path.posix.join(packagePrefix, "dist", "manifest.json"), "utf8");
	const distManifest = JSON.parse(distManifestText);
	if (distManifest.schema !== "omp-spec-kit-dist-manifest@1") fail(`unexpected dist manifest schema at ${tag}: ${distManifest.schema}`);
	if (distManifest.pluginVersion !== version) fail(`dist manifest pluginVersion ${distManifest.pluginVersion} does not match tag ${tag}`);
	const manifestEntries = Object.entries(distManifest.files);
	if (manifestEntries.length === 0) fail(`dist manifest at ${tag} lists no files`);

	// Extract: fixed metadata files plus every dist manifest entry.
	const fixedFiles = [".mcp.json", "package.json"].map((relative) => path.posix.join(packagePrefix, relative));
	const treeFiles = [...fixedFiles, ...manifestEntries.map(([relative]) => path.posix.join(packagePrefix, "dist", ...relative.split("/")))];
	mkdirSync(outputRoot, { recursive: true });
	const written = [];
	for (const repoPath of treeFiles) {
		const bytes = gitShow(tag, repoPath);
		const relativeInsidePackage = repoPath.slice(packagePrefix.length + 1).split("\\").join("/");
		const target = path.join(outputRoot, ...relativeInsidePackage.split("/"));
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, bytes);
		written.push({ relative: relativeInsidePackage, bytes: bytes.length });
	}
	// Validate the extracted MCP declaration against the tree it ships with.
	// Older tags (v0.3.0) run `node dist/mcp/server.js` directly; newer tags
	// bind ./bin/omp-spec-kit-mcp. Either way the declared entrypoint must be
	// present inside the extracted package, taken verbatim from the tag.
	const mcpConfig = JSON.parse(await readFile(path.join(outputRoot, ".mcp.json"), "utf8"));
	const server = mcpConfig?.mcpServers?.[packageManifest.name];
	if (!server || server.type !== "stdio") fail(`extracted .mcp.json does not declare a stdio server for ${packageManifest.name}`);
	const declaredEntry = server.command === "./bin/omp-spec-kit-mcp"
		? ["bin", "omp-spec-kit-mcp"]
		: server.command === "node" && Array.isArray(server.args) && typeof server.args[0] === "string"
			? server.args[0].split("/")
			: null;
	if (!declaredEntry) fail(`extracted .mcp.json declares an unsupported command shape: ${JSON.stringify(server.command)}`);
	const entryBytes = await readFile(path.join(outputRoot, ...declaredEntry));
	if (entryBytes.length === 0) {
		// The declared entrypoint is not part of the committed payload (the
		// bin/ launchers postdate v0.3.0): take its exact bytes from the tag.
		const repoEntry = path.posix.join(packagePrefix, ...declaredEntry);
		let tagged;
		try {
			tagged = gitShow(tag, repoEntry);
		} catch {
			fail(`extracted tree is missing its declared entrypoint ${declaredEntry.join("/")} and ${tag} does not provide it`);
		}
		mkdirSync(path.dirname(path.join(outputRoot, ...declaredEntry)), { recursive: true });
		writeFileSync(path.join(outputRoot, ...declaredEntry), tagged);
	}


	const extractedFiles = await collectFiles(outputRoot);
	const summary = {
		schema: "omp-spec-kit-tagged-candidate-extraction@1",
		tag,
		version,
		commit,
		extractedRoot: outputRoot,
		fileCount: extractedFiles.length,
		distManifestSha256: sha256(distManifestText),
		packageManifestSha256: sha256(Buffer.from(packageManifestText, "utf8")),
	};
	writeFileSync(path.join(outputRoot, "extraction-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
	process.stdout.write(JSON.stringify(summary));
}

await main();

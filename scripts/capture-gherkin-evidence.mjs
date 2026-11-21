import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { isValidSpecSlug } from "../src/kernel/identity.js";
import { parseFeature } from "../src/kernel/parsers/gherkin.js";
import { canonicalDocumentFilename, GHERKIN_DOCUMENT_KINDS } from "../src/kernel/types.js";
import { EVIDENCE_SCHEMA, evidenceUri, readContainedEvidenceSource } from "../src/evidence/service.js";

async function readGraph(root) {
  const repository = await readRepositorySpecs({ root });
  if (repository.error) throw new Error("cannot read the specification root");
  const { graph } = buildKernelGraph(repository);
  if (!graph.valid) throw new Error("cannot capture evidence for an invalid graph");
  return graph;
}

export async function captureGherkinEvidence({ root, spec, imports, projectionPaths, stderr = process.stderr }) {
  if (!isValidSpecSlug(spec) || !Array.isArray(imports) || imports.length === 0) {
    throw new Error("provide a specification slug and at least one step-definition module");
  }
  const cwd = path.resolve(root);
  const before = await readGraph(cwd);
  if (before.diagnostics.some((diagnostic) => diagnostic.specSlug === spec && diagnostic.code === "LEGACY_SPEC_LAYOUT")) {
    throw new Error(`migrate ${spec} before capturing execution evidence`);
  }
  const paths = GHERKIN_DOCUMENT_KINDS.map((kind) => `.specs/${spec}/${canonicalDocumentFilename(kind, spec)}`);
  const sourceHashes = new Map(before.documents.filter((doc) => paths.includes(doc.path) && doc.accepted).map((doc) => [doc.path, doc.sha256]));
  if (sourceHashes.size !== paths.length) throw new Error(`missing canonical Gherkin pair for ${spec}`);
  const scenarios = Object.fromEntries(before.nodes.filter((node) =>
    node.specSlug === spec && node.kind === "SCENARIO" && node.attributes.ready).map((node) => [node.canonicalId, {
    path: node.span.path, scenarioContentHash: node.contentHash, sourceSha256: sourceHashes.get(node.span.path),
  }]));
  if (!Object.keys(scenarios).length) throw new Error(`no @spec-ready scenarios in ${spec}`);

  const executionPaths = projectionPaths === undefined ? paths : projectionPaths;
  if (!Array.isArray(executionPaths) || !executionPaths.length || new Set(executionPaths).size !== executionPaths.length) {
    throw new Error("provide distinct project-relative projection paths");
  }
  const ready = before.nodes.filter((node) => node.specSlug === spec && node.kind === "SCENARIO" && node.attributes.ready);
  const readyTags = new Set(ready.map((node) => `@id:${node.localId}`));
  const seen = new Set();
  const executionHashes = new Map();
  for (const uri of executionPaths) {
    const data = await readContainedEvidenceSource(cwd, uri);
    if (!data) throw new Error("projection source is missing or outside the project root");
    const hash = createHash("sha256").update(data).digest("hex");
    if (projectionPaths === undefined && hash !== sourceHashes.get(uri)) throw new Error("canonical source changed before the run");
    executionHashes.set(uri, hash);
    if (projectionPaths !== undefined) {
      const { ast } = parseFeature(data.toString("utf8"), uri);
      const rejectInherited = (tags = []) => {
        if (tags.some(({ name }) => readyTags.has(name))) throw new Error("ready scenario identity must be declared directly on its scenario");
      };
      rejectInherited(ast.feature?.tags);
      for (const child of ast.feature?.children ?? []) {
        rejectInherited(child.rule?.tags);
        for (const item of child.rule ? child.rule.children : [child]) {
          const scenario = item.scenario;
          if (!scenario) continue;
          for (const example of scenario.examples ?? []) rejectInherited(example.tags);
          const ids = scenario.tags.filter(({ name }) => name.startsWith("@id:"));
          for (const { name } of ids.filter(({ name }) => readyTags.has(name))) {
            if (ids.length !== 1 || seen.has(name)) throw new Error("ambiguous scenario identity in executable sources");
            seen.add(name);
          }
        }
      }
    }
  }
  const tags = projectionPaths === undefined ? "@spec-ready" : ready.map((node) => `@id:${node.localId}`).join(" or ");
  const environment = { cwd, stdout: stderr, stderr };
  const { runConfiguration } = await loadConfiguration({
    file: false,
    provided: { paths: executionPaths, import: imports.map((entry) => path.resolve(cwd, entry)), tags, format: ["progress"] },
  }, environment);
  const frames = [];
  let bytes = 0;
  const result = await runCucumber(runConfiguration, environment, (message) => {
    const frame = JSON.stringify(message);
    bytes += Buffer.byteLength(frame, "utf8") + 1;
    if (bytes > 15 * 1024 * 1024) throw new Error("Cucumber evidence exceeds the capture limit");
    frames.push(frame);
  });
  if ((await readGraph(cwd)).fingerprint !== before.fingerprint) throw new Error("specification graph changed during the run");
  const captured = new Map();
  const starts = [];
  const byLocalId = new Map(ready.map((node) => [node.localId, node.canonicalId]));
  for (const line of frames) {
    const { source, testRunStarted, pickle } = JSON.parse(line);
    if (testRunStarted) starts.push(testRunStarted.id);
    if (pickle) {
      const ids = pickle.tags.filter(({ name }) => name.startsWith("@id:")).map(({ name }) => name.slice(4));
      for (const id of ids) {
        const canonicalId = byLocalId.get(id);
        if (!canonicalId) continue;
        if (ids.length !== 1) throw new Error("ambiguous scenario identity in executable source");
        const uri = evidenceUri(pickle.uri);
        const entry = scenarios[canonicalId];
        if (!executionHashes.has(uri) || (entry.executionPath && entry.executionPath !== uri)) {
          throw new Error("scenario identity appears in multiple executable sources");
        }
        entry.executionPath = uri;
        entry.executionSourceSha256 = executionHashes.get(uri);
      }
    }
    if (!source) continue;
    const uri = evidenceUri(source.uri);
    if (!executionHashes.has(uri) || captured.has(uri)) throw new Error(`unexpected or duplicate source in Cucumber run: ${uri}`);
    captured.set(uri, createHash("sha256").update(source.data, "utf8").digest("hex"));
  }
  for (const uri of executionPaths) {
    const current = await readContainedEvidenceSource(cwd, uri);
    if (!current || captured.get(uri) !== executionHashes.get(uri) ||
        createHash("sha256").update(current).digest("hex") !== executionHashes.get(uri)) {
      throw new Error("Cucumber run did not capture the execution sources from the starting snapshot");
    }
  }
  if (starts.length !== 1) throw new Error("Cucumber run did not capture exactly one run start");
  const binding = { schemaVersion: EVIDENCE_SCHEMA, graphFingerprint: before.fingerprint, testRunStartedId: starts[0], scenarios };
  return { success: result.success, messages: [JSON.stringify({ ompSpecKitEvidence: { binding } }), ...frames, ""].join("\n") };
}

// Opt in with all three environment variables; never place the token in argv.
export async function uploadGherkinEvidence({ baseUrl, project, token, messages }) {
  const url = new URL("/evidence", baseUrl);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("evidence upload requires HTTPS (HTTP is allowed only on loopback)");
  }
  if (typeof project !== "string" || !project || typeof token !== "string" || !token) throw new Error("evidence upload requires a project and token");
  url.searchParams.set("project", project);
  const response = await fetch(url, { method: "POST", redirect: "error", headers: { "content-type": "application/x-ndjson", authorization: `Bearer ${token}` }, body: messages });
  if (!response.ok) throw new Error(`evidence upload failed (HTTP ${response.status})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, spec, ...args] = process.argv.slice(2);
  const imports = args.filter((entry) => !entry.startsWith("--projection="));
  const projections = args.filter((entry) => entry.startsWith("--projection=")).map((entry) => entry.slice("--projection=".length));
  if (!root || !spec || !imports.length) throw new Error("Usage: capture-gherkin-evidence.mjs <root> <spec> <step-module> [<step-module> ...] [--projection=<project-relative-feature> ...]");
  const captured = await captureGherkinEvidence({ root, spec, imports, projectionPaths: projections.length ? projections : undefined });
  process.stdout.write(captured.messages);
  const { SPEC_EVIDENCE_UPLOAD_URL: baseUrl, SPEC_EVIDENCE_PROJECT: project, SPEC_EVIDENCE_TOKEN: token } = process.env;
  if (baseUrl || project || token) await uploadGherkinEvidence({ baseUrl, project, token, messages: captured.messages });
  if (!captured.success) process.exitCode = 1;
}

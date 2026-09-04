#!/usr/bin/env node
/**
 * Portable corpus gate for the live specifications.
 *
 * Build the real corpus with the shipped kernel, require a valid graph, enforce
 * canonical document/ID forms and Markdown links, then reconcile the published
 * v0.3.2 identity with the package metadata.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildKernelGraph } from "../src/kernel/index.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPECS_ROOT = path.join(ROOT, ".specs");
const EXPECTED_SPECS = Object.freeze([
  "plugin-distribution",
  "spec-mcp-access-gate",
  "spec-mcp-operations",
]);
const FIXED_DOCS = Object.freeze([
  "README.md",
  "USER_STORIES.md",
  "USE_CASES.md",
  "RESEARCH.md",
  "FR.md",
  "NFR.md",
  "ACCEPTANCE_CRITERIA.md",
  "REQUIREMENTS.md",
  "DESIGN.md",
  "TASKS.md",
  "FILE_CHANGES.md",
  "FIXTURES.md",
  "CHANGELOG.md",
]);
const EXPECTED_DOCUMENT_COUNT = EXPECTED_SPECS.length * (FIXED_DOCS.length + 2);

function fail(message) {
  console.error(`spec-corpus check: ${message}`);
  process.exit(1);
}

function normalized(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function exactCanonicalDocuments() {
  const actualSpecs = fs
    .readdirSync(SPECS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actualSpecs) !== JSON.stringify([...EXPECTED_SPECS].sort((a, b) => a.localeCompare(b)))) {
    fail(`spec set differs (actual: ${actualSpecs.join(", ")})`);
  }

  let canonicalCount = 0;
  for (const slug of EXPECTED_SPECS) {
    const expected = [...FIXED_DOCS, `${slug}.feature`, `${slug}_SCHEMA.md`];
    for (const name of expected) {
      const filePath = path.join(SPECS_ROOT, slug, name);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(`missing canonical document .specs/${slug}/${name}`);
      }
      canonicalCount += 1;
    }
  }
  if (canonicalCount !== EXPECTED_DOCUMENT_COUNT) fail(`canonical document count is ${canonicalCount}, expected ${EXPECTED_DOCUMENT_COUNT}`);
  return canonicalCount;
}

async function validateRuntimeGraph() {
  const readResult = await readRepositorySpecs({ root: ROOT });
  if (readResult?.error) fail(`kernel reader refused corpus: ${JSON.stringify(readResult.error)}`);
  const { graph, diagnostics } = buildKernelGraph({ files: readResult.files });
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
  const rejected = graph.definitionCandidates.filter((candidate) => candidate.outcome === "REJECTED");
  const ambiguous = graph.definitionCandidates.filter((candidate) => candidate.outcome === "AMBIGUOUS");
  const nodeIds = graph.nodes.map((node) => node.canonicalId);
  const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);

  if (
    !graph.valid ||
    errors.length ||
    graph.counts.rejectedDocuments !== 0 ||
    graph.counts.rejectedDefinitionOccurrences !== 0 ||
    graph.counts.ambiguousDefinitionOccurrences !== 0 ||
    rejected.length ||
    ambiguous.length ||
    duplicateNodeIds.length
  ) {
    const details = [
      ...errors.map((diagnostic) => `${diagnostic.code} ${diagnostic.span?.path ?? ""}:${diagnostic.span?.startLine ?? ""}`),
      ...rejected.map((candidate) => `REJECTED ${candidate.span?.path ?? ""}:${candidate.span?.startLine ?? ""}`),
      ...ambiguous.map((candidate) => `AMBIGUOUS ${candidate.canonicalId ?? "unknown"}`),
      ...duplicateNodeIds.map((id) => `DUPLICATE_NODE ${id}`),
    ].slice(0, 30);
    fail(`shipped kernel graph invalid; ${details.join("\n")}`);
  }
  if (
    graph.counts.discoveredDocuments !== EXPECTED_DOCUMENT_COUNT ||
    graph.counts.acceptedDocuments !== EXPECTED_DOCUMENT_COUNT
  ) {
    fail(
      `kernel document conservation is ${graph.counts.acceptedDocuments}/${graph.counts.discoveredDocuments}, ` +
        `expected ${EXPECTED_DOCUMENT_COUNT}/${EXPECTED_DOCUMENT_COUNT}`,
    );
  }
  return graph;
}

function marksmanSlug(headingText) {
  return headingText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function markdownFiles() {
  const roots = [
    ".specs",
    "docs/decisions",
    "README.md",
    "ROADMAP.md",
    "MIGRATION_MATRIX.md",
    "CHANGELOG.md",
    "SECURITY.md",
    "docs/omp-v17.3.7-contract.md",
    "docs/omp-v18.0.10-contract.md",
    "docs/validation/omp-discovery-v18.0.10.md",
    "docs/omp-plan-approval-event-contract.md",
  ];
  const output = [];
  function walk(relativePath) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const stat = fs.statSync(absolutePath);
    if (stat.isFile()) {
      if (/\.md$/iu.test(relativePath)) output.push(normalized(relativePath));
      return;
    }
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      if (!entry.isFile() && !entry.isDirectory()) continue;
      walk(path.join(relativePath, entry.name));
    }
  }
  roots.forEach(walk);
  return [...new Set(output)].sort((a, b) => a.localeCompare(b));
}

function markdownRecords(relativePath) {
  const headings = new Map();
  const links = [];
  const lines = readText(relativePath).split(/\r?\n/u);
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const fenceMatch = raw.match(/^\s*(```+|~~~+)/u);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === null ? marker : fence === marker ? null : fence;
      continue;
    }
    if (fence !== null) continue;
    const headingMatch = raw.match(/^#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (headingMatch) {
      const slug = marksmanSlug(headingMatch[1]);
      const existing = headings.get(slug) ?? [];
      existing.push(index + 1);
      headings.set(slug, existing);
    }
    const withoutCode = raw.replace(/`[^`]*`/gu, "");
    for (const match of withoutCode.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/gu)) {
      links.push({ destination: match[1], line: index + 1 });
    }
  }
  return { headings, links };
}

function resolveLocalDestination(sourceRelativePath, rawDestination) {
  let destination = rawDestination.trim();
  if (destination.startsWith("<") && destination.endsWith(">")) destination = destination.slice(1, -1);
  if (/^[a-z][a-z0-9+.-]*:/iu.test(destination) || destination.startsWith("//")) return null;
  try {
    destination = decodeURIComponent(destination);
  } catch {
    return { error: "invalid percent encoding" };
  }
  const hashIndex = destination.indexOf("#");
  const pathPartWithQuery = hashIndex < 0 ? destination : destination.slice(0, hashIndex);
  const fragment = hashIndex < 0 ? null : destination.slice(hashIndex + 1);
  const pathPart = pathPartWithQuery.split("?", 1)[0];
  const targetAbsolute = pathPart.length === 0
    ? path.join(ROOT, sourceRelativePath)
    : pathPart.startsWith("/")
      ? path.join(ROOT, pathPart.slice(1))
      : path.resolve(path.dirname(path.join(ROOT, sourceRelativePath)), pathPart);
  const targetRelative = normalized(path.relative(ROOT, targetAbsolute));
  if (targetRelative === ".." || targetRelative.startsWith("../")) return { error: "target escapes repository" };
  return { targetRelative, fragment };
}

function validateMarkdownLinks() {
  const files = markdownFiles();
  const records = new Map(files.map((file) => [file, markdownRecords(file)]));
  const failures = [];
  for (const source of files) {
    for (const link of records.get(source).links) {
      const resolved = resolveLocalDestination(source, link.destination);
      if (resolved === null) continue;
      if (resolved.error) {
        failures.push(`${source}:${link.line}: ${resolved.error}: ${link.destination}`);
        continue;
      }
      const targetAbsolute = path.join(ROOT, resolved.targetRelative);
      if (!fs.existsSync(targetAbsolute)) {
        failures.push(`${source}:${link.line}: missing target ${resolved.targetRelative}`);
        continue;
      }
      if (resolved.fragment === null || resolved.fragment === "" || !fs.statSync(targetAbsolute).isFile()) continue;
      if (!/\.md$/iu.test(resolved.targetRelative)) {
        failures.push(`${source}:${link.line}: fragment on non-markdown target ${resolved.targetRelative}#${resolved.fragment}`);
        continue;
      }
      const targetRecord = records.get(resolved.targetRelative) ?? markdownRecords(resolved.targetRelative);
      if (!targetRecord.headings.has(resolved.fragment)) {
        failures.push(`${source}:${link.line}: missing Marksman anchor ${resolved.targetRelative}#${resolved.fragment}`);
      }
    }
  }
  if (failures.length) fail(`markdown link/anchor failures (${failures.length}):\n${failures.slice(0, 40).join("\n")}`);
  return files.length;
}

function validateCanonicalHeadingForms() {
  const failures = [];
  for (const slug of EXPECTED_SPECS) {
    const acPath = `.specs/${slug}/ACCEPTANCE_CRITERIA.md`;
    for (const [index, line] of readText(acPath).split(/\r?\n/u).entries()) {
      if (/^##\s+AC-/u.test(line) && !/^##\s+AC-[1-9][0-9]*\.[1-9][0-9]*(?:\s*(?::|—|-)\s*.+)?\s*$/u.test(line)) {
        failures.push(`${acPath}:${index + 1}: ${line}`);
      }
    }
    const nfrPath = `.specs/${slug}/NFR.md`;
    for (const [index, line] of readText(nfrPath).split(/\r?\n/u).entries()) {
      if (/^##\s+NFR-/u.test(line) && !/^##\s+NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*(?:\s*(?::|—|-)\s*.+)?\s*$/u.test(line)) {
        failures.push(`${nfrPath}:${index + 1}: ${line}`);
      }
    }
  }
  if (failures.length) fail(`noncanonical AC/NFR headings:\n${failures.slice(0, 40).join("\n")}`);
}


function embeddedVersion(relativePath, pattern) {
  const match = readText(relativePath).match(pattern);
  return match?.[1] ?? null;
}

function validateCurrentStatus() {
  const rootPackage = readJson("package.json");
  const version = rootPackage.version;
  const status = readJson("docs/validation/release-status-v" + version + ".json");
  const childPackage = readJson("plugins/omp-spec-kit/package.json");
  const catalog = readJson(".omp-plugin/marketplace.json");
  const catalogPlugin = catalog.plugins?.[0];
  const authorities = [
    ["root package", rootPackage.version],
    ["child package", childPackage.version],
    ["catalog metadata", catalog.metadata?.version],
    ["catalog plugin", catalogPlugin?.version],
    ["embedded extension", embeddedVersion("src/v0.1/extension.js", /PLUGIN_VERSION\s*=\s*["']([^"']+)["']/u)],
  ];
  for (const [label, actual] of authorities) {
    if (actual !== version) fail(`${label} version ${String(actual)} differs from release status ${version}`);
  }
  if (
    status.tag !== "v" + version ||
    !["SHIPPED", "CANDIDATE"].includes(status.status?.state) ||
    typeof status.status?.surface !== "string" ||
    !Number.isInteger(status.status?.toolCount)
  ) {
    fail("release status is absent or identity-drifted");
  }
  if (status.status.state === "CANDIDATE") {
    if (version === "0.8.1") {
      if (
        status.status.public !== false ||
        status.status.installable !== false ||
        status.status.surface !== "SAFE_AUTHORING" ||
        status.status.toolCount !== 11
      ) {
        fail("candidate status is not the 11-tool consolidated surface");
      }
      return version;
    }
    if (version === "0.6.0" || version === "0.7.0") {
      if (
        status.status.public !== false ||
        status.status.installable !== false ||
        status.status.surface !== "SAFE_AUTHORING" ||
        status.status.toolCount !== 49
      ) {
        fail("candidate status is not the 49-tool safe authoring surface");
      }
      return version;
    }
    if (status.status.public !== false || status.status.installable !== false || status.status.surface !== "EVIDENCE_NAVIGATION" || status.status.toolCount !== 27) {
      fail("v0.5 candidate status is not the additive evidence/navigation surface");
    }
    return version;
  }
  const releaseNotes = status.releaseNotes;
  const releaseNotesDigest =
    typeof releaseNotes?.body === "string"
      ? createHash("sha256").update(releaseNotes.body, "utf8").digest("hex")
      : null;
  if (
    releaseNotes?.source !== status.releaseUrl ||
    releaseNotesDigest !== releaseNotes?.bodySha256 ||
    !releaseNotes.body.includes(`# omp-spec-kit ${status.tag}`) ||
    !releaseNotes.body.includes(`Archive SHA-256: \`${status.archive?.sha256}\``)
  ) {
    fail("captured public release notes are absent or identity-drifted");
  }
  if (status.attestation?.verified !== true || status.attestation?.workflowCommit !== status.tagCommit) {
    fail("release attestation is absent or not commit-bound");
  }
  if (!String(status.attestation?.workflow ?? "").endsWith(`/release.yml@refs/tags/${status.tag}`)) {
    fail("release attestation workflow/ref does not match the candidate tag");
  }
  const archiveAsset = status.releaseAssets?.find((asset) => asset.name === status.archive?.name);
  if (!archiveAsset || archiveAsset.sha256 !== status.archive.sha256) {
    fail("release archive asset/hash is inconsistent");
  }
  for (const [label, value] of [
    ["tag commit", status.tagCommit],
    ["candidate digest", status.candidateDigest],
    ["package tree digest", status.packageTreeDigest],
    ["archive digest", status.archive?.sha256],
  ]) {
    const expectedLength = label === "tag commit" ? 40 : 64;
    if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`, "u").test(String(value ?? ""))) fail(`${label} is malformed`);
  }

  const requiredStatusMarkers = [
    ["README.md", ["v" + version, "release-status-v" + version + ".json", "--scope project"]],
  ];
  for (const [relativePath, markers] of requiredStatusMarkers) {
    const text = readText(relativePath).toLowerCase();
    for (const marker of markers) {
      if (!text.includes(marker.toLowerCase())) fail(`${relativePath} lacks current status marker ${marker}`);
    }
  }
  return version;
}

const canonicalDocuments = exactCanonicalDocuments();
const graph = await validateRuntimeGraph();
validateCanonicalHeadingForms();
const markdownCount = validateMarkdownLinks();
const version = validateCurrentStatus();
console.log(
  `spec-corpus check: clean; version=${version}; specs=${EXPECTED_SPECS.length}; canonical-docs=${canonicalDocuments}; ` +
    `graph-nodes=${graph.nodes.length}; graph-edges=${graph.edges.length}; markdown-files=${markdownCount}`,
);

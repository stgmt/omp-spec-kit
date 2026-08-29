#!/usr/bin/env node
/**
 * Portable two-profile corpus gate.
 *
 * Runtime profile: build the real 150-document corpus with shipped spec-kernel@1
 * and require a valid, lossless graph with no rejected/ambiguous definitions.
 * Contract profile: enforce canonical document/ID forms, Marksman-compatible
 * anchors/links, v2 contract sentinels, and current v0.3.2 status identity.
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
  "mcp-release-integrity",
  "plan-gate",
  "plugin-distribution",
  "product",
  "spec-authoring-workflow",
  "spec-capability",
  "spec-enforcement",
  "spec-evidence",
  "spec-kernel",
  "spec-lsp",
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
const CONTRACT_MARKERS = Object.freeze([
  [".specs/spec-evidence/spec-evidence_SCHEMA.md", ["spec-evidence@2", "GetTestResultRequest", "GetScenarioTraceRequest"]],
  [".specs/spec-kernel/spec-kernel_SCHEMA.md", ["spec-kernel@2", "marksman-anchor@2", "kernel-generator-port-reads@1", "kernel-adapter-io@1"]],
  [".specs/spec-capability/spec-capability_SCHEMA.md", ["spec-capability@2", "evidence invalidation", "MCP"]],
  [".specs/spec-lsp/spec-lsp_SCHEMA.md", ["spec-lsp-read@1", "spec-lsp-step@1", "agent-facing spec API is MCP only"]],
  [".specs/plan-gate/plan-gate_SCHEMA.md", ["plan-gate@2", "selected-plan-event@1", "internalDeadlineMs"]],
  [".specs/spec-enforcement/spec-enforcement_SCHEMA.md", ["spec-enforcement@2", "ToolEffectRegistryEntry", "SPEC_AUTHORING_AUTHORITY"]],
  [".specs/spec-authoring-workflow/FR.md", ["authoring-mcp@1", "Schema v1 names", "Schema v2 later names"]],
  [".specs/plugin-distribution/plugin-distribution_SCHEMA.md", ["distribution-release-eligibility@2", "stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml"]],
]);

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
  if (canonicalCount !== 150) fail(`canonical document count is ${canonicalCount}, expected 150`);
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
  if (graph.counts.discoveredDocuments !== 150 || graph.counts.acceptedDocuments !== 150) {
    fail(`kernel document conservation is ${graph.counts.acceptedDocuments}/${graph.counts.discoveredDocuments}, expected 150/150`);
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

function validateContractMarkers() {
  for (const [relativePath, markers] of CONTRACT_MARKERS) {
    const text = readText(relativePath);
    for (const marker of markers) {
      if (!text.toLowerCase().includes(marker.toLowerCase())) fail(`${relativePath} lacks contract marker ${marker}`);
    }
  }
}

function embeddedVersion(relativePath, pattern) {
  const match = readText(relativePath).match(pattern);
  return match?.[1] ?? null;
}

function validateCurrentStatus() {
  const status = readJson("docs/validation/release-status-v0.3.2.json");
  const rootPackage = readJson("package.json");
  const childPackage = readJson("plugins/omp-spec-kit/package.json");
  const catalog = readJson(".omp-plugin/marketplace.json");
  const catalogPlugin = catalog.plugins?.[0];
  const version = status.version;
  const authorities = [
    ["root package", rootPackage.version],
    ["child package", childPackage.version],
    ["catalog metadata", catalog.metadata?.version],
    ["catalog plugin", catalogPlugin?.version],
    ["embedded extension", embeddedVersion("src/v0.1/extension.js", /PLUGIN_VERSION\s*=\s*["']([^"']+)["']/u)],
    ["embedded inventory", embeddedVersion("src/v0.1/inventory.js", /PLUGIN_VERSION\s*=\s*["']([^"']+)["']/u)],
  ];
  for (const [label, actual] of authorities) {
    if (actual !== version) fail(`${label} version ${String(actual)} differs from release status ${version}`);
  }
  if (status.tag !== `v${version}` || status.status?.public !== true || status.status?.installable !== true) {
    fail("release status tag/public/installable identity is inconsistent");
  }
  if (status.status?.baselineStage !== "V0_3_READONLY_MCP" || status.status?.capabilityState !== "DELIVERED") {
    fail("release status baseline/capability state is not the delivered v0.3 baseline");
  }
  const expectedCapabilityStates = [
    ["GENERATOR_READS", "SPECIFIED"],
    ["LSP_ADAPTER", "SPECIFIED"],
    ["EVIDENCE_MCP", "SPECIFIED"],
    ["CAPABILITY_GRAPH", "SPECIFIED"],
    ["AUTHORING_MCP", "DEFERRED_HOST_ABI"],
    ["SPEC_ENFORCEMENT", "DEFERRED_HOST_ABI"],
    ["AUTOMATIC_PLAN_GATE", "DEFERRED_HOST_ABI"],
  ];
  const capabilities = status.status?.capabilities;
  if (
    !Array.isArray(capabilities) ||
    capabilities.length !== expectedCapabilityStates.length ||
    expectedCapabilityStates.some(([id, state], index) =>
      capabilities[index]?.capabilityId !== id ||
      capabilities[index]?.state !== state ||
      !capabilities[index]?.requiredAggregateIds?.includes("product:FR-6") ||
      capabilities[index]?.acceptedEvidence?.length !== 0 ||
      capabilities[index]?.blockers?.length !== 1)
  ) {
    fail("release status capability map is incomplete or state-drifted");
  }
  const productStatus = status.productStatus;
  if (
    productStatus?.statusProfile !== "historical-v0.3.2@1" ||
    productStatus?.stage !== "V0_3_READONLY_MCP" ||
    productStatus?.state !== "DELIVERED" ||
    productStatus?.productRevision !== status.tagCommit ||
    productStatus?.candidateArtifactSha256 !== status.archive?.sha256 ||
    productStatus?.artifactLineageId !== null ||
    productStatus?.v02ParentArtifactSha256 !== null ||
    productStatus?.publicVisibility !== "PUBLIC" ||
    productStatus?.installable !== true ||
    productStatus?.executedScenarioEvidence !== true ||
    productStatus?.blockers?.length !== 0 ||
    productStatus?.evidence?.length !== 3 ||
    JSON.stringify(productStatus?.capabilities) !== JSON.stringify(capabilities)
  ) {
    fail("bounded historical v0.3.2 ProductStatus is absent or inconsistent");
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
  if (
    JSON.stringify(capabilities[4].requiredAggregateIds) !==
    JSON.stringify(capabilities[5].requiredAggregateIds)
  ) {
    fail("authoring and enforcement joint gate tuples differ");
  }
  if (status.attestation?.verified !== true || status.attestation?.workflowCommit !== status.tagCommit) {
    fail("release attestation is absent or not commit-bound");
  }
  if (!String(status.attestation?.workflow ?? "").endsWith(`/release.yml@refs/tags/${status.tag}`)) {
    fail("release attestation workflow/ref does not match the candidate tag");
  }
  const distributionAttestation = status.distributionAttestation;
  if (
    distributionAttestation?.verified !== true ||
    distributionAttestation.repository !== "stgmt/omp-spec-kit" ||
    distributionAttestation.sourceRef !== `refs/tags/${status.tag}` ||
    distributionAttestation.workflowCommit !== status.tagCommit ||
    distributionAttestation.subjectSha256 !== status.evidence?.distributionReceiptDigest ||
    !String(distributionAttestation.signerWorkflow ?? "").endsWith(
      `/distribution-evidence.yml@refs/tags/${status.tag}`,
    )
  ) {
    fail("distribution evidence attestation trust tuple is absent or inconsistent");
  }
  const archiveAsset = status.releaseAssets?.find((asset) => asset.name === status.archive?.name);
  if (!archiveAsset || archiveAsset.sha256 !== status.archive.sha256) fail("release archive asset/hash is inconsistent");
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
    ["README.md", [`v${version}`, "release-status-v0.3.2.json", "--scope project"]],
    [".specs/product/README.md", [`current public baseline is v${version}`, "DELIVERED / CURRENT_BASELINE", "release-status-v0.3.2.json"]],
    [".specs/product/product_SCHEMA.md", ["V0_3_READONLY_MCP", "release-status-v0.3.2.json"]],
    [".specs/plugin-distribution/README.md", [`v${version}`, "distribution-release-eligibility@2"]],
    [".specs/spec-kernel/README.md", [`v${version}`, "spec-kernel@2"]],
    [".specs/mcp-release-integrity/mcp-release-integrity_SCHEMA.md", [`\"version\": \"${version}\"`, `\"tag\": \"v${version}\"`]],
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
validateContractMarkers();
const markdownCount = validateMarkdownLinks();
const version = validateCurrentStatus();
console.log(
  `spec-corpus check: clean; version=${version}; specs=${EXPECTED_SPECS.length}; canonical-docs=${canonicalDocuments}; ` +
    `graph-nodes=${graph.nodes.length}; graph-edges=${graph.edges.length}; markdown-files=${markdownCount}`,
);

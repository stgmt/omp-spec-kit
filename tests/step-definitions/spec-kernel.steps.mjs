import assert from "node:assert/strict";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import path from "node:path";
import {
  anchorProducerFiles,
  buildKernelGraph,
  canonicalJson,
  createKernelState,
  createTempRepo,
  diagnosticsProducerFiles,
  duplicateProducerFiles,
  envelopeData,
  largeSyntheticCorpusFiles,
  loadFrozenRealCorpus,
  plantDirectoryJunction,
  query,
  readRepositorySpecs,
  sha256Hex,
  writeCorpus,
} from "../helpers/kernel-world.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const SEVERITY_RANK = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });

function countNodes(graph, kind) {
  return graph.nodes.filter((node) => node.kind === kind).length;
}

function assertDiagnosticSort(diagnostics) {
  const sorted = [...diagnostics].sort((left, right) => {
    const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (severity !== 0) return severity;
    if (left.code !== right.code) return left.code < right.code ? -1 : 1;
    const leftPath = left.span === null ? null : left.span.path;
    const rightPath = right.span === null ? null : right.span.path;
    if (leftPath !== rightPath) return leftPath === null ? -1 : rightPath === null ? 1 : leftPath < rightPath ? -1 : 1;
    const leftOffset = left.span === null ? null : left.span.startOffset;
    const rightOffset = right.span === null ? null : right.span.startOffset;
    if (leftOffset !== rightOffset) return (leftOffset ?? -1) - (rightOffset ?? -1);
    const leftId = left.canonicalId ?? null;
    const rightId = right.canonicalId ?? null;
    if (leftId !== rightId) return leftId === null ? -1 : rightId === null ? 1 : leftId < rightId ? -1 : 1;
    return left.diagnosticId < right.diagnosticId ? -1 : 1;
  });
  assert.deepStrictEqual(
    diagnostics.map((diagnostic) => diagnostic.diagnosticId),
    sorted.map((diagnostic) => diagnostic.diagnosticId),
    "diagnostics must be in the stable schema order",
  );
}

function assertConservationInvariants(graph) {
  const counts = graph.counts;
  assert.strictEqual(
    counts.discoveredDocuments,
    counts.acceptedDocuments + counts.rejectedDocuments,
    "discovered = accepted + rejected",
  );
  assert.strictEqual(
    counts.definitionOccurrences,
    counts.uniqueDefinitionNodes +
      counts.ambiguousDefinitionOccurrences +
      counts.rejectedDefinitionOccurrences,
    "definitions = unique + ambiguous + rejected",
  );
  assert.strictEqual(
    counts.referenceOccurrences,
    counts.resolvedEdgeOccurrences + counts.unresolvedReferenceOccurrences,
    "references = resolved + unresolved",
  );
  assert.strictEqual(counts.markdownHeadingOccurrences, graph.markdownHeadingOccurrences.length);
  assert.strictEqual(counts.markdownLinkOccurrences, graph.markdownLinkOccurrences.length);
  assert.strictEqual(
    counts.markdownLinkOccurrences,
    counts.markdownInternalHeadingLinks +
      counts.markdownInternalDocumentLinks +
      counts.markdownExternalLinks +
      counts.markdownUnresolvedLinks,
    "links conserve across the four outcomes",
  );
  const rewriteSites = new Set(graph.markdownLinkOccurrences.map((link) => link.rewriteKey));
  assert.ok(rewriteSites.size <= counts.markdownLinkOccurrences, "rewrite sites cannot exceed link occurrences");
  for (const edge of graph.edges) {
    assert.ok(graph.nodes.some((node) => node.canonicalId === edge.from), "edge endpoints exist");
    assert.ok(graph.nodes.some((node) => node.canonicalId === edge.to), "edge endpoints exist");
  }
}

function findNodesArgs(limit, cursor) {
  return {
    specSlugs: [],
    kinds: ["FUNCTIONAL_REQUIREMENT"],
    canonicalIds: [],
    text: null,
    projection: "summary",
    limit,
    cursor,
  };
}

Before({ tags: "@spec-kernel" }, function () {
  this.kernel = createKernelState();
});

After({ tags: "@spec-kernel" }, async function () {
  await this.kernel.cleanup();
});

// ---------------------------------------------------------------------------
// Scenario 1: real four-spec corpus
// ---------------------------------------------------------------------------

Given("the repository's own four-spec corpus pinned by the captured fixture manifest", async function () {
  this.kernel.repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
  const frozen = await loadFrozenRealCorpus(this.kernel.repositoryRoot);
  this.kernel.manifest = frozen.manifest;
  this.kernel.fixtureRoot = frozen.fixtureRoot;
});

When("the filesystem reader ingests the corpus and the kernel builds two graphs in competing input orders", async function () {
  const read = await readRepositorySpecs({ root: this.kernel.fixtureRoot });
  assert.ok(Object.prototype.hasOwnProperty.call(read, "files"), "the reader must return files for the frozen real corpus");
  const manifestPaths = new Set(this.kernel.manifest.documents.map((entry) => entry.path));
  const missing = [...manifestPaths].filter((p) => !read.files.some((file) => file.path === p));
  assert.deepStrictEqual(missing, [], "every manifest path must exist in the frozen fixture");
  const files = read.files.filter((file) => manifestPaths.has(file.path));
  this.kernel.corpusRead = { files };
  this.kernel.builds = {
    forward: buildKernelGraph({ files }),
    competing: buildKernelGraph({ files: [...files].reverse() }),
  };
});

Then("every ingested file matches the manifest provenance hashes byte-for-byte", function () {
  const { manifest, corpusRead } = this.kernel;
  const byPath = new Map(manifest.documents.map((entry) => [entry.path, entry]));
  assert.strictEqual(corpusRead.files.length, manifest.documents.length);
  assert.strictEqual(manifest.documents.length, 60);
  for (const file of corpusRead.files) {
    const entry = byPath.get(file.path);
    assert.ok(entry, `unexpected ingested path ${file.path}`);
    assert.strictEqual(sha256Hex(file.bytes), entry.sha256, `${file.path} bytes drifted from the pinned commit`);
    assert.strictEqual(file.bytes.byteLength, entry.byteLength, `${file.path} byte length drifted`);
  }
});

Then("the graph counts equal the manifest ground truth exactly", function () {
  const { manifest } = this.kernel;
  const graph = this.kernel.builds.forward.graph;
  const truth = manifest.groundTruth;
  const counts = graph.counts;

  assert.strictEqual(counts.discoveredDocuments, truth.discoveredDocuments);
  assert.strictEqual(counts.acceptedDocuments, truth.acceptedDocuments);
  assert.strictEqual(counts.rejectedDocuments, truth.rejectedDocuments);

  assert.strictEqual(countNodes(graph, "FUNCTIONAL_REQUIREMENT"), truth.functionalRequirements);
  assert.strictEqual(countNodes(graph, "ACCEPTANCE_CRITERION"), truth.acceptanceCriteria);
  assert.strictEqual(countNodes(graph, "TASK"), truth.tasks);
  assert.strictEqual(countNodes(graph, "SCENARIO"), truth.scenarios);

  assert.strictEqual(counts.markdownHeadingOccurrences, truth.markdownHeadingOccurrences);
  assert.strictEqual(counts.markdownLinkOccurrences, truth.markdownLinkOccurrences);
  assert.strictEqual(counts.markdownExternalLinks, truth.markdownExternalLinks);
});

Then("every conservation invariant reconciles with zero unresolved qualified references", function () {
  const graph = this.kernel.builds.forward.graph;
  assertConservationInvariants(graph);
  assert.strictEqual(graph.counts.unresolvedReferenceOccurrences, 0);
  for (const reference of graph.referenceOccurrences) {
    assert.strictEqual(reference.outcome, "RESOLVED", `unresolved reference ${reference.rawTarget}`);
    assert.ok(reference.resolvedEdgeId !== null);
  }
  const errorDiagnostics = graph.diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
  assert.deepStrictEqual(errorDiagnostics, [], "real corpus must be diagnostic-clean at ERROR severity");
  assert.strictEqual(graph.valid, true);
});

Then("source bytes are preserved losslessly into the graph documents", function () {
  const { manifest } = this.kernel;
  const graph = this.kernel.builds.forward.graph;
  const byPath = new Map(this.kernel.corpusRead.files.map((file) => [file.path, file]));
  assert.strictEqual(graph.documents.length, manifest.documents.length);
  for (const document of graph.documents) {
    const source = byPath.get(document.path);
    assert.ok(source, `graph document ${document.path} missing from reader output`);
    assert.strictEqual(document.sha256, sha256Hex(source.bytes), `${document.path} hashed bytes differ from input`);
    assert.strictEqual(document.byteLength, source.bytes.byteLength);
    assert.strictEqual(document.accepted, true);
  }
});

Then("both competing builds serialize to the identical canonical snapshot", function () {
  const { forward, competing } = this.kernel.builds;
  assert.strictEqual(forward.graph.fingerprint, competing.graph.fingerprint);
  assert.strictEqual(canonicalJson(forward.graph), canonicalJson(competing.graph));
  assert.strictEqual(canonicalJson(forward.diagnostics), canonicalJson(competing.diagnostics));
});

// ---------------------------------------------------------------------------
// Scenario 2: adversarial anchor allocation
// ---------------------------------------------------------------------------

Given('a synthetic producer with adversarial duplicate heading sequences "Foo Foo Foo-1" and "Foo-1 Foo Foo"', function () {
  this.kernel.producerFiles = anchorProducerFiles();
});

When("the kernel builds the graph from the producer bytes", function () {
  const build = buildKernelGraph({ files: this.kernel.producerFiles });
  this.kernel.producerBuild = build;
});

Then('the allocated canonical anchors are exactly "foo foo-1 foo-1-1" and "foo-1 foo foo-2"', function () {
  const headings = this.kernel.producerBuild.graph.markdownHeadingOccurrences;
  const readme = headings.filter((heading) => heading.path === ".specs/anchor-lab/README.md");
  const design = headings.filter((heading) => heading.path === ".specs/anchor-lab/DESIGN.md");
  assert.deepStrictEqual(readme.map((heading) => heading.baseAnchor), ["foo", "foo", "foo-1"]);
  assert.deepStrictEqual(readme.map((heading) => heading.canonicalAnchor), ["foo", "foo-1", "foo-1-1"]);
  assert.deepStrictEqual(design.map((heading) => heading.baseAnchor), ["foo-1", "foo", "foo"]);
  assert.deepStrictEqual(design.map((heading) => heading.canonicalAnchor), ["foo-1", "foo", "foo-2"]);
});

Then("every allocation records the glfm-anchor@1 algorithm and minimal duplicate ordinals", function () {
  const headings = this.kernel.producerBuild.graph.markdownHeadingOccurrences;
  assert.strictEqual(headings.length, 6);
  for (const path of [".specs/anchor-lab/README.md", ".specs/anchor-lab/DESIGN.md"]) {
    const perDocument = headings.filter((heading) => heading.path === path).map((heading) => heading.canonicalAnchor);
    assert.strictEqual(new Set(perDocument).size, perDocument.length, `anchors must be unique in ${path}`);
  }
  for (const heading of headings) {
    assert.strictEqual(heading.anchorAlgorithmVersion, "glfm-anchor@1");
    const expectedOrdinal =
      heading.canonicalAnchor === heading.baseAnchor
        ? 0
        : Number(heading.canonicalAnchor.slice(heading.baseAnchor.length + 1));
    assert.strictEqual(heading.duplicateOrdinal, expectedOrdinal);
    assert.ok(heading.duplicateOrdinal >= 0);
  }
  const readmeOrdinals = headings
    .filter((heading) => heading.path.endsWith("README.md"))
    .map((heading) => heading.duplicateOrdinal);
  const designOrdinals = headings
    .filter((heading) => heading.path.endsWith("DESIGN.md"))
    .map((heading) => heading.duplicateOrdinal);
  assert.deepStrictEqual(readmeOrdinals, [0, 1, 1]);
  assert.deepStrictEqual(designOrdinals, [0, 0, 2]);
});

// ---------------------------------------------------------------------------
// Scenario 3: lossless duplicate election
// ---------------------------------------------------------------------------

Given('a synthetic producer whose FR.md defines FR-1 twice as "Alpha" then "Beta"', function () {
  this.kernel.producerFiles = duplicateProducerFiles();
});

Then("both duplicate candidates remain preserved in canonical document order", function () {
  const graph = this.kernel.producerBuild.graph;
  const candidates = graph.definitionCandidates.filter((candidate) => candidate.canonicalId === "dupe-lab:FR-1");
  assert.strictEqual(candidates.length, 2);
  assert.deepStrictEqual(candidates.map((candidate) => candidate.title), ["Alpha", "Beta"]);
  assert.notStrictEqual(candidates[0].occurrenceId, candidates[1].occurrenceId);
  assert.ok(candidates[0].span.startOffset < candidates[1].span.startOffset, "candidates keep document order");
  for (const candidate of candidates) {
    // Closed union per SCHEMA-4: UNIQUE | AMBIGUOUS | REJECTED.
    assert.ok(["UNIQUE", "AMBIGUOUS", "REJECTED"].includes(candidate.outcome), "candidate outcome is in the closed union");
    assert.strictEqual(candidate.outcome, "AMBIGUOUS", "each duplicated candidate is elected ambiguous");
    assert.ok(candidates[0].body.includes("Alpha normative body."), "Alpha candidate keeps its own body");
    assert.ok(!candidates[0].body.includes("Beta normative body."), "Alpha candidate does not absorb Beta body");
    assert.ok(candidates[1].body.includes("Beta normative body."), "Beta candidate keeps its own body");
    assert.ok(!candidates[1].body.includes("Alpha normative body."), "Beta candidate does not absorb Alpha body");
  }
});

Then("no unique node is elected for the duplicated identity", function () {
  const graph = this.kernel.producerBuild.graph;
  assert.strictEqual(graph.nodes.some((node) => node.canonicalId === "dupe-lab:FR-1"), false);
  assert.strictEqual(
    graph.counts.ambiguousDefinitionOccurrences,
    2,
    "the ambiguous counter must observe exactly the duplicate pair",
  );
});

Then("one DUPLICATE_DEFINITION diagnostic binds both candidate occurrences", function () {
  const graph = this.kernel.producerBuild.graph;
  const duplicates = graph.diagnostics.filter((diagnostic) => diagnostic.code === "DUPLICATE_DEFINITION");
  assert.strictEqual(duplicates.length, 1);
  const candidates = graph.definitionCandidates.filter((candidate) => candidate.canonicalId === "dupe-lab:FR-1");
  for (const candidate of candidates) {
    assert.ok(
      candidate.diagnosticIds.includes(duplicates[0].diagnosticId),
      "each duplicate candidate must reference the shared diagnostic",
    );
  }
  assert.deepStrictEqual(duplicates[0].span, candidates[0].span, "primary location is the first canonical-order candidate");
  assert.strictEqual(
    duplicates[0].relatedSpans.length,
    candidates.length - 1,
    "supporting locations cover every non-primary candidate",
  );
  assert.deepStrictEqual(duplicates[0].relatedSpans[0], candidates[1].span, "second candidate is the supporting span");
});

Then("getNode rejects the ambiguous identity with bounded stable candidates", function () {
  const forward = this.kernel.producerBuild.graph;
  const reversed = buildKernelGraph({ files: [...this.kernel.producerFiles].reverse() }).graph;
  const candidateSets = [forward, reversed].map((graph) => {
    const envelope = query(graph, "getNode", {
      canonicalId: "dupe-lab:FR-1",
      projection: "summary",
      includeIncidentCounts: false,
    });
    this.kernel.envelopes.push(envelope);
    assert.strictEqual(envelope.ok, false);
    assert.strictEqual(envelope.error.code, "AMBIGUOUS_ID");
    assert.strictEqual(envelope.error.canonicalId, "dupe-lab:FR-1");
    assert.strictEqual(envelope.error.candidates.length, 2);
    return envelope.error.candidates;
  });
  // SCHEMA-12 orders candidates by (source.path, source.startOffset,
  // occurrenceId) — never by the occurrenceId key alone. Building from
  // competing input orders must yield byte-identical candidate summaries.
  assert.deepStrictEqual(
    candidateSets[0],
    candidateSets[1],
    "candidate summaries are stably ordered regardless of input file order",
  );
  assert.deepStrictEqual(candidateSets[0].map((candidate) => candidate.title), ["Alpha", "Beta"]);
});

Then('the qualified reference into the duplicated identity stays UNRESOLVED with reason "AMBIGUOUS_TARGET"', function () {
  const graph = this.kernel.producerBuild.graph;
  const references = graph.referenceOccurrences.filter((reference) => reference.rawTarget === "dupe-lab:FR-1");
  assert.strictEqual(references.length, 1, "exactly one qualified reference targets the duplicated identity");
  assert.strictEqual(references[0].outcome, "UNRESOLVED");
  assert.strictEqual(references[0].unresolvedReason, "AMBIGUOUS_TARGET");
});

// ---------------------------------------------------------------------------
// Scenario 4: typed diagnostics
// ---------------------------------------------------------------------------

Given("a synthetic producer with two broken markdown links and a duplicated FR identity", function () {
  this.kernel.producerFiles = diagnosticsProducerFiles();
});

Then("every broken link occurrence carries its exact typed unresolved reason", function () {
  const graph = this.kernel.producerBuild.graph;
  const links = graph.markdownLinkOccurrences;
  const ghost = links.find((link) => link.rawDestination === "GHOST.md#nope");
  assert.ok(ghost, "missing-document link must be inventoried");
  assert.strictEqual(ghost.outcome, "UNRESOLVED");
  assert.strictEqual(ghost.unresolvedReason, "TARGET_DOCUMENT_MISSING");
  const absentAnchor = links.find((link) => link.rawDestination === "README.md#absent-anchor");
  assert.ok(absentAnchor, "missing-anchor link must be inventoried");
  assert.strictEqual(absentAnchor.outcome, "UNRESOLVED");
  assert.strictEqual(absentAnchor.unresolvedReason, "TARGET_ANCHOR_MISSING");
});

Then("the diagnostic inventory contains exactly the expected typed codes in stable order", function () {
  const graph = this.kernel.producerBuild.graph;
  assertDiagnosticSort(graph.diagnostics);
  const codes = graph.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes("BROKEN_MARKDOWN_LINK"));
  assert.ok(codes.includes("DUPLICATE_DEFINITION"));
  const unexpected = codes.filter((code) => !["BROKEN_MARKDOWN_LINK", "DUPLICATE_DEFINITION"].includes(code));
  assert.deepStrictEqual(unexpected, [], "no unexplained diagnostics may appear");
  const broken = graph.diagnostics.filter((diagnostic) => diagnostic.code === "BROKEN_MARKDOWN_LINK");
  assert.strictEqual(broken.length, 2);
});

Then("graph validity is false exactly when an ERROR-severity diagnostic exists", function () {
  const graph = this.kernel.producerBuild.graph;
  const hasError = graph.diagnostics.some((diagnostic) => diagnostic.severity === "ERROR");
  assert.strictEqual(graph.valid, !hasError);
  assertConservationInvariants(graph);
});

// ---------------------------------------------------------------------------
// Scenario 5: fail-closed query envelopes
// ---------------------------------------------------------------------------

Given("a built synthetic producer graph", function () {
  this.kernel.producerFiles = duplicateProducerFiles();
  this.kernel.producerBuild = buildKernelGraph({ files: this.kernel.producerFiles });
});

When("the query service receives {string}", function (requestName) {
  const graph = this.kernel.producerBuild.graph;
  let envelope;
  if (requestName === "an unknown operation") {
    envelope = query(graph, "drop-all-tables", {});
  } else if (requestName === "a known operation with unknown field") {
    envelope = query(graph, "overview", { specSlugs: [], grantWriteAccess: true });
  } else {
    throw new Error(`unknown request fixture ${requestName}`);
  }
  this.kernel.envelopes.push(envelope);
  this.kernel.lastEnvelope = envelope;
});

Then("the envelope rejects it fail-closed with error code {string}", function (expectedCode) {
  const envelope = this.kernel.lastEnvelope;
  assert.strictEqual(envelope.ok, false);
  assert.strictEqual(envelope.error.code, expectedCode);
  assert.strictEqual(envelope.schemaVersion, "spec-kernel@1");
  assert.strictEqual(envelopeData(envelope), null, "a rejected envelope must carry no success payload");
  assert.ok(typeof envelope.operation === "string" && envelope.operation.length > 0, "operation is echoed");
});

// ---------------------------------------------------------------------------
// Scenario 6: junction refusal
// ---------------------------------------------------------------------------

Given("a temporary repository whose spec directory contains a real directory junction", async function () {
  const root = await createTempRepo();
  this.kernel.tempRoot = root;
  await writeCorpus(root, [
    { path: ".specs/junction-spec/README.md", bytes: new TextEncoder().encode("# Junction Spec\n") },
  ]);
  const outside = path.join(root, "outside");
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "README.md"), "# Outside Secret\n");
  this.kernel.junctionTargetMarker = "Outside Secret";
  // Real junction on Windows, directory symlink inside Linux containers.
  // Setup failure fails the scenario — there is no skip path.
  await plantDirectoryJunction(path.join(root, ".specs", "junction-spec", "linked"), outside);
});

When("the filesystem reader inspects the temporary repository", async function () {
  this.kernel.readOutcome = await readRepositorySpecs({ root: this.kernel.tempRoot });
});

Then("the reader refuses before reading any linked content", function () {
  const outcome = this.kernel.readOutcome;
  assert.ok(Object.prototype.hasOwnProperty.call(outcome, "error"), "the reader must refuse with an error result");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(outcome, "files"), false, "refusal returns no files");
  const serialized = JSON.stringify(outcome);
  assert.match(serialized, /SYMLINK_REJECTED/, "the sanitized diagnostic must name SYMLINK_REJECTED");
  assert.ok(!serialized.includes(this.kernel.junctionTargetMarker), "linked content must never leak into the result");
});

// ---------------------------------------------------------------------------
// Scenario 7: bounds and truncation
// ---------------------------------------------------------------------------

Given("a large synthetic corpus of four specs with one hundred twenty requirements", function () {
  this.kernel.producerFiles = largeSyntheticCorpusFiles();
  this.kernel.producerBuild = buildKernelGraph({ files: this.kernel.producerFiles });
  const grown = buildKernelGraph({
    files: [
      ...this.kernel.producerFiles,
      { path: ".specs/big-e/README.md", bytes: new TextEncoder().encode("# Big E\n") },
    ],
  });
  this.kernel.foreignBuild = grown;
});

When("the query service pages through every requirement three at a time", function () {
  const graph = this.kernel.producerBuild.graph;
  const pages = [];
  let cursor = null;
  for (let guard = 0; guard < 200; guard += 1) {
    const envelope = query(graph, "findNodes", findNodesArgs(3, cursor));
    assert.strictEqual(envelope.ok, true, `paged request failed: ${JSON.stringify(envelope.error)}`);
    const page = envelope.page;
    if (page.nextCursor !== null) {
      assert.strictEqual(page.returned, 3, "every non-terminal page returns exactly the limit");
    } else {
      assert.ok(page.returned >= 1 && page.returned <= 3, "the terminal page respects the limit");
    }
    assert.ok(page.cursor === null || (typeof page.cursor === "string" && page.cursor.length <= 512));
    pages.push(page);
    const data = envelopeData(envelope);
    assert.strictEqual(data.kind, "nodes");
    if (page.nextCursor === null) break;
    cursor = page.nextCursor;
  }
  this.kernel.pages = pages;
  this.kernel.firstPageEnvelope = query(graph, "findNodes", findNodesArgs(3, null));
});

Then("the cursor chain conserves every matched requirement exactly once", function () {
  const { pages } = this.kernel;
  assert.strictEqual(pages.length, 40, `120 requirements at limit 3 paginate into exactly 40 pages, saw ${pages.length}`);
  assert.strictEqual(pages[pages.length - 1].nextCursor, null, "the chain must terminate explicitly");
  const totalMatched = pages[0].totalMatched;
  assert.strictEqual(totalMatched, 120);
  const returnedSum = pages.reduce((sum, page) => sum + page.returned, 0);
  assert.strictEqual(returnedSum, totalMatched, "sum(returned) must equal totalMatched across the chain");
  assert.strictEqual(pages.at(-1).truncated, false, "a completed chain is not truncated");
});

Then("an out-of-range page size fails closed without silent truncation", function () {
  const graph = this.kernel.producerBuild.graph;
  for (const limit of [0, -1]) {
    const envelope = query(graph, "findNodes", findNodesArgs(limit, null));
    assert.strictEqual(envelope.ok, false, `limit ${limit} must fail closed`);
    assert.strictEqual(envelope.error.code, "INVALID_PARAMETER");
  }
});

Then("a cursor from a foreign graph is rejected as stale", function () {
  const staleCursor = this.kernel.firstPageEnvelope.page.nextCursor;
  assert.ok(staleCursor !== null, "the first page must have a successor for this probe");
  const envelope = query(this.kernel.foreignBuild.graph, "findNodes", findNodesArgs(3, staleCursor));
  assert.strictEqual(envelope.ok, false);
  assert.strictEqual(envelope.error.code, "STALE_CURSOR");
});

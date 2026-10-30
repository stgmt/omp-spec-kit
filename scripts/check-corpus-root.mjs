#!/usr/bin/env node
/**
 * Validate one explicit corpus root with the shipped kernel.
 *
 * Usage: node scripts/check-corpus-root.mjs <root>
 *
 * <root> is the directory that contains `.specs/` (a specs-repo project root
 * such as `<clone>/<owner>/<project>`), not the repository root. The command
 * exits 1 on any ERROR diagnostic or a rejected document, and 0 otherwise.
 */
import path from "node:path";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/index.js";

const root = process.argv[2];
if (typeof root !== "string" || root.length === 0) {
  console.error("usage: node scripts/check-corpus-root.mjs <root containing .specs>");
  process.exit(1);
}

const read = await readRepositorySpecs({ root: path.resolve(root) });
if (read?.error) {
  console.error(`corpus root: reader refused: ${JSON.stringify(read.error)}`);
  process.exit(1);
}

const { graph, diagnostics } = buildKernelGraph({ files: read.files });
const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
const rejected = graph.definitionCandidates.filter((candidate) => candidate.outcome === "REJECTED");
const ambiguous = graph.definitionCandidates.filter((candidate) => candidate.outcome === "AMBIGUOUS");

console.log(
  `corpus root: ${graph.counts.discoveredDocuments} documents, ${graph.counts.acceptedDocuments} accepted, ` +
    `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${errors.length} errors, ${diagnostics.length} diagnostics`,
);

if (!graph.valid || errors.length > 0) {
  for (const diagnostic of errors.slice(0, 20)) {
    console.error(`ERROR ${diagnostic.code} ${diagnostic.span?.path ?? ""}:${diagnostic.span?.startLine ?? ""} ${diagnostic.message ?? ""}`.trim());
  }
  for (const candidate of rejected.slice(0, 10)) {
    console.error(`REJECTED ${candidate.span?.path ?? ""}:${candidate.span?.startLine ?? ""}`);
  }
  for (const candidate of ambiguous.slice(0, 10)) {
    console.error(`AMBIGUOUS ${candidate.canonicalId ?? "unknown"}`);
  }
  process.exit(1);
}

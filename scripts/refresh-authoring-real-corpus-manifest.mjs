#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";
import { buildKernelGraph } from "../src/kernel/graph/build.js";
import { sha256Bytes } from "../src/kernel/normalize.js";
import { canonicalDocumentKind, GHERKIN_DOCUMENT_KINDS, canonicalDocumentFilename } from "../src/kernel/types.js";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const fixtureDirectory = "tests/fixtures/kernel/authoring-real-corpus/.specs";
const selectedSpecs = ["plugin-distribution", "spec-mcp-access-gate", "spec-mcp-operations"];
const manifestPath = path.join(repositoryRoot, "tests/fixtures/kernel/authoring-real-corpus-manifest.json");
const result = await readRepositorySpecs({ root: path.join(repositoryRoot, fixtureDirectory, "..") });
if (result.error) throw new Error(`authoring corpus is unreadable: ${result.error.code}`);
const files = result.files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
if (files.length !== 42 || files.some(({ path: filename }) => {
  const [, spec, name, extra] = filename.split("/");
  return extra !== undefined || !selectedSpecs.includes(spec) || !canonicalDocumentKind(name, spec);
})) {
  throw new Error("authoring corpus must contain 42 canonical documents across the three selected specifications");
}
const selectedPaths = files.map((file) => file.path);
for (const spec of selectedSpecs) {
  if (!GHERKIN_DOCUMENT_KINDS.every((kind) => selectedPaths.includes(`.specs/${spec}/${canonicalDocumentFilename(kind, spec)}`))) {
    throw new Error(`missing canonical Gherkin pair for ${spec}`);
  }
}
const { graph, diagnostics } = buildKernelGraph({ files });
if (!graph.valid) throw new Error(`invalid authoring corpus: ${diagnostics.filter(({ severity }) => severity === "ERROR").map(({ message }) => message).join("; ")}`);

const documents = files.map(({ path: filename, bytes }) => ({ path: filename, bytes: bytes.length, sha256: sha256Bytes(bytes) }));
const material = documents.map(({ path: filename, bytes, sha256 }) => `${filename}\0${bytes}\0${sha256}\n`).join("");
const manifest = {
  schema: "omp-spec-kit-authoring-real-corpus@2",
  sourceCommit: "70468cc40f391d8fc8ecacc7a144b82328e62e03",
  sourceCommand: "Historical .specs from sourceCommit, migrated to the canonical Gherkin pair in this fixture",
  fixtureDirectory,
  selectedSpecs,
  selectedPaths,
  documentCount: documents.length,
  documents,
  aggregateSha256: sha256Bytes(Buffer.from(material, "utf8")),
  licenseDisposition: "Derived from the repository's MIT-licensed specification corpus for release verification.",
};
const expected = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (await readFile(manifestPath, "utf8") !== expected) throw new Error("authoring corpus manifest drifted");
  console.log(`verified authoring corpus: documents=${documents.length}; aggregate=${manifest.aggregateSha256}`);
} else {
  await writeFile(manifestPath, expected, "utf8");
  console.log(`refreshed authoring corpus: documents=${documents.length}; aggregate=${manifest.aggregateSha256}`);
}

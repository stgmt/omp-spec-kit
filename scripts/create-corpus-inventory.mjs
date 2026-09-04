#!/usr/bin/env node
// Standalone capture of a real corpus inventory for distribution evidence.
// Mirrors tests/helpers/kernel-world: verify the frozen real-corpus manifest
// provenance and every frozen byte, then drive the production kernel
// filesystem adapter (src/kernel/adapters/fs.js readRepositorySpecs) over the
// frozen fixture root. Writes one JSON object:
//   { schema, corpusFixtureSha256, observedSpecs, returnedSpecs }
// consumed by scripts/create-distribution-evidence.mjs --inventory-output.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./release-candidate-utils.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CURRENT_CORPUS_SOURCE_COMMIT = "70468cc40f391d8fc8ecacc7a144b82328e62e03";
const CURRENT_CORPUS_MANIFEST_SCHEMA = "omp-spec-kit-authoring-real-corpus@1";

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function frozenCorpusDigest(documents) {
  const bytes = documents
    .map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`)
    .join("");
  return sha256Hex(Buffer.from(bytes, "utf8"));
}

function fail(message) {
  throw new Error(`create-corpus-inventory: ${message}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--output"]);
  if (!args["--output"]) fail("--output is required");

  const manifestPath = path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const paths = Array.isArray(manifest.documents) ? manifest.documents.map((entry) => entry.path) : [];
  if (paths.length !== 45 || new Set(paths).size !== paths.length) {
    fail("authoring corpus manifest must contain exactly 45 unique paths");
  }
  if (
    manifest.schema !== CURRENT_CORPUS_MANIFEST_SCHEMA ||
    manifest.sourceCommit !== CURRENT_CORPUS_SOURCE_COMMIT
  ) {
    fail("authoring corpus manifest does not identify its immutable source commit");
  }
  if (manifest.aggregateSha256 !== frozenCorpusDigest(manifest.documents)) {
    fail("authoring corpus manifest content address is invalid");
  }

  // Verify every current corpus byte before any reader touches the tree.
  const fixtureRoot = path.join(repositoryRoot, "tests", "fixtures", "kernel", "authoring-real-corpus");
  for (const entry of manifest.documents) {
    const absolute = path.join(fixtureRoot, ...entry.path.split("/"));
    let bytes;
    try {
      bytes = await readFile(absolute);
    } catch (error) {
      fail(`frozen corpus byte unreadable: ${entry.path}: ${error.message}`);
    }
    if (bytes.byteLength !== entry.bytes || sha256Hex(bytes) !== entry.sha256) {
      fail(`frozen corpus byte drifted: ${entry.path}`);
    }
  }

  // Production kernel reader over the frozen root; identical containment,
  // symlink-refusal, and budget rules as every MCP-served inventory read.
  const adapterUrl = new URL("../src/kernel/adapters/fs.js", import.meta.url);
  const { readRepositorySpecs } = await import(adapterUrl.href);
  const result = await readRepositorySpecs({ root: fixtureRoot });
  if (result.error) fail(`kernel reader refused the frozen corpus: ${result.error.code}`);

  const slugs = [...new Set(result.files.map((file) => file.path.split("/")[1]))].sort();
  const output = {
    schema: "omp-spec-kit-corpus-inventory@1",
    corpusFixtureSha256: manifest.aggregateSha256,
    observedSpecs: slugs.length,
    returnedSpecs: slugs.length,
    documentCount: result.files.length,
    specs: slugs,
  };

  const target = path.resolve(args["--output"]);
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}


await main();

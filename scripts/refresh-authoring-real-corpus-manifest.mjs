#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "tests", "fixtures", "kernel", "authoring-real-corpus");
const manifestPath = path.join(root, "tests", "fixtures", "kernel", "authoring-real-corpus-manifest.json");
const specs = ["plugin-distribution", "spec-mcp-access-gate", "spec-mcp-operations"];
const fixedDocuments = [
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
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  throw new Error(`refresh-authoring-real-corpus-manifest: ${message}`);
}

function gitShow(commit, relativePath) {
  try {
    return execFileSync("git", ["show", `${commit}:${relativePath}`], { cwd: root });
  } catch (error) {
    fail(`git show failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sourcePaths() {
  return specs.flatMap((spec) => [
    ...fixedDocuments.map((document) => `.specs/${spec}/${document}`),
    `.specs/${spec}/${spec}.feature`,
    `.specs/${spec}/${spec}_SCHEMA.md`,
  ]);
}

function aggregateDigest(files) {
  const material = files.map((file) => `${file.path}\u0000${file.bytes}\u0000${file.sha256}\n`).join("");
  return sha256(Buffer.from(material, "utf8"));
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(`manifest is unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyFixture(manifest) {
  if (manifest.schema !== "omp-spec-kit-authoring-real-corpus@1") fail("manifest schema mismatch");
  if (manifest.documentCount !== 45 || manifest.documents?.length !== 45) fail("manifest must contain exactly 45 documents");
  if (manifest.fixtureDirectory !== "tests/fixtures/kernel/authoring-real-corpus/.specs") fail("fixture directory mismatch");
  const paths = manifest.documents.map((file) => file.path);
  if (new Set(paths).size !== paths.length) fail("manifest document paths are not unique");
  if (JSON.stringify(paths) !== JSON.stringify([...sourcePaths()].sort())) fail("manifest paths differ from the three canonical specs");
  for (const file of manifest.documents) {
    const absolute = path.join(root, manifest.fixtureDirectory, file.path.slice(".specs/".length));
    const bytes = await readFile(absolute);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) fail(`fixture digest mismatch: ${file.path}`);
  }
  if (aggregateDigest(manifest.documents) !== manifest.aggregateSha256) fail("aggregate fixture digest mismatch");
}

async function refresh(commit) {
  const documents = sourcePaths().sort().map((relativePath) => {
    const bytes = gitShow(commit, relativePath);
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes), content: bytes };
  });
  await rm(fixtureRoot, { recursive: true, force: true });
  for (const file of documents) {
    const relative = file.path.slice(".specs/".length);
    const destination = path.join(fixtureRoot, ".specs", relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content);
  }
  const manifest = {
    schema: "omp-spec-kit-authoring-real-corpus@1",
    sourceCommit: commit,
    sourceCommand: "git show <commit>:.specs/<spec>/<document>",
    fixtureDirectory: "tests/fixtures/kernel/authoring-real-corpus/.specs",
    selectedSpecs: specs,
    selectedPaths: documents.map(({ path: relativePath }) => relativePath),
    documentCount: documents.length,
    documents: documents.map(({ path: relativePath, bytes, sha256: digest }) => ({ path: relativePath, bytes, sha256: digest })),
    aggregateSha256: aggregateDigest(documents),
    licenseDisposition: "Copied from the repository's MIT-licensed specification corpus for release verification; no external content added.",
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

const check = process.argv.includes("--check");
const commitArgument = process.argv.find((argument) => argument.startsWith("--commit="));
const commit = commitArgument?.slice("--commit=".length) ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/u.test(commit)) fail(`commit must be a full 40-hex id: ${commit}`);
if (check) {
  await verifyFixture(await loadManifest());
  console.log(`verified authoring corpus: documents=45; aggregate=${(await loadManifest()).aggregateSha256}`);
} else {
  const manifest = await refresh(commit);
  console.log(`refreshed authoring corpus: commit=${commit}; documents=${manifest.documentCount}; aggregate=${manifest.aggregateSha256}`);
}

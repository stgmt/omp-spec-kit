import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_RELATIVE_PATH = "tests/fixtures/kernel/real-corpus-manifest.json";
const FIXTURE_RELATIVE_PATH = "tests/fixtures/kernel/real-corpus";
// The original manifest recorded this clean source commit. Never substitute HEAD.
const SOURCE_COMMIT = "1e1475c139406c112dab43dfa689d1140a57ddb3";
const SELECTION_MANIFEST_COMMIT = "b40db2e57f0b4c093a8a0e96e591d9109e3335be";

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function gitShow(repositoryRoot, revision) {
  return execFileSync("git", ["-C", repositoryRoot, "show", revision], { encoding: null, windowsHide: true });
}

function fixturePath(repositoryRoot) {
  return path.join(repositoryRoot, ...FIXTURE_RELATIVE_PATH.split("/"));
}

function absoluteFixturePath(repositoryRoot, relativePath) {
  if (!/^\.specs\/[a-z0-9-]+\/[A-Za-z0-9_.-]+$/u.test(relativePath)) {
    throw new Error(`unsafe frozen fixture path: ${relativePath}`);
  }
  return path.join(fixturePath(repositoryRoot), ...relativePath.split("/"));
}

function selectedDocuments(repositoryRoot) {
  const selection = JSON.parse(gitShow(repositoryRoot, `${SELECTION_MANIFEST_COMMIT}:${MANIFEST_RELATIVE_PATH}`).toString("utf8"));
  const paths = selection.documents.map((entry) => entry.path);
  if (paths.length !== 60 || new Set(paths).size !== paths.length) {
    throw new Error("the immutable selection manifest must contain exactly 60 unique documents");
  }
  if (!selection.provenance.captureCommand.includes(SOURCE_COMMIT)) {
    throw new Error("the immutable selection manifest does not attest the frozen source commit");
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

function visibleMarkdown(text) {
  let fenced = false;
  return text.split(/\r?\n/u).map((line) => {
    if (/^\s*(```|~~~)/u.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced || /^ {4}/u.test(line) ? "" : line;
  });
}
function glfmAnchor(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/<[^>]*>/gu, "")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim()
    .replace(/\s+/gu, "-");
}

function withoutInlineCode(line) {
  return line.replace(/(`+)(?:.|\r?\n)*?\1/gu, "");
}

function markdownDestinations(lines) {
  const destinations = [];
  const inline = /(?<!!)\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/gu;
  const autolink = /<((?:https?|mailto):[^>\s]+)>/gu;
  for (const visibleLine of lines) {
    const line = withoutInlineCode(visibleLine);
    for (const match of line.matchAll(inline)) destinations.push(match[1] ?? match[2]);
    for (const match of line.matchAll(autolink)) destinations.push(match[1]);
  }
  return destinations;
}

/**
 * An intentionally independent, lexical oracle. It imports no kernel module and
 * does not reuse graph/parser helpers. Its documented grammar is the original
 * fixture provenance grammar: visible ATX headings, owning-document definitions,
 * inline Markdown links/autolinks, and @id tags attached to Gherkin scenarios.
 */
export function independentlyCountCorpus(files) {
  const markdown = new Map();
  const declaredIdentifiers = new Set();
  const qualifiedReferences = [];
  let functionalRequirements = 0;
  let acceptanceCriteria = 0;
  let tasks = 0;
  let scenarios = 0;
  let markdownHeadingOccurrences = 0;
  let markdownLinkOccurrences = 0;
  let markdownExternalLinks = 0;
  let unresolvedReferenceOccurrences = 0;

  for (const file of files) {
    const text = file.bytes.toString("utf8");
    if (!file.path.endsWith(".md")) {
      if (file.path.endsWith(".feature")) {
        let tags = [];
        for (const line of text.split(/\r?\n/u)) {
          const trimmed = line.trim();
          if (trimmed.startsWith("@")) {
            tags.push(...trimmed.split(/\s+/u));
          } else if (/^Scenario(?: Outline)?:/u.test(trimmed)) {
            if (tags.some((tag) => tag.startsWith("@id:"))) scenarios += 1;
            tags = [];
          } else if (trimmed !== "" && !trimmed.startsWith("#")) {
            tags = [];
          }
        }
      }
      continue;
    }

    const lines = visibleMarkdown(text);
    markdown.set(file.path, lines);
    for (const line of lines) {
      const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
      if (heading) {
        markdownHeadingOccurrences += 1;
        if (file.path.endsWith("/FR.md") && /^##\s+FR-\d+\s*(?::|—)/u.test(line)) {
          functionalRequirements += 1;
          declaredIdentifiers.add(`${file.path.split("/")[1]}:${/^##\s+(FR-\d+)/u.exec(line)[1]}`);
        }
        if (file.path.endsWith("/ACCEPTANCE_CRITERIA.md") && /^#{2,3}\s+AC-\d+\.\d+\s*(?::|—|$)/u.test(line)) {
          acceptanceCriteria += 1;
          declaredIdentifiers.add(`${file.path.split("/")[1]}:${/^#{2,3}\s+(AC-\d+\.\d+)/u.exec(line)[1]}`);
        }
        if (file.path.endsWith("/TASKS.md") && /^##\s+TASK-\d+\s*(?::|—)/u.test(line)) {
          tasks += 1;
          declaredIdentifiers.add(`${file.path.split("/")[1]}:${/^##\s+(TASK-\d+)/u.exec(line)[1]}`);
        }
      }
      if (/(?:Refs|Requirements):/u.test(line)) {
        qualifiedReferences.push(...line.matchAll(/\b([a-z0-9-]+:(?:FR-\d+|AC-\d+\.\d+|TASK-\d+))\b/giu).map((match) => match[1]));
      }
    }
  }

  for (const lines of markdown.values()) {
    for (const rawDestination of markdownDestinations(lines)) {
      markdownLinkOccurrences += 1;
      if (/^(?:https?|mailto):/iu.test(rawDestination)) markdownExternalLinks += 1;
    }
  }
  unresolvedReferenceOccurrences = qualifiedReferences.filter((reference) => !declaredIdentifiers.has(reference)).length;

  return {
    discoveredDocuments: files.length,
    acceptedDocuments: files.length,
    rejectedDocuments: 0,
    functionalRequirements,
    acceptanceCriteria,
    tasks,
    scenarios,
    markdownHeadingOccurrences,
    markdownLinkOccurrences,
    markdownExternalLinks,
    unresolvedReferenceOccurrences,
  };
}

function fixtureDigest(documents) {
  return sha256Hex(Buffer.from(documents.map((entry) => `${entry.path}\0${entry.byteLength}\0${entry.sha256}\n`).join(""), "utf8"));
}

async function frozenSourceFiles(repositoryRoot, paths) {
  return Promise.all(paths.map(async (filePath) => {
    const bytes = gitShow(repositoryRoot, `${SOURCE_COMMIT}:${filePath}`);
    return { path: filePath, bytes };
  }));
}

function manifestFor(files, groundTruth) {
  const documents = files
    .map((file) => ({ path: file.path, sha256: sha256Hex(file.bytes), byteLength: file.bytes.byteLength }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: "omp-spec-kit/kernel-fixture-manifest@2",
    fixtureId: "FIXTURE-5",
    fixtureType: "real",
    label: "frozen real four-spec corpus ground truth",
    provenance: {
      sourceCommit: SOURCE_COMMIT,
      selectionManifestCommit: SELECTION_MANIFEST_COMMIT,
      extractionCommand: `node scripts/refresh-real-corpus-manifest.mjs --source-commit ${SOURCE_COMMIT}`,
      captureScope: "Exactly the original manifest-selected 60 canonical documents across plugin-distribution, product, spec-authoring-workflow, and spec-kernel; paths are loaded from the immutable selection manifest, not scanned from the working tree.",
      fixtureDirectory: FIXTURE_RELATIVE_PATH,
      fixtureSha256: fixtureDigest(documents),
      byteSource: "git show <sourceCommit>:<path>; bytes are written verbatim before SHA-256 and byteLength are recorded.",
      countMethod: "independent lexical oracle in scripts/refresh-real-corpus-manifest.mjs: no kernel imports; counts visible ATX headings, owning-document FR/AC/TASK grammar, inline Markdown links/autolinks, declared qualified references, and @id-tagged Gherkin scenarios.",
      licenseDisposition: "repository-owned, same license as omp-spec-kit repository",
    },
    groundTruth,
    documents,
  };
}

function assertSameJson(actual, expected, message) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(message);
}

async function writeFrozenFixture(repositoryRoot, files, manifestPath, manifest) {
  const root = fixturePath(repositoryRoot);
  await rm(root, { recursive: true, force: true });
  for (const file of files) {
    const destination = absoluteFixturePath(repositoryRoot, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readFixtureFiles(repositoryRoot, manifest) {
  return Promise.all(manifest.documents.map(async (entry) => {
    const bytes = await readFile(absoluteFixturePath(repositoryRoot, entry.path));
    if (bytes.byteLength !== entry.byteLength || sha256Hex(bytes) !== entry.sha256) {
      throw new Error(`frozen fixture byte drifted: ${entry.path}`);
    }
    return { path: entry.path, bytes };
  }));
}

/** Materializes exact bytes from the permanently recorded source commit. */
export async function refreshRealCorpusManifest({ repositoryRoot, write = true } = {}) {
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) throw new Error("repositoryRoot is required");
  const paths = selectedDocuments(repositoryRoot);
  const files = await frozenSourceFiles(repositoryRoot, paths);
  const groundTruth = independentlyCountCorpus(files);
  const manifest = manifestFor(files, groundTruth);
  const manifestPath = path.join(repositoryRoot, ...MANIFEST_RELATIVE_PATH.split("/"));

  if (write) await writeFrozenFixture(repositoryRoot, files, manifestPath, manifest);
  else {
    const onDiskManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assertSameJson(onDiskManifest, manifest, "frozen manifest is not reproducible from the recorded commit");
    const onDiskFiles = await readFixtureFiles(repositoryRoot, onDiskManifest);
    assertSameJson(independentlyCountCorpus(onDiskFiles), onDiskManifest.groundTruth, "frozen manifest ground truth does not match the independent oracle");
  }

  return { manifest, capture: { sourceCommit: SOURCE_COMMIT, selectedDocumentCount: files.length, fixtureSha256: manifest.provenance.fixtureSha256, groundTruth } };
}

function parseArguments(argv) {
  if (argv.length === 0) return { repositoryRoot: process.cwd(), write: true };
  if (argv.length === 1 && argv[0] === "--check") return { repositoryRoot: process.cwd(), write: false };
  if (argv.length === 2 && argv[0] === "--source-commit" && argv[1] === SOURCE_COMMIT) return { repositoryRoot: process.cwd(), write: true };
  throw new Error(`usage: node scripts/refresh-real-corpus-manifest.mjs [--check|--source-commit ${SOURCE_COMMIT}]`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { capture } = await refreshRealCorpusManifest(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(capture, null, 2)}\n`);
}

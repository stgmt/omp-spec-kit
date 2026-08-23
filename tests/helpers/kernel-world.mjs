import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Shared kernel contract (v0.2 profile). The core worker implements this
// surface in parallel; these tests code to the contract, not to file state.
export { KERNEL_SCHEMA_VERSION, buildKernelGraph, query } from "../../src/kernel/index.js";
export { readRepositorySpecs } from "../../src/kernel/adapters/fs.js";

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Reads the success payload of a query envelope. The authoritative envelope is
 * SCHEMA-9: a success (`ok:true`) carries exactly `data`. There is no legacy
 * alias — a schema-violating envelope fails the step instead of being
 * silently repaired through a `result` fallback. Rejected envelopes carry no
 * success payload and read as null.
 */
export function envelopeData(envelope) {
  if (envelope.ok !== true) return null;
  if (envelope.data === null || envelope.data === undefined) {
    throw new Error(`SCHEMA-9 violation: ok:true envelope carries no data payload (operation ${envelope.operation ?? "unknown"})`);
  }
  return envelope.data;
}

function encode(text) {
  return new TextEncoder().encode(text);
}

const ANCHOR_README = ["# Foo", "", "intro one.", "", "# Foo", "", "intro two.", "", "# Foo-1", "", "tail.", ""].join("\n");
const ANCHOR_DESIGN = ["# Foo-1", "", "lead.", "", "# Foo", "", "middle.", "", "# Foo", "", "end.", ""].join("\n");

const DUPE_FR = [
  "# Functional Requirements",
  "",
  "## FR-1: Alpha",
  "Alpha normative body.",
  "",
  "Refs: dupe-lab:FR-1",
  "",
  "## FR-1: Beta",
  "",
  "Beta normative body.",
  "",
].join("\n");

const DIAG_FR = [
  "# Functional Requirements",
  "",
  "## FR-1: Broken links live here",
  "",
  "Points at [a missing document](GHOST.md#nope) and [a missing anchor](README.md#absent-anchor).",
  "",
  "## FR-2: Once",
  "",
  "Only once.",
  "",
  "## FR-2: Twice",
  "",
  "Defined twice.",
  "",
].join("\n");

const DIAG_README = ["# Diag Lab", "", "Anchor target document without the absent-anchor heading.", ""].join("\n");

export function anchorProducerFiles() {
  return [
    { path: ".specs/anchor-lab/README.md", bytes: encode(ANCHOR_README) },
    { path: ".specs/anchor-lab/DESIGN.md", bytes: encode(ANCHOR_DESIGN) },
  ];
}

export function duplicateProducerFiles() {
  return [{ path: ".specs/dupe-lab/FR.md", bytes: encode(DUPE_FR) }];
}

export function diagnosticsProducerFiles() {
  return [
    { path: ".specs/diag-lab/FR.md", bytes: encode(DIAG_FR) },
    { path: ".specs/diag-lab/README.md", bytes: encode(DIAG_README) },
  ];
}

export function largeSyntheticCorpusFiles() {
  const files = [];
  for (const slug of ["big-a", "big-b", "big-c", "big-d"]) {
    const requirements = ["# Functional Requirements", ""];
    for (let index = 1; index <= 30; index += 1) {
      requirements.push(`## FR-${index}: Requirement ${slug} number ${index}`, "", `Normative text for ${slug} ${index}.`, "");
    }
    files.push({ path: `.specs/${slug}/FR.md`, bytes: encode(requirements.join("\n")) });
    const readme = ["# Big Corpus " + slug, ""];
    for (let index = 1; index <= 12; index += 1) {
      readme.push(`## Section ${index}`, "", `Body of section ${index}.`, "");
    }
    files.push({ path: `.specs/${slug}/README.md`, bytes: encode(readme.join("\n")) });
  }
  return files;
}

export async function loadRealCorpusManifest(repositoryRoot) {
  const manifestPath = path.join(repositoryRoot, "tests", "fixtures", "kernel", "real-corpus-manifest.json");
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function createTempRepo() {
  return mkdtemp(path.join(tmpdir(), "omp-spec-kit-kernel-"));
}

export async function writeCorpus(root, files) {
  for (const file of files) {
    const absolute = path.join(root, ...file.path.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, file.bytes);
  }
}

/**
 * Plants a real directory junction (Windows) or directory symlink (POSIX
 * containers). Throws when creation fails — the scenario fails, it never skips.
 */
export async function plantDirectoryJunction(linkPath, targetPath) {
  await mkdir(path.dirname(linkPath), { recursive: true });
  await symlink(targetPath, linkPath, "junction");
}

export async function removeTempRepo(root) {
  if (root === null) return;
  await rm(root, { recursive: true, force: true, maxRetries: 3 });
}

export function createKernelState() {
  return {
    repositoryRoot: null,
    manifest: null,
    corpusRead: null,
    builds: null,
    producerFiles: null,
    producerBuild: null,
    envelopes: [],
    tempRoot: null,
    junctionTargetMarker: null,
    async cleanup() {
      await removeTempRepo(this.tempRoot);
      this.tempRoot = null;
    },
  };
}

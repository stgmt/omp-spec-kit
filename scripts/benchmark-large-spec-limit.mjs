#!/usr/bin/env node
// Focused release check for the large-document and aggregate graph budgets.
// Every observation uses a fresh process so V8's retained heap cannot hide a
// later sample's peak.
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist");
const limitsUrl = pathToFileURL(path.join(packageRoot, "kernel", "limits.js")).href;
const readerUrl = pathToFileURL(path.join(packageRoot, "kernel", "adapters", "fs.js")).href;
const graphUrl = pathToFileURL(path.join(packageRoot, "kernel", "graph", "build.js")).href;
const manifest = await readFile(path.join(packageRoot, "manifest.json"));
const { DEFAULT_LIMITS } = await import(limitsUrl);
const documentLimit = DEFAULT_LIMITS.maxBytesPerDocument;
const aggregateLimit = DEFAULT_LIMITS.maxAggregateBytes;
const tempRoot = os.tmpdir();
const singleRoot = await mkdtemp(path.join(tempRoot, "omp-large-document-bench-"));
const aggregateRoot = await mkdtemp(path.join(tempRoot, "omp-large-corpus-bench-"));

function storyContent(index, targetBytes) {
  const prefix = `Feature: Stories\n  @story:US-${index}\n  Rule: Large context ${index}\n    Actor: User\n    Goal: Read the specification\n    Benefit: Preserve all source text\n    Context: `;
  const suffix = `\n    @id:SCEN-large-${index}\n    Scenario: Read the large specification\n      Given the source is available\n      When the user reads it\n      Then the content is preserved\n`;
  const fillerBytes = targetBytes - Buffer.byteLength(prefix, "utf8") - Buffer.byteLength(suffix, "utf8");
  if (fillerBytes < 0) throw new Error("benchmark target is smaller than the Gherkin structure");
  const bytes = Buffer.from(`${prefix}${"x".repeat(fillerBytes)}${suffix}`, "utf8");
  if (bytes.byteLength !== targetBytes) throw new Error("benchmark fixture did not reach its target byte count");
  return bytes;
}

async function writeSpec(root, index, storyBytes) {
  const slug = `large-limit-${index}`;
  const specDir = path.join(root, ".specs", slug);
  await mkdir(specDir, { recursive: true });
  await writeFile(path.join(specDir, `${slug}-user-stories.feature`), storyBytes);
  await writeFile(path.join(specDir, `${slug}-use-cases.feature`), "Feature: Use cases\n");
}

const singleStoryBytes = storyContent(1, documentLimit);
await writeSpec(singleRoot, 1, singleStoryBytes);

const caseBytes = Buffer.byteLength("Feature: Use cases\n", "utf8");
const aggregateStorySizes = [
  documentLimit,
  documentLimit,
  aggregateLimit - (2 * documentLimit) - (3 * caseBytes),
];
for (const [index, bytes] of aggregateStorySizes.entries()) {
  await writeSpec(aggregateRoot, index + 1, storyContent(index + 1, bytes));
}
const aggregateSourceBytes = aggregateStorySizes.reduce((sum, value) => sum + value, 0) + 3 * caseBytes;
if (aggregateSourceBytes !== aggregateLimit) throw new Error("aggregate benchmark fixture did not reach its exact byte cap");

const worker = `
import { performance } from "node:perf_hooks";
const [{ readRepositorySpecs }, { buildKernelGraph }] = await Promise.all([
  import(${JSON.stringify(readerUrl)}), import(${JSON.stringify(graphUrl)}),
]);
global.gc?.();
const baselineRssBytes = process.memoryUsage().rss;
const start = performance.now();
const read = await readRepositorySpecs({ root: process.env.OMP_LARGE_BENCH_ROOT });
if (read.error) throw new Error(JSON.stringify(read.error));
const built = buildKernelGraph({ files: read.files });
const elapsedMs = performance.now() - start;
const peakRssBytes = process.resourceUsage().maxRSS * 1024;
console.log(JSON.stringify({
  elapsedMs,
  baselineRssBytes,
  peakRssBytes,
  incrementalPeakRssBytes: Math.max(0, peakRssBytes - baselineRssBytes),
  graphValid: built.graph.valid,
  diagnosticCount: built.diagnostics.length,
  graphFingerprint: built.graph.fingerprint,
}));
`;

function summarize(samples) {
  const byElapsed = [...samples].sort((a, b) => a.elapsedMs - b.elapsedMs);
  const byMemory = [...samples].sort((a, b) => a.incrementalPeakRssBytes - b.incrementalPeakRssBytes);
  return {
    allGraphsValid: samples.every(({ graphValid }) => graphValid),
    p95BuildMs: byElapsed[Math.ceil(byElapsed.length * 0.95) - 1].elapsedMs,
    maxIncrementalPeakRssBytes: byMemory.at(-1).incrementalPeakRssBytes,
    maxPeakRssBytes: byMemory.at(-1).peakRssBytes,
    maxDiagnosticCount: Math.max(...samples.map(({ diagnosticCount }) => diagnosticCount)),
  };
}

async function measure(root, label) {
  const samples = [];
  for (let index = 0; index < 21; index += 1) {
    const result = spawnSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", worker], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, OMP_LARGE_BENCH_ROOT: root },
      timeout: 30000,
    });
    if (result.status !== 0) throw new Error(`${label} worker ${index + 1} failed: ${result.stderr || result.error || result.stdout}`);
    const observation = JSON.parse(result.stdout.trim());
    if (observation.graphValid !== true) throw new Error(`${label} graph invalid: ${JSON.stringify(observation)}`);
    if (index > 0) samples.push(observation); // one warm-up, twenty measured samples
  }
  return summarize(samples);
}

try {
  const profiles = {
    oneDocumentAtHardCap: await measure(singleRoot, "single-document"),
    aggregateCorpusAtHardCap: await measure(aggregateRoot, "aggregate-corpus"),
  };
  const manifestSha256 = createHash("sha256").update(manifest).digest("hex");
  const report = {
    schema: "omp-large-spec-limit-benchmark@1",
    artifact: { path: "plugins/omp-spec-kit/dist", manifestSha256 },
    runtime: { node: process.version, platform: process.platform, release: os.release(), arch: process.arch },
    machine: { cpu: os.cpus()[0]?.model ?? null, logicalCores: os.cpus().length, totalMemoryBytes: os.totalmem() },
    input: {
      perDocumentLimitBytes: documentLimit,
      aggregateLimitBytes: aggregateLimit,
      singleDocumentSourceBytes: singleStoryBytes.byteLength,
      aggregateCorpusSourceBytes: aggregateSourceBytes,
    },
    method: { warmupSamples: 1, measuredSamples: 20, isolatedNodeProcesses: true },
    profiles,
  };
  const json = JSON.stringify(report, null, 2);
  const outputOption = process.argv.indexOf("--output");
  if (outputOption >= 0) {
    const outputPath = process.argv[outputOption + 1];
    if (!outputPath) throw new Error("--output requires a path");
    await writeFile(path.resolve(repositoryRoot, outputPath), `${json}\n`, "utf8");
  }
  console.log(json);
} finally {
  await Promise.all([
    rm(singleRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }),
    rm(aggregateRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }),
  ]);
}

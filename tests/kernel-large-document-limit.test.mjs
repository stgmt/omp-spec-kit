import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_LIMITS, resolveLimits } from "../src/kernel/limits.js";
import { readRepositorySpecs } from "../src/kernel/adapters/fs.js";

test("filesystem graph input uses the shared 8 MiB per-document cap and fails closed above it", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "omp-large-document-limit-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }));
  const specDir = path.join(root, ".specs", "large-document");
  await mkdir(specDir, { recursive: true });
  const filename = "large-document-user-stories.feature";
  const prefix = "Feature: Stories\n";
  const atLimit = `${prefix}${"x".repeat(DEFAULT_LIMITS.maxBytesPerDocument - Buffer.byteLength(prefix))}`;
  await writeFile(path.join(specDir, filename), atLimit);
  assert.equal(Buffer.byteLength(atLimit), DEFAULT_LIMITS.maxBytesPerDocument);
  const accepted = await readRepositorySpecs({ root });
  assert.equal(accepted.error, undefined);
  assert.equal(accepted.files.find((file) => file.path.endsWith(filename))?.bytes.byteLength, DEFAULT_LIMITS.maxBytesPerDocument);

  await writeFile(path.join(specDir, filename), `${atLimit}x`);
  const rejected = await readRepositorySpecs({ root });
  assert.equal(rejected.error.code, "ADAPTER_CONTAINMENT_ERROR");
  assert.equal(rejected.error.diagnostics[0].code, "FILE_TOO_LARGE");
  assert.equal(rejected.error.diagnostics[0].limitValue, DEFAULT_LIMITS.maxBytesPerDocument);
  await rm(path.join(specDir, filename));

  const belowAggregateLimit = DEFAULT_LIMITS.maxAggregateBytes - (2 * DEFAULT_LIMITS.maxBytesPerDocument);
  assert.ok(belowAggregateLimit > 0 && belowAggregateLimit < DEFAULT_LIMITS.maxBytesPerDocument);
  for (let index = 1; index <= 4; index += 1) {
    const slug = `aggregate-${index}`;
    const dir = path.join(root, ".specs", slug);
    await mkdir(dir, { recursive: true });
    const contents = index <= 2 ? atLimit : index === 3 ? "x".repeat(belowAggregateLimit) : "x";
    await writeFile(path.join(dir, `${slug}-user-stories.feature`), contents);
  }
  const aggregateRejected = await readRepositorySpecs({ root });
  const aggregateDiagnostic = aggregateRejected.error.diagnostics.find(({ code }) => code === "CORPUS_LIMIT_EXCEEDED");
  assert.ok(aggregateDiagnostic);
  assert.equal(aggregateDiagnostic.limitName, "maxAggregateBytes");
  assert.equal(aggregateDiagnostic.limitValue, DEFAULT_LIMITS.maxAggregateBytes);
  assert.equal(aggregateDiagnostic.observedValue, DEFAULT_LIMITS.maxAggregateBytes + 1);
  assert.equal(
    resolveLimits({ maxBytesPerDocument: DEFAULT_LIMITS.maxBytesPerDocument + 1 }).maxBytesPerDocument,
    DEFAULT_LIMITS.maxBytesPerDocument,
    "callers may lower, but cannot bypass, the shipped hard maximum",
  );
  assert.equal(
    resolveLimits({ maxAggregateBytes: DEFAULT_LIMITS.maxAggregateBytes + 1 }).maxAggregateBytes,
    DEFAULT_LIMITS.maxAggregateBytes,
  );
});

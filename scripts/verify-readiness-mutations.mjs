import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const logs = path.join(root, ".omp-spec-kit", "release-logs");
const driver = path.join(root, "tests", "helpers", "readiness-mutation-driver.mjs");
const target = "src/evidence/service.js";
const source = await readFile(path.join(root, target), "utf8");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cases = [
  { id: "baseline" },
  {
    id: "successful-run-required",
    from: " || finishes[0].testRunFinished.success !== true",
    to: "",
    leaf: "unsuccessful producer run cannot prove L3",
  },
  {
    id: "source-attribution-required",
    from: "if (documents.length !== 1 || documents[0].span.path !== node.span.path) return false;",
    to: "// deliberate mutation: source attribution removed",
    leaf: "different executed source cannot prove L3",
  },
  {
    id: "well-formed-capture-required",
    from: "if (!capture.valid) return false;",
    to: "// deliberate mutation: malformed captures accepted",
    leaf: "malformed producer capture cannot prove L3",
  },
  {
    id: "evidence-containment-required",
    from: 'if (path.isAbsolute(contained) || contained === ".." || contained.startsWith(`..${path.sep}`)) continue;',
    to: "// deliberate mutation: containment removed",
    leaf: "escaped evidence directory cannot prove project execution",
  },
];
for (const mutation of cases.slice(1)) {
  assert.equal(source.split(mutation.from).length - 1, 1, `${mutation.id}: unique anchor`);
}
await mkdir(logs, { recursive: true });

function execute(worker, mutation) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", "--test-reporter=tap", driver], {
      cwd: worker,
      env: { ...process.env, READINESS_MUTATION_ROOT: worker, READINESS_MUTATION_CASE: JSON.stringify(mutation) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (bytes) => { stdout += bytes; });
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function copyWorker(worker) {
  const originalHashes = new Map();
  for (const file of files) {
    const destination = path.join(worker, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, file), destination);
    originalHashes.set(file, hash(await readFile(destination)));
  }
  // The tested code only reads dependencies; every writable input is copied.
  await symlink(path.join(root, "node_modules"), path.join(worker, "node_modules"), "junction");
  return originalHashes;
}

async function verifyInputs(worker, mutation, originalHashes) {
  for (const file of files) {
    const expected = file === target && mutation.from
      ? hash(source.replace(mutation.from, mutation.to))
      : originalHashes.get(file);
    assert.equal(hash(await readFile(path.join(worker, file))), expected, `${mutation.id}: contaminated input ${file}`);
  }
}

function verifyOutcome(result, mutation) {
  assert.equal(result.signal, null, "timeout/signal is infrastructure");
  assert.match(result.stdout, /# tests 5\b/, "all five deciding leaf tests must execute");
  assert.match(result.stdout, /# cancelled 0\b/);
  assert.match(result.stdout, /# skipped 0\b/);
  if (!mutation.from) {
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# pass 5\b/);
    return "BASELINE_PASS";
  }
  assert.notEqual(result.code, 0, "mutation survived");
  assert.ok(result.stdout.split("\n").some((line) => /not ok \d+ -/.test(line) && line.includes(mutation.leaf)), `wrong deciding leaf: ${mutation.leaf}`);
  assert.match(result.stdout, /ERR_ASSERTION/);
  assert.doesNotMatch(result.stdout + result.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError|spawn .*ENOENT|source input .*must match/, "infrastructure is not a kill");
  return "KILLED";
}

async function run(mutation) {
  const worker = await mkdtemp(path.join(tmpdir(), `readiness-mut-${mutation.id}-`));
  const receipt = { id: mutation.id, sourceSha256: hash(source), driverSha256: hash(await readFile(driver)) };
  try {
    const originalHashes = await copyWorker(worker);
    const result = await execute(worker, mutation);
    await writeFile(path.join(logs, `readiness-mutation-${mutation.id}.tap`), result.stdout + result.stderr);
    await verifyInputs(worker, mutation, originalHashes);
    receipt.outcome = verifyOutcome(result, mutation);
    if (mutation.from) receipt.decidingTest = mutation.leaf;
    receipt.exitCode = result.code;
  } catch (error) {
    receipt.outcome = "INFRASTRUCTURE_OR_FAILED_PROOF";
    receipt.error = error.message;
  } finally {
    try {
      await rm(worker, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch (error) {
      receipt.cleanupInfrastructure = error.code ?? error.message;
    }
  }
  // Persist each demonstrated result before another worker can fail.
  await writeFile(path.join(logs, `readiness-mutation-${mutation.id}.json`), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
  return receipt;
}

const baseline = await run(cases[0]);
if (baseline.outcome !== "BASELINE_PASS") {
  process.exitCode = 1;
} else {
  // A pristine baseline first, then four independent async mutant workers.
  const results = await Promise.all(cases.slice(1).map(run));
  await writeFile(path.join(logs, "readiness-mutations.json"), JSON.stringify({ baseline, results }, null, 2) + "\n");
  if (results.some((result) => result.outcome !== "KILLED")) process.exitCode = 1;
}

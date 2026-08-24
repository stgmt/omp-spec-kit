import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repositoryRoot } from "./verify-marketplace.mjs";
import {
  assertCandidateShape,
  canonicalJson,
  collectRegularFiles,
  fail,
  packageTreeDigest,
  parseArgs,
  readStrictJson,
  sha256,
  toPublicFileRows,
} from "./release-candidate-utils.mjs";

const FORBIDDEN_PATH_SEGMENTS = new Set([".env", ".git", "node_modules", "tests", "docs", "src", ".specs"]);
const SECRET_PATTERNS = Object.freeze([
  ["authorization", /\b(?:proxy-)?authorization\s*:\s*(?:bearer|basic|token)\s+[^\s"']+/iu],
  ["bearer-token", /\b(?:bearer|token)\s+[A-Za-z0-9._~+/=-]{12,}/iu],
  ["cookie", /\b(?:set-)?cookie\s*:\s*[^;\r\n=]+=[^;\r\n]+/iu],
  ["pem-private-key", /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u],
  ["generic-secret", /\b(?:(?:[A-Za-z][A-Za-z0-9]*[_-])+)?(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|credential)\s*[:=]\s*[^\s"']+/iu],
  ["known-secret", /\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{12,})\b/u],
]);

export async function verifyPublicTree(candidatePath) {
  const candidate = assertCandidateShape(await readStrictJson(candidatePath, "candidate manifest"), "candidate manifest");
  const packageRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit");
  const files = await collectRegularFiles(packageRoot);
  const actualRows = toPublicFileRows(files);
  const findings = [];
  if (packageTreeDigest(files) !== candidate.packageTreeDigest) findings.push("package-tree-digest-mismatch");
  if (JSON.stringify(actualRows) !== JSON.stringify(candidate.files)) findings.push("package-file-list-mismatch");
  for (const file of files) {
    const segments = file.path.split("/");
    if (segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) findings.push(`forbidden-path:${file.path}`);
    const text = (await readFile(file.absolute)).toString("utf8");
    for (const [category, pattern] of SECRET_PATTERNS) if (pattern.test(text)) findings.push(`secret-like-content:${category}:${file.path}`);
  }
  const reportWithoutDigest = {
    schema: "omp-spec-kit-public-safety@1",
    status: findings.length === 0 ? "passed" : "failed",
    candidateDigest: candidate.candidateDigest,
    packageTreeDigest: candidate.packageTreeDigest,
    findings: [...new Set(findings)].sort(),
  };
  return { ...reportWithoutDigest, digest: sha256(Buffer.from(canonicalJson(reportWithoutDigest))) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ["--candidate", "--output"]);
  if (!args["--candidate"]) fail("--candidate is required");
  const report = await verifyPublicTree(path.resolve(args["--candidate"]));
  const content = canonicalJson(report);
  if (args["--output"]) await writeFile(path.resolve(args["--output"]), content, "utf8");
  process.stdout.write(content);
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

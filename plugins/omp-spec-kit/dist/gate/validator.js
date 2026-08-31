import { createHash } from "node:crypto";

const MAX_PLAN_BYTES = 512 * 1024;
const PLAN_PATH_PATTERN = /^local:\/\/[^/\\]+-plan\.md$/u;

function digest(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function finding(code, message, field = null) {
  return { code, message, field };
}

/** Validate only the exact plan tuple supplied by the native OMP resolver. */
export function validateExactPlan(input) {
  if (input === null || typeof input !== "object") {
    return { status: "UNAVAILABLE", findings: [finding("INVALID_REQUEST", "selected plan tuple is unavailable")] };
  }
  const path = input.planFilePath;
  const content = input.planContent;
  const expectedHash = input.planSha256;
  const title = input.title;
  const findings = [];
  if (typeof path !== "string" || !PLAN_PATH_PATTERN.test(path)) findings.push(finding("INVALID_PATH", "selected plan path must be local://<slug>-plan.md", "planFilePath"));
  if (typeof content !== "string" || content.trim().length === 0) findings.push(finding("EMPTY_PLAN", "selected plan content must be non-empty", "planContent"));
  if (typeof content === "string" && Buffer.byteLength(content, "utf8") > MAX_PLAN_BYTES) findings.push(finding("PLAN_TOO_LARGE", "selected plan exceeds the bounded plan size", "planContent"));
  if (typeof expectedHash !== "string" || !/^[0-9a-f]{64}$/u.test(expectedHash)) findings.push(finding("INVALID_DIGEST", "selected plan digest must be a lowercase SHA-256", "planSha256"));
  if (typeof content === "string" && typeof expectedHash === "string" && digest(content) !== expectedHash) findings.push(finding("DIGEST_MISMATCH", "selected plan digest does not match the exact content", "planSha256"));
  if (typeof title !== "string" || title.trim().length === 0) findings.push(finding("INVALID_TITLE", "selected plan title must be non-empty", "title"));
  return { status: findings.length === 0 ? "VALID" : "INVALID", planFilePath: path ?? null, title: title ?? null, planSha256: expectedHash ?? null, findings };
}

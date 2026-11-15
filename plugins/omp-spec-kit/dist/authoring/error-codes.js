export const WRITE_ERROR_CODES = new Set([
  "INVALID_REQUEST",
  "PATH_FORBIDDEN",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RECOVERY_REQUIRED",
  "DEADLINE_EXCEEDED",
  "CONCURRENT_READ",
  "ROLLBACK_FAILED",
  "INTERNAL_ERROR",
  "ELICITATION_REQUIRED",
  "CLAIM_HELD",
  "UNAVAILABLE",
  "VERSION_EXISTS",
  "DESIGN_REVIEW_REQUIRED",
  "DESIGN_REVIEW_INVALID",
  // Admission refusals. Without an entry here safeErrorCode collapses every one
  // of them to VALIDATION_FAILED and the caller loses the fix plan.
  "SPEC_NOT_READY",
  "TASK_NOT_TRACEABLE",
  "TASK_DOCUMENT_BYPASS",
  "BACKLOG_FORBIDDEN",
  "SCENARIO_NOT_TRACEABLE",
]);

export function isRetryable(code) {
  return (
    code === "CONFLICT" ||
    code === "DEADLINE_EXCEEDED" ||
    code === "CONCURRENT_READ" ||
    code === "RECOVERY_REQUIRED" ||
    code === "ROLLBACK_FAILED" ||
    code === "UNAVAILABLE"
  );
}

export function safeErrorCode(code) {
  if (WRITE_ERROR_CODES.has(code)) return code;
  if (code === "DOC_NOT_FOUND" || code === "NOT_FOUND") return "PATH_FORBIDDEN";
  return "VALIDATION_FAILED";
}

export function error(code, message, extra = {}) {
  const normalizedCode = safeErrorCode(code);
  return {
    ok: false,
    error: {
      code: normalizedCode,
      message,
      retryable: isRetryable(normalizedCode),
      requestId: extra.requestId ?? null,
      proposalHash: extra.proposalHash ?? null,
      changedPaths: extra.changedPaths ?? [],
      findings: extra.findings ?? [],
      ...extra,
    },
  };
}

const DESIGN_REVIEW_SCHEMA = "omp-spec-kit/design-review@1";
const SCENARIO_HEADER_RE = /^\s*Scenario(?: Outline)?:/mu;
const REVIEW_KEYS = new Set(["schemaVersion", "decision", "boundary", "evidence", "alternatives", "selfTestCheck"]);
const BOUNDARY_KEYS = new Set(["kind", "name", "claim"]);
const EVIDENCE_KEYS = new Set(["kind", "reference", "observation"]);
const ALTERNATIVE_KEYS = new Set(["option", "reasonRejected"]);
const SELF_TEST_KEYS = new Set([
  "status",
  "command",
  "hypothesis",
  "answer",
  "positiveCase",
  "negativeCase",
  "expectedFailure",
  "observedFailure",
  "mutation",
]);
const EVIDENCE_KINDS = new Set(["source", "test", "documentation", "research"]);
const BOUNDARY_KINDS = new Set(["external-contract", "external-system", "user-visible-contract"]);
const VAGUE_TEXT = /^(?:n\/?a|none|tbd|todo|unknown|later)$/iu;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function text(value, field, maxBytes) {
  if (typeof value !== "string") return { ok: false, message: field + " must be a string" };
  const normalized = value.trim();
  if (normalized.length === 0 || VAGUE_TEXT.test(normalized)) {
    return { ok: false, message: field + " must contain a concrete statement" };
  }
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    return { ok: false, message: field + " contains control characters" };
  }
  if (byteLength(normalized) > maxBytes) {
    return { ok: false, message: field + " exceeds " + maxBytes + " UTF-8 bytes" };
  }
  return { ok: true, value: normalized };
}

function safeReference(value, field) {
  const result = text(value, field, 512);
  if (!result.ok) return result;
  if (/^(?:[A-Za-z]:[\\/]|[\\/]{2}|file:)/u.test(result.value)) {
    return { ok: false, message: field + " must be repository-relative or an HTTPS URL" };
  }
  if (/^https?:\/\//iu.test(result.value) === false && result.value.includes("..")) {
    return { ok: false, message: field + " must not traverse parent directories" };
  }
  return result;
}

function unknownKey(value, allowed, field) {
  if (!isRecord(value)) return null;
  const key = Object.keys(value).find((candidate) => !allowed.has(candidate));
  return key === undefined ? null : field + "." + key + " is not supported";
}

function failure(code, message, field = null) {
  return {
    ok: false,
    code,
    message,
    findings: [{ code, ...(field ? { field } : {}), message }],
  };
}

function normalizeReview(review) {
  if (!isRecord(review)) return failure("DESIGN_REVIEW_REQUIRED", "designReview is required for scenario-authoring changes", "designReview");
  const unknownReviewKey = unknownKey(review, REVIEW_KEYS, "designReview");
  if (unknownReviewKey) return failure("DESIGN_REVIEW_INVALID", unknownReviewKey, "designReview");
  if (review.schemaVersion !== DESIGN_REVIEW_SCHEMA) {
    return failure("DESIGN_REVIEW_INVALID", "designReview.schemaVersion must equal " + DESIGN_REVIEW_SCHEMA, "designReview.schemaVersion");
  }
  if (review.decision !== "proceed") return failure("DESIGN_REVIEW_INVALID", "designReview.decision must be proceed", "designReview.decision");

  const boundary = review.boundary;
  const boundaryKey = unknownKey(boundary, BOUNDARY_KEYS, "designReview.boundary");
  if (boundaryKey) return failure("DESIGN_REVIEW_INVALID", boundaryKey, "designReview.boundary");
  if (!isRecord(boundary) || !BOUNDARY_KINDS.has(boundary.kind)) {
    return failure("DESIGN_REVIEW_INVALID", "designReview.boundary.kind must name an external or user-visible contract boundary", "designReview.boundary.kind");
  }
  const boundaryName = text(boundary.name, "designReview.boundary.name", 160);
  const boundaryClaim = text(boundary.claim, "designReview.boundary.claim", 512);
  if (!boundaryName.ok) return failure("DESIGN_REVIEW_INVALID", boundaryName.message, "designReview.boundary.name");
  if (!boundaryClaim.ok) return failure("DESIGN_REVIEW_INVALID", boundaryClaim.message, "designReview.boundary.claim");

  if (!Array.isArray(review.evidence) || review.evidence.length < 2 || review.evidence.length > 8) {
    return failure("DESIGN_REVIEW_INVALID", "designReview.evidence must contain 2 to 8 independent references", "designReview.evidence");
  }
  const evidence = [];
  for (let index = 0; index < review.evidence.length; index += 1) {
    const item = review.evidence[index];
    const itemField = "designReview.evidence[" + index + "]";
    const unknownEvidenceKey = unknownKey(item, EVIDENCE_KEYS, itemField);
    if (unknownEvidenceKey) return failure("DESIGN_REVIEW_INVALID", unknownEvidenceKey, itemField);
    if (!isRecord(item) || !EVIDENCE_KINDS.has(item.kind)) {
      return failure("DESIGN_REVIEW_INVALID", itemField + ".kind is unsupported", itemField + ".kind");
    }
    const reference = safeReference(item.reference, itemField + ".reference");
    const observation = text(item.observation, itemField + ".observation", 512);
    if (!reference.ok) return failure("DESIGN_REVIEW_INVALID", reference.message, itemField + ".reference");
    if (!observation.ok) return failure("DESIGN_REVIEW_INVALID", observation.message, itemField + ".observation");
    evidence.push({ kind: item.kind, reference: reference.value, observation: observation.value });
  }
  const evidenceKinds = new Set(evidence.map((item) => item.kind));
  if (!evidenceKinds.has("test") || [...evidenceKinds].every((kind) => kind === "test")) {
    return failure("DESIGN_REVIEW_INVALID", "designReview.evidence must include a test and an independent source, documentation, or research reference", "designReview.evidence");
  }

  if (!Array.isArray(review.alternatives) || review.alternatives.length < 1 || review.alternatives.length > 5) {
    return failure("DESIGN_REVIEW_INVALID", "designReview.alternatives must contain 1 to 5 rejected alternatives", "designReview.alternatives");
  }
  const alternatives = [];
  for (let index = 0; index < review.alternatives.length; index += 1) {
    const item = review.alternatives[index];
    const itemField = "designReview.alternatives[" + index + "]";
    const unknownAlternativeKey = unknownKey(item, ALTERNATIVE_KEYS, itemField);
    if (unknownAlternativeKey) return failure("DESIGN_REVIEW_INVALID", unknownAlternativeKey, itemField);
    if (!isRecord(item)) return failure("DESIGN_REVIEW_INVALID", itemField + " must be an object", itemField);
    const option = text(item.option, itemField + ".option", 256);
    const reasonRejected = text(item.reasonRejected, itemField + ".reasonRejected", 512);
    if (!option.ok) return failure("DESIGN_REVIEW_INVALID", option.message, itemField + ".option");
    if (!reasonRejected.ok) return failure("DESIGN_REVIEW_INVALID", reasonRejected.message, itemField + ".reasonRejected");
    alternatives.push({ option: option.value, reasonRejected: reasonRejected.value });
  }

  const selfTest = review.selfTestCheck;
  const unknownSelfTestKey = unknownKey(selfTest, SELF_TEST_KEYS, "designReview.selfTestCheck");
  if (unknownSelfTestKey) return failure("DESIGN_REVIEW_INVALID", unknownSelfTestKey, "designReview.selfTestCheck");
  if (!isRecord(selfTest) || selfTest.status !== "passed" || selfTest.mutation !== "failed-as-expected") {
    return failure("DESIGN_REVIEW_INVALID", "selfTestCheck must report a passed positive test and a mutation that failed as expected", "designReview.selfTestCheck");
  }
  const selfTestFields = ["command", "hypothesis", "answer", "positiveCase", "negativeCase", "expectedFailure", "observedFailure"];
  const normalizedSelfTest = {};
  for (const field of selfTestFields) {
    const result = text(selfTest[field], "designReview.selfTestCheck." + field, 768);
    if (!result.ok) return failure("DESIGN_REVIEW_INVALID", result.message, "designReview.selfTestCheck." + field);
    normalizedSelfTest[field] = result.value;
  }
  if (normalizedSelfTest.positiveCase === normalizedSelfTest.negativeCase) {
    return failure("DESIGN_REVIEW_INVALID", "selfTestCheck positiveCase and negativeCase must be different", "designReview.selfTestCheck");
  }
  if (normalizedSelfTest.expectedFailure === normalizedSelfTest.observedFailure) {
    return failure("DESIGN_REVIEW_INVALID", "selfTestCheck must record the observed mutation failure, not only the expectation", "designReview.selfTestCheck");
  }

  return {
    ok: true,
    material: {
      schemaVersion: DESIGN_REVIEW_SCHEMA,
      decision: "proceed",
      boundary: { kind: boundary.kind, name: boundaryName.value, claim: boundaryClaim.value },
      evidence,
      alternatives,
      selfTestCheck: { status: "passed", mutation: "failed-as-expected", ...normalizedSelfTest },
    },
  };
}

function asText(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes.toString("utf8");
  if (bytes instanceof Uint8Array) return Buffer.from(bytes).toString("utf8");
  return typeof bytes === "string" ? bytes : "";
}

function scenarioDocumentChange(change) {
  if (!change || typeof change.document !== "string" || !/\.feature$/iu.test(change.document)) return false;
  const before = asText(change.beforeBytes);
  const after = asText(change.afterBytes);
  return before !== after && (SCENARIO_HEADER_RE.test(before) || SCENARIO_HEADER_RE.test(after));
}

export const DESIGN_REVIEW_SCHEMA_VERSION = DESIGN_REVIEW_SCHEMA;

export function validateDesignReviewForChanges(review, changes) {
  const scenarioChanges = Array.isArray(changes) ? changes.filter(scenarioDocumentChange) : [];
  const required = scenarioChanges.length > 0;
  if (review === undefined && !required) return { ok: true, required: false, material: null, receipt: null };
  const normalized = normalizeReview(review);
  if (!normalized.ok) return { ...normalized, required };
  const receipt = {
    schemaVersion: DESIGN_REVIEW_SCHEMA,
    decision: "proceed",
    required,
    boundaryKind: normalized.material.boundary.kind,
    evidenceCount: normalized.material.evidence.length,
    alternativesCount: normalized.material.alternatives.length,
    selfTestCheck: { status: "passed", mutation: "failed-as-expected" },
    ...(required
      ? {
          reviewedDocuments: scenarioChanges.map((change) => ({
            path: change.document,
            afterSha256: change.preview.afterSha256,
          })),
        }
      : {}),
  };
  return { ok: true, required, material: normalized.material, receipt };
}

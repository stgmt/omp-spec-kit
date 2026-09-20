import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { TOOL_CONTRACTS } from "../adapters/tool-contracts.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { decidePathPolicy } from "./resolve-targets.js";

const ALL_SHORT_NAMES = Object.freeze(new Set(TOOL_CONTRACTS.map((contract) => contract.tool)));
const MUTATING_SHORT_NAMES = Object.freeze(new Set([
  "spec_patch",
]));
const DIRECT_PATH_MUTATION_TOOLS = Object.freeze(new Set(["write", "edit", "apply_patch", "delete", "rename"]));
const DIRECT_PATH_READ_TOOLS = Object.freeze(new Set(["read", "grep", "glob"]));
const PATH_KEYS = Object.freeze(new Set(["path", "paths", "file", "files", "document", "documents"]));
// Matches every scenario header form cucumber-js executes — a superset of the
// kernel parser's recognized set (Scenario, Scenario Outline, Example,
// Scenario Template; space or tab indented). Docstring bodies are skipped so
// quoted "Scenario:" text does not force a review.
const FEATURE_SCENARIO_PATTERN = /^[ \t]*(?:Scenario|Scenario Outline|Scenario Template|Example):/mu;
const FEATURE_DOCSTRING_RE = /^[ ]{0,3}("""|```)/u;
const FEATURE_CONTENT_FIELDS = Object.freeze(["content", "text", "newText"]);
const FEATURE_BYTE_OPS = Object.freeze(new Set(["delete_document", "rename_document", "deleteDocument", "renameDocument"]));

function featureTextHasScenario(text) {
  let docstringMarker = null;
  for (const line of text.split("\n")) {
    if (docstringMarker !== null) {
      if (line.trimStart().startsWith(docstringMarker)) docstringMarker = null;
      continue;
    }
    const marker = FEATURE_DOCSTRING_RE.exec(line);
    if (marker && !line.trimStart().startsWith("#")) {
      docstringMarker = marker[1];
      continue;
    }
    if (FEATURE_SCENARIO_PATTERN.test(line)) return true;
  }
  return false;
}

function featureFileHasScenario(root, spec, document) {
  // Canonical-form check before any filesystem access: a .feature document is
  // canonical only as <spec>.feature, so anything else (incl. traversal) is
  // never probed.
  if (typeof root !== "string" || root === "") return false;
  if (!isValidSpecSlug(spec) || document !== spec + ".feature") return false;
  try {
    const filePath = path.join(root, "." + "specs", spec, document);
    return featureTextHasScenario(readFileSync(filePath, "utf8"));
  } catch {
    return false;
  }
}

function specDirHasScenarioFeature(root, spec) {
  if (typeof root !== "string" || root === "" || !isValidSpecSlug(spec)) return false;
  try {
    const dir = path.join(root, "." + "specs", spec);
    for (const name of readdirSync(dir)) {
      if (name === spec + ".feature" && featureTextHasScenario(readFileSync(path.join(dir, name), "utf8"))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function featurePatchNeedsDesignReview(input, root) {
  if ((input?.designReview ?? input?.design_review) !== undefined && (input?.designReview ?? input?.design_review) !== null) return false;
  const spec = typeof input?.spec === "string" ? input.spec : "";
  // Facade intents carry no operations array; mirror the server gate for the
  // ones that can touch a scenario-bearing .feature document.
  const intent = typeof input?.intent === "string" ? input.intent : "patch";
  if (intent === "archiveSpec") return specDirHasScenarioFeature(root, spec);
  if (intent === "deleteSpecDoc" || intent === "renameSpecDoc") {
    const doc = typeof input?.doc === "string" ? input.doc : "";
    return doc.toLowerCase().endsWith(".feature") && featureFileHasScenario(root, spec, doc);
  }
  const operations = Array.isArray(input?.operations) ? input.operations : [];
  return operations.some((op) => {
    if (op === null || typeof op !== "object") return false;
    const document = typeof op.document === "string" ? op.document : typeof op.doc === "string" ? op.doc : "";
    if (!document.toLowerCase().endsWith(".feature")) return false;
    if (FEATURE_CONTENT_FIELDS.some((field) => typeof op[field] === "string" && featureTextHasScenario(op[field]))) return true;
    // delete/rename carry no content fields; the server gate inspects before
    // bytes, so preflight reads the file the same way (fail-open to the server).
    if (FEATURE_BYTE_OPS.has(op.kind) && spec !== "" && featureFileHasScenario(root, spec, document)) return true;
    return false;
  });
}
const SPEC_PATH_REFERENCE = /(?:^|[^a-z0-9])\.specs(?:$|[^a-z0-9])/iu;

function validReadRangeChunk(chunk) {
  const match = /^L?([1-9]\d*)(?:(-|\+|\.\.)L?([1-9]\d*)?)?$/iu.exec(chunk);
  if (!match) return false;
  const start = Number(match[1]);
  const end = match[3] === undefined ? undefined : Number(match[3]);
  if (!Number.isSafeInteger(start) || (end !== undefined && !Number.isSafeInteger(end))) return false;
  if (match[2] === "+") return end !== undefined;
  return end === undefined || end >= start;
}

function validReadSelectorPart(part) {
  if (/^(?:raw|conflicts)$/iu.test(part)) return true;
  return part.length > 0 && part.split(",").every(validReadRangeChunk);
}

function isReadSelector(selector) {
  const parts = selector.split(":");
  if (parts.length === 1) return validReadSelectorPart(parts[0]);
  if (parts.length !== 2) return false;
  const [first, second] = parts;
  return (first.toLowerCase() === "raw" && validReadSelectorPart(second))
    || (second.toLowerCase() === "raw" && validReadSelectorPart(first));
}

function stripReadSelector(raw) {
  if (process.platform !== "win32" || typeof raw !== "string") return raw;
  const colon = raw.lastIndexOf(":");
  if (colon <= 0) return raw;
  const candidate = raw.slice(colon + 1);
  if (!isReadSelector(candidate)) return raw;
  let basePath = raw.slice(0, colon);
  const innerColon = basePath.lastIndexOf(":");
  if (innerColon > 0) {
    const inner = basePath.slice(innerColon + 1);
    const innerIsRaw = inner.toLowerCase() === "raw";
    const outerIsRaw = candidate.toLowerCase() === "raw";
    const innerIsRange = inner.length > 0 && inner.split(",").every(validReadRangeChunk);
    const outerIsRange = candidate.length > 0 && candidate.split(",").every(validReadRangeChunk);
    if ((innerIsRaw && outerIsRange) || (innerIsRange && outerIsRaw)) basePath = basePath.slice(0, innerColon);
  }
  return basePath;
}

function readTargets(toolName, targets) {
  return DIRECT_PATH_READ_TOOLS.has(toolName) ? targets.map(stripReadSelector) : targets;
}

function hasEmbeddedSpecReference(value, key = "") {
  if (typeof value === "string") return (key === "code" || key === "command") && SPEC_PATH_REFERENCE.test(value);
  if (Array.isArray(value)) return value.some((entry) => hasEmbeddedSpecReference(entry, key));
  if (value !== null && typeof value === "object") return Object.entries(value).some(([name, entry]) => hasEmbeddedSpecReference(entry, name));
  return false;
}

function textValues(value, key = "") {
  if (typeof value === "string") return PATH_KEYS.has(key) || key === "" ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => textValues(entry, key));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([name, entry]) => textValues(entry, name));
  return [];
}

function sanitizeMCPToolNamePart(part) {
  return part.replace(/[^a-zA-Z0-9_-]/gu, "_").replace(/[-_]+/gu, "_");
}

export function createMCPToolName(serverName, toolName) {
  const sanitizedServerName = sanitizeMCPToolNamePart(serverName);
  const sanitizedToolName = sanitizeMCPToolNamePart(toolName);
  const prefixWithUnderscore = `${sanitizedServerName}_`;
  let normalizedToolName = sanitizedToolName;
  if (sanitizedToolName.startsWith(prefixWithUnderscore)) {
    normalizedToolName = sanitizedToolName.slice(prefixWithUnderscore.length);
  }
  const fullName = `mcp__${sanitizedServerName}_${normalizedToolName}`;
  if (fullName.length <= 64) return fullName;
  return `${fullName.slice(0, 56)}_${Buffer.from(fullName).toString("hex").slice(0, 7)}`;
}

function getActiveFamilies() {
  const tools = TOOL_CONTRACTS.map((c) => c.tool);
  const familyA = new Map(tools.map((tool) => [createMCPToolName("omp-spec-kit", tool), tool]));
  const familyB = new Map(tools.map((tool) => [createMCPToolName("omp-spec-kit:omp-spec-kit", tool), tool]));
  return { tools, familyA, familyB };
}

function resolveAuthority(toolName, allTools, familyA, familyB, expectedCount) {
  if (!Array.isArray(allTools)) {
    if (familyA.has(toolName)) return { ok: true, logicalName: familyA.get(toolName) };
    if (familyB.has(toolName)) return { ok: true, logicalName: familyB.get(toolName) };
    return { ok: false, code: "UNREGISTERED_AUTHORING_CALL", reason: "tool is not an authorized MCP tool" };
  }

  let countA = 0;
  let countB = 0;

  for (const tool of allTools) {
    const isA = familyA.has(tool.name);
    const isB = familyB.has(tool.name);
    if (isA) {
      countA++;
      if (tool.sourceInfo?.source !== "mcp" || tool.sourceInfo?.path !== `<mcp:${tool.name}>`) {
        return { ok: false, code: "AMBIGUOUS_TOOL_AUTHORITY", reason: "tool provenance spoof detected" };
      }
    }
    if (isB) {
      countB++;
      if (tool.sourceInfo?.source !== "mcp" || tool.sourceInfo?.path !== `<mcp:${tool.name}>`) {
        return { ok: false, code: "AMBIGUOUS_TOOL_AUTHORITY", reason: "tool provenance spoof detected" };
      }
    }
  }

  const validA = countA === expectedCount && countB === 0;
  const validB = countB === expectedCount && countA === 0;

  if (!validA && !validB) {
    return {
      ok: false,
      code: "AMBIGUOUS_TOOL_AUTHORITY",
      reason: `expected exactly one complete tool family (observed A=${countA}, B=${countB}, expected=${expectedCount})`,
    };
  }

  const activeFamily = validA ? familyA : familyB;
  if (!activeFamily.has(toolName)) {
    return { ok: false, code: "UNREGISTERED_AUTHORING_CALL", reason: "tool is not in active MCP family" };
  }
  return { ok: true, logicalName: activeFamily.get(toolName) };
}

const TARGET_RECOVERY = "Recovery: provide one explicit repository-relative target, or use spec_patch with dryRun: true for preview or dryRun: false to apply.";

function specReadRecovery(relativePath) {
  const parts = typeof relativePath === "string" ? relativePath.split("/") : [];
  if (parts.length >= 3 && parts[0] === "." + "specs" && parts[1] !== "" && parts.slice(2).every((part) => part !== "")) {
    return " use spec_documents(action: \"read\", spec: \"" + parts[1] + "\", doc: \"" + parts.slice(2).join("/") + "\")";
  }
  return " use spec_catalog or spec_documents(action: list or read) for specification corpus access";
}

function boundedReason(code, relativePath = null) {
  const target = typeof relativePath === "string" && relativePath !== "" && !/^[a-z]:[\\/]/iu.test(relativePath) && !relativePath.startsWith("/") && !relativePath.startsWith("\\")
    ? " target=" + relativePath
    : "";
  const recovery = code === "TARGET_INDETERMINATE" ? " " + TARGET_RECOVERY
    : code === "SPEC_READ_REDIRECT" ? specReadRecovery(relativePath)
    : code === "DESIGN_REVIEW_REQUIRED" ? " attach designReview (schema omp-spec-kit/design-review@1; template in skill engineering-anti-bike) to the spec_patch call"
    : " use spec_patch with dryRun: true for preview or dryRun: false to apply";
  const reason = code + ":" + target + recovery;
  if (Buffer.byteLength(reason, "utf8") <= 512) return reason;
  let boundedTarget = target;
  while (boundedTarget.length > 0 && Buffer.byteLength(code + ":" + boundedTarget + recovery, "utf8") > 512) boundedTarget = boundedTarget.slice(0, -1);
  return code + ":" + boundedTarget + recovery;
}

const CODE_RESOLUTION = Object.freeze({
  TARGET_INDETERMINATE: "INDETERMINATE",
  RAW_SPEC_WRITE: "SPEC",
  SPEC_READ_REDIRECT: "SPEC",
});

function offendingTarget(code, resolutions) {
  const wanted = CODE_RESOLUTION[code];
  const offender = wanted ? resolutions.find((item) => item.resolution === wanted) : null;
  if (offender) {
    if (typeof offender.relativePath === "string") return offender.relativePath;
    return typeof offender.rawTarget === "string" && offender.rawTarget !== "" ? offender.rawTarget : null;
  }
  return resolutions.find((item) => typeof item.relativePath === "string")?.relativePath ?? null;
}

function blocked(toolName, code, resolutions = [], mismatchField = null) {
  return {
    action: "block",
    code,
    toolName,
    touchesSpecs: code !== "TARGET_INDETERMINATE" || resolutions.length > 0,
    mismatchField: mismatchField ?? (code === "UNREGISTERED_AUTHORING_CALL" ? "authority" : null),
    reason: boundedReason(code, offendingTarget(code, resolutions)),
  };
}

function classifyMcpToolCall(toolName, input, options, tools, familyA, familyB, event) {
  const allTools = options.allTools ?? (typeof options.getAllTools === "function" ? options.getAllTools() : typeof options.pi?.getAllTools === "function" ? options.pi.getAllTools() : null);
  const auth = resolveAuthority(toolName, allTools, familyA, familyB, tools.length);
  if (!auth.ok) {
    return blocked(toolName, auth.code, [], auth.reason);
  }
  const logicalName = auth.logicalName;
  if (logicalName === "spec_patch" && featurePatchNeedsDesignReview(input, options.root ?? event?.cwd ?? process.cwd())) {
    return blocked(toolName, "DESIGN_REVIEW_REQUIRED", [], "designReview");
  }
  return { action: "allow", code: "AUTHORING_TOOL_ALLOWED", toolName, logicalName, touchesSpecs: true, mismatchField: null };
}

export function classifyToolCall(event, options = {}) {
  const toolName = typeof event?.toolName === "string" ? event.toolName : "";
  const input = event?.input ?? {};

  // Direct short-name invocation of authoring tools is forbidden in MCP-only mode
  if (ALL_SHORT_NAMES.has(toolName)) {
    return blocked(toolName, "UNREGISTERED_AUTHORING_CALL", [], "shortNameDirectCallForbidden");
  }

  const { tools, familyA, familyB } = getActiveFamilies();

  const isCandidateMcp = familyA.has(toolName) || familyB.has(toolName);
  if (isCandidateMcp) {
    return classifyMcpToolCall(toolName, input, options, tools, familyA, familyB, event);
  }

  if (hasEmbeddedSpecReference(input)) return blocked(toolName, "RAW_SPEC_WRITE");
  const targets = readTargets(toolName, textValues(input));
  if (targets.length === 0 && !DIRECT_PATH_MUTATION_TOOLS.has(toolName)) {
    return { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  }

  const policy = decidePathPolicy(options.root ?? event?.cwd ?? process.cwd(), targets);
  if (policy.decision === "ALLOW") {
    return DIRECT_PATH_MUTATION_TOOLS.has(toolName)
      ? { action: "continue", code: "NON_SPEC_ALLOWED", toolName, touchesSpecs: false, mismatchField: null }
      : { action: "continue", toolName, touchesSpecs: false, mismatchField: null };
  }

  if (policy.code === "RAW_SPEC_WRITE" && DIRECT_PATH_READ_TOOLS.has(toolName)) return blocked(toolName, "SPEC_READ_REDIRECT", policy.resolutions);
  return blocked(toolName, policy.code, policy.resolutions);
}

export { ALL_SHORT_NAMES, MUTATING_SHORT_NAMES, DIRECT_PATH_MUTATION_TOOLS, DIRECT_PATH_READ_TOOLS };

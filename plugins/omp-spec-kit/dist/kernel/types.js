// Closed type unions and constants for kernel schema `spec-kernel@1`.
// Every list below is declaration-ordered; count summaries use declaration order.

export const KERNEL_SCHEMA_VERSION = "spec-kernel@1";
export const ANCHOR_ALGORITHM_VERSION = "glfm-anchor@1";
export const DIST_MANIFEST_SCHEMA = "omp-spec-kit-dist-manifest@1";

// DocumentKind -> required filename (fixed names only; FEATURE/SCHEMA are slug-derived).
export const FIXED_DOCUMENT_FILES = Object.freeze({
  README: "README.md",
  USER_STORIES: "USER_STORIES.md",
  USE_CASES: "USE_CASES.md",
  RESEARCH: "RESEARCH.md",
  REQUIREMENTS: "REQUIREMENTS.md",
  FUNCTIONAL_REQUIREMENTS: "FR.md",
  NON_FUNCTIONAL_REQUIREMENTS: "NFR.md",
  ACCEPTANCE_CRITERIA: "ACCEPTANCE_CRITERIA.md",
  DESIGN: "DESIGN.md",
  TASKS: "TASKS.md",
  FILE_CHANGES: "FILE_CHANGES.md",
  CHANGELOG: "CHANGELOG.md",
  FIXTURES: "FIXTURES.md",
});

export const DOCUMENT_KINDS = Object.freeze([
  "README",
  "USER_STORIES",
  "USE_CASES",
  "RESEARCH",
  "REQUIREMENTS",
  "FUNCTIONAL_REQUIREMENTS",
  "NON_FUNCTIONAL_REQUIREMENTS",
  "ACCEPTANCE_CRITERIA",
  "DESIGN",
  "TASKS",
  "FILE_CHANGES",
  "CHANGELOG",
  "FEATURE",
  "FIXTURES",
  "SCHEMA",
]);

// Document kinds that contribute Markdown heading/link inventories (everything except FEATURE).
export const MARKDOWN_DOCUMENT_KINDS = Object.freeze(
  DOCUMENT_KINDS.filter((kind) => kind !== "FEATURE"),
);

export const ENTITY_TYPE_DESCRIPTORS = Object.freeze([
  Object.freeze({
    kind: "DOCUMENT",
    label: "Document",
    description: "Canonical or auxiliary specification document.",
  }),
  Object.freeze({
    kind: "USER_STORY",
    label: "User Story",
    description: "User-oriented outcome and rationale.",
  }),
  Object.freeze({
    kind: "USE_CASE",
    label: "Use Case",
    description: "Actor interaction sequence.",
  }),
  Object.freeze({
    kind: "RESEARCH_FINDING",
    label: "Research Finding",
    description: "Verified research observation.",
  }),
  Object.freeze({
    kind: "RISK",
    label: "Risk",
    description: "Adverse condition with impact and mitigation context.",
  }),
  Object.freeze({
    kind: "FUNCTIONAL_REQUIREMENT",
    label: "Functional Requirement",
    description: "Observable mandatory behavior.",
  }),
  Object.freeze({
    kind: "NON_FUNCTIONAL_REQUIREMENT",
    label: "Non-Functional Requirement",
    description: "Quality, constraint, or operational property.",
  }),
  Object.freeze({
    kind: "ACCEPTANCE_CRITERION",
    label: "Acceptance Criterion",
    description: "Verifiable condition of satisfaction.",
  }),
  Object.freeze({
    kind: "DECISION",
    label: "Decision",
    description: "Recorded architecture or design decision with rationale.",
  }),
  Object.freeze({
    kind: "TASK",
    label: "Task",
    description: "Tracked implementation work unit.",
  }),
  Object.freeze({
    kind: "FILE_CHANGE",
    label: "File Change",
    description: "Planned or recorded repository file modification.",
  }),
  Object.freeze({
    kind: "FILE",
    label: "File",
    description: "Associated repository file.",
  }),
  Object.freeze({
    kind: "SCENARIO",
    label: "Scenario",
    description: "Executable behavioral example or test scenario.",
  }),
  Object.freeze({
    kind: "FIXTURE",
    label: "Fixture",
    description: "Test or verification input fixture.",
  }),
  Object.freeze({
    kind: "SCHEMA_ENTITY",
    label: "Schema Entity",
    description: "Structured schema entity or contract definition.",
  }),
]);

export const EDGE_TYPE_DESCRIPTORS = Object.freeze([
  Object.freeze({
    type: "REFS",
    label: "References",
    description: "Generalized resolved reference.",
  }),
  Object.freeze({
    type: "COVERS",
    label: "Covers",
    description: "Requirement coverage relationship.",
  }),
  Object.freeze({
    type: "TESTED_BY",
    label: "Tested By",
    description: "Verification test scenario mapping.",
  }),
  Object.freeze({
    type: "IMPLEMENTS",
    label: "Implements",
    description: "Implementation tracking relationship.",
  }),
  Object.freeze({
    type: "DEPENDS_ON",
    label: "Depends On",
    description: "Ordering or precondition dependency.",
  }),
  Object.freeze({
    type: "DOCUMENTS",
    label: "Documents",
    description: "Descriptive or documenting relationship.",
  }),
  Object.freeze({
    type: "DECLARES",
    label: "Declares",
    description: "Document declaration relationship.",
  }),
]);

export const NODE_KINDS = Object.freeze(
  ENTITY_TYPE_DESCRIPTORS.map((descriptor) => descriptor.kind),
);

export const EDGE_TYPES = Object.freeze(
  EDGE_TYPE_DESCRIPTORS.map((descriptor) => descriptor.type),
);

export const EDGE_ENDPOINT_MATRIX = Object.freeze({
  REFS: { from: null, to: null }, // null = any node kind
  COVERS: {
    from: ["ACCEPTANCE_CRITERION", "USE_CASE", "USER_STORY"],
    to: ["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"],
  },
  TESTED_BY: {
    from: ["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION"],
    to: ["SCENARIO"],
  },
  IMPLEMENTS: {
    from: ["TASK", "FILE_CHANGE", "FILE"],
    to: ["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION"],
  },
  DEPENDS_ON: { from: ["TASK"], to: ["TASK"] },
  DOCUMENTS: {
    from: ["RESEARCH_FINDING", "DECISION", "FILE_CHANGE", "FIXTURE", "SCHEMA_ENTITY"],
    toExcept: ["DOCUMENT"],
  },
  DECLARES: { from: ["DOCUMENT"], toExcept: ["DOCUMENT"] },
});

// AuthoredLocalId roles and their exact grammars (case-sensitive, no normalization).
export const LOCAL_ID_ROLES = Object.freeze({
  USER_STORY: { kind: "USER_STORY", re: /^US-[1-9][0-9]*$/ },
  USE_CASE: { kind: "USE_CASE", re: /^UC-[1-9][0-9]*$/ },
  RESEARCH_FINDING: { kind: "RESEARCH_FINDING", re: /^RF-[1-9][0-9]*$/ },
  RISK: { kind: "RISK", re: /^RISK-[1-9][0-9]*$/ },
  FUNCTIONAL_REQUIREMENT: { kind: "FUNCTIONAL_REQUIREMENT", re: /^FR-[1-9][0-9]*$/ },
  NON_FUNCTIONAL_REQUIREMENT: {
    kind: "NON_FUNCTIONAL_REQUIREMENT",
    re: /^NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*$/,
  },
  ACCEPTANCE_CRITERION: { kind: "ACCEPTANCE_CRITERION", re: /^AC-[1-9][0-9]*\.[1-9][0-9]*$/ },
  DECISION: { kind: "DECISION", re: /^DEC-[1-9][0-9]*$/ },
  TASK: { kind: "TASK", re: /^TASK-[1-9][0-9]*$/ },
  FILE_CHANGE: { kind: "FILE_CHANGE", re: /^FC-[1-9][0-9]*$/ },
  FIXTURE: { kind: "FIXTURE", re: /^FIXTURE-[1-9][0-9]*$/ },
  SCHEMA_ENTITY: { kind: "SCHEMA_ENTITY", re: /^SCHEMA-[1-9][0-9]*$/ },
  SCENARIO: { kind: "SCENARIO", re: /^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/ },
});

// DocumentKind -> definition roles allowed (empty = no authored definitions).
export const DOCUMENT_DEFINITION_ROLES = Object.freeze({
  README: [],
  USER_STORIES: ["USER_STORY"],
  USE_CASES: ["USE_CASE"],
  RESEARCH: ["RESEARCH_FINDING", "RISK"],
  REQUIREMENTS: [],
  FUNCTIONAL_REQUIREMENTS: ["FUNCTIONAL_REQUIREMENT"],
  NON_FUNCTIONAL_REQUIREMENTS: ["NON_FUNCTIONAL_REQUIREMENT"],
  ACCEPTANCE_CRITERIA: ["ACCEPTANCE_CRITERION"],
  DESIGN: ["DECISION"],
  TASKS: ["TASK"],
  FILE_CHANGES: ["FILE_CHANGE"],
  CHANGELOG: [],
  FEATURE: [],
  FIXTURES: ["FIXTURE"],
  SCHEMA: ["SCHEMA_ENTITY"],
});

// Definition heading productions per role.
// levels: allowed ATX levels; separators: ["colon","emdash"] and/or "bare".
export const ROLE_HEADING_PRODUCTION = Object.freeze({
  USER_STORY: { levels: [2], separators: ["colon", "emdash"] },
  USE_CASE: { levels: [2], separators: ["colon", "emdash"] },
  RESEARCH_FINDING: { levels: [2], separators: ["colon", "emdash"] },
  RISK: { levels: [2], separators: ["colon", "emdash"] },
  FUNCTIONAL_REQUIREMENT: { levels: [2], separators: ["colon", "emdash"] },
  NON_FUNCTIONAL_REQUIREMENT: { levels: [2], separators: ["colon", "emdash"] },
  ACCEPTANCE_CRITERION: { levels: [2, 3], separators: ["colon", "emdash", "bare"] },
  DECISION: { levels: [2], separators: ["colon", "emdash"] },
  TASK: { levels: [2], separators: ["colon", "emdash"] },
  FILE_CHANGE: { levels: [2], separators: ["colon", "emdash"] },
  FIXTURE: { levels: [2], separators: ["colon", "emdash"] },
  SCHEMA_ENTITY: { levels: [2], separators: ["colon", "emdash"] },
  SCENARIO: { levels: [], separators: [] }, // Gherkin tags only
});

// Structured reference field name -> requested edge type (non-fenced lines and table columns).
export const REFERENCE_FIELD_EDGE_TYPES = Object.freeze({
  Refs: "REFS",
  Related: "REFS",
  Covers: "COVERS",
  Implements: "IMPLEMENTS",
  "Depends On": "DEPENDS_ON",
});

// Documents whose defined table columns may carry reference projections.
export const TABLE_REFERENCE_DOCUMENT_KINDS = Object.freeze([
  "REQUIREMENTS",
  "TASKS",
  "FILE_CHANGES",
]);

export const TASK_STATUSES = Object.freeze([
  "planned",
  "todo",
  "ready",
  "in-progress",
  "blocked",
  "done",
  "deferred",
  "unknown",
]);

// Canonical-corpus spellings normalize without coercion between planned and todo.
export const TASK_STATUS_NORMALIZATION = Object.freeze({
  Planned: "planned",
  planned: "planned",
  todo: "todo",
  Completed: "done",
  completed: "done",
});

export const FILE_ACTIONS = Object.freeze(["create", "edit", "delete"]);
export const FILE_PLANNED_ACTIONS = Object.freeze(["create", "edit", "delete", "reference"]);

export const LINK_SYNTAXES = Object.freeze([
  "INLINE",
  "FULL_REFERENCE",
  "COLLAPSED_REFERENCE",
  "SHORTCUT_REFERENCE",
  "AUTOLINK",
]);

export const LINK_OUTCOMES = Object.freeze(["INTERNAL_HEADING", "INTERNAL_DOCUMENT", "EXTERNAL", "UNRESOLVED"]);

export const MD_UNRESOLVED_REASONS = Object.freeze([
  "MALFORMED_DESTINATION",
  "TARGET_DOCUMENT_MISSING",
  "TARGET_ANCHOR_MISSING",
  "TARGET_OUTSIDE_CORPUS",
  "AMBIGUOUS_PATH",
]);

export const REF_UNRESOLVED_REASONS = Object.freeze([
  "MALFORMED_TARGET",
  "UNQUALIFIED_CROSS_SPEC",
  "MISSING_TARGET",
  "AMBIGUOUS_TARGET",
  "FORBIDDEN_ENDPOINT",
  "REJECTED_SOURCE",
]);

export const DIAGNOSTIC_CODES = Object.freeze([
  "UNSUPPORTED_DOCUMENT",
  "INVALID_UTF8",
  "HASH_MISMATCH",
  "FILE_TOO_LARGE",
  "CORPUS_LIMIT_EXCEEDED",
  "INVALID_SPEC_SLUG",
  "PATH_MISMATCH",
  "PATH_ESCAPE",
  "SYMLINK_REJECTED",
  "NON_REGULAR_FILE",
  "IO_READ_FAILED",
  "UNSUPPORTED_GHERKIN_DIALECT",
  "MALFORMED_GHERKIN",
  "MISSING_SCENARIO_ID",
  "DUPLICATE_SCENARIO_ID_TAG",
  "MALFORMED_HEADING",
  "INVALID_LOCAL_ID",
  "ID_NOT_ALLOWED_IN_DOCUMENT",
  "DUPLICATE_DEFINITION",
  "MALFORMED_REFERENCE",
  "UNQUALIFIED_CROSS_SPEC_REFERENCE",
  "BROKEN_REFERENCE",
  "AMBIGUOUS_REFERENCE",
  "FORBIDDEN_EDGE_ENDPOINT",
  "MALFORMED_MARKDOWN_LINK",
  "BROKEN_MARKDOWN_LINK",
  "INVALID_AC_PARENT",
  "INVARIANT_VIOLATION",
  "DIAGNOSTIC_LIMIT_REACHED",
]);

export const DIAGNOSTIC_SEVERITIES = Object.freeze(["ERROR", "WARNING", "INFO"]);

// Default severity per diagnostic code (builder may not widen the union).
export const DIAGNOSTIC_DEFAULT_SEVERITY = Object.freeze({
  UNSUPPORTED_DOCUMENT: "INFO",
  INVALID_UTF8: "ERROR",
  HASH_MISMATCH: "ERROR",
  FILE_TOO_LARGE: "ERROR",
  CORPUS_LIMIT_EXCEEDED: "ERROR",
  INVALID_SPEC_SLUG: "ERROR",
  PATH_MISMATCH: "ERROR",
  PATH_ESCAPE: "ERROR",
  SYMLINK_REJECTED: "ERROR",
  NON_REGULAR_FILE: "ERROR",
  IO_READ_FAILED: "ERROR",
  UNSUPPORTED_GHERKIN_DIALECT: "ERROR",
  MALFORMED_GHERKIN: "ERROR",
  MISSING_SCENARIO_ID: "ERROR",
  DUPLICATE_SCENARIO_ID_TAG: "ERROR",
  MALFORMED_HEADING: "WARNING",
  INVALID_LOCAL_ID: "WARNING",
  ID_NOT_ALLOWED_IN_DOCUMENT: "WARNING",
  DUPLICATE_DEFINITION: "WARNING",
  MALFORMED_REFERENCE: "WARNING",
  UNQUALIFIED_CROSS_SPEC_REFERENCE: "WARNING",
  BROKEN_REFERENCE: "WARNING",
  AMBIGUOUS_REFERENCE: "WARNING",
  FORBIDDEN_EDGE_ENDPOINT: "WARNING",
  MALFORMED_MARKDOWN_LINK: "WARNING",
  BROKEN_MARKDOWN_LINK: "WARNING",
  INVALID_AC_PARENT: "WARNING",
  INVARIANT_VIOLATION: "ERROR",
  DIAGNOSTIC_LIMIT_REACHED: "WARNING",
});

// Closed remediation keys.
export const REMEDIATIONS = Object.freeze({
  UNSUPPORTED_DOCUMENT: "rename-to-canonical-document",
  INVALID_UTF8: "re-encode-as-utf8",
  HASH_MISMATCH: "refresh-source-bytes",
  FILE_TOO_LARGE: "reduce-document-size",
  CORPUS_LIMIT_EXCEEDED: "reduce-corpus-scope",
  INVALID_SPEC_SLUG: "use-lowercase-kebab-slug",
  PATH_MISMATCH: "align-path-and-document-kind",
  PATH_ESCAPE: "keep-paths-inside-root",
  SYMLINK_REJECTED: "replace-link-with-regular-file",
  NON_REGULAR_FILE: "use-regular-file",
  IO_READ_FAILED: "fix-read-permissions",
  UNSUPPORTED_GHERKIN_DIALECT: "use-english-gherkin",
  MALFORMED_GHERKIN: "fix-gherkin-structure",
  MISSING_SCENARIO_ID: "add-id-tag",
  DUPLICATE_SCENARIO_ID_TAG: "keep-one-id-tag",
  MALFORMED_HEADING: "use-canonical-heading-production",
  INVALID_LOCAL_ID: "use-valid-local-id",
  ID_NOT_ALLOWED_IN_DOCUMENT: "move-definition-to-owning-document",
  DUPLICATE_DEFINITION: "remove-duplicate-definition",
  MALFORMED_REFERENCE: "use-valid-target-syntax",
  UNQUALIFIED_CROSS_SPEC_REFERENCE: "use-qualified-id",
  BROKEN_REFERENCE: "define-target-or-fix-spelling",
  AMBIGUOUS_REFERENCE: "remove-duplicate-target-definition",
  FORBIDDEN_EDGE_ENDPOINT: "use-allowed-endpoint-kinds",
  MALFORMED_MARKDOWN_LINK: "fix-markdown-link-destination",
  BROKEN_MARKDOWN_LINK: "fix-link-target-or-anchor",
  INVALID_AC_PARENT: "align-ac-parent-numbering",
  INVARIANT_VIOLATION: "report-kernel-defect",
  DIAGNOSTIC_LIMIT_REACHED: "reduce-diagnostic-volume",
});

export const QUERY_OPERATIONS = Object.freeze([
  "inventory",
  "getNode",
  "findNodes",
  "getEdges",
  "trace",
  "diagnostics",
  "overview",
  "markdownInventory",
  "validation",
]);

export const QUERY_ERROR_CODES = Object.freeze([
  "INVALID_REQUEST",
  "UNSUPPORTED_SCHEMA_VERSION",
  "UNKNOWN_OPERATION",
  "UNKNOWN_FIELD",
  "MISSING_FIELD",
  "INVALID_PARAMETER",
  "LIMIT_EXCEEDED",
  "INVALID_CURSOR",
  "STALE_CURSOR",
  "GRAPH_UNAVAILABLE",
  "GRAPH_INVALID",
  "NOT_FOUND",
  "AMBIGUOUS_ID",
  "HEADING_NOT_FOUND",
  "RESPONSE_TOO_LARGE",
  "CANCELLED",
  "ADAPTER_CONTAINMENT_ERROR",
  "ADAPTER_READ_ERROR",
  "INTERNAL_INVARIANT_ERROR",
]);

export const NODE_PROJECTIONS = Object.freeze(["summary", "full"]);
export const EDGE_DIRECTIONS = Object.freeze(["in", "out", "both"]);
export const MARKDOWN_MODES = Object.freeze(["all", "focus"]);

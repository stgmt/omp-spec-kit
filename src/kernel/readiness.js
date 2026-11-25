import { createHash } from "node:crypto";

// Readiness ladder over the specification graph.
//
// One pure function decides how far a specification has come and what keeps it
// from the next rung. Nothing here reads files or calls a service: the graph is
// the only input, so the preview and the write cannot disagree, and the plugin
// hooks can render the same text without a second implementation.
//
// The rule text and the refusal catalogue live here as the single source that
// tool descriptions, the MCP instructions and hook messages render. A copy that
// diverges from these constants is a build failure (tests/readiness-drift).

// The rungs the corpus itself can prove from its documents and links.
export const READINESS_LEVELS = Object.freeze(["L0", "L1", "L2", "L3"]);

// The chain a specification walks before a task may exist. A task is the last
// entity: it names a requirement that already exists in an assembled corpus.
export const SPEC_CHAIN_ORDER = Object.freeze([
  "ROADMAP.md",
  "<slug>-user-stories.feature",
  "<slug>-use-cases.feature",
  "RESEARCH.md",
  "REQUIREMENTS.md",
  "FR.md",
  "NFR.md",
  "ACCEPTANCE_CRITERIA.md",
  "DESIGN.md",
  "TASKS.md",
]);

// A design document below this size is the scaffold `createSpec` writes
// (`# Title` plus `Status: DRAFT`), not an assembled design. The threshold is
// deliberately generous: it separates a placeholder from any authored section.
export const DESIGN_STUB_MAX_BYTES = 200;

export const READINESS_BLOCKER_CODES = Object.freeze({
  REQUIREMENTS: "NO_REQUIREMENTS",
  CRITERIA: "NO_ACCEPTANCE_CRITERIA",
  DESIGN: "NO_DESIGN",
  REQUIREMENTS_DOC: "NO_REQUIREMENTS_DOC",
  NON_FUNCTIONAL: "NO_NON_FUNCTIONAL_REQUIREMENT",
  SCHEMA: "NO_SCHEMA",
});

// Refusal codes the compiler emits. They are part of the tool contract, so the
// catalogue is declared once and rendered everywhere.
export const READINESS_REFUSALS = Object.freeze({
  SPEC_NOT_READY: "specification has not reached L3 (requirements doc, FR and NFR, criteria, design, schema, cross-link); a task cannot exist earlier in the chain",
  REQUIREMENTS_DOC_REQUIRED: "REQUIREMENTS.md is still the scaffold; write the requirement index before functional requirements",
  TASK_NOT_TRACEABLE: "task names no requirement that exists in this specification",
  TASK_DOCUMENT_BYPASS: "task definitions are created only through confirmTaskCreation; raw TASKS.md inserts are refused",
  BACKLOG_FORBIDDEN: "a task requires a requirement; the backlog intents addBacklogTask and registerIncidentBacklog are removed",
  SCENARIO_NOT_TRACEABLE: "scenario carries neither @featureN nor @AC-N.M",
});

// The one way a mutation reaches the corpus. Hook refusals render this instead
// of keeping their own copy.
export const SPEC_WRITE_ROUTE_HINT =
  "use spec_patch with dryRun: true for preview or dryRun: false to apply";

// The whole cycle in one block. Tool descriptions, the MCP server instructions
// and hook messages render this constant instead of keeping a copy.
export const READINESS_RULE_TEXT = [
  "Specification chain: ROADMAP -> USER_STORIES/USE_CASES/RESEARCH -> REQUIREMENTS -> FR -> NFR -> ACCEPTANCE_CRITERIA -> DESIGN -> TASKS.",
  "TASKS are the last entity in the chain; FR is refused while REQUIREMENTS.md is still the scaffold.",
  "Readiness ladder: L0 scaffold, L1 requirements, L2 criteria and design, L3 assembled documents (requirements index, NFR, schema, cross-spec link).",
  "A task is created only on a specification that reached L3 and names at least one requirement from the same specification.",
  "Write User Stories and Use Cases in the two canonical Gherkin files. Each use case Rule declares its story. Draft scenarios need Given/When/Then. @spec-ready requires FR/AC trace and owner-approved coverage.",
  "Creating or changing the requirements or coverageScope of a task requires current owner-approved BDD examples. Raw insertion of a task heading in TASKS.md is refused.",
  "The preview and the write report the same blockers and the same fix calls.",
].join("\n");

const REQUIREMENT_KINDS = new Set(["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"]);

function blocker(code, level, message) {
  return { code, level, message };
}

function designDocument(nodes) {
  return nodes.find(
    (node) =>
      node.kind === "DOCUMENT" &&
      (node.attributes?.filename === "DESIGN.md" || node.localId === "DOC:DESIGN.md"),
  ) ?? null;
}

function documentByFilename(nodes, filename) {
  return nodes.find(
    (node) =>
      node.kind === "DOCUMENT" &&
      (node.attributes?.filename === filename || node.localId === `DOC:${filename}`),
  ) ?? null;
}

function documentIsAssembled(nodes, filename) {
  const document = documentByFilename(nodes, filename);
  if (document === null) return false;
  const bytes = document.attributes?.byteLength;
  if (typeof bytes === "number") return bytes >= DESIGN_STUB_MAX_BYTES;
  // A corpus that reports no byte length cannot prove the document is assembled.
  return false;
}

function designIsAssembled(nodes) {
  return documentIsAssembled(nodes, "DESIGN.md");
}

function criteriaUnderRequirements(graph, nodes, requirementIds, requirementCanonicalIds) {
  return nodes.filter((node) => {
    if (node.kind !== "ACCEPTANCE_CRITERION") return false;
    const parent = node.attributes?.parentLocalId;
    if (typeof parent === "string" && requirementIds.has(parent)) return true;
    // Fall back to the authored edge, matching the canonical id so a
    // cross-spec reference to a same-named requirement cannot count.
    return graph.edges.some(
      (edge) => edge.from === node.canonicalId && requirementCanonicalIds.has(edge.to),
    );
  });
}

/**
 * Compute the readiness verdict for one specification.
 *
 * @param {{nodes: Array<object>, edges: Array<object>}} graph
 * @param {string} specSlug
 * @returns {{spec: string, level: string, nextLevel: string|null,
 *   reached: object, blockers: Array<{code: string, level: string, message: string}>}}
 */
export function specReadiness(graph, specSlug) {
  const nodes = graph.nodes.filter((node) => node.specSlug === specSlug);
  // Both requirement kinds count: the admission gate accepts an NFR id as a
  // traceable parent, so a rung that ignored NFRs would pin an NFR-only
  // specification at L0 while the same compiler accepts its ids.
  const requirements = nodes.filter((node) => REQUIREMENT_KINDS.has(node.kind));
  // A criterion is parented by its id (AC-<n>.<m> to FR-<n>), so only a
  // functional requirement can carry one. A specification held back at the
  // criteria rung for want of an FR must be told that, not told it has none.
  const functionalRequirements = requirements.filter((node) => node.kind === "FUNCTIONAL_REQUIREMENT");
  const requirementIds = new Set(requirements.map((node) => node.localId));
  const requirementCanonicalIds = new Set(requirements.map((node) => node.canonicalId));
  const criteria = criteriaUnderRequirements(graph, nodes, requirementIds, requirementCanonicalIds);
  const design = designIsAssembled(nodes);
  const tasks = nodes.some((node) => node.kind === "TASK");
  // A decision id already taken by the design. A design can be short and still
  // declare a decision, so the fix step must extend it with a free id instead
  // of inserting a second definition of one that exists.
  const decisionNumbers = nodes
    .filter((node) => node.kind === "DECISION")
    .map((node) => /^DEC-([0-9]+)$/u.exec(node.localId ?? "")?.[1])
    .filter((value) => value !== undefined)
    .map(Number);

  const blockers = [];
  let level = "L0";
  if (requirements.length === 0) {
    blockers.push(blocker(READINESS_BLOCKER_CODES.REQUIREMENTS, "L1", "specification has no requirement"));
  } else {
    level = "L1";
    if (criteria.length === 0) {
      blockers.push(blocker(READINESS_BLOCKER_CODES.CRITERIA, "L2", "no acceptance criterion is attached to a requirement"));
    }
    if (!design) {
      blockers.push(blocker(READINESS_BLOCKER_CODES.DESIGN, "L2", "DESIGN.md is still the scaffold"));
    }
    if (criteria.length > 0 && design) {
      level = "L2";
      // L3: the documents a task must sit on. Tasks are the last entity in the
      // chain, so everything they trace to has to be assembled first.
      const requirementsDoc = documentIsAssembled(nodes, "REQUIREMENTS.md");
      const nonFunctional = requirements.some((node) => node.kind === "NON_FUNCTIONAL_REQUIREMENT");
      const schema = documentIsAssembled(nodes, `${specSlug}_SCHEMA.md`);
      if (!requirementsDoc) {
        blockers.push(blocker(READINESS_BLOCKER_CODES.REQUIREMENTS_DOC, "L3", "REQUIREMENTS.md is missing or short; author the requirement index before retrying"));
      }
      if (!nonFunctional) {
        blockers.push(blocker(READINESS_BLOCKER_CODES.NON_FUNCTIONAL, "L3", "specification has no non-functional requirement"));
      }
      if (!schema) {
        blockers.push(blocker(READINESS_BLOCKER_CODES.SCHEMA, "L3", `${specSlug}_SCHEMA.md is still the scaffold`));
      }
      if (requirementsDoc && nonFunctional && schema) level = "L3";
    }
  }

  const index = READINESS_LEVELS.indexOf(level);
  return {
    spec: specSlug,
    level,
    nextLevel: index + 1 < READINESS_LEVELS.length ? READINESS_LEVELS[index + 1] : null,
    // The first requirement the specification already has, so a fix step can
    // name the parent a criterion must be attached to instead of guessing.
    firstRequirement: requirements.length > 0 ? requirements[0].localId : null,
    // The parent a criterion can actually be attached to; null while the
    // specification has only non-functional requirements.
    firstFunctionalRequirement: functionalRequirements.length > 0 ? functionalRequirements[0].localId : null,
    // The first decision id the design does not use, so a fix step can add a
    // decision without colliding with one the (short) design already declares.
    nextDecisionId: `DEC-${decisionNumbers.length > 0 ? Math.max(...decisionNumbers) + 1 : 1}`,
    documents: Object.fromEntries(
      ["FR.md", "NFR.md", "ACCEPTANCE_CRITERIA.md", "DESIGN.md"]
        .map((filename) => [filename, documentByFilename(nodes, filename)?.attributes?.sourceSha256 ?? null]),
    ),
    reached: {
      requirements: requirements.length,
      criteria: criteria.length,
      design: design,
      // Task count is reported without being a rung of its own.
      tasks: tasks,
    },
    blockers,
  };
}

/**
 * Blockers that stop a task from being admitted, in level order.
 * Only the rungs up to L2 matter for admission.
 */
export function taskAdmissionBlockers(readiness) {
  // Every blocker gates a task: the chain is ordered, so an unfinished rung
  // below the task cannot be skipped.
  return readiness.blockers;
}

/**
 * Preview-only suggestions for task admission, in level order. The generated
 * scaffold text needs domain review; some blockers have no automatic step.
 */
/**
 * The one builder for a suggested fix step. Every refusal in the compiler
 * and every readiness blocker builds its plan through these two functions, so
 * a change to the `spec_patch` request shape is one edit, not one per fix list.
 */
function fixRequestId(args) {
  return `readiness-fix-${createHash("sha256").update(JSON.stringify(args)).digest("hex")}`;
}

export function specPatchStep(spec, reason, operations) {
  const args = { intent: "patch", spec, reason, operations };
  return { tool: "spec_patch", arguments: { requestId: fixRequestId(args), ...args } };
}

/** The facade form: `confirmTaskCreation` takes fields, not operations. */
export function confirmTaskStep(spec, { entity, subject, requirements, reason }) {
  const args = { intent: "confirmTaskCreation", spec, entity, subject, requirements, reason };
  return { tool: "spec_patch", arguments: { requestId: fixRequestId(args), ...args } };
}

export function taskAdmissionFixSteps(spec, readiness) {
  const steps = [];
  const has = (code) => taskAdmissionBlockers(readiness).some((entry) => entry.code === code);
  // A short index or schema may contain authored material. It needs domain
  // input, not replacement with generic filler that merely passes a byte limit.
  if (has(READINESS_BLOCKER_CODES.REQUIREMENTS)) {
    steps.push(fixStep(spec, "readiness: add the first functional requirement", {
      kind: "insert_at_eof",
      document: "FR.md",
      text: "\n## FR-1 — First functional requirement\n\nDescribe what the system must do for its first user-visible behaviour.\n",
    }));
  }
  if (has(READINESS_BLOCKER_CODES.CRITERIA)) {
    const parent = readiness.firstFunctionalRequirement;
    if (!parent) {
      steps.push(fixStep(spec, "readiness: a criterion attaches to a functional requirement", {
        kind: "insert_at_eof",
        document: "FR.md",
        text: "\n## FR-1 — First functional requirement\n\nDescribe what the system must do for its first user-visible behaviour.\n",
      }));
    } else {
      steps.push(fixStep(spec, "readiness: attach an acceptance criterion", {
        kind: "insert_at_eof",
        document: "ACCEPTANCE_CRITERIA.md",
        text:
          `\n## AC-${parent.slice(3)}.1 — ${parent}\n\n` +
          "Given the requirement is exercised, when the caller sends the request, then the expected outcome holds.\n",
      }));
    }
  }
  if (has(READINESS_BLOCKER_CODES.DESIGN)) {
    steps.push(fixStep(spec, "readiness: assemble DESIGN.md", {
      kind: "insert_at_eof",
      document: "DESIGN.md",
      text:
        `\n## ${readiness.nextDecisionId ?? "DEC-1"} — Decision\n\n` +
        "Context: state the constraint that forces a choice, in the caller's own terms.\n\n" +
        "Decision: state what is chosen and which boundary it moves.\n\n" +
        "Consequences: state what follows for callers, operators and later changes.\n\n" +
        "Alternatives: state the option that was rejected and why the chosen one is safer.\n",
    }));
  }
  if (has(READINESS_BLOCKER_CODES.NON_FUNCTIONAL)) {
    steps.push(fixStep(spec, "readiness: add the first non-functional requirement", {
      kind: "insert_at_eof",
      document: "NFR.md",
      text: "\n## NFR-SPEC-1 — First non-functional requirement\n\nState the quality or constraint the specification must hold.\n",
    }));
  }
  // Do not create absent documents speculatively, and guard each replay
  // against edits made since the refusal was produced.
  return steps.flatMap((step) => {
    const operation = step.arguments.operations[0];
    const sha = readiness.documents?.[operation.document];
    if (typeof sha !== "string") return [];
    const { requestId: unused, ...rest } = step.arguments;
    const args = { ...rest, dryRun: true, operations: [{ ...operation, expectedSha: sha }] };
    return [{ ...step, arguments: { requestId: fixRequestId(args), ...args } }];
  });
}

function fixStep(spec, reason, operation) {
  return specPatchStep(spec, reason, [operation]);
}

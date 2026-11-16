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

// The full canonical ladder. Execution evidence is supplied by the existing
// evidence pipeline; authored status text cannot prove the execution rung.
export const READINESS_LEVELS = Object.freeze(["L0", "L1", "L2", "L3", "L4"]);

// A design document below this size is the scaffold `createSpec` writes
// (`# Title` plus `Status: DRAFT`), not an assembled design. The threshold is
// deliberately generous: it separates a placeholder from any authored section.
export const DESIGN_STUB_MAX_BYTES = 200;

export const READINESS_BLOCKER_CODES = Object.freeze({
  REQUIREMENTS: "NO_REQUIREMENTS",
  CRITERIA: "NO_ACCEPTANCE_CRITERIA",
  DESIGN: "NO_DESIGN",
  EVIDENCE: "NO_EXECUTION_EVIDENCE",
  TASKS: "NO_TASKS",
});

// Refusal codes the compiler emits. They are part of the tool contract, so the
// catalogue is declared once and rendered everywhere.
export const READINESS_REFUSALS = Object.freeze({
  SPEC_NOT_READY: "specification has not reached L2 (criteria and design); a task cannot exist on a scaffold",
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
  "Readiness ladder: L0 scaffold, L1 requirements, L2 criteria and design, L3 execution evidence, L4 tasks.",
  "A task is created only on a specification that reached L2 and names at least one requirement from the same specification.",
  "A scenario is added only with @featureN or @AC-N.M; a raw operation that inserts a task heading in TASKS.md is refused.",
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

function designIsAssembled(nodes) {
  const document = designDocument(nodes);
  if (document === null) return false;
  const bytes = document.attributes?.byteLength;
  if (typeof bytes === "number") return bytes >= DESIGN_STUB_MAX_BYTES;
  // A corpus that reports no byte length cannot prove the design is assembled.
  return false;
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
  const scenarios = nodes.filter((node) => node.kind === "SCENARIO");
  const evidence = scenarios.length > 0 && scenarios.every((node) => {
    const proof = graph.executionEvidence?.[node.canonicalId];
    return proof?.result === "PASSED" && proof.graphFingerprint === graph.fingerprint &&
      proof.scenarioContentHash === node.contentHash;
  });
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
  }
  // Report every missing admission prerequisite, including the missing
  // criteria on a scaffold (AC-2.1), in ladder order.
  if (criteria.length === 0) {
    blockers.push(blocker(READINESS_BLOCKER_CODES.CRITERIA, "L2", "no acceptance criterion is attached to a requirement"));
  }
  if (!design) {
    blockers.push(blocker(READINESS_BLOCKER_CODES.DESIGN, "L2", "DESIGN.md is still the scaffold"));
  }
  if (requirements.length > 0 && criteria.length > 0 && design) {
    level = "L2";
    if (!evidence) {
      blockers.push(blocker(READINESS_BLOCKER_CODES.EVIDENCE, "L3", "no complete passing execution evidence matches every scenario source"));
    } else {
      level = "L3";
      if (tasks) level = "L4";
      else blockers.push(blocker(READINESS_BLOCKER_CODES.TASKS, "L4", "specification has no task"));
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
    reached: {
      requirements: requirements.length,
      criteria: criteria.length,
      design: design,
      evidence,
      tasks: tasks,
    },
    blockers,
  };
}

/**
 * Blockers that stop a task from being admitted, in level order.
 * Only the rungs up to L2 matter: evidence and tasks come after admission.
 */
export function taskAdmissionBlockers(readiness) {
  return readiness.blockers.filter((entry) => entry.level === "L1" || entry.level === "L2");
}

/**
 * Ready-to-call steps that clear the blockers of a task admission, in level
 * order. Each entry is a `spec_patch` intent the caller can send as-is.
 */
/**
 * The one builder for a ready-to-call fix step. Every refusal in the compiler
 * and every readiness blocker builds its plan through these two functions, so
 * a change to the `spec_patch` request shape is one edit, not one per fix list.
 */
export function specPatchStep(spec, reason, operations) {
  return { tool: "spec_patch", arguments: { intent: "patch", spec, reason, operations } };
}

/** The facade form: `confirmTaskCreation` takes fields, not operations. */
export function confirmTaskStep(spec, { entity, subject, requirements, reason }) {
  return {
    tool: "spec_patch",
    arguments: { intent: "confirmTaskCreation", spec, entity, subject, requirements, reason },
  };
}

export function taskAdmissionFixSteps(spec, readiness) {
  const steps = [];
  let criterionParent = readiness.firstFunctionalRequirement;
  for (const entry of taskAdmissionBlockers(readiness)) {
    if (entry.code === READINESS_BLOCKER_CODES.REQUIREMENTS) {
      steps.push(fixStep(spec, "readiness: add the first functional requirement", {
        kind: "insert_at_eof",
        document: "FR.md",
        text: "\n## FR-1 — First functional requirement\n\nDescribe what the system must do for its first user-visible behaviour.\n",
      }));
      criterionParent = "FR-1";
    } else if (entry.code === READINESS_BLOCKER_CODES.CRITERIA) {
      // An acceptance criterion is parented by its id (AC-<n>.<m> to FR-<n>),
      // so the step must reuse the functional requirement the specification
      // already has. An NFR-only specification gets the requirement first:
      // a plan that attached a criterion to a missing FR-1 would not apply.
      if (!criterionParent) {
        steps.push(fixStep(spec, "readiness: a criterion attaches to a functional requirement", {
          kind: "insert_at_eof",
          document: "FR.md",
          text: "\n## FR-1 — First functional requirement\n\nDescribe what the system must do for its first user-visible behaviour.\n",
        }));
        criterionParent = "FR-1";
      }
      steps.push(fixStep(spec, "readiness: attach an acceptance criterion", {
        kind: "insert_at_eof",
        document: "ACCEPTANCE_CRITERIA.md",
        text:
          `\n## AC-${criterionParent.slice(3)}.1 — ${criterionParent}\n\n` +
          "Given the requirement is exercised, when the caller sends the request, then the expected outcome holds.\n",
      }));
    } else if (entry.code === READINESS_BLOCKER_CODES.DESIGN) {
      // Long enough that the document clears DESIGN_STUB_MAX_BYTES once it is
      // appended to the scaffold, which is the state that produced the blocker,
      // and numbered past any decision the design already declares.
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
  }
  return steps;
}

function fixStep(spec, reason, operation) {
  return specPatchStep(spec, reason, [operation]);
}

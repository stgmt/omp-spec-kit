// Typed edge resolution in the fixed order: target syntax, qualification,
// existence/cardinality, endpoint matrix. One outcome per reference.

import {
  EDGE_ENDPOINT_MATRIX,
  REF_UNRESOLVED_REASONS,
} from "../types.js";
import { isValidSpecSlug, localIdKind, isGeneratedLocalId } from "../identity.js";

function isValidTargetSyntax(rawTarget) {
  if (typeof rawTarget !== "string" || rawTarget === "") return false;
  const colon = rawTarget.indexOf(":");
  if (colon < 0) {
    return localIdKind(rawTarget) !== null || isGeneratedLocalId(rawTarget);
  }
  const slug = rawTarget.slice(0, colon);
  const local = rawTarget.slice(colon + 1);
  return isValidSpecSlug(slug) && (localIdKind(local) !== null || isGeneratedLocalId(local));
}

function matchesSide(list, kind) {
  if (!list) return true; // null = any node kind
  return list.includes(kind);
}

export function endpointAllowed(type, fromKind, toKind) {
  const rule = EDGE_ENDPOINT_MATRIX[type];
  if (!rule) return false;
  if (!matchesSide(rule.from, fromKind)) return false;
  if (rule.toExcept && rule.toExcept.includes(toKind)) return false;
  if (rule.to && !matchesSide(rule.to, toKind)) return false;
  return true;
}
// Returns { outcome:"RESOLVED", edge } | { outcome:"UNRESOLVED", reason,
//          candidates, diagnosticCode, message }
export function resolveReference(ref, ctx) {
  const { groups, nodeById, specSlugsOfLocalId } = ctx;

  // 1. Target syntax.
  if (!isValidTargetSyntax(ref.rawTarget)) {
    return unresolved("MALFORMED_TARGET", [], "MALFORMED_REFERENCE", "reference target does not match any local ID grammar");
  }

  let targetCanonicalId;
  if (ref.rawTarget.includes(":")) {
    targetCanonicalId = ref.rawTarget;
  } else {
    // 2. Qualification: bare IDs resolve only inside the source spec.
    const ownKey = `${ref.specSlug}:${ref.rawTarget}`;
    if (groups.has(ownKey)) {
      targetCanonicalId = ownKey;
    } else {
      const foreignSpecs = specSlugsOfLocalId.get(ref.rawTarget) ?? [];
      if (foreignSpecs.length > 0) {
        return unresolved(
          "UNQUALIFIED_CROSS_SPEC",
          foreignSpecs.map((slug) => `${slug}:${ref.rawTarget}`).slice(0, 16),
          "UNQUALIFIED_CROSS_SPEC_REFERENCE",
          "bare target exists only in other specs; qualify as <spec-slug>:<local-id>",
        );
      }
      return unresolved("MISSING_TARGET", [], "BROKEN_REFERENCE", "target is not defined anywhere in the corpus");
    }
  }

  const group = groups.get(targetCanonicalId);
  // 3. Existence and cardinality.
  if (!group || group.count === 0) {
    return unresolved("MISSING_TARGET", [], "BROKEN_REFERENCE", "qualified target has no definition occurrence");
  }
  if (group.count >= 2 || group.nodeId === null) {
    return unresolved("AMBIGUOUS_TARGET", [targetCanonicalId], "AMBIGUOUS_REFERENCE", "target canonical ID has multiple definition candidates");
  }

  const sourceNode = nodeById.get(ref.sourceCanonicalId);
  if (!sourceNode) {
    return unresolved("REJECTED_SOURCE", [], "BROKEN_REFERENCE", "reference source is not an elected node");
  }
  const targetNode = nodeById.get(targetCanonicalId);

  // 4. Endpoint matrix. Gherkin tags author TESTED_BY from the scenario side;
  // the closed matrix orients that edge requirement -> scenario.
  let fromEndpoint = sourceNode;
  let toEndpoint = targetNode;
  if (ref.requestedEdgeType === "TESTED_BY" && sourceNode.kind === "SCENARIO" && targetNode.kind !== "SCENARIO") {
    fromEndpoint = targetNode;
    toEndpoint = sourceNode;
  }
  if (!endpointAllowed(ref.requestedEdgeType, fromEndpoint.kind, toEndpoint.kind)) {
    return unresolved(
      "FORBIDDEN_ENDPOINT",
      [],
      "FORBIDDEN_EDGE_ENDPOINT",
      `${sourceNode.kind} -[${ref.requestedEdgeType}-> ${targetNode.kind} is outside the endpoint matrix`,
    );
  }

  return {
    outcome: "RESOLVED",
    edge: {
      edgeId: ref.occurrenceId,
      from: fromEndpoint.canonicalId,
      to: toEndpoint.canonicalId,
      type: ref.requestedEdgeType,
      span: ref.span,
    },
  };
}

function unresolved(reason, candidates, diagnosticCode, message) {
  if (!REF_UNRESOLVED_REASONS.includes(reason)) throw new Error(`unknown unresolved reason ${reason}`);
  return { outcome: "UNRESOLVED", reason, candidates, diagnosticCode, message };
}

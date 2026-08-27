// Conservation and cardinality invariant checks over the assembled build
// state. Each violation yields one INVARIANT_VIOLATION message; the builder
// converts them into ERROR diagnostics and invalidates the snapshot.

export function checkInvariants(state) {
  const violations = [];
  const {
    documents,
    definitionOccurrences,
    uniqueAuthoredNodes,
    ambiguousCount,
    rejectedCount,
    referenceOccurrences,
    resolvedEdges,
    unresolvedReferences,
    headings,
    links,
  } = state;

  if (documents.accepted + documents.rejected !== documents.discovered) {
    violations.push(
      `document conservation failed: discovered=${documents.discovered} accepted=${documents.accepted} rejected=${documents.rejected}`,
    );
  }
  if (
    definitionOccurrences.total !==
    uniqueAuthoredNodes + ambiguousCount + rejectedCount
  ) {
    violations.push(
      `definition conservation failed: total=${definitionOccurrences.total} unique=${uniqueAuthoredNodes} ambiguous=${ambiguousCount} rejected=${rejectedCount}`,
    );
  }
  if (referenceOccurrences.total !== resolvedEdges.length + unresolvedReferences.length) {
    violations.push(
      `reference conservation failed: total=${referenceOccurrences.total} resolved=${resolvedEdges.length} unresolved=${unresolvedReferences.length}`,
    );
  }
  if (headings.total !== headings.array.length) {
    violations.push(`heading count mismatch: counted=${headings.total} array=${headings.array.length}`);
  }

  const outcomeCounts = { INTERNAL_HEADING: 0, INTERNAL_DOCUMENT: 0, EXTERNAL: 0, UNRESOLVED: 0 };
  for (const link of links) outcomeCounts[link.outcome] += 1;
  const outcomeSum =
    outcomeCounts.INTERNAL_HEADING +
    outcomeCounts.INTERNAL_DOCUMENT +
    outcomeCounts.EXTERNAL +
    outcomeCounts.UNRESOLVED;
  if (outcomeSum !== links.length) {
    violations.push(`link outcome conservation failed: outcomes=${outcomeSum} links=${links.length}`);
  }

  // Every resolved edge endpoint exists and is allowed by the matrix.
  for (const edge of resolvedEdges) {
    const from = state.nodeById.get(edge.from);
    const to = state.nodeById.get(edge.to);
    if (!from || !to) {
      violations.push(`edge ${edge.edgeId} references a missing endpoint`);
      continue;
    }
    if (!state.endpointAllowed(edge.type, from.kind, to.kind)) {
      violations.push(`edge ${edge.edgeId} violates the ${edge.type} endpoint matrix`);
    }
  }

  // Per-identity exactly-one rule.
  for (const [canonicalId, group] of state.groups) {
    if (group.count >= 2 && state.nodeById.has(canonicalId)) {
      violations.push(`ambiguous identity ${canonicalId} also produced an elected node`);
    }
  }

  return violations;
}

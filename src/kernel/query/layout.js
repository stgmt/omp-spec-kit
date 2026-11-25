import { localIdKind, splitCanonicalId } from "../identity.js";

const UNINDEXED_KINDS = Object.freeze(["USER_STORY", "USE_CASE", "SCENARIO"]);

export function allSpecSlugs(graph) {
  const slugs = new Set(graph.documents.map((document) => document.specSlug));
  for (const layout of graph.specLayouts ?? []) slugs.add(layout.specSlug);
  return [...slugs].sort();
}

export function completenessFor(graph, selected = []) {
  const filter = new Set(selected);
  const excludedSpecs = (graph.specLayouts ?? [])
    .filter((layout) => (layout.status !== "canonical" || layout.indexComplete === false) && (filter.size === 0 || filter.has(layout.specSlug)))
    .map((layout) => ({
      specSlug: layout.specSlug,
      layout: layout.status,
      reason: layout.status === "canonical" ? "INVALID_GHERKIN" : "SPEC_LAYOUT_INCOMPLETE",
      missingKinds: [...layout.missingKinds],
      sourceDocuments: [...layout.legacyDocuments],
    }));
  return { complete: excludedSpecs.length === 0, excludedKinds: excludedSpecs.length ? [...UNINDEXED_KINDS] : [], excludedSpecs };
}

// Absence from the new graph cannot prove absence in an unparsed old document.
export function unindexedEntity(graph, canonicalId) {
  const identity = splitCanonicalId(canonicalId);
  if (!identity || !UNINDEXED_KINDS.includes(localIdKind(identity.localId))) return null;
  const layout = (graph.specLayouts ?? []).find((candidate) => candidate.specSlug === identity.specSlug);
  if (!layout || (layout.status === "canonical" && layout.indexComplete !== false)) return null;
  const sources = new Set(layout.legacyDocuments);
  for (const document of graph.documents) {
    if (document.specSlug === identity.specSlug && ["USER_STORIES", "USE_CASES"].includes(document.documentKind)) sources.add(document.path);
  }
  return {
    kind: "unindexed-legacy-entity",
    canonicalId,
    presence: "unknown",
    reason: layout.status === "canonical" ? "INVALID_GHERKIN" : "SPEC_LAYOUT_INCOMPLETE",
    sourceDocuments: [...sources].sort(),
  };
}

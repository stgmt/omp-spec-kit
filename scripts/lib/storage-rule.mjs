// One canonical storage rule for the whole corpus: a specification lives only
// on an orphan `spec-<slug>` branch of its own project repository. The rule is
// authored once in spec-registry-service/README.md; every other mention must
// either point there or carry an explicit historical marker.

export const STORAGE_RULE_SPEC = "spec-registry-service";
export const STORAGE_RULE_DOC = "README.md";
export const STORAGE_RULE_MARKER = "Single source of truth — storage location";

// All retired-store shapes seen in the corpus, including the angle-bracket
// layout and the bare phrase that appeared in the outage scenario.
export const STALE_STORAGE_PATTERNS = Object.freeze([
  /dedicated specs repo/i,
  /one shared specs repo/i,
  /stgmt\/spec-database/i,
  /owner\/project\/\.specs/i,
  /<owner>\/<project>\/\.specs/i,
  /specs repo/i,
]);

// An incidental "archived" anywhere in a line is not enough: the marker must
// be an explicit parenthetical, or an em-dash followed by a marker word.
const HISTORICAL_MARKER = /\([^)]*\b(?:superseded|historical|archived|retired)\b[^)]*\)|—\s*(?:SUPERSEDED|HISTORICAL|ARCHIVED|RETIRED)\b/i;

export function hasCanonicalStorageRule(content) {
  return typeof content === "string" && content.includes(STORAGE_RULE_MARKER);
}

/**
 * Find retired-store mentions that neither point at the canonical rule nor
 * carry an explicit historical marker.
 *
 * @param {Array<{spec: string, doc: string, content: string}>} documents
 * @returns {Array<{spec: string, doc: string, line: number, text: string}>}
 */
export function findUnmarkedStorageMentions(documents) {
  const findings = [];
  for (const entry of documents ?? []) {
    const content = typeof entry?.content === "string" ? entry.content : "";
    for (const [index, line] of content.split("\n").entries()) {
      // The canonical rule itself names the retired store to say it is retired.
      if (line.includes(STORAGE_RULE_MARKER)) continue;
      if (!STALE_STORAGE_PATTERNS.some((pattern) => pattern.test(line))) continue;
      if (HISTORICAL_MARKER.test(line)) continue;
      findings.push({
        spec: entry.spec,
        doc: entry.doc,
        line: index + 1,
        text: line.trim(),
      });
    }
  }
  return findings;
}

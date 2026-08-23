import { createHash } from "node:crypto";
import { LOCAL_ID_ROLES } from "./types.js";

// Identity validation and canonical identity formation. Case-sensitive; no
// trimming, zero-padding correction, percent-decoding, or fuzzy matching.

export const SPEC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSpecSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && SPEC_SLUG_RE.test(slug);
}

export function localIdRole(localId) {
  if (typeof localId !== "string") return null;
  for (const role of Object.keys(LOCAL_ID_ROLES)) {
    if (LOCAL_ID_ROLES[role].re.test(localId)) return role;
  }
  return null;
}

export function localIdKind(localId) {
  const role = localIdRole(localId);
  return role === null ? null : LOCAL_ID_ROLES[role].kind;
}

export function isValidLocalId(localId) {
  return localIdRole(localId) !== null;
}

export function makeCanonicalId(specSlug, localId) {
  return `${specSlug}:${localId}`;
}

// Split only on the first ':'.
export function splitCanonicalId(canonicalId) {
  if (typeof canonicalId !== "string") return null;
  const index = canonicalId.indexOf(":");
  if (index <= 0 || index === canonicalId.length - 1) return null;
  const specSlug = canonicalId.slice(0, index);
  const rest = canonicalId.slice(index + 1);
  // Split only on the FIRST ':'; generated local IDs contain further colons.
  const secondColon = rest.indexOf(":");
  const localId =
    (rest.startsWith("DOC:") || rest.startsWith("FILE:")) && secondColon >= 0
      ? rest
      : rest.slice(0, secondColon >= 0 ? secondColon : undefined);
  if (!isValidSpecSlug(specSlug)) return null;
  if (!(isValidLocalId(localId) || isGeneratedLocalId(localId))) return null;
  return { specSlug, localId };
}

export function isValidCanonicalId(canonicalId) {
  return splitCanonicalId(canonicalId) !== null;
}

// Generated identities.
export function documentLocalId(filename) {
  return `DOC:${filename}`;
}

export function fileLocalId(normalizedPath) {
  return `FILE:${normalizedPath}`;
}

export function isGeneratedLocalId(localId) {
  return typeof localId === "string" && (localId.startsWith("DOC:") || localId.startsWith("FILE:"));
}

// Public path normalization: NFC, '/'-separated, repository-relative, no dot
// segments, no absolute form. Returns null when the input is not a safe
// public path shape.
export function normalizePublicPath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.length === 0) return null;
  const nfc = inputPath.normalize("NFC");
  if (/^[A-Za-z]:[\\/]/u.test(nfc)) return null;
  const replaced = nfc.split("\\").join("/");
  if (replaced.startsWith("/") || replaced.endsWith("/")) return null;
  if (/\/\/+/u.test(replaced)) return null;
  for (const segment of replaced.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return null;
    if (/[\u0000-\u001f]/u.test(segment)) return null;
  }
  return replaced;
}

export function sha256Hex(bytesOrString) {
  return createHash("sha256").update(bytesOrString).digest("hex");
}

const REFERENCE_TARGET_RE =
  /(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?(?:US|UC|RF|RISK|FR|DEC|TASK|FC)-[1-9][0-9]*|(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?AC-[1-9][0-9]*\.[1-9][0-9]*|(?:[a-z0-9]+(?:-[a-z0-9]+)*:)?NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*/gu;

// Extract a valid authored/qualified reference target embedded in arbitrary
// token text (e.g. inside a Markdown link). Returns { target, index } or null.
export function extractReferenceTarget(text) {
  if (typeof text !== "string") return null;
  if (localIdRole(text) !== null || isGeneratedLocalId(text)) return { target: text, index: 0 };
  for (const match of text.matchAll(REFERENCE_TARGET_RE)) {
    const candidate = match[0];
    const qualified = candidate.includes(":");
    const valid = qualified ? isValidCanonicalId(candidate) : localIdKind(candidate) !== null;
    if (valid) return { target: candidate, index: match.index };
  }
  return null;
}

export const SECRET_PATTERNS = Object.freeze([
  ["authorization", /\b(?:proxy-)?authorization\s*:\s*(?:bearer|basic|token)\s+[^\s"']+/iu],
  ["bearer-token", /\b(?:bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/iu],
  ["cookie", /\b(?:set-)?cookie\s*:\s*[^;\r\n=]+=[^;\r\n]+/iu],
  ["pem-private-key", /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u],
  ["generic-secret", /\b(?:(?:[A-Za-z][A-Za-z0-9]*[_-])+)?(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|credential)\s*[:=]\s*[^\s"']+/iu],
  ["known-secret", /\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{12,})\b/u],
]);

export function detectSecret(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  for (const [category, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

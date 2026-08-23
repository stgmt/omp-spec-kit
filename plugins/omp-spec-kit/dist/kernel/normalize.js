import { createHash } from "node:crypto";

// Content normalization, canonical JSON, hashing. Pure; no locale or clock input.

export class NormalizationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const decoder = new TextDecoder("utf-8", { fatal: true });

// Decode exact bytes as strict UTF-8, strip a leading UTF-8 BOM, and normalize
// CRLF/CR line endings to LF for parsing. Original bytes are hashed separately.
export function normalizeSourceBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new NormalizationError("INVALID_UTF8", "source is not a Uint8Array");
  }
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new NormalizationError("INVALID_UTF8", "source bytes are not valid UTF-8");
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  return text.replace(/\r\n?/gu, "\n");
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalize(item))).join(",")}]`;
  }
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

// Canonical JSON: object keys sorted lexicographically at every level.
export function canonicalJson(value) {
  return canonicalize(value);
}

export function stableStringify(value) {
  return canonicalJson(value);
}

// UTF-8 byte length of a string.
export function byteLength(text) {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i);
    if (code > 0xffff) i += 1;
    if (code < 0x80) total += 1;
    else if (code < 0x800) total += 2;
    else if (code < 0x10000) total += 3;
    else total += 4;
  }
  return total;
}

// Unicode code point comparison (not UTF-16 unit order).
export function compareCodePoints(a, b) {
  if (a === b) return 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const ca = a.codePointAt(i);
    const cb = b.codePointAt(i);
    if (ca !== cb) return ca < cb ? -1 : 1;
    if (ca > 0xffff) i += 1; // surrogate pair consumed as one scalar in both
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

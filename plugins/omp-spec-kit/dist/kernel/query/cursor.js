// Fingerprint-bound opaque cursor codec. Integrity-protected by a checksum,
// not a secret. Payload is ASCII-safe base64url JSON plus a 16-hex checksum.

import { createHash } from "node:crypto";

function checksum(json) {
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

// payload must be a plain object of ASCII-safe scalar values/arrays.
export function encodeCursor(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  return `${body}.${checksum(json)}`;
}

// Returns { ok: true, payload } or { ok: false, code: "INVALID_CURSOR" }.
export function decodeCursor(cursor, maxBytes) {
  if (typeof cursor !== "string" || cursor.length === 0) {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  if (Buffer.byteLength(cursor, "ascii") !== cursor.length || cursor.length > maxBytes) {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  const dot = cursor.lastIndexOf(".");
  if (dot <= 0 || dot === cursor.length - 1) return { ok: false, code: "INVALID_CURSOR" };
  const body = cursor.slice(0, dot);
  const mac = cursor.slice(dot + 1);
  let json;
  try {
    json = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  if (checksum(json) !== mac) return { ok: false, code: "INVALID_CURSOR" };
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  if (payload === null || typeof payload !== "object") return { ok: false, code: "INVALID_CURSOR" };
  return { ok: true, payload };
}

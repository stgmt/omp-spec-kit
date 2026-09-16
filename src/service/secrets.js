import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Credential sealing for per-project repo bindings (TASK-17): a bound
 * repository's git token must survive restarts but never sit in plaintext in
 * the store, a log line, or an API response. AES-256-GCM with a key derived
 * from SPEC_REGISTRY_SECRETS_KEY; the seal is self-authenticating so a
 * tampered store row fails decryption instead of yielding a wrong token.
 */
export function secretsKeyFromEnv(env = process.env) {
  const raw = env.SPEC_REGISTRY_SECRETS_KEY;
  if (typeof raw !== "string" || raw.trim().length < 16) return null;
  return createHash("sha256").update(raw.trim(), "utf8").digest();
}

export function sealSecret(key, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

export function openSecret(key, sealed) {
  const enc = JSON.parse(sealed);
  if (enc?.v !== 1) throw new Error("unsupported sealed secret version");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, "base64")), decipher.final()]).toString("utf8");
}

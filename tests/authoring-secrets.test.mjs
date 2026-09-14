import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectSecret } from "../src/authoring/secrets.js";

describe("secret detection", () => {
  it("accepts documented header placeholders", () => {
    for (const text of [
      "Authorization: Bearer <credential>",
      "Authorization: Bearer ${SPEC_REGISTRY_TOKEN}",
      'headers: { "Authorization": "Bearer {{token}}" }',
      "authorization: basic <base64>",
    ]) {
      assert.equal(detectSecret(text), null, `expected no match: ${text}`);
    }
  });

  it("still flags real credentials in headers", () => {
    assert.equal(detectSecret("Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"), "authorization");
    assert.equal(detectSecret("Authorization: Bearer aVeryLongRealLookingCredentialValue123"), "authorization");
    assert.equal(detectSecret("Proxy-Authorization: basic dXNlcjpwYXNzd29yZA=="), "authorization");
  });

  it("keeps the other categories intact", () => {
    assert.equal(detectSecret(`ghp_${"A".repeat(36)}`), "known-secret");
    assert.equal(detectSecret("api_key: 0123456789abcdef"), "generic-secret");
    assert.equal(detectSecret("Set-Cookie: session=abcdef123456"), "cookie");
    assert.equal(detectSecret("-----BEGIN RSA PRIVATE KEY-----"), "pem-private-key");
    assert.equal(detectSecret("no credentials here at all"), null);
  });
});

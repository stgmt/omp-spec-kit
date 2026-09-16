import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repoHostAllowed } from "../../../src/service/mounts.js";
import { openSecret, sealSecret, secretsKeyFromEnv } from "../../../src/service/secrets.js";

describe("repoHostAllowed — SSRF policy for bound spec repos", () => {
  it("accepts https on public hosts", () => {
    assert.equal(repoHostAllowed("https://github.com/user/specs.git").ok, true);
  });

  it("refuses http on public hosts but tolerates it on private ones", () => {
    assert.equal(repoHostAllowed("http://git.example.com/x.git").ok, false);
    assert.equal(repoHostAllowed("http://spec-git/x.git").ok, true);
    assert.equal(repoHostAllowed("http://127.0.0.1:9418/x.git").ok, true);
    assert.equal(repoHostAllowed("git://spec-git/x.git").ok, true);
  });

  it("refuses non-git schemes and malformed urls", () => {
    assert.equal(repoHostAllowed("ssh://git@github.com/x.git").ok, false);
    assert.equal(repoHostAllowed("ftp://x/y").ok, false);
    assert.equal(repoHostAllowed("not a url").ok, false);
  });

  it("narrows public hosts to repoPolicy.allowedHosts when configured", () => {
    const policy = ["github.com"];
    assert.equal(repoHostAllowed("https://github.com/u/r.git", policy).ok, true);
    assert.equal(repoHostAllowed("https://gitlab.com/u/r.git", policy).ok, false);
    // Private hosts stay reachable — they are already inside the perimeter.
    assert.equal(repoHostAllowed("http://spec-git/x.git", policy).ok, true);
  });

  it("keeps file:// opt-in via an explicit allowlist entry", () => {
    assert.equal(repoHostAllowed("file:///srv/git/x.git").ok, false);
    assert.equal(repoHostAllowed("file:///srv/git/x.git", ["file"]).ok, true);
    assert.equal(repoHostAllowed("file:///srv/git/x.git", ["github.com"]).ok, false);
  });
});

describe("credential sealing (AES-256-GCM)", () => {
  const key = secretsKeyFromEnv({ SPEC_REGISTRY_SECRETS_KEY: "test-key-material-0001" });

  it("round-trips a token", () => {
    const sealed = sealSecret(key, "ghp_secret-value");
    assert.ok(!sealed.includes("ghp_secret-value"));
    assert.equal(openSecret(key, sealed), "ghp_secret-value");
  });

  it("never emits the same seal twice (random iv)", () => {
    assert.notEqual(sealSecret(key, "same"), sealSecret(key, "same"));
  });

  it("fails closed on tampered payloads and wrong keys", () => {
    const sealed = JSON.parse(sealSecret(key, "value"));
    const tampered = JSON.stringify({ ...sealed, data: Buffer.from("forged").toString("base64") });
    assert.throws(() => openSecret(key, tampered));
    const otherKey = secretsKeyFromEnv({ SPEC_REGISTRY_SECRETS_KEY: "a-different-key-0002" });
    assert.throws(() => openSecret(otherKey, JSON.stringify(sealed)));
  });

  it("refuses short or missing key material", () => {
    assert.equal(secretsKeyFromEnv({ SPEC_REGISTRY_SECRETS_KEY: "short" }), null);
    assert.equal(secretsKeyFromEnv({}), null);
  });
});

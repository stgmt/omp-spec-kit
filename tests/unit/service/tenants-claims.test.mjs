import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClaimStore } from "../../../src/service/claims.js";
import { parseTenants, resolveTenantScopes, TenantConfigError } from "../../../src/service/tenants.js";
import { parseAuthConfig, AuthConfigError } from "../../../src/service/auth.js";

describe("claim store", () => {
  it("grants, renews, and releases a lease", () => {
    const claims = createClaimStore();
    const first = claims.claim({ project: "a/b", spec: "spec-x", holder: "alice", ttlMinutes: 30 });
    assert.equal(first.holder, "alice");
    assert.equal(typeof first.expiresAt, "string");
    const renewed = claims.claim({ project: "a/b", spec: "spec-x", holder: "alice", ttlMinutes: 5 });
    assert.equal(renewed.holder, "alice");
    const released = claims.release({ project: "a/b", spec: "spec-x", holder: "alice" });
    assert.equal(released.released, true);
    assert.equal(claims.get("a/b", "spec-x"), null);
  });

  it("refuses a second holder with CLAIM_HELD naming holder and expiry", () => {
    const claims = createClaimStore();
    claims.claim({ project: "a/b", spec: "spec-x", holder: "alice" });
    assert.throws(() => claims.claim({ project: "a/b", spec: "spec-x", holder: "bob" }), (error) => {
      assert.equal(error.code, "CLAIM_HELD");
      assert.equal(error.holder, "alice");
      assert.equal(typeof error.expiresAt, "string");
      return true;
    });
  });

  it("expires leases without manual action and refuses foreign release", () => {
    const claims = createClaimStore();
    claims.claim({ project: "a/b", spec: "spec-x", holder: "alice", ttlMinutes: 1 });
    const record = claims.get("a/b", "spec-x");
    record.expiresAtMs = Date.now() - 1;
    assert.equal(claims.get("a/b", "spec-x"), null);
    claims.claim({ project: "a/b", spec: "spec-y", holder: "alice" });
    const foreign = claims.release({ project: "a/b", spec: "spec-y", holder: "bob" });
    assert.equal(foreign.released, false);
    assert.equal(foreign.reason, "CLAIM_HELD");
  });
});

describe("tenant definitions", () => {
  const tenants = parseTenants([
    { tenant: "alpha", projects: ["stgmt/a", "stgmt/b"], hubGroups: ["spec-alpha"] },
    { tenant: "beta", projects: ["acme/c"], hubGroups: ["spec-beta"], defaultProject: "acme/c" },
  ]);

  it("resolves scopes by group intersection with exact default rules", () => {
    const alpha = resolveTenantScopes(["spec-alpha", "All Users"], tenants);
    assert.deepEqual(alpha.matched, ["alpha"]);
    assert.deepEqual(alpha.scopes, ["stgmt/a", "stgmt/b"]);
    assert.equal(alpha.defaultScope, null, "several scopes without a default must not resolve a default");
    const beta = resolveTenantScopes(["spec-beta"], tenants);
    assert.deepEqual(beta.scopes, ["acme/c"]);
    assert.equal(beta.defaultScope, "acme/c");
    const both = resolveTenantScopes(["spec-alpha", "spec-beta"], tenants);
    assert.deepEqual(both.scopes, ["stgmt/a", "stgmt/b", "acme/c"], "multiple tenants union their scopes");
    assert.equal(both.defaultScope, null);
    const none = resolveTenantScopes(["All Users"], tenants);
    assert.deepEqual(none.matched, []);
  });

  it("rejects misconfigured tenants", () => {
    assert.throws(() => parseTenants([{ tenant: "x", projects: [], hubGroups: ["g"] }]), TenantConfigError);
    assert.throws(() => parseTenants([{ tenant: "x", projects: ["a/b"], hubGroups: [] }]), TenantConfigError);
    assert.throws(() => parseTenants([{ tenant: "x", projects: ["a/b"], hubGroups: ["g"], defaultProject: "c/d" }]), TenantConfigError);
    assert.throws(() => parseTenants([
      { tenant: "x", projects: ["a/b"], hubGroups: ["g"] },
      { tenant: "x", projects: ["c/d"], hubGroups: ["h"] },
    ]), TenantConfigError);
  });
});

describe("auth configuration", () => {
  const valid = {
    youtrack: { baseUrl: "https://youtrack.example.com", serviceToken: "service-token-1234567890" },
    appBridge: { token: "bridge-token-1234567890" },
    roleGroups: { owner: ["spec-owners"], writer: ["spec-writers"], reader: ["spec-readers"] },
  };

  it("accepts a valid block and strips trailing slashes", () => {
    const parsed = parseAuthConfig({ ...valid, youtrack: { ...valid.youtrack, baseUrl: "https://youtrack.example.com/" } });
    assert.equal(parsed.youtrack.baseUrl, "https://youtrack.example.com");
    assert.deepEqual(parsed.roleGroups.reader, ["spec-readers"]);
  });

  it("requires https for public hosts but allows private ones", () => {
    assert.throws(() => parseAuthConfig({ ...valid, youtrack: { ...valid.youtrack, baseUrl: "http://youtrack.example.com" } }), AuthConfigError);
    const privateHost = parseAuthConfig({ ...valid, youtrack: { ...valid.youtrack, baseUrl: "http://youtrack:8080" } });
    assert.equal(privateHost.youtrack.baseUrl, "http://youtrack:8080");
    assert.doesNotThrow(() => parseAuthConfig({ ...valid, youtrack: { ...valid.youtrack, baseUrl: "http://localhost:8080" } }));
  });

  it("refuses missing or too-short credentials and empty role groups", () => {
    assert.throws(() => parseAuthConfig(undefined), AuthConfigError);
    assert.throws(() => parseAuthConfig({ ...valid, appBridge: { token: "short" } }), AuthConfigError);
    assert.throws(() => parseAuthConfig({ ...valid, youtrack: { baseUrl: "https://x.example.com", serviceToken: "short" } }), AuthConfigError);
    assert.throws(() => parseAuthConfig({ ...valid, roleGroups: { owner: [], writer: [], reader: [] } }), AuthConfigError);
  });
});

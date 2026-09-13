import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClaimStore } from "../../../src/service/claims.js";
import { createTenantDirectory, contextFor } from "../../../src/service/tenants.js";
import { TenantConfigError } from "../../../src/service/tenants.js";

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

describe("tenant directory", () => {
  const tenants = createTenantDirectory({
    tenants: [
      { token: "token-alpha-123456", tenant: "alpha", projects: ["stgmt/a", "stgmt/b"] },
      { token: "token-beta-1234567", tenant: "beta", projects: ["acme/c"], defaultProject: "acme/c" },
    ],
  });

  it("resolves token to tenant, scopes, and default", () => {
    const record = tenants.resolve("token-alpha-123456");
    assert.equal(record.tenant, "alpha");
    assert.deepEqual(record.projects, ["stgmt/a", "stgmt/b"]);
    assert.equal(record.defaultProject, null);
    const beta = tenants.resolve("token-beta-1234567");
    assert.equal(beta.defaultProject, "acme/c");
  });

  it("keeps only the token hash and refuses unknown tokens", () => {
    assert.equal(tenants.resolve("nope"), null);
    assert.equal(tenants.resolve(null), null);
  });

  it("builds the caller context with asserted identity", () => {
    const ctx = contextFor(tenants.resolve("token-alpha-123456"), "stigm");
    assert.deepEqual(ctx, { tenant: "alpha", scopes: ["stgmt/a", "stgmt/b"], defaultScope: null, identity: "stigm" });
    assert.equal(contextFor(tenants.resolve("token-alpha-123456"), "").identity, null);
  });

  it("rejects misconfigured tenants", () => {
    assert.throws(() => createTenantDirectory({ tenants: [{ token: "short", tenant: "x", projects: ["a/b"] }] }), TenantConfigError);
    assert.throws(() => createTenantDirectory({ tenants: [{ token: "token-aaaa-12345", tenant: "x", projects: [] }] }), TenantConfigError);
    assert.throws(() => createTenantDirectory({ tenants: [{ token: "token-aaaa-12345", tenant: "x", projects: ["a/b"], defaultProject: "c/d" }] }), TenantConfigError);
    assert.throws(() => createTenantDirectory({ tenants: [
      { token: "token-aaaa-12345", tenant: "x", projects: ["a/b"] },
      { token: "token-aaaa-12345", tenant: "y", projects: ["c/d"] },
    ] }), TenantConfigError);
  });
});

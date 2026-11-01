import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { buildRegistryIndex } from "../../src/service/registry.js";
import { closeScopedServices, content, restGet, rpc, setupScopedService } from "./lib/scoped-service.mjs";

after(closeScopedServices);

const ALPHA_ONLY = [
  { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" },
];
const BOTH_TENANTS = [
  { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" },
  { tenant: "beta", projects: ["stgmt/beta"], hubGroups: ["spec-beta"], defaultProject: "stgmt/beta" },
];

describe("every surface that returns project data obeys the caller's scopes", () => {
  it("the duplicated listing routes are gone: /registry and /drift answer 404", async () => {
    const { api, tokens } = await setupScopedService({ tenants: ALPHA_ONLY });
    for (const route of ["/registry", "/drift"]) {
      const gone = await restGet(api, route, tokens.alice);
      assert.equal(gone.status, 404, route + " must not be served: spec_registry and spec_drift over MCP are the only listings");
    }
  });

  it("GET /status returns only the caller's projects", async () => {
    const { api, tokens } = await setupScopedService({ tenants: ALPHA_ONLY });
    const scoped = await restGet(api, "/status", tokens.alice);
    assert.equal(scoped.status, 200);
    assert.deepEqual(scoped.json.projects.map((entry) => entry.project), ["stgmt/alpha"]);
  });

  it("a two-scope caller still sees both projects over MCP, so the filter is scoping and not an empty registry", async () => {
    const { url, tokens } = await setupScopedService({ tenants: BOTH_TENANTS });
    const both = await content(url, tokens.frank, "spec_registry", {});
    assert.equal(both.ok, true, JSON.stringify(both.error ?? {}));
    assert.deepEqual(both.data.projects.map((entry) => entry.id).sort(), ["stgmt/alpha", "stgmt/beta"]);
  });

  it("refuses the retired X-Spec-Project header instead of silently honouring it", async () => {
    const { url, tokens } = await setupScopedService({ tenants: BOTH_TENANTS });
    const { status, json } = await rpc(
      url,
      tokens.alice,
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "spec_registry", arguments: {} } },
      { "x-spec-project": "stgmt/beta" },
    );
    assert.equal(status, 400);
    assert.match(JSON.stringify(json), /PROJECT_HEADER_REMOVED/u);
  });

  it("a header-free call still resolves through the caller's session project", async () => {
    const { url, tokens } = await setupScopedService({ tenants: ALPHA_ONLY });
    const served = await content(url, tokens.alice, "spec_registry", {});
    assert.equal(served.ok, true, JSON.stringify(served.error ?? {}));
    assert.deepEqual(served.data.projects.map((entry) => entry.id), ["stgmt/alpha"]);
  });
});

describe("scope is a required argument, never an implicit 'everything'", () => {
  it("buildRegistryIndex refuses to run without a scope", async () => {
    const mounts = {
      projects: ["stgmt/alpha", "stgmt/beta"],
      projectRoot: async () => {
        throw new Error("mounts must not be touched when the scope is missing");
      },
    };
    await assert.rejects(
      () => buildRegistryIndex({ mounts, claims: { get: () => null }, ledger: { getLedger: () => [] } }),
      /SCOPE_REQUIRED/u,
    );
  });

  it("the drift report refuses to run without a scope", async () => {
    const { service } = await setupScopedService({ tenants: ALPHA_ONLY });
    await assert.rejects(() => service.driftReport(), /SCOPE_REQUIRED/u);
  });
});

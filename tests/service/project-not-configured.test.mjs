import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDispatcher } from "../../src/service/dispatch.js";
import { scopeFromContext } from "../../src/service/scope.js";
import { TOOL_CONTRACTS } from "../../src/adapters/tool-contracts.js";

describe("dispatcher PROJECT_NOT_CONFIGURED refusal", () => {
  it("refuses before any serviceFor call when requireConfigured throws it", async () => {
    let serviceForCalled = false;
    const dispatcher = createDispatcher({
      mounts: {
        requireConfigured: () => { throw { code: "PROJECT_NOT_CONFIGURED", message: "project not configured" }; },
        requireRepoReady: () => {},
        serviceFor: () => { serviceForCalled = true; return { runQuery: () => ({ ok: true }) }; },
      },
      serviceContracts: TOOL_CONTRACTS,
    });
    const ctx = { role: "reader", scopes: ["stgmt/unbound"], identity: { login: "alice" }, defaultScope: null };
    const res = await dispatcher.callTool({
      tool: "spec_catalog",
      args: { schemaVersion: "spec-kernel@2", project: "stgmt/unbound", view: "specs" },
      ctx: { ...ctx, scope: scopeFromContext(ctx) },
    });
    assert.equal(res.envelope.ok, false, "must refuse");
    assert.equal(res.envelope.error.code, "PROJECT_NOT_CONFIGURED");
    assert.equal(res.envelope.error.parameter, "project");
    assert.equal(serviceForCalled, false, "must not reach corpus access");
  });
});

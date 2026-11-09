import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { REPO_CONTRACTS } from "../../src/service/ops/repos.js";
import { closeScopedServices, content, setupScopedService as setup, tools } from "./lib/scoped-service.mjs";

after(closeScopedServices);
describe("authorized discovery is bounded by the caller's scopes", () => {
  it("opts into all authorized projects without changing default or explicit selection", async () => {
    const { url, tokens } = await setup({
      projects: ["stgmt/alpha", "stgmt/beta", "stgmt/gamma"],
      tenants: [
        { tenant: "alpha", projects: ["stgmt/alpha", "stgmt/beta"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" },
        { tenant: "beta", projects: ["stgmt/gamma"], hubGroups: ["spec-beta"], defaultProject: "stgmt/gamma" },
      ],
    });
    const ids = (result) => result.data.projects.map((entry) => entry.id).sort();
    const defaultResult = await content(url, tokens.alice, "spec_registry", {});
    assert.equal(defaultResult.ok, true);
    assert.deepEqual(ids(defaultResult), ["stgmt/alpha"]);
    const disabled = await content(url, tokens.alice, "spec_registry", { allProjects: false });
    assert.deepEqual(ids(disabled), ["stgmt/alpha"]);
    const explicit = await content(url, tokens.alice, "spec_registry", { project: "stgmt/beta" });
    assert.deepEqual(ids(explicit), ["stgmt/beta"]);
    const all = await content(url, tokens.alice, "spec_registry", { allProjects: true });
    assert.equal(all.ok, true);
    assert.deepEqual(ids(all), ["stgmt/alpha", "stgmt/beta"]);
    assert.doesNotMatch(JSON.stringify(all.data), /stgmt\/gamma|stgmt-gamma\.git/u);
    const forbidden = await content(url, tokens.alice, "spec_registry", { project: "stgmt/gamma" });
    assert.equal(forbidden.error.code, "PROJECT_NOT_ALLOWED");
    const conflicting = await content(url, tokens.alice, "spec_registry", { project: "stgmt/alpha", allProjects: true });
    assert.equal(conflicting.ok, false);
    assert.equal(conflicting.error.code, "INVALID_REQUEST");
    const invalid = await content(url, tokens.alice, "spec_registry", { allProjects: "true" });
    assert.equal(invalid.ok, false);
    const listedTools = await tools(url, tokens.alice);
    const registry = listedTools.find((entry) => entry.name === "spec_registry");
    assert.equal(registry.inputSchema.properties.allProjects.type, "boolean");
  });

  it("lists authorized projects when the default project has no repository binding", async () => {
    const { url, tokens } = await setup({
      unbound: ["stgmt/alpha"],
      tenants: [{ tenant: "alpha", projects: ["stgmt/alpha", "stgmt/beta"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" }],
    });
    const all = await content(url, tokens.alice, "spec_registry", { allProjects: true });
    assert.equal(all.ok, true);
    assert.deepEqual(all.data.projects.map((entry) => entry.id).sort(), ["stgmt/alpha", "stgmt/beta"]);
    assert.equal(all.data.projects.find((entry) => entry.id === "stgmt/alpha").repository.bound, false);
    assert.ok(Array.isArray(all.data.projects.find((entry) => entry.id === "stgmt/beta").specs));
  });

  it("returns only the caller's project from spec_registry and spec_drift, never another tenant's repository", async () => {
    const { url, repos, tokens } = await setup({
      tenants: [
        { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" },
        { tenant: "beta", projects: ["stgmt/beta"], hubGroups: ["spec-beta"], defaultProject: "stgmt/beta" },
      ],
    });
    const alphaOnly = await content(url, tokens.alice, "spec_registry", {});
    assert.equal(alphaOnly.ok, true, JSON.stringify(alphaOnly.error ?? {}));
    assert.deepEqual(alphaOnly.data.projects.map((entry) => entry.id), ["stgmt/alpha"]);
    assert.equal(alphaOnly.data.projects[0].repository.status, "active");
    assert.doesNotMatch(JSON.stringify(alphaOnly.data), /stgmt\/beta/u, "no metadata about the other project");

    const drift = await content(url, tokens.alice, "spec_drift", {});
    assert.equal(drift.ok, true, JSON.stringify(drift.error ?? {}));
    assert.ok(drift.data.events.every((event) => event.project === "stgmt/alpha"), `unexpected project in drift: ${JSON.stringify(drift.data.events).slice(0, 300)}`);
    assert.doesNotMatch(JSON.stringify(drift.data), /stgmt-beta\.git/u, "no repository URL from outside the caller's scopes");

    // The same service does hold beta: the two-scope caller sees both, so the
    // missing beta above is scope filtering, not an empty registry.
    const both = await content(url, tokens.frank, "spec_registry", {});
    assert.deepEqual(both.data.projects.map((entry) => entry.id).sort(), ["stgmt/alpha", "stgmt/beta"]);

    const outOfScope = await content(url, tokens.alice, "spec_registry", { project: "stgmt/beta" });
    assert.equal(outOfScope.ok, false);
    assert.equal(outOfScope.error.code, "PROJECT_NOT_ALLOWED");
    assert.match(repos["stgmt/beta"].url, /stgmt-beta\.git/u);
  });

  it("refuses a B-scoped caller every probe and read of A", async () => {
    // Same service, mirrored tenant mapping: alice is scoped to stgmt/beta
    // only, so her allowed set never contains alpha.
    const { url, repos, tokens } = await setup({
      tenants: [
        { tenant: "alpha", projects: ["stgmt/beta"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/beta" },
        { tenant: "beta", projects: ["stgmt/alpha"], hubGroups: ["spec-beta"], defaultProject: "stgmt/alpha" },
      ],
    });
    const listed = await content(url, tokens.alice, "spec_registry", {});
    assert.deepEqual(listed.data.projects.map((entry) => entry.id), ["stgmt/beta"]);

    const read = await content(url, tokens.alice, "spec_catalog", { project: "stgmt/alpha", view: "specs" });
    assert.equal(read.ok, false);
    assert.equal(read.error.code, "PROJECT_NOT_ALLOWED");

    const probe = await content(url, tokens.alice, "spec_repo", {
      action: "probe",
      project: "stgmt/alpha",
      repoUrl: repos["stgmt/alpha"].url,
      token: "irrelevant",
    });
    assert.equal(probe.ok, false);
    assert.equal(probe.error.code, "PROJECT_NOT_ALLOWED", "refused by scope, before any repository access");

    const bindings = await content(url, tokens.alice, "spec_repo", { action: "bindings" });
    assert.deepEqual(bindings.data.bindings.map((entry) => entry.project), ["stgmt/beta"]);
  });
});

describe("repository binding over MCP", () => {
  it("refuses a reader on every mutating variant and annotates each variant honestly", async () => {
    const { url, repos, tokens } = await setup();
    for (const action of ["bind", "unbind"]) {
      const refused = await content(url, tokens.bob, "spec_repo", {
        action,
        project: "stgmt/alpha",
        ...(action === "bind" ? { repoUrl: repos["stgmt/alpha"].url, token: "reader-token" } : {}),
      });
      assert.equal(refused.ok, false, `${action} must refuse a reader`);
      assert.match(refused.error.message, /requires writer role/u);
    }
    // probe is a read variant: the role gate passes, and the repository
    // service refuses the reader before it touches the remote.
    const probe = await content(url, tokens.bob, "spec_repo", { action: "probe", project: "stgmt/alpha", repoUrl: repos["stgmt/alpha"].url, token: "reader-token" });
    assert.equal(probe.ok, false);
    assert.equal(probe.error.code, "FORBIDDEN_ROLE");

    const [contract] = REPO_CONTRACTS;
    assert.equal(contract.variants.bind.annotations.readOnlyHint, false);
    assert.equal(contract.variants.unbind.annotations.readOnlyHint, false);
    assert.equal(contract.variants.probe.annotations.readOnlyHint, true);
    assert.equal(contract.variants.bindings.annotations.readOnlyHint, true);

    const advertised = (await tools(url, tokens.bob)).find((tool) => tool.name === "spec_repo");
    assert.ok(advertised, "spec_repo must be advertised");
    assert.equal(advertised.annotations.readOnlyHint, false, "a tool carrying mutating variants is not read-only");
    assert.equal(advertised.annotations.destructiveHint, true);
  });

  it("binds through the MCP operation and flips mcp_preflight to mutationReady", async () => {
    const { url, repos, tokens } = await setup({ unbound: ["stgmt/beta"] });

    const before = await content(url, tokens.alice, "mcp_preflight", { project: "stgmt/beta" });
    assert.equal(before.ok, true, JSON.stringify(before.error ?? {}));
    assert.equal(before.data.setup.required, true);
    assert.equal(before.data.setup.code, "REPO_BINDING_REQUIRED");
    assert.equal(before.data.setup.action.tool, "spec_repo", "setup names the MCP call, not only the operator route");
    assert.equal(before.data.setup.action.arguments.project, "stgmt/beta");
    assert.equal(before.data.setup.operator, undefined, "no REST bind mirror is advertised");
    assert.match(before.data.setup.command, /^call spec_repo/u, "the setup command is the tool call");
    assert.equal(before.data.mutationReady, false);

    // An unbound project never answers with another project's catalog.
    const refused = await content(url, tokens.alice, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "SETUP_REQUIRED");
    assert.match(refused.error.message, /spec_repo \{"action":"bind"/u, "the refusal carries the MCP action");
    assert.doesNotMatch(refused.error.message, /POST \/repos\/bind/u, "the REST bind mirror is gone, so it is never advertised");

    const bound = await content(url, tokens.alice, "spec_repo", {
      action: "bind",
      project: "stgmt/beta",
      repoUrl: repos["stgmt/beta"].url,
      token: "byo-token",
      requestId: "scope-bind-beta",
    });
    assert.equal(bound.ok, true, JSON.stringify(bound.error ?? {}));
    assert.equal(bound.data.binding.status, "active");

    const after = await content(url, tokens.alice, "mcp_preflight", { project: "stgmt/beta" });
    assert.equal(after.data.setup.required, false);
    assert.equal(after.data.mutationReady, true, JSON.stringify(after.data));

    const catalog = await content(url, tokens.alice, "spec_catalog", { project: "stgmt/beta", view: "specs" });
    assert.equal(catalog.ok, true, JSON.stringify(catalog.error ?? {}));
    assert.deepEqual(catalog.data.specs, [repos["stgmt/beta"].spec]);
  });

  it("refuses an ambiguous selection instead of choosing one project", async () => {
    const { url, tokens } = await setup({
      tenants: [{ tenant: "alpha", projects: ["stgmt/alpha", "stgmt/beta"], hubGroups: ["spec-alpha"], defaultProject: null }],
    });
    const refused = await content(url, tokens.alice, "spec_catalog", { view: "specs" });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "PROJECT_SELECTION_REQUIRED");
    assert.deepEqual(refused.error.candidates.sort(), ["stgmt/alpha", "stgmt/beta"]);
  });

  it("reports an unknown project as unconfigured instead of binding it", async () => {
    const { url, repos, tokens } = await setup();
    const refused = await content(url, tokens.alice, "spec_repo", {
      action: "bind",
      project: "stgmt/ghost",
      repoUrl: repos["stgmt/alpha"].url,
      token: "byo-token",
    });
    assert.equal(refused.ok, false);
    assert.ok(["PROJECT_NOT_ALLOWED", "PROJECT_NOT_CONFIGURED"].includes(refused.error.code), JSON.stringify(refused.error));
  });
});

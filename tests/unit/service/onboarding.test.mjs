import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ONBOARDING_TOKEN_NAME, buildManagedSnippet, createOnboarding, OnboardingError } from "../../../src/service/onboarding.js";

const CONFIG = Object.freeze({
  auth: { youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" } },
});
const CTX = { identity: { login: "alice" }, role: "writer", tenant: "alpha" };
const SERVICES = { services: [{ id: "0-0-0-0-0", applicationName: "Hub" }, { id: "1-2-3-4-5", applicationName: "YouTrack" }] };

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null, authorization: init.headers?.authorization ?? null });
    const route = routes.find((candidate) => url.includes(candidate.match) && (candidate.method ?? "GET") === method);
    if (!route) throw new Error(`unexpected call: ${method} ${url}`);
    if (route.throws) throw new Error(route.throws);
    const status = route.status ?? 200;
    return {
      ok: status < 400,
      status,
      json: async () => route.json ?? null,
      text: async () => route.text ?? "",
    };
  };
  return { impl, calls };
}

describe("onboarding (TASK-8): mints the caller's YouTrack token", () => {
  it("resolves the caller, scopes to every Hub service and returns a ready snippet", async () => {
    const audited = [];
    const { impl, calls } = fakeFetch([
      { match: "/users?query=login:alice", json: { users: [{ id: "u-1", login: "alice", banned: false }] } },
      { match: "/services", json: SERVICES },
      { match: "/users/u-1/permanenttokens?fields=id,name", json: { permanenttokens: [] } },
      { match: "/users/u-1/permanenttokens?fields=id,name,token", method: "POST", json: { id: "t-new", name: ONBOARDING_TOKEN_NAME, token: "perm-abc123" } },
    ]);
    const onboarding = createOnboarding({ config: CONFIG, audit: (entry) => audited.push(entry), fetchImpl: impl });

    const result = await onboarding.issueToken({ ctx: CTX, serviceUrl: "http://127.0.0.1:8642/" });

    assert.equal(result.token, "perm-abc123");
    assert.equal(result.url, "http://127.0.0.1:8642/mcp");
    const snippet = JSON.parse(result.mcpJson);
    assert.equal(snippet.mcpServers["omp-spec-kit"].type, "http");
    assert.equal(snippet.mcpServers["omp-spec-kit"].url, "http://127.0.0.1:8642/mcp");
    assert.equal(snippet.mcpServers["omp-spec-kit"].headers.Authorization, "Bearer perm-abc123");

    const mint = calls.find((call) => call.method === "POST");
    assert.equal(mint.body.name, ONBOARDING_TOKEN_NAME, "the token name is the stable onboarding purpose name");
    assert.deepEqual(mint.body.scope, [{ id: "0-0-0-0-0" }, { id: "1-2-3-4-5" }], "the scope must cover every Hub service");
    assert.ok(
      calls.every((call) => call.authorization === "Bearer service-token-1234567890"),
      "every YouTrack call must use the service token, never the caller's",
    );
    assert.equal(audited.length, 1);
    assert.equal(audited[0].login, "alice");
    assert.equal(audited[0].op, "onboarding");
    assert.ok(!JSON.stringify(audited[0]).includes("perm-abc123"), "the issued token value must never be audited");
  });

  it("revokes a previous token with the same name before minting, so calls do not pile up", async () => {
    const { impl, calls } = fakeFetch([
      { match: "/users?query=login:alice", json: { users: [{ id: "u-1", login: "alice" }] } },
      { match: "/services", json: SERVICES },
      {
        match: "/users/u-1/permanenttokens?fields=id,name",
        json: { permanenttokens: [{ id: "old-1", name: ONBOARDING_TOKEN_NAME }, { id: "keep", name: "unrelated" }] },
      },
      { match: "/users/u-1/permanenttokens/old-1", method: "DELETE", status: 204 },
      { match: "/users/u-1/permanenttokens?fields=id,name,token", method: "POST", json: { id: "t-2", token: "perm-second" } },
    ]);
    const onboarding = createOnboarding({ config: CONFIG, fetchImpl: impl });

    const result = await onboarding.issueToken({ ctx: CTX, serviceUrl: "http://registry:8642" });

    assert.equal(result.token, "perm-second");
    const revoked = calls.filter((call) => call.method === "DELETE").map((call) => call.url);
    assert.deepEqual(revoked, ["http://youtrack:8080/hub/api/rest/users/u-1/permanenttokens/old-1"]);
    assert.ok(!calls.some((call) => call.method === "DELETE" && call.url.endsWith("/keep")), "unrelated tokens must not be touched");
  });

  it("fails closed: unreachable YouTrack is retryable 503, unknown or banned callers are refused", async () => {
    const unreachable = createOnboarding({
      config: CONFIG,
      fetchImpl: fakeFetch([{ match: "/users?query=login:alice", throws: "ECONNREFUSED" }]).impl,
    });
    await assert.rejects(
      () => unreachable.issueToken({ ctx: CTX, serviceUrl: "http://registry:8642" }),
      (error) => error instanceof OnboardingError && error.status === 503 && error.code === "UNAVAILABLE" && error.retryable === true,
    );

    const unknown = createOnboarding({ config: CONFIG, fetchImpl: fakeFetch([{ match: "/users?query=login:alice", json: { users: [] } }]).impl });
    await assert.rejects(
      () => unknown.issueToken({ ctx: CTX, serviceUrl: "http://registry:8642" }),
      (error) => error.status === 404 && error.code === "UNKNOWN_USER",
    );

    const banned = createOnboarding({
      config: CONFIG,
      fetchImpl: fakeFetch([{ match: "/users?query=login:alice", json: { users: [{ id: "u-1", login: "alice", banned: true }] } }]).impl,
    });
    await assert.rejects(
      () => banned.issueToken({ ctx: CTX, serviceUrl: "http://registry:8642" }),
      (error) => error.status === 403 && error.code === "BANNED",
    );

    const noIdentity = createOnboarding({ config: CONFIG, fetchImpl: fakeFetch([]).impl });
    await assert.rejects(
      () => noIdentity.issueToken({ ctx: { identity: {} }, serviceUrl: "http://registry:8642" }),
      (error) => error.status === 401 && error.code === "UNAUTHENTICATED",
    );
  });

  it("builds the managed snippet from the same shape the plugin template documents", () => {
    const snippet = JSON.parse(buildManagedSnippet("https://specs.example.com", "perm-xyz"));
    assert.deepEqual(Object.keys(snippet.mcpServers), ["omp-spec-kit"]);
    assert.equal(snippet.mcpServers["omp-spec-kit"].headers.Authorization, "Bearer perm-xyz");
    assert.match(snippet.$schema, /mcp-schema\.json$/u);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createServiceApp } from "../../../src/service/http.js";

/** In-process app with a stubbed authenticate — no live fixture needed. */
async function setup(role) {
  const calls = [];
  const app = createServiceApp({
    mounts: {},
    authenticate: async (req) => {
      if (!req.headers.authorization) throw Object.assign(new Error("MISSING_TOKEN"), { status: 401 });
      return { role, scopes: ["demo/stack"], identity: { login: "tester" } };
    },
    endpoints: {
      projectionStatus: async () => ({ running: false, dirty: false, last: null }),
      projectionSync: async () => {
        calls.push("sync");
        return { outcome: "SKIPPED", writeCalls: 0 };
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function post(base, path, token = "tok") {
  return fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: "{}",
  });
}

describe("projection ops endpoints", () => {
  it("POST /projection/sync requires the owner role", async () => {
    for (const role of ["reader", "writer"]) {
      const { base, calls, close } = await setup(role);
      try {
        const response = await post(base, "/projection/sync");
        assert.equal(response.status, 403, `${role} must not trigger a cross-tenant tracker sync`);
        assert.equal((await response.json()).error, "FORBIDDEN_ROLE");
        assert.equal(calls.length, 0);
      } finally {
        await close();
      }
    }
    const { base, calls, close } = await setup("owner");
    try {
      const response = await post(base, "/projection/sync");
      assert.equal(response.status, 200);
      assert.equal(calls.length, 1);
    } finally {
      await close();
    }
  });

  it("returns 501 when the projection endpoints are not wired (and 403 for non-owners first)", async () => {
    const calls = [];
    const app = createServiceApp({
      mounts: {},
      authenticate: async (req) => {
        if (!req.headers.authorization) throw Object.assign(new Error("MISSING_TOKEN"), { status: 401 });
        return { role: req.headers["x-role"] ?? "owner", scopes: ["demo/stack"], identity: { login: "t" } };
      },
      endpoints: {},
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const statusResponse = await fetch(`${base}/projection/status`, { headers: { authorization: "Bearer tok" } });
      assert.equal(statusResponse.status, 501, "unwired status reports not-implemented, not a crash");
      const syncResponse = await post(base, "/projection/sync");
      assert.equal(syncResponse.status, 501);
      // The role gate still runs before the wiring check: a reader on an
      // unwired deployment gets 403, not 501.
      const readerResponse = await fetch(`${base}/projection/status`, { headers: { authorization: "Bearer tok", "x-role": "reader" } });
      assert.equal(readerResponse.status, 403);
      void calls;
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("GET /projection/status requires the owner role and authentication", async () => {
    const { base, close } = await setup("reader");
    try {
      assert.equal((await fetch(`${base}/projection/status`, { headers: { authorization: "Bearer tok" } })).status, 403);
      assert.equal((await fetch(`${base}/projection/status`)).status, 401);
    } finally {
      await close();
    }
    const owner = await setup("owner");
    try {
      const response = await fetch(`${owner.base}/projection/status`, { headers: { authorization: "Bearer tok" } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { running: false, dirty: false, last: null });
    } finally {
      await owner.close();
    }
  });
});

import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import {
  containerHostAddress,
  createServiceApp,
  isLocalBootstrapPeer,
  isLoopbackAddress,
} from "../../../src/service/http.js";

/**
 * The local bootstrap presents no credential: its whole authorization is the
 * caller's address plus the operator's opt-in. Both gates and the minting path
 * are proven here without a live YouTrack — the endpoint is the seam.
 */
function app({ localToken, env = {} } = {}) {
  return createServiceApp({
    mounts: {},
    authenticate: async () => {
      throw new Error("the local bootstrap must never consult the auth gate");
    },
    endpoints: localToken === undefined ? {} : { localToken },
    env,
  });
}

async function listen(application) {
  const server = application.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/**
 * A real request whose socket claims a non-loopback peer: `remoteAddress` is a
 * prototype getter, so an own value shadows it exactly as a LAN peer would.
 */
async function listenBehindForeignAddress(application, remoteAddress) {
  const inner = application.listen(0, "127.0.0.1");
  await new Promise((resolve) => inner.once("listening", resolve));
  const outer = http.createServer((req, res) => {
    Object.defineProperty(req.socket, "remoteAddress", {
      value: remoteAddress,
      configurable: true,
    });
    inner.emit("request", req, res);
  });
  outer.listen(0, "127.0.0.1");
  await new Promise((resolve) => outer.once("listening", resolve));
  return {
    base: `http://127.0.0.1:${outer.address().port}`,
    close: async () => {
      await new Promise((resolve) => outer.close(resolve));
      await new Promise((resolve) => inner.close(resolve));
    },
  };
}

const post = (base) => fetch(`${base}/local/token`, { method: "POST" });

describe("loopback predicate", () => {
  it("accepts the loopback literals net reports and nothing else", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      assert.equal(
        isLoopbackAddress(address),
        true,
        `${address} must count as loopback`,
      );
    }
    for (const address of [
      undefined,
      null,
      "",
      "localhost",
      "10.1.2.3",
      "::ffff:10.1.2.3",
      "192.168.0.10",
      "127.0.0.2",
      "fe80::1",
    ]) {
      assert.equal(
        isLoopbackAddress(address),
        false,
        `${String(address)} must not count as loopback`,
      );
    }
  });
});

describe("local bootstrap peer", () => {
  it("accepts the container gateway only when it is this container's host", () => {
    // Measured inside the e2e compose network: the host appears as 172.18.0.1.
    assert.equal(isLocalBootstrapPeer("172.18.0.1", "172.18.0.1"), true);
    assert.equal(isLocalBootstrapPeer("::ffff:127.0.0.1", "172.18.0.1"), true);
    // A sibling container keeps its own address and stays outside.
    assert.equal(isLocalBootstrapPeer("172.18.0.7", "172.18.0.1"), false);
    // No container: locality means loopback only.
    assert.equal(isLocalBootstrapPeer("172.18.0.1", null), false);
    assert.equal(isLocalBootstrapPeer("10.1.2.3", "172.18.0.1"), false);
  });

  it("reads the default-route gateway from the kernel and nothing outside a container", () => {
    const route = [
      "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT",
      "eth0\t00000000\t010012AC\t0003\t0\t0\t0\t00000000\t0\t0\t0",
      "eth0\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0",
      "",
    ].join("\n");
    assert.equal(
      containerHostAddress(
        () => route,
        () => true,
      ),
      "172.18.0.1",
    );
    assert.equal(
      containerHostAddress(
        () => route,
        () => false,
      ),
      null,
    );
    assert.equal(
      containerHostAddress(
        () => "garbage",
        () => true,
      ),
      null,
    );
    assert.equal(
      containerHostAddress(
        () => {
          throw new Error("no procfs");
        },
        () => true,
      ),
      null,
    );
  });
});

describe("POST /local/token", () => {
  it("mints the configured login's credential for a loopback caller", async () => {
    const seen = [];
    const { server, base } = await listen(
      app({
        env: { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "alice" },
        localToken: async (input) => {
          seen.push(input);
          return { token: "minted-unit-token", login: input.login };
        },
      }),
    );
    try {
      const response = await post(base);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        token: "minted-unit-token",
        login: "alice",
      });
      assert.equal(seen.length, 1);
      assert.equal(seen[0].login, "alice");
      assert.match(seen[0].serviceUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("refuses a non-loopback caller with 403 before any minting work", async () => {
    let called = 0;
    const application = app({
      env: { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "alice" },
      localToken: async ({ login }) => {
        called += 1;
        return { token: "minted-unit-token", login };
      },
    });
    for (const remoteAddress of [
      "10.1.2.3",
      "::ffff:10.1.2.3",
      "192.168.0.10",
    ]) {
      const { base, close } = await listenBehindForeignAddress(
        application,
        remoteAddress,
      );
      try {
        const response = await post(base);
        assert.equal(response.status, 403, `${remoteAddress} must be refused`);
        assert.equal(
          (await response.json()).error,
          "LOCAL_BOOTSTRAP_FORBIDDEN",
        );
      } finally {
        await close();
      }
    }
    assert.equal(called, 0, "a refused caller must never reach the minter");
  });

  it("refuses with 409 when the operator has not opted in", async () => {
    let called = 0;
    for (const env of [
      {},
      { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "" },
      { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "  " },
    ]) {
      const { server, base } = await listen(
        app({
          env,
          localToken: async ({ login }) => {
            called += 1;
            return { token: "minted-unit-token", login };
          },
        }),
      );
      try {
        const response = await post(base);
        assert.equal(response.status, 409, JSON.stringify(env));
        assert.equal((await response.json()).error, "LOCAL_BOOTSTRAP_DISABLED");
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    }
    assert.equal(called, 0);
  });

  it("returns 501 when the bootstrap endpoint is not wired", async () => {
    const { server, base } = await listen(
      app({ env: { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "alice" } }),
    );
    try {
      const response = await post(base);
      assert.equal(response.status, 501);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("maps a minter refusal to its status and code without leaking the token", async () => {
    const { server, base } = await listen(
      app({
        env: { SPEC_REGISTRY_LOCAL_BOOTSTRAP_LOGIN: "alice" },
        localToken: async () => {
          const error = new Error("YouTrack has no user alice");
          error.status = 404;
          error.code = "UNKNOWN_USER";
          throw error;
        },
      }),
    );
    try {
      const response = await post(base);
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error, "UNKNOWN_USER");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { after, describe, it } from "node:test";
import { MountManager, parseProjectsConfig } from "../../../src/service/mounts.js";
import { buildServiceStack } from "../../../src/service/index.js";
import { stableJson, digest } from "../../../src/adapters/youtrack-projection.js";
import { resolveMarkerSecret } from "../../../src/adapters/marker-secret.js";

const execFileAsync = promisify(execFile);
const FIXTURE_SPEC = path.resolve("tests/fixtures/kernel/real-corpus/.specs/spec-kernel");
const SECRETS_KEY = "k".repeat(32);
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});

const AUTH_BLOCK = {
  youtrack: { baseUrl: "http://youtrack:8080", serviceToken: "service-token-1234567890" },
  appBridge: { token: "bridge-token-1234567890" },
  roleGroups: { reader: ["spec-readers"] },
};

function memoryStore() {
  const bindings = new Map();
  return {
    bindings,
    getBinding: (project) => bindings.get(project) ?? null,
    putBinding: async (row) => {
      bindings.set(row.project, { ...row });
    },
    putCredential: async () => {},
    deleteBinding: async (project) => {
      bindings.delete(project);
    },
    deleteCredential: async () => {},
    logAccess: () => {},
  };
}

async function seededBare() {
  const dir = await mkdtemp(path.join(tmpdir(), "spec-stack-projection-"));
  tempDirs.push(dir);
  const bare = path.join(dir, "specs.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", bare]);
  const seed = path.join(dir, "seed");
  await execFileAsync("git", ["clone", bare, seed]);
  await execFileAsync("git", ["-C", seed, "config", "user.email", "seed@example.invalid"]);
  await execFileAsync("git", ["-C", seed, "config", "user.name", "seed"]);
  await cp(FIXTURE_SPEC, path.join(seed, "stgmt", "alpha", ".specs", "spec-kernel"), { recursive: true });
  await execFileAsync("git", ["-C", seed, "add", "."]);
  await execFileAsync("git", ["-C", seed, "commit", "-m", "seed"]);
  await execFileAsync("git", ["-C", seed, "push", "-q", "origin", "HEAD:refs/heads/main"]);
  await rm(seed, { recursive: true, force: true });
  const byoBare = path.join(dir, "byo.git");
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", byoBare]);
  return { dir, bare, byoBare };
}

function stackConfig(specsBare) {
  const config = parseProjectsConfig({
    specsRepo: pathToFileURL(specsBare).href,
    branch: "main",
    projects: [{ id: "stgmt/alpha" }],
    auth: AUTH_BLOCK,
  });
  config.repoPolicy = { allowedHosts: ["file"] };
  return config;
}

describe("buildServiceStack projection wiring", () => {
  it("projection disabled: ops endpoints report enabled:false without touching YouTrack", async () => {
    const { dir, bare } = await seededBare();
    const config = stackConfig(bare);
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store: memoryStore(), secretsKey: SECRETS_KEY, identity: { name: "b", email: "b@x" } });
    const stack = buildServiceStack({
      mounts,
      config,
      store: memoryStore(),
      secretsKey: SECRETS_KEY,
      env: {},
      logger: () => {},
    });
    assert.equal(stack.projection, null);
    assert.deepEqual(await stack.endpoints.projectionStatus(), { enabled: false });
    assert.deepEqual(await stack.endpoints.projectionSync(), { enabled: false });
  });

  it("projection enabled: the marker secret resolves through the shared chain (secretsKey-derived)", async () => {
    const { dir, bare } = await seededBare();
    const config = stackConfig(bare);
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store: memoryStore(), secretsKey: SECRETS_KEY, identity: { name: "b", email: "b@x" } });
    await mounts.boot();
    const captured = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      const pathname = new URL(url).pathname;
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(init.body) : null;
      const json = (data, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
      if (method === "GET" && pathname === "/api/admin/projects") return json([{ id: "0-1", shortName: "SPEC" }]);
      if (method === "GET" && pathname === "/api/issues") return json([]);
      if (method === "GET" && pathname.startsWith("/api/admin/projects/")) return json([]);
      if (method === "GET" && pathname === "/api/issueLinkTypes") {
        return json(["covers", "constrains", "implements", "satisfies", "verifies", "depends-on", "satisfied-by", "implemented-by"].map((name, i) => ({ id: `lt-${i}`, name, directed: false })));
      }
      if (method === "GET" && /\/api\/issues\/[^/]+\/links$/.test(pathname)) return json([]);
      if (method === "POST" && pathname === "/api/issues") {
        captured.push(body);
        return json({ id: "3-1", idReadable: "SPEC-1" });
      }
      if (method === "POST" && /\/api\/issues\/[^/]+/.test(pathname)) {
        captured.push(body);
        return json({ id: "3-1" });
      }
      if (method === "POST" && pathname === "/api/commands") return json({});
      if (method === "DELETE") return json({});
      return json({ error: "unhandled " + pathname }, 404);
    };
    try {
      const stack = buildServiceStack({
        mounts,
        config,
        store: memoryStore(),
        secretsKey: SECRETS_KEY,
        env: { SPEC_REGISTRY_PROJECTION: "1", SPEC_REGISTRY_YT_URL: "http://yt.test" },
        logger: () => {},
      });
      assert.ok(stack.projection, "projection constructed");
      await stack.projection.syncOnce();
      const markerWrite = captured.find((b) => typeof b?.description === "string" && b.description.startsWith("SPEC-SYNC-STATE"));
      assert.ok(markerWrite, `the sync published a marker (last=${JSON.stringify(stack.projection.status().last)})`);
      const marker = JSON.parse(markerWrite.description.slice("SPEC-SYNC-STATE\n".length));
      const { signature, ...unsigned } = marker;
      // The secret came from the shared resolver — whatever arm wins locally
      // (env/file/derived), it is the SAME value a manual spec-graph-sync run
      // would resolve and verify with.
      const secret = resolveMarkerSecret({ env: {}, secretsKey: SECRETS_KEY });
      const expected = createHmac("sha256", secret).update(stableJson(unsigned), "utf8").digest("hex");
      assert.equal(signature, expected);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("repo bind/unbind through the composed stack fires projection.syncNow once each", async () => {
    const { dir, bare, byoBare } = await seededBare();
    const config = stackConfig(bare);
    const mounts = new MountManager({ config, cloneDir: path.join(dir, "clone"), store: memoryStore(), secretsKey: SECRETS_KEY, identity: { name: "b", email: "b@x" } });
    await mounts.boot();
    const stack = buildServiceStack({
      mounts,
      config,
      store: memoryStore(),
      secretsKey: SECRETS_KEY,
      env: { SPEC_REGISTRY_PROJECTION: "1", SPEC_REGISTRY_YT_URL: "http://127.0.0.1:1", SPEC_SYNC_MARKER_KEY: "m".repeat(40) },
      logger: () => {},
    });
    let calls = 0;
    const original = stack.projection.syncNow;
    stack.projection.syncNow = () => {
      calls += 1;
      // Swallow the actual sync — the YouTrack URL is unroutable; the wiring
      // assertion is on invocation, not on tracker outcome.
    };
    void original;
    const ctx = { role: "owner", scopes: ["stgmt/alpha"], identity: { login: "op" } };
    await stack.endpoints.repoBind({ ctx, project: "stgmt/alpha", repoUrl: pathToFileURL(byoBare).href, token: "unused-file-remote", migrate: false });
    assert.equal(calls, 1, "bind triggers exactly one projection run");
    await stack.endpoints.repoUnbind({ ctx, project: "stgmt/alpha" });
    assert.equal(calls, 2, "unbind triggers a second projection run");
  });
});

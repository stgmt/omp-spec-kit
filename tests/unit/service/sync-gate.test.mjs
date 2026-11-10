import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { GitClient, parseCatFileBatch } from "../../../src/service/git.js";
import { verifyGitHubSignature, createServiceApp } from "../../../src/service/http.js";
import { MountManager } from "../../../src/service/mounts.js";
import { remoteUnchanged, startSync } from "../../../src/service/sync.js";

function fakeMounts({ changed = false, probeSupported = true } = {}) {
  const calls = { discover: 0, root: 0 };
  const mount = { key: "mount-1", git: {}, repoUrl: "https://github.com/stgmt/demo.git", mirrorDir: "/tmp/mirror", cwd: "/tmp" };
  const mounts = {
    calls,
    projects: ["stgmt/demo"],
    readableRepo: () => mount,
    authFor: () => ({ token: "repo-token" }),
    async mirrorSpecRefs() {
      return new Map([["spec-a", "sha-a"]]);
    },
    async discoverProject() {
      calls.discover += 1;
      return { mount, bindings: [], invalid: [] };
    },
    projectSignature: () => null,
    async projectRoot() {
      calls.root += 1;
    },
  };
  const remoteRefs = {
    async probe() {
      if (!probeSupported) return { supported: false, reason: "not-github" };
      return { supported: true, refs: new Map([["spec-a", changed ? "sha-b" : "sha-a"]]) };
    },
  };
  return { mounts, remoteRefs, calls };
}

describe("sync ref gate", () => {
  it("reports an unchanged remote as unchanged", async () => {
    const { mounts, remoteRefs } = fakeMounts();
    const mount = mounts.readableRepo("stgmt/demo");
    assert.equal(await remoteUnchanged({ mounts, remoteRefs, projectId: "stgmt/demo", mount }), true);
  });

  it("never treats an unavailable probe as unchanged", async () => {
    const { mounts, remoteRefs } = fakeMounts({ probeSupported: false });
    const mount = mounts.readableRepo("stgmt/demo");
    assert.equal(await remoteUnchanged({ mounts, remoteRefs, projectId: "stgmt/demo", mount }), false);
  });

  it("skips the fetch, discovery and drift work of a quiet cycle", async () => {
    const { mounts, remoteRefs, calls } = fakeMounts();
    const sync = startSync({ mounts, identity: { name: "bot", email: "bot@example.invalid" }, intervalMs: 60_000, remoteRefs, logger: () => {} });
    try {
      const result = await sync.reconcile();
      assert.equal(result.skipped, 1);
      assert.equal(calls.discover, 0, "a quiet cycle must not read bindings");
      assert.equal(calls.root, 0, "a quiet cycle must not rebuild the corpus");
    } finally {
      sync.stop();
    }
  });

  it("takes the ordinary path when a spec tip moved", async () => {
    const { mounts, remoteRefs, calls } = fakeMounts({ changed: true });
    const sync = startSync({ mounts, identity: { name: "bot", email: "bot@example.invalid" }, intervalMs: 60_000, remoteRefs, logger: () => {} });
    try {
      const result = await sync.reconcile();
      assert.equal(result.skipped, 0);
      assert.equal(calls.discover, 1, "a moved tip must re-read the bindings");
      assert.equal(calls.root, 1, "a moved tip must rebuild the corpus");
    } finally {
      sync.stop();
    }
  });
});

describe("git cat-file --batch parsing", () => {
  it("reads blobs in request order and keeps bytes untouched", () => {
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const header = Buffer.from(`deadbeef blob ${content.length}\n`, "utf8");
    const body = Buffer.concat([header, content, Buffer.from("\n", "utf8")]);
    const results = parseCatFileBatch(body, ["spec-a:.spec-kit.json"]);
    assert.equal(results.length, 1);
    assert.equal(results[0].type, "blob");
    assert.equal(results[0].oid, "deadbeef");
    assert.deepEqual([...results[0].content], [...content]);
  });

  it("marks revisions the object store does not know as missing", () => {
    const body = Buffer.from("spec-b:.spec-kit.json missing\n", "utf8");
    const results = parseCatFileBatch(body, ["spec-b:.spec-kit.json"]);
    assert.equal(results[0].missing, true);
  });
});

describe("GitHub webhook signature", () => {
  const secret = "hook-secret";
  const body = Buffer.from('{"ref":"refs/heads/spec-a"}', "utf8");
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts the signature GitHub sends for the raw body", () => {
    assert.equal(verifyGitHubSignature(secret, body, signature), true);
  });

  it("rejects a tampered body, a wrong scheme and an absent header", () => {
    assert.equal(verifyGitHubSignature(secret, Buffer.from('{"ref":"refs/heads/spec-b"}', "utf8"), signature), false);
    assert.equal(verifyGitHubSignature(secret, body, `sha1=${signature.slice(7)}`), false);
    assert.equal(verifyGitHubSignature(secret, body, undefined), false);
  });

  it("refuses to verify without a configured secret", () => {
    assert.equal(verifyGitHubSignature("", body, signature), false);
  });
});

describe("POST /webhook/github", () => {
  async function listen(app) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    return { server, url: `http://127.0.0.1:${server.address().port}/webhook/github` };
  }

  function appFor({ secret = "hook-secret", projects = ["stgmt/alpha"], stale = [], reconciled = { count: 0 } } = {}) {
    const app = createServiceApp({
      mounts: {
        config: { fingerprint: "test" },
        projectsForRepo: (repoUrl) => (repoUrl === "https://github.com/stgmt/alpha.git" ? projects : []),
        markStale: (project) => stale.push(project),
      },
      authenticate: () => ({ identity: { login: "tester" }, scopes: projects, role: "owner" }),
      sync: { reconcile: async () => { reconciled.count += 1; } },
      webhookSecret: secret,
    });
    return app;
  }

  const sign = (secret, body) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const push = (url, body, headers = {}) => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-event": "push", ...headers },
    body,
  });

  it("accepts a signed push for a bound repository", async () => {
    const stale = [];
    const reconciled = { count: 0 };
    const { server, url } = await listen(appFor({ stale, reconciled }));
    try {
      const body = JSON.stringify({ ref: "refs/heads/spec-alpha", repository: { clone_url: "https://github.com/stgmt/alpha.git" } });
      const response = await push(url, body, { "x-hub-signature-256": sign("hook-secret", body) });
      assert.equal(response.status, 202);
      assert.deepEqual((await response.json()).projects, ["stgmt/alpha"]);
      assert.deepEqual(stale, ["stgmt/alpha"], "the push marks the project stale");
      // The reconcile is queued off the response; give the microtask a turn.
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(reconciled.count, 1, "the push triggers one reconcile");
    } finally {
      server.close();
    }
  });

  it("refuses an unsigned push and ignores non-spec refs and foreign repositories", async () => {
    const { server, url } = await listen(appFor());
    try {
      const body = JSON.stringify({ ref: "refs/heads/spec-alpha", repository: { clone_url: "https://github.com/stgmt/alpha.git" } });
      assert.equal((await push(url, body)).status, 401, "an unsigned push is refused");

      const mainBody = JSON.stringify({ ref: "refs/heads/main", repository: { clone_url: "https://github.com/stgmt/alpha.git" } });
      const main = await push(url, mainBody, { "x-hub-signature-256": sign("hook-secret", mainBody) });
      assert.equal(main.status, 202);
      assert.equal((await main.json()).ignored, "ref");

      const foreignBody = JSON.stringify({ ref: "refs/heads/spec-alpha", repository: { clone_url: "https://github.com/other/repo.git" } });
      const foreign = await push(url, foreignBody, { "x-hub-signature-256": sign("hook-secret", foreignBody) });
      assert.equal(foreign.status, 202);
      assert.equal((await foreign.json()).ignored, "repository");
    } finally {
      server.close();
    }
  });

  it("answers 503 when the deployment has no webhook secret", async () => {
    const { server, url } = await listen(appFor({ secret: "" }));
    try {
      const body = JSON.stringify({ ref: "refs/heads/spec-alpha", repository: { clone_url: "https://github.com/stgmt/alpha.git" } });
      assert.equal((await push(url, body)).status, 503);
    } finally {
      server.close();
    }
  });
});

describe("mirror refs", () => {
  it("lists only remote spec-* refs, because a literal git pattern stops at a slash", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mirror-refs-"));
    try {
      const mirror = path.join(dir, "mirror.git");
      execFileSync("git", ["init", "--bare", "-q", mirror]);
      const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
      const tree = execFileSync("git", ["--git-dir", mirror, "hash-object", "-w", "-t", "tree", "--stdin"], { input: "", env }).toString().trim();
      const commit = execFileSync("git", ["--git-dir", mirror, "commit-tree", tree, "-m", "seed"], { env }).toString().trim();
      execFileSync("git", ["--git-dir", mirror, "update-ref", "refs/remotes/origin/spec-alpha", commit]);
      execFileSync("git", ["--git-dir", mirror, "update-ref", "refs/remotes/origin/main", commit]);
      const mounts = Object.create(MountManager.prototype);
      const refs = await mounts.mirrorSpecRefs({ mirrorDir: mirror, cwd: dir, git: new GitClient({}) });
      assert.deepEqual([...refs.keys()], ["spec-alpha"]);
      assert.equal(refs.get("spec-alpha"), commit);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });
});

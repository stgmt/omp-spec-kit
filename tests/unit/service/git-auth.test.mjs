import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, after } from "node:test";
import { GitClient, GitError, gitAuthEnv, gitAuthFromEnv } from "../../../src/service/git.js";
import { isolateGitEnvironment } from "../../helpers/git-env.mjs";

// Real git runs in this file: never inherit a hook's GIT_DIR/GIT_INDEX_FILE.
isolateGitEnvironment();

const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "spec-git-auth-"));
  tempDirs.push(dir);
  return dir;
}

const TOKEN = "perm-c2VjcmV0LXRva2VuLXZhbHVl";

describe("git auth env", () => {
  it("is empty without a token", () => {
    assert.deepEqual(gitAuthEnv(undefined), {});
    assert.deepEqual(gitAuthEnv({ token: "" }), {});
    assert.deepEqual(gitAuthEnv({}), {});
  });

  it("builds a basic extraheader, unscoped by default and url-scoped on request", () => {
    const unscoped = gitAuthEnv({ token: TOKEN });
    assert.equal(unscoped.GIT_CONFIG_COUNT, "1");
    assert.equal(unscoped.GIT_CONFIG_KEY_0, "http.extraheader");
    assert.equal(
      unscoped.GIT_CONFIG_VALUE_0,
      `Authorization: Basic ${Buffer.from(`x-access-token:${TOKEN}`, "utf8").toString("base64")}`,
    );

    const scoped = gitAuthEnv({ token: TOKEN, username: "operator", url: "https://github.com/" });
    assert.equal(scoped.GIT_CONFIG_KEY_0, "http.https://github.com/.extraheader");
    assert.equal(
      scoped.GIT_CONFIG_VALUE_0,
      `Authorization: Basic ${Buffer.from(`operator:${TOKEN}`, "utf8").toString("base64")}`,
    );
  });

  it("reads the operator token from the environment only", () => {
    assert.equal(gitAuthFromEnv({}), undefined);
    assert.equal(gitAuthFromEnv({ SPEC_REGISTRY_GIT_TOKEN: "   " }), undefined);
    assert.deepEqual(gitAuthFromEnv({ SPEC_REGISTRY_GIT_TOKEN: ` ${TOKEN} ` }), {
      token: TOKEN,
      username: undefined,
      url: undefined,
    });
    assert.deepEqual(
      gitAuthFromEnv({ SPEC_REGISTRY_GIT_TOKEN: TOKEN, SPEC_REGISTRY_GIT_USER: "operator", SPEC_REGISTRY_GIT_AUTH_URL: "https://github.com/" }),
      { token: TOKEN, username: "operator", url: "https://github.com/" },
    );
  });
});

describe("git client credential handling", () => {
  it("injects the header into the child environment and keeps the token out of argv", () => {
    const client = new GitClient({ gitAuth: { token: TOKEN }, env: { PATH: "/usr/bin" } });
    const env = client.childEnv();
    assert.equal(env.GIT_CONFIG_KEY_0, "http.extraheader");
    assert.ok(env.GIT_CONFIG_VALUE_0.includes(Buffer.from(TOKEN, "utf8").toString("base64")));
    assert.equal(env.PATH, "/usr/bin");
  });

  it("passes no auth config when no credential is configured", () => {
    const env = new GitClient({ env: { PATH: "/usr/bin" } }).childEnv();
    assert.equal(env.GIT_CONFIG_COUNT, undefined);
  });

  it("refuses a git call without a cwd instead of running against the process directory", async () => {
    const client = new GitClient({ gitAuth: { token: TOKEN } });
    await assert.rejects(
      () => client.run(["status"]),
      (error) => {
        assert.ok(error instanceof GitError);
        assert.match(error.message, /no cwd/u);
        return true;
      },
    );
    await assert.rejects(() => client.revParse("HEAD"), (error) => error instanceof GitError && /no cwd/u.test(error.message));
    // An explicit cwd still works, and `clone` derives one from the destination.
    const cwd = await tempDir();
    const withCwd = new GitClient({ gitAuth: { token: TOKEN } });
    await withCwd.run(["init", "-q", "."], { cwd });
    const target = path.join(await tempDir(), "clone");
    await withCwd.clone(cwd, target);
    assert.ok((await stat(path.join(target, ".git"))).isDirectory());
  });

  it("redacts the token from errors raised by the git CLI", async () => {
    const cwd = await tempDir();
    const client = new GitClient({ defaultCwd: cwd, gitAuth: { token: TOKEN } });
    await client.run(["init", "-q", "."]);
    await assert.rejects(
      () => client.run(["cat-file", "-e", TOKEN]),
      (error) => {
        assert.ok(error instanceof GitError);
        assert.ok(!error.message.includes(TOKEN), `token leaked in message: ${error.message}`);
        assert.ok(!String(error.stderr ?? "").includes(TOKEN), "token leaked in stderr");
        assert.ok(error.message.includes("***"), `expected a redaction marker in: ${error.message}`);
        return true;
      },
    );
  });
});

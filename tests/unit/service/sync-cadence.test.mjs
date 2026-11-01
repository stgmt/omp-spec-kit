import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startSync } from "../../../src/service/sync.js";

describe("sync cadence", () => {
  it("publishes only after a canonical branch actually moved", async () => {
    let signature = "a";
    let desired = "a";
    let published = 0;
    const mounts = {
      projects: ["stgmt/demo"],
      async discoverProject() {
        return { mount: { git: {}, repoUrl: "file:///tmp/demo.git", mirrorDir: "/tmp/mirror", cwd: "/tmp" }, bindings: [], invalid: [] };
      },
      projectSignature() {
        return signature;
      },
      async projectRoot() {
        signature = desired;
      },
    };
    const sync = startSync({
      mounts,
      identity: { name: "bot", email: "bot@example.invalid" },
      intervalMs: 60_000,
      afterReconcile: async () => { published += 1; },
    });
    try {
      await sync.reconcile();
      assert.equal(published, 0, "an unchanged corpus must not publish");
      desired = "b";
      await sync.reconcile();
      assert.equal(published, 1, "a moved corpus must publish once");
    } finally {
      sync.stop();
    }
  });
});

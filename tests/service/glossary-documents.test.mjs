import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { KERNEL_SCHEMA_VERSION } from "../../src/kernel/index.js";
import { createSpecService } from "../../src/adapters/query-service.js";

const SCHEMA = { schemaVersion: KERNEL_SCHEMA_VERSION };

async function withService(context, run) {
  const root = await mkdtemp(path.join(tmpdir(), "omp-glossary-docs-"));
  try {
    return await run(createSpecService(root, context));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("glossary document actions", () => {
  it("refuses on a transport without a registry", async () => {
    // mutant: answer the corpus root instead of refusing → a local server
    // pretends to serve a project it cannot resolve.
    await withService({}, async (service) => {
      const envelope = await service.runQuery("documents", { action: "glossaryStatus" }, SCHEMA);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.error.code, "GLOSSARY_PROJECT_REQUIRED");
      assert.match(envelope.error.message, /hosted transport/u);
      assert.match(envelope.error.message, /project/u);
    });
  });

  it("returns the status the provider reports", async () => {
    const data = { exists: false, ref: "glossary", path: "glossary/acme/booking/GLOSSARY.md", project: "acme/booking" };
    await withService({ glossary: { status: async () => ({ ok: true, data }) } }, async (service) => {
      const envelope = await service.runQuery("documents", { action: "glossaryStatus" }, SCHEMA);
      assert.equal(envelope.ok, true, JSON.stringify(envelope.error ?? {}));
      assert.deepEqual(envelope.data, data);
    });
  });

  it("passes query and limit to the search provider", async () => {
    let seen = null;
    const provider = {
      search: async (options) => {
        seen = options;
        return { ok: true, data: { exists: true, hits: [] } };
      },
    };
    await withService({ glossary: provider }, async (service) => {
      const envelope = await service.runQuery("documents", { action: "glossarySearch", query: "пул", limit: 3 }, SCHEMA);
      assert.equal(envelope.ok, true);
      assert.deepEqual(seen, { query: "пул", limit: 3 });
    });
  });

  it("keeps the provider's refusal code instead of inventing a document error", async () => {
    const provider = {
      read: async () => ({ ok: false, error: { code: "GLOSSARY_BRANCH_MISSING", message: "the glossary branch does not exist" } }),
    };
    await withService({ glossary: provider }, async (service) => {
      const envelope = await service.runQuery("documents", { action: "glossaryRead" }, SCHEMA);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.error.code, "GLOSSARY_BRANCH_MISSING");
    });
  });

  it("turns a provider crash into a read error", async () => {
    const provider = {
      read: async () => {
        throw new Error("git exploded");
      },
    };
    await withService({ glossary: provider }, async (service) => {
      const envelope = await service.runQuery("documents", { action: "glossaryRead" }, SCHEMA);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.error.code, "ADAPTER_READ_ERROR");
      assert.match(envelope.error.message, /git exploded/u);
    });
  });
});

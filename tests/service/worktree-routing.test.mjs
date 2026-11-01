import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRootedServices } from "../../src/adapters/query-service.js";

function worktreeWithSpec(slug) {
  const dir = mkdtempSync(path.join(tmpdir(), "wt-"));
  const specDir = path.join(dir, ".specs", slug);
  mkdirSync(specDir, { recursive: true });
  writeFileSync(
    path.join(specDir, "README.md"),
    `# ${slug}\n\nStatus: ACTIVE\n\nVersion: 1.0.0\n`,
  );
  return dir;
}

describe("multi-worktree routing", () => {
  it("serves each declared worktree's own corpus through one dispatcher", async () => {
    const a = worktreeWithSpec("spec-alpha");
    const b = worktreeWithSpec("spec-beta");
    const serviceFor = createRootedServices(a);
    const envA = await serviceFor(a).runQuery("catalog", { view: "specs" });
    const envB = await serviceFor(b).runQuery("catalog", { view: "specs" });
    assert.equal(envA.ok, true);
    assert.equal(envB.ok, true);
    const slugsA = (envA.data?.specs ?? []).map((s) => s.slug ?? s);
    const slugsB = (envB.data?.specs ?? []).map((s) => s.slug ?? s);
    assert.deepEqual(slugsA, ["spec-alpha"], "default root serves its own corpus");
    assert.deepEqual(slugsB, ["spec-beta"], "declared worktree serves its own corpus");
    assert.notDeepEqual(slugsA, slugsB, "the two worktrees answer different corpora");
  });

  it("preflight reports mutationReady:false on a worktree without .specs", async () => {
    const a = worktreeWithSpec("spec-alpha");
    const bare = mkdtempSync(path.join(tmpdir(), "wt-bare-"));
    const serviceFor = createRootedServices(a);
    const env = await serviceFor(bare).runQuery("mcpPreflight", { declaredWorktree: bare });
    assert.equal(env.ok, true);
    assert.equal(env.data.corpus?.present, false, "no .specs -> corpus absent");
    assert.equal(env.data.mutationReady, false, "writes would fail -> mutationReady honest");
    const envA = await serviceFor(a).runQuery("mcpPreflight", { declaredWorktree: a });
    assert.equal(envA.data.corpus?.present, true);
    assert.equal(envA.data.mutationReady, true);
  });

  it("reports admission facts separately instead of a root compared with itself", async () => {
    const a = worktreeWithSpec("spec-alpha");
    const serviceFor = createRootedServices(a);
    const declared = await serviceFor(a).runQuery("mcpPreflight", { declaredWorktree: a });
    assert.equal(declared.ok, true);
    assert.equal(declared.data.connection.healthy, true);
    assert.equal(declared.data.connection.transport, "local");
    assert.equal(declared.data.project.selected, null, "the local transport has no registry project");
    assert.equal(declared.data.repository.binding, "not-applicable");
    assert.equal(declared.data.worktree.transport, "local");
    assert.equal(declared.data.worktree.declared, true);
    assert.equal(declared.data.corpus.present, true);
    assert.equal("matchesResolvedRoot" in declared.data.worktree, false, "no tautological root match");

    const undeclared = await serviceFor(a).runQuery("mcpPreflight", {});
    assert.equal(undeclared.data.worktree.declared, false, "no worktree was declared on this call");
    assert.equal(undeclared.data.corpus.present, true, "the default root still serves its corpus");
    for (const envelope of [declared, undeclared]) {
      assert.equal(typeof envelope.data.repository.rootId, "string");
      assert.doesNotMatch(envelope.data.repository.rootId, /[A-Za-z]:[\\/]/u, "root identity is a hash, not an absolute path");
    }
  });

  it("reuses one service per root (graph cache is not rebuilt per call)", () => {
    const a = worktreeWithSpec("spec-alpha");
    const serviceFor = createRootedServices(a);
    assert.equal(serviceFor(a), serviceFor(a), "same root -> same cached service");
    const b = worktreeWithSpec("spec-beta");
    assert.notEqual(serviceFor(b), serviceFor(a), "different root -> different service");
  });
});

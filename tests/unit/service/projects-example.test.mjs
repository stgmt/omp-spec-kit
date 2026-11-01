import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { parseProjectsConfig } from "../../../src/service/mounts.js";

describe("shipped projects example", () => {
  it("parses under the 3.0 binding model", async () => {
    const raw = JSON.parse(await readFile(path.resolve("config/projects.example.json"), "utf8"));
    const config = parseProjectsConfig(raw);
    assert.deepEqual(config.projects, ["stgmt/omp-spec-kit"]);
    assert.equal(config.bindings.length, 1);
    assert.equal(config.bindings[0].project, "stgmt/omp-spec-kit");
    assert.equal(config.bindings[0].tokenEnv, "SPEC_REGISTRY_REPO_TOKEN");
    assert.equal(config.bindings[0].repoUrl.includes("@"), false, "the example must not embed credentials");
  });

  it("rejects the retired specsRepo/branch shape with MIGRATION_REQUIRED", () => {
    assert.throws(
      () => parseProjectsConfig({ specsRepo: "https://github.com/stgmt/spec-database.git", branch: "main", projects: [{ id: "stgmt/omp-spec-kit" }] }),
      (error) => error.code === "MIGRATION_REQUIRED",
    );
  });
});

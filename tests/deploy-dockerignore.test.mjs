import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function dockerignoreRules(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => ({ negated: line.startsWith("!"), pattern: negatedPattern(line) }));

  function negatedPattern(line) {
    return line.startsWith("!") ? line.slice(1).trim() : line;
  }
}

function patternMatches(pattern, p) {
  const re = new RegExp("^" + pattern.split("*").map(escapeRe).join("[^/]*") + "$");
  if (re.test(p)) return true;
  // A directory pattern excludes everything beneath it.
  return p.startsWith(pattern + "/");
}

function escapeRe(segment) {
  return segment.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/** Last matching rule wins; `!` re-includes (only legal when no ancestor dir is excluded). */
function isExcluded(rules, p) {
  let excluded = false;
  for (const rule of rules) {
    if (patternMatches(rule.pattern, p)) excluded = !rule.negated;
  }
  return excluded;
}

function copySources(dockerfile) {
  return readFileSync(dockerfile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^COPY\s/.test(line) && !line.includes("--from="))
    .flatMap((line) => {
      const parts = line.replace(/^COPY\s+/, "").split(/\s+/);
      return parts.slice(0, -1).map((source) => source.replace(/\/$/, ""));
    });
}

const DEPLOY_DOCKERFILE = path.join(ROOT, "deploy", "Dockerfile");
const DEPLOY_IGNORE = path.join(ROOT, "deploy", "Dockerfile.dockerignore");

describe("deploy/Dockerfile.dockerignore keeps the spec-registryd build context complete", () => {
  const rules = dockerignoreRules(DEPLOY_IGNORE);

  it("includes every path the deploy Dockerfile copies", () => {
    const sources = copySources(DEPLOY_DOCKERFILE);
    assert.ok(sources.length > 0, "COPY sources parsed");
    for (const source of sources) {
      assert.equal(isExcluded(rules, source), false, `COPY source ${source} must reach the build context`);
    }
    // src/ is copied as a directory: its contents must be reachable too.
    assert.equal(isExcluded(rules, "src/service/index.js"), false);
    assert.equal(isExcluded(rules, "src/adapters/youtrack-store.js"), false);
  });

  it("re-includes exactly the two scripts the image runs", () => {
    assert.equal(isExcluded(rules, "scripts/spec-graph-sync.mjs"), false);
    assert.equal(isExcluded(rules, "scripts/spec-listener-ensure.mjs"), false);
    assert.equal(isExcluded(rules, "scripts/build-plugin.mjs"), true);
    assert.equal(isExcluded(rules, "scripts/candidate-status.mjs"), true);
  });

  it("still excludes heavy, test, docs, and VCS trees", () => {
    for (const p of [
      "node_modules/any-dep/index.js",
      ".git/HEAD",
      "tests/service/projection.test.mjs",
      "plugins/omp-spec-kit/package.json",
      "docs/validation/release-status-v2.8.1.json",
      "config/projects.example.json",
      ".specs/demo/FR.md",
      "audit-reports/commit-reviews/runs.jsonl",
      "deploy/Dockerfile",
      "tools/some-tool.mjs",
      "README.md",
      "CHANGELOG.md",
      "cucumber.mjs",
    ]) {
      assert.equal(isExcluded(rules, p), true, `${p} must stay out of the image context`);
    }
  });

  it("keeps direction over deletion: removing an exclusion would leak the tree into the image", () => {
    const mutated = rules.filter((rule) => !(rule.pattern === "tests" && !rule.negated));
    assert.equal(isExcluded(mutated, "tests/service/projection.test.mjs"), false, "without the tests line the test tree reaches the context");
  });

  it("re-includes exactly two scripts — no other top-level scripts/ entry reaches the context", () => {
    const expected = new Set(["scripts/spec-graph-sync.mjs", "scripts/spec-listener-ensure.mjs"]);
    const entries = readdirSync(path.join(ROOT, "scripts"), { withFileTypes: true });
    const reIncluded = entries
      .map((entry) => `scripts/${entry.name}`)
      .filter((p) => !isExcluded(rules, p));
    assert.deepEqual(new Set(reIncluded), expected);
    for (const entry of entries) {
      const p = `scripts/${entry.name}`;
      if (expected.has(p)) continue;
      assert.equal(isExcluded(rules, p), true, `${p} must stay excluded`);
    }
    // Discriminating: a hypothetical extra re-include must flip the verdict for
    // a path the real rules exclude — independent of which files exist on disk.
    const probe = "scripts/__not-in-image__.mjs";
    assert.equal(isExcluded(rules, probe), true);
    const mutated = [...rules, { negated: true, pattern: probe }];
    assert.equal(isExcluded(mutated, probe), false);
  });

  // Mutual guard with tests/test-harness.test.mjs: each file asserts the
  // other's test:unit registration, so dropping a token can't take its own
  // assertion down with it.
  it("guards test-harness registration: token present exactly once, file on disk", () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const hits = (manifest.scripts["test:unit"] ?? "")
      .split(/\s+/)
      .filter((token) => token === "tests/test-harness.test.mjs");
    assert.equal(hits.length, 1, "tests/test-harness.test.mjs must be listed in test:unit");
    assert.ok(existsSync(path.join(ROOT, "tests", "test-harness.test.mjs")));
  });
});

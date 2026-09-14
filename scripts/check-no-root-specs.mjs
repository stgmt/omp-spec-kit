#!/usr/bin/env node
/**
 * Boundary check (FR-2): code branches must not carry a repository-root
 * `.specs/` corpus.
 *
 * The canonical corpus lives in the specs repository, is written only by the
 * spec registry service, and is read by consumers through MCP. Code gates in
 * this repository run against the frozen fixture under
 * `tests/fixtures/kernel/authoring-real-corpus`; a root `.specs/` would be a
 * third copy that agents could silently read or edit outside the service.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];

const tracked = execFileSync("git", ["ls-files", "--", ".specs"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
if (tracked.length > 0) {
  findings.push(`tracked corpus files (${tracked.length}): ${tracked.slice(0, 5).join(", ")}${tracked.length > 5 ? ", …" : ""}`);
}

if (existsSync(path.join(ROOT, ".specs"))) {
  findings.push("a .specs/ directory exists in the working tree");
}

if (findings.length > 0) {
  console.error(
    [
      "no-root-specs check: the canonical corpus must not live in this repository",
      ...findings.map((finding) => `  - ${finding}`),
      "  the corpus is served by the spec registry: run `npm run check:corpus:remote`",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(JSON.stringify({ schema: "omp-spec-kit-no-root-specs@1", status: "passed" }));

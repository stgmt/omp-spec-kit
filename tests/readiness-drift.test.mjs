import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  MCP_SERVER_INSTRUCTIONS,
  TOOL_CONTRACTS,
} from "../src/adapters/tool-contracts.js";
import {
  READINESS_REFUSALS,
  READINESS_RULE_TEXT,
} from "../src/kernel/readiness.js";

const repositoryRoot = process.cwd();
const CONTRACT_FILE = path.join(repositoryRoot, "src", "kernel", "readiness.js");
// Generated payloads and the fixture corpora are not sources of truth.
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "fixtures", ".git", "archive", "docs"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await sourceFiles(full)));
      continue;
    }
    if (/\.(?:js|mjs|cjs)$/u.test(entry.name)) files.push(full);
  }
  return files;
}

describe("one source for the rule text", () => {
  it("renders the generated block into the tool descriptions", () => {
    const patch = TOOL_CONTRACTS.find((contract) => contract.tool === "spec_patch");
    const inspect = TOOL_CONTRACTS.find((contract) => contract.tool === "spec_inspect");
    assert.ok(patch.description.includes(READINESS_RULE_TEXT));
    assert.ok(inspect.description.includes(READINESS_RULE_TEXT));
  });

  it("renders the generated block into the MCP server instructions", () => {
    assert.ok(MCP_SERVER_INSTRUCTIONS.includes(READINESS_RULE_TEXT));
  });

  it("fails when a source carries a divergent copy of the rule or a refusal message", async () => {
    const files = [
      ...(await sourceFiles(path.join(repositoryRoot, "src"))),
      ...(await sourceFiles(path.join(repositoryRoot, "plugins"))),
    ];
    const offenders = [];
    for (const file of files) {
      if (path.resolve(file) === path.resolve(CONTRACT_FILE)) continue;
      const text = await readFile(file, "utf8");
      for (const ruleLine of READINESS_RULE_TEXT.split("\n")) {
        if (text.includes(ruleLine)) offenders.push(`${file}: rule line "${ruleLine.slice(0, 40)}"`);
      }
      for (const [code, message] of Object.entries(READINESS_REFUSALS)) {
        if (text.includes(message)) offenders.push(`${file}: hand-written ${code} message`);
      }
    }
    assert.deepEqual(offenders, [], `hand-written rule copies must be rendered from src/kernel/readiness.js:\n${offenders.join("\n")}`);
  });
});

#!/usr/bin/env node
/**
 * Fail if spec/product docs freeze the v0.3 eight-tool first slice as the
 * destination door, or send the agent through host lsp for spec work.
 *
 * Allowed nearby qualifiers: first slice, v0.3 candidate, SCHEMA-11.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "dist",
  "tests",
  "src",
  "docs/upstream",
  "docs/plans",
  "docs/validation",
]);

const SKIP_FILE = new Set([
  path.normalize("CHANGELOG.md"), // shipped history; Unreleased is checked via .specs changelogs
]);

const FORBIDDEN = [
  /not the (upstream )?46-tool/i,
  /there is no 46-tool door to prune/i,
  /46-tool door is upstream/i,
  /46-tool table is not this product/i,
  /Agent navigating spec definitions through LSP primitives/i,
  /MCP registry SHALL remain the eight/i,
  /this FR SHALL NOT add a ninth MCP tool/i,
  /MCP remains eight tools/i,
  /rather than copying the upstream mixed registry/i,
];

const ALLOW_NEAR = /first slice|v0\.3 candidate|SCHEMA-11|current v0\.3 proof/i;

const roots = [
  "ROADMAP.md",
  "plugins/omp-spec-kit/README.md",
  "docs/decisions",
  ".specs/product",
  ".specs/spec-kernel",
  ".specs/spec-lsp",
  ".specs/spec-evidence",
  ".specs/spec-authoring-workflow",
  ".specs/mcp-release-integrity/README.md",
];

function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isFile()) return [rel];
  const out = [];
  for (const name of fs.readdirSync(abs)) {
    const child = path.join(rel, name);
    const full = path.join(ROOT, child);
    const stc = fs.statSync(full);
    if (stc.isDirectory()) {
      const base = name;
      if (SKIP_DIR.has(base) || SKIP_DIR.has(child.replaceAll("\\", "/"))) continue;
      out.push(...walk(child));
    } else if (/\.(md|feature)$/i.test(name)) {
      out.push(child);
    }
  }
  return out;
}

const hits = [];
for (const rel of roots.flatMap(walk)) {
  const norm = path.normalize(rel);
  if (SKIP_FILE.has(norm) || SKIP_FILE.has(rel.replaceAll("\\", "/"))) continue;
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const window = [lines[i - 1] || "", line, lines[i + 1] || ""].join("\n");
    for (const re of FORBIDDEN) {
      if (re.test(line) && !ALLOW_NEAR.test(window)) {
        hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
  }
}

if (hits.length) {
  console.error("spec-generator-port freeze leftovers:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("spec-generator-port freeze check: clean");

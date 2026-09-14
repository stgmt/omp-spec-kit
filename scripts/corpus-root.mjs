/**
 * Corpus root for code gates.
 *
 * The canonical `.specs` corpus no longer lives in this repository: it is
 * served by the spec registry over MCP, and only the service holds git access
 * to the specs repository. Gates that need a corpus therefore run against the
 * frozen fixture under `tests/fixtures/kernel/authoring-real-corpus` —
 * deterministic, offline, refreshed deliberately by
 * `scripts/refresh-authoring-real-corpus-manifest.mjs`. An explicit checkout
 * still wins through `OMP_SPEC_KIT_ROOT`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FROZEN_CORPUS_ROOT = path.join(REPOSITORY_ROOT, "tests", "fixtures", "kernel", "authoring-real-corpus");

export function resolveCorpusRoot({ baseDir = REPOSITORY_ROOT, env = process.env } = {}) {
  const raw = env?.OMP_SPEC_KIT_ROOT;
  if (typeof raw === "string" && raw.length > 0 && path.isAbsolute(raw) && existsSync(path.join(raw, ".specs"))) {
    return raw;
  }
  const fixture = path.join(baseDir, "tests", "fixtures", "kernel", "authoring-real-corpus");
  if (!existsSync(path.join(fixture, ".specs"))) {
    throw new Error(`no corpus root: ${fixture} has no .specs and OMP_SPEC_KIT_ROOT is unset`);
  }
  return fixture;
}

export function corpusPath(relative, options) {
  return path.join(resolveCorpusRoot(options), ".specs", relative);
}

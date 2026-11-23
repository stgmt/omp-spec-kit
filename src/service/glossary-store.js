// Glossary storage: one authoritative file per project on the `glossary` branch.
//
// The glossary is not a specification: its branch does not start with `spec-`,
// so discovery, validation and readiness never see it as a corpus document.
// The project is part of the path, so two projects that share a repository keep
// separate files and cannot read each other's.
//
// This module owns only the read side and the path rule. Writes go through the
// existing authoring transaction layer, and the readiness gate consumes the
// `exists`/`sha256` this module returns.
import { error } from "../authoring/error-codes.js";
import { normalizeGlossaryText, parseGlossary } from "../kernel/glossary.js";
import { sha256Bytes } from "../kernel/normalize.js";

export const GLOSSARY_BRANCH = "glossary";
export const GLOSSARY_FILE = "GLOSSARY.md";
export const GLOSSARY_ERROR_CODES = Object.freeze({
  PROJECT_INVALID: "GLOSSARY_PROJECT_INVALID",
  BRANCH_MISSING: "GLOSSARY_BRANCH_MISSING",
  UNAVAILABLE: "GLOSSARY_UNAVAILABLE",
});

const PROJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u;
// `rev-parse --verify` rejects a ref that does not exist with these texts. Any
// other rejection (not a repository, permissions, I/O) is a read failure, not
// an absent branch.
const ABSENT_REF = /unknown revision|needed a single revision|ambiguous argument|not a valid object name|bad revision|no such ref/iu;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** The path of a project's glossary inside the branch; refuses anything else. */
export function glossaryPath(projectId) {
  if (typeof projectId !== "string" || !PROJECT_PATTERN.test(projectId)) return null;
  const [owner, project] = projectId.split("/");
  return `glossary/${owner}/${project}/${GLOSSARY_FILE}`;
}

/**
 * Read a project's glossary from the branch without checking it out.
 *
 * `git` is the service GitClient (or a double with the same `revParse`/`show`
 * methods). The branch is looked up under its local name first and then under
 * `origin/`, so a mirror that only has the remote ref still answers.
 */
export function createGlossaryStore({ git, cwd, refs = [GLOSSARY_BRANCH, `origin/${GLOSSARY_BRANCH}`] } = {}) {
  if (!git || typeof git.revParse !== "function" || typeof git.show !== "function") {
    throw new TypeError("createGlossaryStore needs a git client with revParse and show");
  }
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new TypeError("createGlossaryStore needs the repository cwd");
  }

  async function resolveRef() {
    let failure = null;
    for (const ref of refs) {
      try {
        const sha = await git.revParse(ref, { cwd });
        if (typeof sha === "string" && sha.trim() !== "") return { ref, failure: null };
      } catch (err) {
        // A missing ref is expected; an unreadable repository is not, and it
        // must not be reported as "create the branch".
        if (!ABSENT_REF.test(String(err?.stderr ?? err?.message ?? ""))) failure = err;
      }
    }
    return { ref: null, failure };
  }

  async function read(projectId) {
    const filePath = glossaryPath(projectId);
    if (filePath === null) {
      return error(GLOSSARY_ERROR_CODES.PROJECT_INVALID, "project must be an owner/project identifier", {
        project: projectId ?? null,
      });
    }
    const { ref, failure } = await resolveRef();
    if (ref === null) {
      if (failure) {
        return error(GLOSSARY_ERROR_CODES.UNAVAILABLE, "the repository could not be read", {
          branch: GLOSSARY_BRANCH,
          path: filePath,
          cause: String(failure?.stderr ?? failure?.message ?? failure).slice(0, 300),
        });
      }
      return error(GLOSSARY_ERROR_CODES.BRANCH_MISSING, `the ${GLOSSARY_BRANCH} branch does not exist`, {
        branch: GLOSSARY_BRANCH,
        path: filePath,
      });
    }
    let text;
    try {
      text = await git.show(ref, filePath, { cwd });
    } catch (err) {
      const missing = /does not exist|exists on disk, but not in|path .* does not match/iu.test(
        String(err?.stderr ?? err?.message ?? ""),
      );
      if (missing) {
        return { ok: true, data: { exists: false, ref, path: filePath, project: projectId } };
      }
      return error(GLOSSARY_ERROR_CODES.UNAVAILABLE, "the glossary branch could not be read", {
        branch: GLOSSARY_BRANCH,
        path: filePath,
        cause: String(err?.message ?? err).slice(0, 300),
      });
    }
    const parsed = parseGlossary(text);
    return {
      ok: true,
      data: {
        exists: true,
        ref,
        path: filePath,
        project: projectId,
        text,
        sha256: sha256Bytes(Buffer.from(text, "utf8")),
        terms: parsed.terms,
        errors: parsed.errors,
      },
    };
  }

  /** Compact view for agents that only need the state of the file. */
  async function status(projectId) {
    const result = await read(projectId);
    // The empty state is first class: a project that has not created its file
    // reports `exists: false` and has no terms to count.
    if (!result.ok || !result.data.exists) return result;
    const { text, terms, ...rest } = result.data;
    void text;
    return { ok: true, data: { ...rest, termCount: terms.length } };
  }

  /**
   * Search terms by canonical term, definition or forbidden form. The query is
   * normalized with the same rule the corpus check uses, so case and NFC
   * differences never hide a match.
   */
  async function search(projectId, { query, limit = DEFAULT_LIMIT } = {}) {
    const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
    const result = await read(projectId);
    if (!result.ok) return result;
    if (!result.data.exists) return result;
    const needle = normalizeGlossaryText(query ?? "");
    const terms = result.data.terms;
    const hits = [];
    if (needle !== "") {
      for (const term of terms) {
        const fields = [
          ["term", term.term],
          ["definition", term.definition],
          ...(term.forbiddenForms ?? []).map((form) => ["forbiddenForm", form]),
        ];
        const matched = fields.find(([, value]) => normalizeGlossaryText(value).includes(needle));
        if (!matched) continue;
        hits.push({
          id: term.id,
          term: term.term,
          definition: term.definition,
          line: term.line,
          matchedIn: matched[0],
          canonical: matched[0] === "forbiddenForm" ? term.term : null,
          forbidden: matched[0] === "forbiddenForm",
        });
        if (hits.length >= bounded) break;
      }
    }
    return {
      ok: true,
      data: {
        exists: true,
        ref: result.data.ref,
        path: result.data.path,
        project: result.data.project,
        sha256: result.data.sha256,
        query: query ?? "",
        limit: bounded,
        // True when the scan stopped at the limit. It means "the page is full",
        // not "another match is known to exist".
        truncated: hits.length >= bounded,
        hits,
      },
    };
  }

  return { read, status, search, path: glossaryPath };
}

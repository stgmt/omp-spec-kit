import { isCanonicalDocument } from "./transactions.js";

export const ELICITATION_REQUIRED = "ELICITATION_REQUIRED";
export const ELICITATION_SKILL_URI = "skill://spec-elicitation";
export const ELICITATION_HINT =
  "Before creating a specification Markdown document, read skill://spec-elicitation, assess source gaps, ask the user when needed, then retry; later edits are allowed.";

export class FirstWriteElicitationGuard {
  constructor() {
    this._recorded = new Set();
  }

  _key(spec, doc) {
    return String(spec) + "/" + doc;
  }

  _remember(key) {
    this._recorded.add(key);
  }

  checkAndRecord(spec, changes) {
    if (!Array.isArray(changes)) {
      return { ok: true };
    }

    const candidateDocs = [];
    for (const change of changes) {
      if (
        change?.beforeMissing === true &&
        change?.deleteAfter !== true &&
        typeof change?.document === "string" &&
        change.document.endsWith(".md") &&
        isCanonicalDocument(change.document, spec)
      ) {
        candidateDocs.push(change.document);
      }
    }

    if (candidateDocs.length === 0) {
      return { ok: true };
    }

    candidateDocs.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

    const allRecorded = candidateDocs.every((doc) =>
      this._recorded.has(this._key(spec, doc))
    );

    if (allRecorded) {
      return { ok: true };
    }

    for (const doc of candidateDocs) {
      this._remember(this._key(spec, doc));
    }

    return {
      ok: false,
      documents: candidateDocs,
    };
  }
}

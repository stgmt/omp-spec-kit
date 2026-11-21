/**
 * Coordinates one proposal review: fresh corpus snapshot, fragment selection,
 * the reviewer port, then a second snapshot that proves nothing moved.
 *
 * Both call sites use this: a specification patch (the text that is about to be
 * written) and a draft file noticed on a read (the plan the agent is working
 * on). The MCP server owns the trigger, so no host adapter is involved.
 */
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import {
  REVIEW_ERRORS,
  REVIEW_POLICY_DEFAULTS,
  buildCorpus,
  corpusFingerprint,
  draftClaims,
  invalidProposal,
  overallVerdict,
  reviewInputHash,
  selectFragments,
  toClaim,
} from "../kernel/proposal-review.js";

const DRAFT_MARKER = path.join(".omp-spec-kit", "draft.json");
const DRAFT_GLOBS = ["docs/plans"];

async function tryRead(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function newestPlanFile(root) {
  for (const dir of DRAFT_GLOBS) {
    const absolute = path.join(root, dir);
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch {
      continue;
    }
    const plans = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const full = path.join(absolute, entry.name);
      try {
        const info = await stat(full);
        plans.push({ full, mtimeMs: info.mtimeMs });
      } catch {}
    }
    if (plans.length === 0) continue;
    // Timestamps can tie on coarse filesystems; the path tie-break keeps the
    // choice deterministic instead of depending on directory order.
    plans.sort((a, b) => b.mtimeMs - a.mtimeMs || b.full.localeCompare(a.full));
    return plans[0].full;
  }
  return null;
}

/**
 * Which file is the draft under review: an explicit marker wins, otherwise the
 * newest plan document. Absence means there is nothing to review yet.
 */
export async function findDraftDraft(root) {
  const marker = await tryRead(path.join(root, DRAFT_MARKER));
  if (marker !== null) {
    try {
      const parsed = JSON.parse(marker);
      const declared = typeof parsed?.path === "string" ? parsed.path : "";
      if (declared !== "") {
        const text = await tryRead(path.resolve(root, declared));
        if (text !== null) return { path: declared, text };
      }
    } catch {}
  }
  const file = await newestPlanFile(root);
  if (file === null) return null;
  const text = await tryRead(file);
  if (text === null || text.trim() === "") return null;
  return { path: path.relative(root, file).split(path.sep).join("/"), text };
}

const emptyCoverage = (specState) => ({
  spec: specState,
  code: "not-supplied",
  tests: "not-supplied",
  conversation: "not-supplied",
});

/**
 * @param {object} options
 * @param {string} options.root corpus root
 * @param {() => Promise<{files?: {path: string, bytes: Buffer}[], error?: any}>} options.readCorpus
 * @param {object|null} options.reviewer ReviewerPort (null when not configured)
 * @param {string} [options.model]
 * @param {object} [options.policy]
 */
export function createProposalReviewService({ root, readCorpus, reviewer, embedder = null, model = null, policy = REVIEW_POLICY_DEFAULTS }) {
  const cache = new Map();
  const vectorCache = new Map();
  const MAX_CACHE = 32;

  const cosine = (a, b) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  };

  /** Passages with their vectors for one corpus snapshot, built at most once. */
  async function vectorIndex(corpus, fingerprint) {
    if (!embedder || corpus.passages.length === 0) return null;
    const cached = vectorCache.get(fingerprint);
    if (cached) return cached;
    const vectors = await embedder.embed(corpus.passages.map((p) => p.text));
    if (vectors.length !== corpus.passages.length) return null;
    const index = { corpus, vectors };
    if (vectorCache.size >= 8) vectorCache.clear();
    vectorCache.set(fingerprint, index);
    return index;
  }

  async function pickFragments(claim, corpus, index) {
    if (index) {
      const [vector] = await embedder.embed([claim]);
      if (Array.isArray(vector)) {
        return index.corpus.passages
          .map((passage, position) => ({ passage, score: cosine(vector, index.vectors[position]) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, policy.maxFragments)
          .map((item) => item.passage);
      }
    }
    return selectFragments(claim, corpus, policy.maxFragments);
  }

  return {
    get configured() {
      return reviewer !== null;
    },
    get model() {
      return model;
    },

    /**
     * @param {{draft: string, scope?: string[], kind?: string}} request
     */
    async reviewDraft({ draft, scope = [], kind = "draft" }) {
      const text = typeof draft === "string" ? draft : "";
      const claims = draftClaims(text);
      if (claims.length === 0) return { ok: false, error: invalidProposal("proposal text is empty") };

      const basisBase = { project: path.basename(path.resolve(root)), scope: [...scope].sort(), kind, proposalHash: reviewInputHash({ draft: text, scope: [...scope].sort(), kind }) };
      const cacheKey = `${basisBase.proposalHash}:${model ?? "none"}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      if (reviewer === null) {
        const notConfigured = {
          ok: true,
          data: {
            verdict: "insufficient",
            reviewState: "not-performed",
            reason: REVIEW_ERRORS.REVIEWER_NOT_CONFIGURED,
            proposalHash: basisBase.proposalHash,
            corpusFingerprint: null,
            reviewInputHash: null,
            coverage: emptyCoverage("available"),
            claims: [],
            needSources: [],
            reviewer: { configured: false, model: null },
            basis: basisBase,
          },
        };
        return notConfigured;
      }

      const snapshot = await readCorpus();
      if (!snapshot || snapshot.error) {
        return {
          ok: true,
          data: {
            verdict: "insufficient",
            reviewState: "not-performed",
            reason: "CORPUS_UNAVAILABLE",
            proposalHash: basisBase.proposalHash,
            corpusFingerprint: null,
            reviewInputHash: null,
            coverage: emptyCoverage("unavailable"),
            claims: [],
            needSources: [],
            reviewer: { configured: true, model },
            basis: basisBase,
          },
        };
      }

      const files = snapshot.files ?? [];
      const before = corpusFingerprint(files);
      const corpus = buildCorpus(files);
      if (corpus.passages.length === 0) {
        // Nothing to compare against: say so without spending a model call.
        return {
          ok: true,
          data: {
            verdict: "insufficient",
            reviewState: "not-performed",
            reason: "CORPUS_EMPTY",
            proposalHash: basisBase.proposalHash,
            corpusFingerprint: before,
            reviewInputHash: null,
            coverage: { ...emptyCoverage("available"), spec: "empty" },
            claims: [],
            needSources: [],
            reviewer: { configured: true, model },
            basis: basisBase,
          },
        };
      }
      const index = await vectorIndex(corpus, before).catch(() => null);

      const results = [];
      let failure = null;
      for (const claim of claims) {
        const fragments = await pickFragments(claim, corpus, index).catch(() => selectFragments(claim, corpus, policy.maxFragments));
        if (fragments.length === 0) {
          results.push({ text: claim, fragments: [], assessment: { forbids: null, supports: null, why: "no candidate fragments" } });
          continue;
        }
        try {
          const assessment = await reviewer.review({ claim, fragments });
          results.push({ text: claim, fragments, assessment });
        } catch (error) {
          failure = error;
          break;
        }
      }

      if (failure !== null) {
        return {
          ok: true,
          data: {
            verdict: "insufficient",
            reviewState: "not-performed",
            reason: REVIEW_ERRORS.REVIEWER_FAILED,
            detail: String(failure?.message ?? failure),
            proposalHash: basisBase.proposalHash,
            corpusFingerprint: before,
            reviewInputHash: null,
            coverage: emptyCoverage("available"),
            claims: [],
            needSources: [],
            reviewer: { configured: true, model },
            basis: basisBase,
          },
        };
      }

      const after = corpusFingerprint((await readCorpus())?.files ?? []);
      if (after !== before) {
        return {
          ok: true,
          data: {
            verdict: "insufficient",
            reviewState: "not-performed",
            reason: REVIEW_ERRORS.SOURCE_CHANGED,
            proposalHash: basisBase.proposalHash,
            corpusFingerprint: before,
            reviewInputHash: null,
            coverage: emptyCoverage("changed-during-review"),
            claims: [],
            needSources: [],
            reviewer: { configured: true, model },
            basis: basisBase,
          },
        };
      }

      const reviewed = results.map((item) =>
        toClaim({ text: item.text, fragments: item.fragments, assessment: item.assessment, policy }),
      );
      const basis = {
        ...basisBase,
        corpusFingerprint: before,
        fragments: results.flatMap((item) => item.fragments.map((fragment) => ({ id: fragment.id, fingerprint: fragment.fingerprint }))),
        model,
        policy,
        contract: "proposal-review@1",
      };
      const data = {
        verdict: overallVerdict(reviewed),
        reviewState: "completed",
        reason: null,
        proposalHash: basisBase.proposalHash,
        corpusFingerprint: before,
        reviewInputHash: reviewInputHash(basis),
        coverage: emptyCoverage("available"),
        claims: reviewed,
        needSources: reviewed
          .filter((claim) => claim.verdict === "insufficient")
          .map((claim) => ({ category: "spec", hint: claim.text.slice(0, 120), reason: claim.why || "no decisive evidence" })),
        reviewer: { configured: true, model },
        basis,
      };

      if (cache.size >= MAX_CACHE) cache.clear();
      cache.set(cacheKey, { ok: true, data });
      return { ok: true, data };
    },
  };
}

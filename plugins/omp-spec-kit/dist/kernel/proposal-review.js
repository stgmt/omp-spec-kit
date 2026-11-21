/**
 * Pure proposal-review rules: what counts as evidence, how a probability
 * becomes a verdict, and which inputs a result is bound to.
 *
 * Nothing here reads disk, env or the network. The reviewer port supplies
 * probabilities; this module decides what they are allowed to mean.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "./normalize.js";

export const REVIEW_CONTRACT_VERSION = "proposal-review@1";

export const REVIEW_ERRORS = Object.freeze({
  INVALID_PROPOSAL: "INVALID_PROPOSAL",
  SOURCE_CHANGED: "SOURCE_CHANGED",
  REVIEWER_NOT_CONFIGURED: "REVIEWER_NOT_CONFIGURED",
  REVIEWER_FAILED: "REVIEWER_FAILED",
  PROPOSAL_CONFLICT: "PROPOSAL_CONFLICT",
});

export const REVIEW_POLICY_DEFAULTS = Object.freeze({
  conflictThreshold: 0.95,
  supportThreshold: 0.95,
  // A claim is only "supported" while the forbid probability stays low: a soft
  // forbidding signal must downgrade to insufficient, never coexist with support.
  supportForbidCeiling: 0.5,
  maxFragments: 10,
  maxClaims: 40,
});

const MAX_SECTION_CHARS = 700;
const MIN_SECTION_CHARS = 120;

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const TOKEN = /[\p{L}\p{N}_-]{3,}/gu;

function tokens(text) {
  return (String(text ?? "").toLowerCase().match(TOKEN) ?? []).map((t) => t.replace(/^-+|-+$/gu, "")).filter((t) => t.length >= 3);
}

/** Split one document into reviewable passages. */
export function splitPassages(text, id) {
  const out = [];
  let buf = "";
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/u)) {
    const next = buf ? `${buf} ${sentence}` : sentence;
    if (next.length > MAX_SECTION_CHARS && buf) {
      out.push(buf.trim());
      buf = sentence;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  // A short document is still a document: the length floor only drops trailing
  // slivers of a long one, not the whole text.
  const kept = out.length <= 1 ? out.filter((p) => p.trim() !== "") : out.filter((p) => p.length >= MIN_SECTION_CHARS);
  return kept.map((p, index) => ({ id: `${id}#${index}`, text: p, fingerprint: sha256(p) }));
}

/**
 * Reader files carry bytes that may be a Buffer, a Uint8Array, or the plain
 * numeric-key object JSON round-tripping produces. All three decode here, so a
 * snapshot that survives a transport still has text.
 */
export function fileText(file) {
  const bytes = file?.bytes;
  if (Buffer.isBuffer(bytes)) return bytes.toString("utf8");
  if (bytes instanceof Uint8Array) return Buffer.from(bytes).toString("utf8");
  if (bytes && typeof bytes === "object") {
    const keys = Object.keys(bytes).filter((key) => /^\d+$/u.test(key));
    if (keys.length > 0) {
      keys.sort((a, b) => Number(a) - Number(b));
      return Buffer.from(keys.map((key) => bytes[key])).toString("utf8");
    }
  }
  return String(file?.content ?? "");
}

/** Build the searchable corpus from reader files ({path, bytes}). */
export function buildCorpus(files) {
  const passages = [];
  for (const file of files ?? []) {
    passages.push(...splitPassages(fileText(file), String(file?.path ?? "")));
  }
  const df = new Map();
  for (const p of passages) {
    for (const token of new Set(tokens(p.text))) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return { passages, df, size: passages.length };
}

/** Deterministic lexical selection: no second model, no index to maintain. */
export function selectFragments(claim, corpus, limit = REVIEW_POLICY_DEFAULTS.maxFragments) {
  const query = [...new Set(tokens(claim))];
  if (query.length === 0 || corpus.size === 0) return [];
  const scored = corpus.passages.map((passage) => {
    const seen = new Set(tokens(passage.text));
    let score = 0;
    for (const token of query) {
      if (seen.has(token)) score += Math.log(1 + corpus.size / (1 + (corpus.df.get(token) ?? 0)));
    }
    return { passage, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.passage);
}

/** Verdict from calibrated probabilities; the band is the whole point. */
export function bandVerdict(assessment, policy = REVIEW_POLICY_DEFAULTS) {
  const forbids = typeof assessment?.forbids === "number" ? assessment.forbids : null;
  const supports = typeof assessment?.supports === "number" ? assessment.supports : null;
  if (forbids !== null && forbids >= policy.conflictThreshold) return "conflict";
  if (supports !== null && supports >= policy.supportThreshold && (forbids === null || forbids < policy.supportForbidCeiling)) {
    return "supported";
  }
  return "insufficient";
}

const norm = (text) => String(text ?? "").toLowerCase().replace(/[«»"'`]/gu, "").replace(/\s+/gu, " ").trim();

/** A conflict is evidence only when its quote exists in the cited fragment. */
export function quoteInFragments(quote, fragments) {
  const q = norm(quote);
  if (!q) return false;
  return (fragments ?? []).some((fragment) => norm(fragment?.text).includes(q));
}

/** Added lines of a unified diff: the text a patch proposes. */
export function addedLines(diff) {
  if (typeof diff !== "string" || diff === "") return "";
  return diff
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n")
    .trim();
}

/**
 * One claim as the result contract reports it.
 *
 * Evidence has two honest shapes. A reviewer that returns a quote must have it
 * inside the cited fragment or the conflict falls to insufficient. A reviewer
 * that only returns probabilities (the Decisions API answers in numbers) cites
 * the fragments themselves; the claim is `fragment`-backed rather than
 * `quote`-backed, and the band alone decides.
 */
export function toClaim({ text, fragments, assessment, policy }) {
  const verdict = bandVerdict(assessment, policy);
  const quote = typeof assessment?.quote === "string" ? assessment.quote.trim() : "";
  const hasQuote = quote !== "";
  const quoteVerified = verdict === "conflict" && hasQuote ? quoteInFragments(quote, fragments) : false;
  const conflictAllowed = verdict !== "conflict" || !hasQuote || quoteVerified;
  return {
    text,
    verdict: conflictAllowed ? verdict : "insufficient",
    evidence: verdict === "conflict" && conflictAllowed ? (hasQuote ? "quote" : "fragment") : "none",
    verified: verdict === "conflict" && conflictAllowed,
    forbids: assessment?.forbids ?? null,
    supports: assessment?.supports ?? null,
    quote: quoteVerified ? quote : null,
    sources: fragments.map((f) => f.id),
    why: assessment?.why ?? "",
  };
}

/** Overall verdict: a conflict wins, support needs every claim supported. */
export function overallVerdict(claims) {
  if (!Array.isArray(claims) || claims.length === 0) return "insufficient";
  if (claims.some((claim) => claim.verdict === "conflict")) return "conflict";
  if (claims.every((claim) => claim.verdict === "supported")) return "supported";
  return "insufficient";
}

/**
 * Hash of everything a result depends on. Same input → same hash; any change
 * of draft, scope, corpus, fragments, policy or model → different hash.
 */
export function reviewInputHash(basis) {
  return sha256(canonicalJson({ contract: REVIEW_CONTRACT_VERSION, ...basis }));
}

export function corpusFingerprint(files) {
  const entries = (files ?? [])
    .map((file) => ({ path: String(file?.path ?? ""), sha256: sha256(fileText(file)) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return sha256(canonicalJson(entries));
}

/** Draft claims: sentences of the proposal, bounded and never empty. */
export function draftClaims(draft, limit = REVIEW_POLICY_DEFAULTS.maxClaims) {
  const text = String(draft ?? "").trim();
  if (text === "") return [];
  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);
  const picked = sentences.length > 0 ? sentences : [text];
  return picked.slice(0, limit);
}

export function invalidProposal(reason) {
  return { ok: false, code: REVIEW_ERRORS.INVALID_PROPOSAL, message: reason };
}

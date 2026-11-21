import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  addedLines,
  bandVerdict,
  buildCorpus,
  corpusFingerprint,
  draftClaims,
  overallVerdict,
  quoteInFragments,
  reviewInputHash,
  selectFragments,
  splitPassages,
  toClaim,
  REVIEW_POLICY_DEFAULTS,
} from "../src/kernel/proposal-review.js";
import { createProposalReviewService, findDraftDraft } from "../src/service/proposal-review.js";

const bytes = (text) => Buffer.from(text, "utf8");

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("band: a high forbid probability is a conflict", () => {
  assert.equal(bandVerdict({ forbids: 0.99, supports: 0.01 }), "conflict");
});

test("band: a soft forbid is insufficient, never supported", () => {
  assert.equal(bandVerdict({ forbids: 0.56, supports: 0.12 }), "insufficient");
  assert.equal(bandVerdict({ forbids: 0.7, supports: 1 }), "insufficient");
});

test("band: support needs both a high support and a low forbid", () => {
  assert.equal(bandVerdict({ forbids: 0.03, supports: 0.99 }), "supported");
  assert.equal(bandVerdict({ forbids: 0.9, supports: 0.99 }), "insufficient");
});

test("band: missing probabilities never produce support", () => {
  assert.equal(bandVerdict({ forbids: null, supports: null }), "insufficient");
});

test("quote verification requires the quote to exist in the cited fragment", () => {
  const fragments = [{ id: "a#0", text: "Новая ветка proposal не использует этот кеш." }];
  assert.equal(quoteInFragments("не использует этот кеш", fragments), true);
  assert.equal(quoteInFragments("не использует этот кошелёк", fragments), false);
  assert.equal(quoteInFragments("", fragments), false);
  // Containment proves presence, not polarity: "использует этот кеш" is inside
  // the negated sentence. Polarity rests on the reviewer's probability, which is
  // why a conflict also has to clear the band.
  assert.equal(quoteInFragments("использует этот кеш", fragments), true);
});

test("a conflict whose quote is absent from the fragment is downgraded", () => {
  const claim = toClaim({
    text: "переиспользуем кеш",
    fragments: [{ id: "a#0", text: "снимок строится на каждый запрос" }],
    assessment: { forbids: 0.99, supports: 0, quote: "не использует кеш" },
    policy: REVIEW_POLICY_DEFAULTS,
  });
  assert.equal(claim.verdict, "insufficient");
  assert.equal(claim.verified, false);
  assert.equal(claim.quote, null);
  assert.equal(claim.evidence, "none");
});

test("a probability-only reviewer backs the conflict with fragments, not a quote", () => {
  const claim = toClaim({
    text: "дать проверяющему инструменты",
    fragments: [{ id: "p#3", text: "no tools are given to the reviewer at any point" }],
    assessment: { forbids: 1, supports: 0 },
    policy: REVIEW_POLICY_DEFAULTS,
  });
  assert.equal(claim.verdict, "conflict");
  assert.equal(claim.evidence, "fragment");
  assert.equal(claim.verified, true);
  assert.equal(claim.quote, null);
  assert.deepEqual(claim.sources, ["p#3"]);
});

test("a verified conflict keeps its quote and source ids", () => {
  const claim = toClaim({
    text: "дать проверяющему инструменты",
    fragments: [{ id: "p#3", text: "не получает оболочку, прямую запись, ключи или инструменты изменения документов" }],
    assessment: { forbids: 0.99, supports: 0.01, quote: "ключи или инструменты изменения документов" },
    policy: REVIEW_POLICY_DEFAULTS,
  });
  assert.equal(claim.verdict, "conflict");
  assert.equal(claim.verified, true);
  assert.deepEqual(claim.sources, ["p#3"]);
});

test("overall verdict: one conflict wins, support needs every claim", () => {
  assert.equal(overallVerdict([]), "insufficient");
  assert.equal(overallVerdict([{ verdict: "supported" }, { verdict: "conflict" }]), "conflict");
  assert.equal(overallVerdict([{ verdict: "supported" }, { verdict: "supported" }]), "supported");
  assert.equal(overallVerdict([{ verdict: "supported" }, { verdict: "insufficient" }]), "insufficient");
});

test("reviewInputHash changes with every part of the basis", () => {
  const base = { draft: "a", scope: ["s"], model: "m", corpusFingerprint: "f" };
  const hash = reviewInputHash(base);
  assert.equal(hash, reviewInputHash({ ...base }));
  assert.notEqual(hash, reviewInputHash({ ...base, scope: ["s", "t"] }));
  assert.notEqual(hash, reviewInputHash({ ...base, model: "m2" }));
  assert.notEqual(hash, reviewInputHash({ ...base, draft: "b" }));
});

test("addedLines reads only proposed lines", () => {
  const diff = ["--- a/DESIGN.md", "+++ b/DESIGN.md", "@@ -1,2 +1,2 @@", " context", "-removed", "+added one", "+added two"].join("\n");
  assert.equal(addedLines(diff), "added one\nadded two");
  assert.equal(addedLines(""), "");
});

test("draft claims are sentences and never empty for real text", () => {
  assert.deepEqual(draftClaims("   "), []);
  assert.equal(draftClaims("Первое утверждение черновика. Второе утверждение.").length, 2);
});

test("selection is deterministic and prefers the passage that mentions the terms", () => {
  const corpus = buildCorpus([
    { path: "a", bytes: bytes("Проверяющий не получает ключи и инструменты изменения документов. Это ограничение действует всегда и не обсуждается.") },
    { path: "b", bytes: bytes("Каталог спек перечисляет документы и их статусы для автора проекта, без проверки смысла.") },
  ]);
  const first = selectFragments("проверяющему нужны инструменты изменения документов", corpus, 1);
  const again = selectFragments("проверяющему нужны инструменты изменения документов", corpus, 1);
  assert.deepEqual(first.map((f) => f.id), again.map((f) => f.id));
  assert.equal(first[0].id.startsWith("a#"), true);
});

test("corpusFingerprint is order independent and content sensitive", () => {
  const a = { path: "a", bytes: bytes("one") };
  const b = { path: "b", bytes: bytes("two") };
  assert.equal(corpusFingerprint([a, b]), corpusFingerprint([b, a]));
  assert.notEqual(corpusFingerprint([a, b]), corpusFingerprint([a, { path: "b", bytes: bytes("two!") }]));
});

test("splitPassages keeps short documents whole and chunks long ones", () => {
  const short = "Короткий раздел, которого достаточно для проверки.";
  assert.equal(splitPassages(short, "x").length, 1);
  const long = Array.from({ length: 40 }, (_, i) => `Утверждение номер ${i} о поведении системы.`).join(" ");
  assert.ok(splitPassages(long, "x").length > 1);
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const CORPUS = bytes(
  "Решение DEC-1: автоматическая подмена модели запрещена. Проверяющий не получает ключи или инструменты изменения документов. " +
    "Новая ветка proposal не использует ensure-кеш ни для снимка, ни для финального сравнения.",
);

function fakeReviewer(log = []) {
  return {
    model: "fake",
    async review({ claim, fragments }) {
      log.push(claim);
      const text = fragments.map((f) => f.text).join(" ");
      if (claim.includes("инструменты") && text.includes("инструменты изменения документов")) {
        return { forbids: 0.99, supports: 0.01, quote: "ключи или инструменты изменения документов" };
      }
      if (claim.includes("резервной") && text.includes("подмена модели запрещена")) {
        return { forbids: 0.98, supports: 0.0, quote: "автоматическая подмена модели запрещена" };
      }
      if (claim.includes("согласовано")) return { forbids: 0.02, supports: 0.99 };
      return { forbids: 0.1, supports: 0.1 };
    },
  };
}

const corpusOnce = () => Promise.resolve({ files: [{ path: "specs/demo/DESIGN.md", bytes: CORPUS }] });

test("empty draft is an invalid proposal", async () => {
  const service = createProposalReviewService({ root: "/repo", readCorpus: corpusOnce, reviewer: fakeReviewer() });
  const result = await service.reviewDraft({ draft: "   " });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_PROPOSAL");
});

test("not configured yields insufficient, not an error", async () => {
  const service = createProposalReviewService({ root: "/repo", readCorpus: corpusOnce, reviewer: null });
  const result = await service.reviewDraft({ draft: "Проверяющему нужны инструменты изменения документов." });
  assert.equal(result.ok, true);
  assert.equal(result.data.verdict, "insufficient");
  assert.equal(result.data.reason, "REVIEWER_NOT_CONFIGURED");
  assert.equal(result.data.reviewState, "not-performed");
});

test("an empty corpus is reported without calling the reviewer", async () => {
  const log = [];
  const service = createProposalReviewService({
    root: "/repo",
    readCorpus: () => Promise.resolve({ files: [] }),
    reviewer: fakeReviewer(log),
    embedder: { embed: async () => [] },
  });
  const result = await service.reviewDraft({ draft: "Проверяющему нужно дать инструменты изменения документов." });
  assert.equal(result.data.reason, "CORPUS_EMPTY");
  assert.equal(result.data.coverage.spec, "empty");
  assert.equal(log.length, 0);
});

test("a contradicting draft is reported as a verified conflict", async () => {
  const service = createProposalReviewService({ root: "/repo", readCorpus: corpusOnce, reviewer: fakeReviewer() });
  const result = await service.reviewDraft({ draft: "Проверяющему нужно дать инструменты изменения документов." });
  assert.equal(result.data.verdict, "conflict");
  const claim = result.data.claims[0];
  assert.equal(claim.verdict, "conflict");
  assert.equal(claim.verified, true);
  assert.match(claim.quote, /инструменты изменения документов/u);
  assert.equal(result.data.coverage.spec, "available");
  assert.equal(result.data.coverage.conversation, "not-supplied");
  assert.match(result.data.reviewInputHash, /^[0-9a-f]{64}$/u);
});

test("the second identical review is served from cache", async () => {
  const log = [];
  const service = createProposalReviewService({ root: "/repo", readCorpus: corpusOnce, reviewer: fakeReviewer(log) });
  const draft = "Проверяющему нужно дать инструменты изменения документов.";
  await service.reviewDraft({ draft });
  const calls = log.length;
  await service.reviewDraft({ draft });
  assert.equal(log.length, calls);
});

test("a reviewer failure is visible and never becomes support", async () => {
  const reviewer = {
    async review() {
      throw Object.assign(new Error("boom"), { code: "REVIEWER_FAILED" });
    },
  };
  const service = createProposalReviewService({ root: "/repo", readCorpus: corpusOnce, reviewer });
  const result = await service.reviewDraft({ draft: "Проверяющему нужно дать инструменты изменения документов." });
  assert.equal(result.data.verdict, "insufficient");
  assert.equal(result.data.reason, "REVIEWER_FAILED");
  assert.equal(result.data.reviewState, "not-performed");
});

test("a corpus that moves during the review is SOURCE_CHANGED", async () => {
  let call = 0;
  const readCorpus = () => {
    call += 1;
    const extra = call > 1 ? [{ path: "specs/demo/REQUIREMENTS.md", bytes: bytes("Новое требование, появившееся во время проверки.") }] : [];
    return Promise.resolve({ files: [{ path: "specs/demo/DESIGN.md", bytes: CORPUS }, ...extra] });
  };
  const service = createProposalReviewService({ root: "/repo", readCorpus, reviewer: fakeReviewer() });
  const result = await service.reviewDraft({ draft: "Проверяющему нужно дать инструменты изменения документов." });
  assert.equal(result.data.verdict, "insufficient");
  assert.equal(result.data.reason, "SOURCE_CHANGED");
});

test("draft discovery: explicit marker wins over the newest plan", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "draft-"));
  try {
    await mkdir(path.join(root, "docs/plans"), { recursive: true });
    await mkdir(path.join(root, ".omp-spec-kit"), { recursive: true });
    await writeFile(path.join(root, "docs/plans/declared.md"), "# Объявленный\n\nОбъявленный черновик.\n", "utf8");
    await writeFile(path.join(root, ".omp-spec-kit/draft.json"), JSON.stringify({ path: "docs/plans/declared.md" }), "utf8");
    // Written last so the fallback really is a different file.
    await writeFile(path.join(root, "docs/plans/newest-plan.md"), "# План\n\nСвежий план.\n", "utf8");
    const declared = await findDraftDraft(root);
    assert.equal(declared.path, "docs/plans/declared.md");
    assert.match(declared.text, /Объявленный черновик/u);

    await rm(path.join(root, ".omp-spec-kit/draft.json"));
    const fallback = await findDraftDraft(root);
    assert.equal(fallback.path, "docs/plans/newest-plan.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("draft discovery returns null when there is nothing to review", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "draft-none-"));
  try {
    assert.equal(await findDraftDraft(root), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

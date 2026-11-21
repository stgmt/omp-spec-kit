#!/usr/bin/env node
// Run against the real canonical corpus: a checkout of a `spec-<slug>` branch
// (only `.specs/<slug>/`), which is where this project's specifications live.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readConsistentRepositorySpecs } from "../../src/authoring/transactions.js";
import { createDecisionsReviewer, createEmbeddingsEmbedder } from "../../src/adapters/openai-decisions.js";
import { createProposalReviewService } from "../../src/service/proposal-review.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Fail closed: point this at a `spec-<slug>` branch worktree, never at a
// working code branch (which carries no `.specs/`) and never at a retired
// central specs repository.
const CORPUS_ROOT = process.env.OMP_SPEC_KIT_ROOT;
if (!CORPUS_ROOT) throw new Error("set OMP_SPEC_KIT_ROOT to a `spec-<slug>` branch worktree");

const DRAFT = `# План: проверка предложения

Проверка предложения запускается самим MCP-сервером при вызове spec_catalog, отдельного инструмента не будет.
Политику внешней отправки задаёт владелец репозитория правкой файла в корпусе проекта, отдельного администратора не требуется.
Результат проверки содержит вероятности запрета и поддержки по каждому утверждению черновика.`;

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const m = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
}

await loadEnv();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY missing");

const service = createProposalReviewService({
  root: CORPUS_ROOT,
  readCorpus: () => readConsistentRepositorySpecs({ root: CORPUS_ROOT }),
  reviewer: createDecisionsReviewer({ apiKey }),
  embedder: createEmbeddingsEmbedder({ apiKey }),
  model: process.env.OPENAI_REVIEW_MODEL || "gpt-6-luna",
});

const started = Date.now();
const result = await service.reviewDraft({ draft: DRAFT, scope: ["stgmt/omp-spec-kit"], kind: "live" });
const data = result.data ?? {};
console.log(`corpus: ${CORPUS_ROOT}`);
console.log(`verdict: ${data.verdict} | state: ${data.reviewState} | ${Date.now() - started}ms`);
console.log(`coverage: ${JSON.stringify(data.coverage)}`);
console.log(`hash: ${String(data.reviewInputHash ?? "").slice(0, 16)}`);
for (const claim of data.claims ?? []) {
  console.log(`- ${claim.verdict}${claim.verified ? " (verified)" : ""} forbid=${claim.forbids} support=${claim.supports}`);
  console.log(`  ${claim.text.slice(0, 110)}`);
  console.log(`  sources: ${(claim.sources ?? []).slice(0, 3).join(", ")}`);
}

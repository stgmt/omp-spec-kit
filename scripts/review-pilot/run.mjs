#!/usr/bin/env node
// Pilot: can a small model act as the reviewer of a proposal against a spec
// corpus, and which shape is cheapest per caught conflict?
// Spike code: no imports from src/, writes only under out/.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(import.meta.dirname, "out");
const API = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const K = 10;
const CONCURRENCY = 24;

const M = {
  nano: process.env.PILOT_NANO || "gpt-4o-mini",
  fast: process.env.PILOT_FAST || "gpt-4.1-mini",
  mid: process.env.PILOT_MID || "gpt-5.4-mini",
};

// USD per 1M tokens, platform.openai.com/docs/pricing, fetched 2026-11-16.
const PRICE = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-5.4-mini": { in: 0.75, out: 4.5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};

const isReasoning = (model) => /^gpt-5/u.test(model);
const tokenParam = (model, n) => (isReasoning(model) ? { max_completion_tokens: n } : { max_tokens: n });
const jsonMode = (model) => (isReasoning(model) ? {} : { response_format: { type: "json_object" } });

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const m = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing in .env");
}

const usage = { prompt: 0, completion: 0, calls: 0 };
async function api(kind, body, attempt = 0) {
  const res = await fetch(`${API}/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    return api(kind, body, attempt + 1);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${kind} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  if (json.usage) {
    usage.prompt += json.usage.prompt_tokens ?? 0;
    usage.completion += json.usage.completion_tokens ?? 0;
    usage.calls += 1;
  }
  return json;
}

const chatText = (json) => json.choices?.[0]?.message?.content ?? "";
function parseJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/u.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function pool(items, fn, limit = CONCURRENCY) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      try {
        out[i] = await fn(items[i], i);
      } catch (err) {
        out[i] = { error: String(err.message ?? err) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const norm = (s) => (s ?? "").toLowerCase().replace(/[«»"'`]/gu, "").replace(/\s+/gu, " ").trim();
function quoteMatches(quote, evidence) {
  const q = norm(quote);
  const e = norm(evidence);
  if (!q || !e) return false;
  if (e.includes(q) || q.includes(e)) return true;
  const qw = new Set(q.split(" ").filter((w) => w.length > 4));
  if (qw.size === 0) return false;
  const ew = new Set(e.split(" ").filter((w) => w.length > 4));
  let hit = 0;
  for (const w of qw) if (ew.has(w)) hit += 1;
  return hit / qw.size >= 0.6;
}

const PAIR_SYSTEM = `Ты сверяешь одно утверждение технического черновика с одним фрагментом спецификации.
Ответ строго JSON: {"verdict":"follows"|"contradicts"|"unrelated","quote":"точная цитата из фрагмента или пустая строка","why":"до 120 символов"}.
contradicts — только если фрагмент прямо запрещает, исключает или отменяет утверждение. follows — только если прямо подтверждает. Иначе unrelated. Не додумывай.`;
const BATCH_SYSTEM = `Ты сверяешь утверждение технического черновика с набором фрагментов спецификации.
Ответ строго JSON: {"verdict":"follows"|"contradicts"|"unrelated","quote":"точная цитата из подходящего фрагмента или пустая строка","source":"id фрагмента или пустая строка","why":"до 120 символов"}.
contradicts — только если какой-то фрагмент прямо запрещает, исключает или отменяет утверждение. follows — только если прямо подтверждает. Иначе unrelated. Не додумывай.`;
const REVIEW_SYSTEM = `Ты независимо проверяешь технический черновик против предоставленных фрагментов спецификации.
Выдели все проверяемые утверждения из полного черновика и для каждого дай вывод: "supported" (фрагмент прямо подтверждает), "conflict" (фрагмент прямо запрещает или отменяет), "insufficient" (источников не хватает).
Ответ строго JSON: {"claims":[{"text":"утверждение дословно из черновика","verdict":"supported"|"conflict"|"insufficient","quote":"точная цитата из фрагмента или пустая строка","source":"id фрагмента или пустая строка","why":"до 150 символов"}]}
Не пропускай утверждения: пустой список запрещён. Не додумывай того, чего нет во фрагментах.`;
const EXTRACT_SYSTEM = `Выдели из черновика все проверяемые утверждения. Ответ строго JSON: {"claims":["утверждение дословно"]}. Пустой список запрещён.`;

async function pairCall(model, claim, section) {
  const json = await api("chat/completions", {
    model,
    messages: [
      { role: "system", content: PAIR_SYSTEM },
      { role: "user", content: `УТВЕРЖДЕНИЕ:\n${claim}\n\nФРАГМЕНТ (${section.id}):\n${section.text}` },
    ],
    ...jsonMode(model),
    ...tokenParam(model, 600),
  });
  const p = parseJson(chatText(json)) ?? {};
  return {
    verdict: ["follows", "contradicts", "unrelated"].includes(p.verdict) ? p.verdict : "unrelated",
    quote: typeof p.quote === "string" ? p.quote : "",
    why: p.why ?? "",
    sourceText: section.text,
  };
}

async function batchCall(model, claim, sections) {
  const blocks = sections.map((s, i) => `[${i}] id=${s.id}\n${s.text}`).join("\n\n");
  const json = await api("chat/completions", {
    model,
    messages: [
      { role: "system", content: BATCH_SYSTEM },
      { role: "user", content: `УТВЕРЖДЕНИЕ:\n${claim}\n\nФРАГМЕНТЫ:\n${blocks}` },
    ],
    ...jsonMode(model),
    ...tokenParam(model, 800),
  });
  const p = parseJson(chatText(json)) ?? {};
  const cited = sections.find((s) => s.id === p.source);
  return {
    verdict: ["follows", "contradicts", "unrelated"].includes(p.verdict) ? p.verdict : "unrelated",
    quote: typeof p.quote === "string" ? p.quote : "",
    source: p.source ?? "",
    sourceText: cited ? cited.text : sections.map((s) => s.text).join("\n"),
    why: p.why ?? "",
  };
}

function aggregate(pairs) {
  const good = pairs.filter((p) => !p.error);
  const conflicts = good.filter((p) => p.verdict === "contradicts");
  // The design's rule: a conflict counts only when its quote exists in the
  // cited source. Anything else is not evidence, it is noise.
  const verified = conflicts.filter((c) => c.quote && c.sourceText && quoteMatches(c.quote, c.sourceText));
  if (verified.length) return { verdict: "conflict", verified: true, evidence: verified.map((c) => `${c.quote} ${c.why}`).join(" ") };
  if (conflicts.length) return { verdict: "insufficient", verified: false, rejected: conflicts.length, evidence: "" };
  const follows = good.filter((p) => p.verdict === "follows");
  if (follows.length) return { verdict: "supported", verified: false, evidence: follows.map((f) => `${f.quote} ${f.why}`).join(" ") };
  return { verdict: "insufficient", verified: false, evidence: "" };
}

function chunkSection(section) {
  const text = section.text;
  if (text.length <= 700) return [{ ...section }];
  const sentences = text.split(/(?<=[.!?])\s+/u);
  const parts = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > 700 && buf.length > 0) {
      parts.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.map((p, i) => ({ id: `${section.id}~${i}`, heading: section.heading, text: p }));
}

function splitSections(text, file) {
  const lines = text.split(/\r?\n/u);
  const sections = [];
  let heading = file;
  let buf = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body.length >= 120) sections.push({ id: `${file}#${heading}`, heading, text: body });
    buf = [];
  };
  for (const line of lines) {
    const h = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (h) {
      flush();
      heading = h[2].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections.flatMap(chunkSection);
}

async function embedAll(inputs) {
  const out = [];
  for (let i = 0; i < inputs.length; i += 128) {
    const json = await api("embeddings", { model: EMBED_MODEL, input: inputs.slice(i, i + 128) });
    for (const item of json.data) out.push(item.embedding);
  }
  return out;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function score(caseObj, claims) {
  const anyConflict = claims.some((c) => c.verdict === "conflict" && c.verified !== false);
  if (caseObj.expect === "conflict") {
    const hit = claims.find(
      (c) => c.verdict === "conflict" && c.verified !== false && (caseObj.quotes ?? []).some((q) => quoteMatches(q, `${c.quote ?? ""} ${c.why ?? ""} ${c.evidence ?? ""}`)),
    );
    return { ok: Boolean(hit), kind: hit ? "caught" : anyConflict ? "conflict-wrong-quote" : "missed" };
  }
  if (caseObj.expect === "consistent") return anyConflict ? { ok: false, kind: "false-alarm" } : { ok: true, kind: "clean" };
  const overclaim = claims.some((c) => c.verdict === "supported" || (c.verdict === "conflict" && c.verified !== false));
  return overclaim ? { ok: false, kind: "overclaim" } : { ok: true, kind: "honest-insufficient" };
}

const costOf = (model, pin, pout) => {
  const p = PRICE[model] ?? { in: 0, out: 0 };
  return (pin / 1e6) * p.in + (pout / 1e6) * p.out;
};

async function main() {
  await loadEnv();
  const spec = JSON.parse(await readFile(path.join(import.meta.dirname, "cases.json"), "utf8"));
  const corpus = [];
  for (const file of spec.corpus) {
    corpus.push(...splitSections(await readFile(path.join(ROOT, file), "utf8"), file));
  }
  const sectionVectors = await embedAll(corpus.map((s) => `${s.heading}\n${s.text}`));
  console.log(`corpus: ${corpus.length} passages from ${spec.corpus.length} files`);

  const cases = [];
  for (const caseObj of spec.cases) {
    const claims = caseObj.draft
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const vectors = await embedAll(claims);
    const top = claims.map((claim, i) => {
      const seen = new Set();
      const sections = corpus
        .map((section, j) => ({ section, score: cosine(vectors[i], sectionVectors[j]) }))
        .sort((a, b) => b.score - a.score)
        .map((r) => r.section)
        .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
        .slice(0, K);
      return { claim, sections };
    });
    const gold = [];
    for (const q of caseObj.quotes ?? []) {
      const found = corpus.find((s) => norm(s.text).includes(norm(q)));
      if (found) gold.push(found);
    }
    const retrievalHit = caseObj.expect !== "conflict" ? null : gold.length > 0 && top.some((t) => t.sections.some((s) => gold.some((g) => g.id === s.id)));
    cases.push({ ...caseObj, claims, top, gold, retrievalHit });
  }
  const conflictCases = cases.filter((c) => c.expect === "conflict");
  console.log(`retrieval recall (gold passage in top-${K}): ${conflictCases.filter((c) => c.retrievalHit).length}/${conflictCases.length}`);

  const runPairs = async (model, pick) => {
    const tasks = [];
    for (const c of cases) for (const item of c.top) for (const section of pick(c, item)) tasks.push({ c, item, section });
    const done = await pool(tasks, (t) => pairCall(model, t.item.claim, t.section));
    const claims = new Map(cases.map((c) => [c.id, new Map()]));
    tasks.forEach((t, i) => {
      const per = claims.get(t.c.id);
      if (!per.has(t.item.claim)) per.set(t.item.claim, []);
      per.get(t.item.claim).push(done[i]);
    });
    return cases.map((c) => ({
      id: c.id,
      expect: c.expect,
      claims: [...claims.get(c.id)].map(([claim, pairs]) => ({ text: claim, ...aggregate(pairs) })),
    }));
  };

  const runBatch = async (model) => {
    const tasks = [];
    for (const c of cases) for (const item of c.top) tasks.push({ c, item });
    const done = await pool(tasks, (t) => batchCall(model, t.item.claim, t.item.sections));
    const claims = new Map(cases.map((c) => [c.id, []]));
    tasks.forEach((t, i) => {
      const r = done[i];
      if (r.error) return;
      const verifiedConflict = r.verdict === "contradicts" && Boolean(r.quote) && quoteMatches(r.quote, r.sourceText ?? "");
      const verdict = verifiedConflict ? "conflict" : r.verdict === "follows" ? "supported" : "insufficient";
      claims.get(t.c.id).push({ text: t.item.claim, verdict, verified: verifiedConflict, evidence: `${r.quote} ${r.why}` });
    });
    return cases.map((c) => ({ id: c.id, expect: c.expect, claims: claims.get(c.id) }));
  };

  const runOnePass = async (model) => {
    const done = await pool(cases, async (c) => {
      const blocks = c.top.flatMap((t) => t.sections).filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
      const flat = blocks.map((s) => s.text).join("\n");
      const json = await api("chat/completions", {
        model,
        messages: [
          { role: "system", content: REVIEW_SYSTEM },
          { role: "user", content: `ЧЕРНОВИК:\n${c.draft}\n\nФРАГМЕНТЫ:\n${blocks.map((s) => `id=${s.id}\n${s.text}`).join("\n\n")}` },
        ],
        ...tokenParam(model, 3000),
      });
      const parsed = parseJson(chatText(json)) ?? {};
      return (parsed.claims ?? []).map((x) => {
        const raw = ["supported", "conflict", "insufficient"].includes(x.verdict) ? x.verdict : "insufficient";
        const verified = raw === "conflict" && Boolean(x.quote) && quoteMatches(x.quote, flat);
        return {
          text: x.text ?? "",
          verdict: raw === "conflict" && !verified ? "insufficient" : raw,
          verified,
          evidence: `${x.quote ?? ""} ${x.why ?? ""}`,
        };
      });
    });
    return cases.map((c, i) => ({ id: c.id, expect: c.expect, claims: done[i].error ? [] : done[i] }));
  };

  const runTwoStep = async (model) => {
    const extracted = await pool(cases, async (c) => {
      const json = await api("chat/completions", {
        model,
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          { role: "user", content: c.draft },
        ],
        ...tokenParam(model, 1200),
      });
      const list = (parseJson(chatText(json))?.claims ?? []).map(String).filter((s) => s.length > 8);
      return list.length ? list : c.claims;
    });
    const tasks = [];
    cases.forEach((c, ci) => {
      const blocks = c.top.flatMap((t) => t.sections).filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
      for (const claim of extracted[ci] ?? c.claims) tasks.push({ ci, claim, blocks });
    });
    const judged = await pool(tasks, (t) => batchCall(model, t.claim, t.blocks));
    const claims = new Map(cases.map((c) => [c.id, []]));
    tasks.forEach((t, i) => {
      const r = judged[i];
      if (r.error) return;
      const verifiedConflict = r.verdict === "contradicts" && Boolean(r.quote) && quoteMatches(r.quote, r.sourceText ?? "");
      const verdict = verifiedConflict ? "conflict" : r.verdict === "follows" ? "supported" : "insufficient";
      claims.get(cases[t.ci].id).push({ text: t.claim, verdict, verified: verifiedConflict, evidence: `${r.quote} ${r.why}` });
    });
    return cases.map((c) => ({ id: c.id, expect: c.expect, claims: claims.get(c.id) }));
  };

  const variants = [
    ["V0_oracle_pairs_4.1mini", M.fast, () => runPairs(M.fast, (c) => (c.gold.length ? c.gold : c.top[0].sections.slice(0, 1)))],
    ["V1_pairs_4o-mini", M.nano, () => runPairs(M.nano, (c, item) => item.sections)],
    ["V2_pairs_4.1mini", M.fast, () => runPairs(M.fast, (c, item) => item.sections)],
    ["V3_batch_4.1mini", M.fast, () => runBatch(M.fast)],
    ["V4_onepass_5.4mini", M.mid, () => runOnePass(M.mid)],
    ["V5_twostep_5.4mini", M.mid, () => runTwoStep(M.mid)],
  ];

  await mkdir(OUT, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), passages: corpus.length, models: M, price: PRICE, retrieval: { recall: `${conflictCases.filter((c) => c.retrievalHit).length}/${conflictCases.length}` }, variants: {} };

  for (const [name, model, run] of variants) {
    const before = { ...usage };
    const started = Date.now();
    const rows = await run();
    const scored = rows.map((r) => ({ ...r, ...score(cases.find((c) => c.id === r.id), r.claims) }));
    const pin = usage.prompt - before.prompt;
    const pout = usage.completion - before.completion;
    const total = costOf(model, pin, pout);
    const c1 = scored.filter((r) => r.expect === "conflict");
    const c2 = scored.filter((r) => r.expect === "consistent");
    const c3 = scored.filter((r) => r.expect === "insufficient");
    report.variants[name] = {
      model,
      perCaseMs: Math.round((Date.now() - started) / cases.length),
      tokens: { prompt: pin, completion: pout },
      costUsd: Number(total.toFixed(4)),
      costPerCaseUsd: Number((total / cases.length).toFixed(5)),
      score: `${scored.filter((r) => r.ok).length}/${scored.length}`,
      conflict: `${c1.filter((r) => r.ok).length}/${c1.length}`,
      consistent: `${c2.filter((r) => r.ok).length}/${c2.length}`,
      insufficient: `${c3.filter((r) => r.ok).length}/${c3.length}`,
      rows: scored,
    };
    const v = report.variants[name];
    console.log(`${name} [${model}]: score ${v.score} | conflict ${v.conflict} | clean ${v.consistent} | insufficient ${v.insufficient} | ${v.perCaseMs}ms/case | $${v.costPerCaseUsd}/case`);
    await writeFile(path.join(OUT, "results.json"), JSON.stringify(report, null, 2), "utf8");
  }
  console.log("wrote", path.join(OUT, "results.json"));
}

main().catch((err) => {
  console.error("pilot failed:", err.message ?? err);
  process.exit(1);
});

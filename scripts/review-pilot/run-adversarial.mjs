#!/usr/bin/env node
// Pilot 4 (option 2): adversarial pass. For each claim ask for the exact
// sentence that forbids this action by this subject, or null. A conflict counts
// only when the returned quote really exists in the supplied fragments.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(import.meta.dirname, "out");
const API = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const K = 10;
const MODEL = process.env.PILOT_ADV_MODEL || "gpt-6-luna";
const PRICE = { "gpt-6-luna": { in: 0.25, out: 2 }, "gpt-5.4-mini": { in: 0.75, out: 4.5 } };

const RELAXED = process.env.PILOT_ADV_RELAXED === "1";
const SYSTEM = RELAXED
  ? `Ты не подтверждаешь черновик, а ищешь опровержение.
Для утверждения верни ОДНО самое близкое предложение из фрагментов, которое ограничивает или запрещает это действие у этого субъекта. Не возвращай null из осторожности: если предложение касается того же действия или того же субъекта, верни его, даже если формулировка не идеальна. null — только если во фрагментах вообще нет ничего про это действие.
Цитата копируется дословно, без пересказа.
Ответ строго JSON: {"quote": "дословная цитата" | null, "fragmentId": "id или пустая строка", "why": "до 100 символов"}`
  : `Ты не подтверждаешь черновик, а ищешь опровержение.
Для утверждения найди в предоставленных фрагментах ОДНО дословное предложение, которое прямо запрещает, исключает или отменяет именно это действие у именно этого субъекта.
Требования:
- цитата копируется дословно, без пересказа и без склейки предложений;
- если предложение запрещает другое действие или другому субъекту — это не ответ;
- если запрещающего предложения нет, верни null.
Ответ строго JSON: {"quote": "дословная цитата" | null, "fragmentId": "id или пустая строка", "why": "до 100 символов"}`;

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const m = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
}

const usage = { prompt: 0, completion: 0, calls: 0 };
async function api(kind, body) {
  const res = await fetch(`${API}/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${kind} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  if (json.usage) {
    usage.prompt += json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0;
    usage.completion += json.usage.completion_tokens ?? json.usage.output_tokens ?? 0;
    usage.calls += 1;
  }
  return json;
}

const parseJson = (text) => {
  const f = /```(?:json)?\s*([\s\S]*?)```/u.exec(text);
  const body = f ? f[1] : text;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(body.slice(a, b + 1));
  } catch {
    return null;
  }
};

async function pool(items, fn, limit = 8) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      try {
        out[i] = await fn(items[i]);
      } catch (err) {
        out[i] = { error: String(err.message ?? err) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const norm = (s) => (s ?? "").toLowerCase().replace(/[«»"'`]/gu, "").replace(/\s+/gu, " ").trim();
const quoteMatches = (quote, evidence) => {
  const q = norm(quote);
  const e = norm(evidence);
  if (!q || !e) return false;
  if (e.includes(q) || q.includes(e)) return true;
  const qw = new Set(q.split(" ").filter((w) => w.length > 4));
  const ew = new Set(e.split(" ").filter((w) => w.length > 4));
  if (qw.size === 0) return false;
  let hit = 0;
  for (const w of qw) if (ew.has(w)) hit += 1;
  return hit / qw.size >= 0.6;
};

function chunkSection(section) {
  if (section.text.length <= 700) return [{ ...section }];
  const sentences = section.text.split(/(?<=[.!?])\s+/u);
  const parts = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > 700 && buf) {
      parts.push(buf.trim());
      buf = s;
    } else buf = buf ? `${buf} ${s}` : s;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.map((p, i) => ({ id: `${section.id}~${i}`, heading: section.heading, text: p }));
}

function splitSections(text, file) {
  const sections = [];
  let heading = file;
  let buf = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body.length >= 120) sections.push({ id: `${file}#${heading}`, heading, text: body });
    buf = [];
  };
  for (const line of text.split(/\r?\n/u)) {
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

const cosine = (a, b) => {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

async function adversarial(claim, fragments) {
  const json = await api("chat/completions", {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `УТВЕРЖДЕНИЕ:\n${claim}\n\nФРАГМЕНТЫ:\n${fragments.map((f) => `id=${f.id}\n${f.text}`).join("\n\n")}` },
    ],
    max_completion_tokens: 700,
  });
  const p = parseJson(json.choices?.[0]?.message?.content ?? "") ?? {};
  const quote = typeof p.quote === "string" && p.quote.trim() ? p.quote.trim() : null;
  const verified = Boolean(quote) && quoteMatches(quote, fragments.map((f) => f.text).join("\n"));
  return { quote, verified, why: p.why ?? "", fragmentId: p.fragmentId ?? "" };
}

async function main() {
  await loadEnv();
  const spec = JSON.parse(await readFile(path.join(import.meta.dirname, "cases.json"), "utf8"));
  const corpus = [];
  for (const file of spec.corpus) corpus.push(...splitSections(await readFile(path.join(ROOT, file), "utf8"), file));
  const vectors = await embedAll(corpus.map((s) => `${s.heading}\n${s.text}`));

  const cases = [];
  for (const c of spec.cases) {
    const claims = c.draft
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const cv = await embedAll(claims);
    const top = claims.map((claim, i) => {
      const seen = new Set();
      return {
        claim,
        fragments: corpus
          .map((section, j) => ({ section, score: cosine(cv[i], vectors[j]) }))
          .sort((a, b) => b.score - a.score)
          .map((r) => r.section)
          .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
          .slice(0, K),
      };
    });
    cases.push({ ...c, top });
  }

  const tasks = [];
  for (const c of cases) for (const item of c.top) tasks.push({ c, item });
  const started = Date.now();
  const done = await pool(tasks, (t) => adversarial(t.item.claim, t.item.fragments));

  const perCase = new Map(cases.map((c) => [c.id, []]));
  tasks.forEach((t, i) => {
    const r = done[i];
    if (r.error) return;
    perCase.get(t.c.id).push({ claim: t.item.claim, ...r });
  });

  const rows = cases.map((c) => {
    const claims = perCase.get(c.id) ?? [];
    const conflict = claims.some((x) => x.verified);
    const hitQuote = claims.some((x) => x.verified && (c.quotes ?? []).some((q) => quoteMatches(q, x.quote)));
    const ok = c.expect === "conflict" ? hitQuote : c.expect === "consistent" ? !conflict : !conflict;
    return { id: c.id, expect: c.expect, ok, conflict, hitQuote, claims };
  });

  const conf = rows.filter((r) => r.expect === "conflict");
  const cons = rows.filter((r) => r.expect === "consistent");
  const ins = rows.filter((r) => r.expect === "insufficient");
  const price = PRICE[MODEL] ?? { in: 0, out: 0 };
  const cost = (usage.prompt / 1e6) * price.in + (usage.completion / 1e6) * price.out;

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "adversarial.json"),
    JSON.stringify({ model: MODEL, calls: usage.calls, ms: Date.now() - started, tokens: usage, costUsd: cost, rows }, null, 2),
    "utf8",
  );

  console.log(`adversarial [${MODEL}] score ${rows.filter((r) => r.ok).length}/${rows.length} | conflict ${conf.filter((r) => r.ok).length}/${conf.length} | clean ${cons.filter((r) => !r.conflict).length}/${cons.length} | insufficient ${ins.filter((r) => !r.conflict).length}/${ins.length}`);
  console.log(`calls ${usage.calls} | ${Math.round((Date.now() - started) / tasks.length)}ms/call | $${cost.toFixed(4)} total, $${(cost / cases.length).toFixed(5)}/case`);
  for (const r of rows) if (!r.ok) console.log("  miss:", r.id, JSON.stringify(r.claims.map((x) => [x.verified, (x.quote ?? "").slice(0, 50)])));
}

main().catch((err) => {
  console.error("failed:", err.message ?? err);
  process.exit(1);
});

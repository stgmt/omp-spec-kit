#!/usr/bin/env node
// End-to-end: real MCP server over stdio, real corpus fixture, real reviewer.
// Proves the wiring, not the accuracy: the draft deliberately contradicts a
// decision that actually exists in the fixture corpus.
import { spawn } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SERVER = path.join(ROOT, "src/mcp/server.js");
const FIXTURE = path.join(ROOT, "tests/fixtures/kernel/authoring-real-corpus");

const DRAFT = `# План публикации

Публикация идёт по существующему пути с неизменяемым архивом.
Перед публикацией добавляем параллельный оценщик правомерности, который пересчитывает аттестации по внутренним доказательствам.
Каталог спек по-прежнему перечисляет документы и статусы.`;

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const m = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
}

function startServer({ cwd }) {
  const env = { ...process.env, OMP_SPEC_REVIEW: "1", OPENAI_REVIEW_MODEL: process.env.OPENAI_REVIEW_MODEL || "gpt-6-luna" };
  const child = spawn(process.execPath, [SERVER], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  const reader = createInterface({ input: child.stdout });
  const pending = new Map();
  reader.on("line", (line) => {
    if (!line.trim()) return;
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      return;
    }
    const entry = pending.get(frame.id);
    if (!entry) return;
    pending.delete(frame.id);
    clearTimeout(entry.timer);
    entry.resolve(frame);
  });
  let id = 0;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => reject(new Error(`${method} timed out\n${stderr}`)), 60000);
      pending.set(requestId, { resolve, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
    });
  const close = async () => {
    reader.close();
    child.stdin.end();
    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  };
  return { request, close };
}

async function initialize(server) {
  await server.request("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "review-e2e", version: "1.0.0" },
  });
  await server.request("notifications/initialized", undefined);
}

async function main() {
  await loadEnv();
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing in .env");

  const cwd = await mkdtemp(path.join(tmpdir(), "review-e2e-"));
  const server = startServer({ cwd });
  try {
    await cp(FIXTURE, cwd, { recursive: true });
    await mkdir(path.join(cwd, "docs/plans"), { recursive: true });
    await writeFile(path.join(cwd, "docs/plans/e2e-plan.md"), DRAFT, "utf8");

    await initialize(server);

    const catalog = await server.request("tools/call", { name: "spec_catalog", arguments: { view: "specs" } });
    const text = catalog?.result?.content?.[0]?.text ?? "";
    const payload = text ? JSON.parse(text) : {};
    const review = payload?.data?.review;

    console.log("catalog ok:", payload?.ok === true);
    if (!review) {
      console.log("FAIL: no review attached to spec_catalog");
      console.log(JSON.stringify(catalog).slice(0, 600));
      process.exitCode = 1;
      return;
    }
    console.log("draft path:", review.draftPath);
    console.log("verdict:", review.verdict, "| state:", review.reviewState, "| model:", review.reviewer?.model);
    console.log("coverage:", JSON.stringify(review.coverage));
    console.log("hash:", String(review.reviewInputHash).slice(0, 16));
    for (const claim of review.claims ?? []) {
      console.log(`  - ${claim.verdict}${claim.verified ? " (verified)" : ""} p_forbid=${claim.forbids} p_support=${claim.supports} :: ${claim.text.slice(0, 90)}`);
      if (claim.quote) console.log(`      quote: ${claim.quote.slice(0, 110)}`);
    }

    // H1: the same reviewer gates a specification write before it lands.
    const designPath = path.join(cwd, ".specs/plugin-distribution/DESIGN.md");
    const before = await readFile(designPath, "utf8");
    const patch = await server.request("tools/call", {
      name: "spec_patch",
      arguments: {
        intent: "patch",
        requestId: "e2e-review-1",
        spec: "plugin-distribution",
        reason: "review e2e",
        dryRun: false,
        operations: [
          {
            kind: "insert_at_eof",
            document: "DESIGN.md",
            text: "\nПеред публикацией добавляем параллельный оценщик правомерности, который пересчитывает аттестации по внутренним доказательствам.\n",
          },
        ],
      },
    });
    const patchPayload = JSON.parse(patch?.result?.content?.[0]?.text ?? "{}");
    const after = await readFile(designPath, "utf8");
    console.log("patch error code:", patchPayload?.error?.code ?? "(none)");
    if (patchPayload?.error) console.log("patch error detail:", JSON.stringify(patchPayload.error).slice(0, 500));
    console.log("patch review verdict:", patchPayload?.error?.review?.verdict ?? patchPayload?.data?.review?.verdict ?? "(none)");
    console.log("document unchanged:", before === after);

  } finally {
    await server.close();
    await rm(cwd, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
}

main().catch((error) => {
  console.error("e2e failed:", error?.message ?? error);
  process.exit(1);
});

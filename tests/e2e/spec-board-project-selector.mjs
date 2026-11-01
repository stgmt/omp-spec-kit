/**
 * Widget-level project selector regression: two projects + unassigned, with a
 * fake Host API. No live YouTrack is needed; the same board HTML is loaded from
 * disk and the host returns signed-shaped v7 markers.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const prefix = "SPEC-SYNC-STATE\n";
const node = (canonicalId) => ({
  canonicalId,
  specSlug: canonicalId.split(":")[0],
  localId: canonicalId.split(":")[1],
  kind: "FUNCTIONAL_REQUIREMENT",
  title: canonicalId,
  excerpt: "",
  taskStatus: null,
});
const snapshot = (nodes) => ({
  schemaVersion: "BoardSnapshotV1",
  fingerprint: "f".repeat(64),
  scope: { mode: "corpus", specSlugs: [] },
  complete: true,
  page: null,
  nodes,
  edges: [],
  counts: { nodes: nodes.length, edges: 0 },
});
const marker = (nodes, extra = {}) => ({
  schemaVersion: "BoardSnapshotV1",
  projectionVersion: 7,
  complete: true,
  cardIds: {},
  snapshot: snapshot(nodes),
  ...extra,
});
const issue = (id, idReadable, specId, body) => ({
  id,
  idReadable,
  summary: specId,
  description: prefix + JSON.stringify(body),
  customFields: [{ name: "SpecId", value: { text: specId } }],
});

const a1 = node("a1:FR-1");
const a2 = node("a2:FR-1");
const b1 = node("b1:FR-1");
const orphan = node("orphan:FR-1");
const root = issue("3-1", "SPEC-1", "SPEC:SYNC-STATE", marker([a1, a2, b1, orphan], {
  projects: [
    { id: "proj-a", pointer: "SPEC-101", nodeCount: 2, edgeCount: 0 },
    { id: "proj-b", pointer: "SPEC-102", nodeCount: 1, edgeCount: 0 },
  ],
  unassigned: { pointer: "SPEC-103", nodeCount: 1 },
  specProjects: { a1: "proj-a", a2: "proj-a", b1: "proj-b" },
}));
const pointers = {
  "SPEC-101": issue("3-2", "SPEC-101", "SPEC:SYNC-STATE:cHJvai1h", marker([a1, a2], {
    scope: { mode: "project", project: "proj-a", specSlugs: ["a1", "a2"] },
  })),
  "SPEC-102": issue("3-3", "SPEC-102", "SPEC:SYNC-STATE:cHJvai1i", marker([b1], {
    scope: { mode: "project", project: "proj-b", specSlugs: ["b1"] },
  })),
  "SPEC-103": issue("3-4", "SPEC-103", "SPEC:SYNC-STATE:__unassigned__", marker([orphan], {
    scope: { mode: "project", project: "__unassigned__", specSlugs: ["orphan"] },
  })),
};

let preference = "ALL";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
await page.exposeFunction("__getSpecBoardPreference", () => preference);
await page.exposeFunction("__setSpecBoardPreference", (value) => { preference = value; });
await page.addInitScript((payload) => {
  const host = {
    fetchYouTrack: async (apiPath) => {
      if (apiPath.startsWith("issues?")) return [payload.root];
      const match = /^issues\/([^?]+)/.exec(apiPath);
      return match && payload.pointers[match[1]] ? payload.pointers[match[1]] : null;
    },
    readCache: async () => ({ specBoardProject: await window.__getSpecBoardPreference() }),
    storeCache: async (data) => { await window.__setSpecBoardPreference(data.specBoardProject); },
  };
  window.YTApp = { register: async () => host };
}, { root, pointers });

const out = { steps: [], error: null };
try {
  await page.goto(pathToFileURL(path.resolve("tools/spec-graph-app/widgets/spec-board/index.html")).href);
  await page.locator("#project-select").waitFor({ state: "visible", timeout: 15000 });
  const read = async (label) => {
    const text = await page.locator("body").innerText();
    out.steps.push({
      label,
      selected: await page.locator("#project-select").inputValue(),
      options: await page.locator("#project-select option").allInnerTexts(),
      head: text.slice(0, 220),
    });
    return text;
  };

  const all = await read("all");
  assert.match(all, /Загружено: 4 узлов/u);
  assert.match(all, /proj-a \(2\)/u);
  assert.match(all, /proj-b \(1\)/u);

  await page.locator("#project-select").selectOption("proj-b");
  await page.waitForFunction(() => document.body.innerText.includes("Загружено: 1 узлов"), null, { timeout: 15000 });
  const b = await read("project-b");
  assert.match(b, /b1 \(1\)/u);
  assert.doesNotMatch(b, /a1 \(2\)/u);

  await page.locator("#project-select").selectOption("__unassigned__");
  await page.waitForFunction(() => document.body.innerText.includes("orphan (1)"), null, { timeout: 15000 });
  const unassigned = await read("unassigned");
  assert.match(unassigned, /orphan \(1\)/u);

  await page.evaluate(() => window.__setSpecBoardPreference("missing-project"));
  await page.reload();
  await page.locator("#project-select").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes("orphan (1)"), null, { timeout: 15000 });
  const unknown = await read("unknown-preference");
  assert.equal(out.steps.at(-1).selected, "__unassigned__", "unknown project must resolve to Unassigned");

  await page.locator("#project-select").selectOption("ALL");
  await page.waitForFunction(() => document.body.innerText.includes("Загружено: 4 узлов"), null, { timeout: 15000 });
  await read("all-again");
  await page.screenshot({ path: ".tmp/spec-board-project-selector-e2e.png", fullPage: false });
  assert.deepEqual(consoleErrors, [], "no console errors");
} catch (error) {
  out.error = String(error);
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
if (out.error) process.exit(1);

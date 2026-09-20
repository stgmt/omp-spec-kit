/**
 * Selling-video dogfood: the full onboarding journey recorded to video.
 * Headed Chrome + Playwright recordVideo (webm per context), visible
 * cursor + click ripple + per-action captions, chapter title cards,
 * ffmpeg concat → one mp4.
 *
 *   node tests/e2e/dogfood-video.mjs
 *
 * Output: %TEMP%/spec-dogfood-video/omp-spec-kit-onboarding.mp4
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { browserLogin } from "./lib/browser.mjs";
import { ADMIN_PASSWORD, APP_NAME } from "./lib/bootstrap.mjs";
import { createYouTrackAdmin } from "./lib/youtrack.mjs";
import {
  EXT_TENANT,
  EXT_USERS,
  EXT_YT_HOST_URL,
  ensureExtYoutrack,
  extAdmin,
  extBindBody,
} from "./lib/idp-fixture.mjs";
import { compose, SERVICE_URL, waitFor } from "./lib/compose.mjs";

const execFileAsync = promisify(execFile);
const OUT = "C:/Users/stigm/AppData/Local/Temp/spec-dogfood-video";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const APP_ZIP_FILE = (await readdir(path.join(REPO_ROOT, "dist"))).filter((f) => f.startsWith(`${APP_NAME}-`) && f.endsWith(".zip")).sort().pop();
const APP_ZIP_PATH = path.join(REPO_ROOT, "dist", APP_ZIP_FILE);
const EXT_REPO_URL = "git://spec-git/acme-specs.git";
const EXT_REPO_PATH = "/srv/git/acme-specs.git";
const basicAuth = `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`;
const log = (msg) => console.log(`\x1b[35m[video]\x1b[0m ${msg}`);

const VP = { width: 1600, height: 900 };

/**
 * Synthetic pointer is invisible in recordings — draw our own: a red dot
 * that follows real mousemove events (CDP-dispatched, so iframes get them
 * too) plus a ripple on mousedown. Hides after a beat of inactivity so a
 * stale dot never lingers over the wrong frame.
 */
const CURSOR_JS = `(() => {
  let lastMove = 0;
  const ensure = () => {
    if (!document.body) return;
    let c = document.getElementById("__vc");
    if (!c) {
      c = document.createElement("div");
      c.id = "__vc";
      c.style.cssText = "position:fixed;z-index:2147483647;left:-60px;top:-60px;width:16px;height:16px;border-radius:50%;background:rgba(255,70,70,.92);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.6);pointer-events:none;transition:opacity .25s";
      document.body.appendChild(c);
      const s = document.createElement("style");
      s.textContent = "@keyframes __vr{from{transform:scale(.5);opacity:.95}to{transform:scale(2.4);opacity:0}}";
      document.head.appendChild(s);
      addEventListener("mousemove", (e) => {
        lastMove = Date.now();
        c.style.opacity = "1";
        c.style.left = (e.clientX - 10) + "px";
        c.style.top = (e.clientY - 10) + "px";
      }, true);
      addEventListener("mousedown", (e) => {
        const r = document.createElement("div");
        r.style.cssText = "position:fixed;z-index:2147483647;left:" + (e.clientX - 12) + "px;top:" + (e.clientY - 12) + "px;width:24px;height:24px;border-radius:50%;border:3px solid rgba(80,170,255,.95);pointer-events:none;animation:__vr .55s ease-out forwards";
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 650);
      }, true);
    }
  };
  setInterval(ensure, 250);
})();`;

async function newRecording(browser, name) {
  const dir = path.join(OUT, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: VP, recordVideo: { dir, size: VP }, acceptDownloads: true });
  await context.addInitScript(CURSOR_JS);
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.waitForTimeout(1_500); // headed window needs a beat to reach full size
  return { context, page, dir };
}

async function titleCard(page, title, sub = "", ms = 2600) {
  await page.setContent(`<body style="margin:0;font-family:system-ui"><div style="position:fixed;inset:0;background:#0b0e14;color:#e8ecf1;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div style="font-size:44px;font-weight:700;letter-spacing:-0.5px;max-width:1300px;text-align:center">${title}</div>
    ${sub ? `<div style="font-size:22px;color:#9aa4b2;margin-top:18px;max-width:1100px;text-align:center">${sub}</div>` : ""}
  </div></body>`);
  await page.waitForTimeout(ms);
}

/**
 * Quest log, top-left: the persona's plan and where they are in it.
 * Re-created after every navigation (DOM wipes) — call again on step change.
 */
async function questLog(page, goal, steps, current) {
  await page.evaluate(({ goal, steps, current }) => {
    let el = document.getElementById("dogfood-quest");
    if (!el && document.body) {
      el = document.createElement("div");
      el.id = "dogfood-quest";
      el.style.cssText = "position:fixed;right:18px;top:18px;z-index:2147483647;background:rgba(10,13,18,.93);color:#fff;font:500 15px/1.5 system-ui;padding:14px 20px;border-radius:10px;border-left:4px solid #4da3ff;min-width:310px;box-shadow:0 4px 18px rgba(0,0,0,.45);pointer-events:none";
      document.body.appendChild(el);
    }
    if (!el) return;
    el.innerHTML =
      `<div style="font-weight:700;font-size:13px;letter-spacing:.08em;color:#6fb4ff;text-transform:uppercase;margin-bottom:9px">${goal}</div>` +
      steps.map((s, i) =>
        `<div style="margin:4px 0;opacity:${i === current ? 1 : i < current ? 0.6 : 0.38};${i === current ? "font-weight:600" : ""}">` +
        `${i < current ? '<span style="color:#5fd98a">✓</span>' : i === current ? '<span style="color:#6fb4ff">▶</span>' : '<span style="color:#889">○</span>'} ${s}</div>`
      ).join("");
  }, { goal, steps, current });
}

/** The quest box sits top-right — the same corner YouTrack uses for action
 *  buttons ("Add app"), dropdown menus and card headers. Hide it while a
 *  beat clicks through that zone; navigation wipes it anyway. */
async function questOverlay(page, visible) {
  await page.evaluate((v) => {
    const el = document.getElementById("dogfood-quest");
    if (el) el.style.display = v ? "" : "none";
  }, visible);
}

let lastCap = "";
async function caption(page, text) {
  lastCap = text;
  await page.evaluate((t) => {
    let el = document.getElementById("dogfood-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "dogfood-caption";
      el.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(10,12,16,.92);color:#fff;font:600 19px/1.45 system-ui;padding:13px 28px;text-align:center;border-top:2px solid #4da3ff;pointer-events:none";
      document.body.appendChild(el);
      const st = document.createElement("style");
      st.id = "dogfood-caption-style";
      st.textContent = "@keyframes dogfoodCapWord{from{opacity:0;transform:translateY(7px) scale(.92)}to{opacity:1;transform:none}}";
      document.head.appendChild(st);
    }
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = Array.isArray(t) ? t : [t];
    // Reels-style: words pop in one by one, fast enough to read along.
    let w = 0;
    el.innerHTML = lines.map((line, li) =>
      `<div style="${li === 0 ? "" : "font-weight:500;font-size:16.5px;color:#b8c4d4;margin-top:4px"}">` +
      String(line).split(/\s+/).filter(Boolean).map((word) =>
        `<span style="opacity:0;display:inline-block;animation:dogfoodCapWord .2s ${(w++) * 0.075}s forwards">${esc(word)}</span>`
      ).join(" ") +
      `</div>`
    ).join("");
  }, text);
}

/** Smooth glide of the visible cursor to the element's centre; returns the point. */
async function glide(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox().catch(() => null);
  if (!box) return null;
  const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(pt.x, pt.y, { steps: 30 });
  await page.waitForTimeout(450);
  return pt;
}

/** Click at the point the cursor glided to — mouse.down/up, no Playwright
 *  internal move, so the pointer only ever travels A→B on camera. */
async function press(page, pt) {
  if (!pt) return;
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
}

/** Visible click: glide, flash the target, click, settle. Throws when the
 *  target has no box — silent misses hid the admin-nav bug. */
async function vclick(page, loc, { settle = 500, optional = false } = {}) {
  const pt = await glide(page, loc);
  if (!pt && !optional) throw new Error("vclick: target has no bounding box");
  await loc.evaluate((el) => {
    el.style.outline = "3px solid #50aaff";
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 900);
  }).catch(() => {});
  await press(page, pt);
  await page.waitForTimeout(settle);
}

/** Visible typing: glide, click to focus, keystroke-per-keystroke input.
 *  `hint` pins a "где взять" tooltip above the field while typing. */
async function vtype(page, loc, text, { delay = 80, hint } = {}) {
  const pt = await glide(page, loc);
  const base = lastCap;
  if (hint) await caption(page, [...(Array.isArray(base) ? base : [base]), `поле — где взять: ${hint}`]);
  await press(page, pt);
  await loc.pressSequentially(text, { delay });
  await page.waitForTimeout(350);
  if (hint) await caption(page, base);
}

async function frameWith(page, selector, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (await frame.locator(selector).count().catch(() => 0)) return frame;
    }
    await page.waitForTimeout(800);
  }
  throw new Error(`frame with ${selector} did not render`);
}

function mcpTransportFromSnippet(snippet) {
  const server = snippet.mcpServers["omp-spec-kit"];
  const url = new URL(server.url);
  if (url.hostname === "spec-registryd") {
    url.hostname = "127.0.0.1";
    url.port = "8643";
  }
  return new StreamableHTTPClientTransport(url, { requestInit: { headers: server.headers } });
}

async function mcpCallWithSnippet(snippet, toolName, args) {
  const transport = mcpTransportFromSnippet(snippet);
  const client = new Client({ name: "dogfood-video", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const result = await client.callTool({ name: toolName, arguments: args });
    return { tools: tools.tools.length, result };
  } finally {
    await client.close();
  }
}

async function mcpSession(snippet) {
  const transport = mcpTransportFromSnippet(snippet);
  const client = new Client({ name: "dogfood-video-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

/** Terminal-styled page: real MCP calls shown as a live agent session. */
async function termInit(page, subtitle) {
  await page.setContent(`<body style="margin:0;background:#0b0e14;font-family:ui-monospace,Consolas,monospace">
    <div style="max-width:1180px;margin:70px auto;background:#0d1117;border:1px solid #2a3140;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="background:#161b24;padding:11px 18px;color:#8b93a5;font-size:13.5px;display:flex;gap:8px;align-items:center">
        <span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;display:inline-block"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#febc2e;display:inline-block"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#28c840;display:inline-block"></span>
        <span style="margin-left:10px">${subtitle}</span>
      </div>
      <div id="term" style="padding:22px 26px;color:#d6deeb;font-size:15.5px;line-height:1.75;min-height:640px"></div>
    </div></body>`);
}

async function termCmd(page, cmd, note) {
  if (note) {
    await page.evaluate((n) => {
      const el = document.createElement("div");
      el.style.color = "#6a737d";
      el.style.marginTop = "10px";
      el.textContent = `# ${n}`;
      document.getElementById("term").appendChild(el);
    }, note);
    await page.waitForTimeout(500);
  }
  await page.evaluate(async (c) => {
    const el = document.createElement("div");
    el.innerHTML = `<span style="color:#4da3ff">$&nbsp;</span><span style="color:#7ee787"></span>`;
    const span = el.querySelector("span:last-child");
    document.getElementById("term").appendChild(el);
    for (const ch of c) {
      span.textContent += ch;
      await new Promise((r) => setTimeout(r, 40));
    }
  }, cmd);
  await page.waitForTimeout(300);
}

async function termOut(page, lines, color = "#8b93a5") {
  await page.evaluate(({ lines, color }) => {
    for (const t of lines) {
      const el = document.createElement("div");
      el.style.color = color;
      el.style.whiteSpace = "pre-wrap";
      el.textContent = t;
      document.getElementById("term").appendChild(el);
    }
  }, { lines, color });
  await page.waitForTimeout(900);
}

/* ── Agent IDE surface ────────────────────────────────────────────────
 * A Claude-Code-like coding agent: file tree + editor + chat. Every tool
 * call rendered here is a REAL call — the page is a shell, the work is
 * done by the actual MCP session and YouTrack REST underneath. */

async function agentInit(page, subtitle) {
  await page.setContent(`<body style="margin:0;background:#0b0e14;font-family:system-ui">
    <div style="position:fixed;inset:0;display:flex;flex-direction:column">
      <div style="background:#161b24;padding:10px 20px;color:#8b93a5;font-size:13.5px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #2a3140">
        <span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;display:inline-block"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#febc2e;display:inline-block"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#28c840;display:inline-block"></span>
        <span style="margin-left:12px">${subtitle}</span>
      </div>
      <div style="flex:1;display:flex;min-height:0">
        <div id="files" style="width:210px;border-right:1px solid #2a3140;padding:14px 12px;font:13px/1.9 ui-monospace,Consolas,monospace;color:#8b93a5"></div>
        <div id="editor" style="flex:1;padding:14px 20px;font:12.5px/1.6 ui-monospace,Consolas,monospace;color:#c9d4e3;overflow:hidden;white-space:pre-wrap"></div>
      </div>
      <div id="chat" style="height:46%;border-top:1px solid #2a3140;padding:14px 22px;overflow:hidden;font-size:14.5px;line-height:1.65;color:#d6deeb"></div>
      <div style="border-top:1px solid #2a3140;padding:10px 22px;display:flex;gap:10px;align-items:center">
        <span style="color:#4da3ff;font-family:ui-monospace,monospace">&gt;</span>
        <span id="input" style="font-family:ui-monospace,monospace;color:#e8ecf1;font-size:14px"></span>
        <span style="color:#4da3ff;animation:__blink 1s steps(1) infinite">▌</span>
      </div>
    </div>
    <style>@keyframes __blink{50%{opacity:0}}</style></body>`);
  await page.evaluate(() => {
    const files = document.getElementById("files");
    for (const f of ["acme-portal/", "  .mcp.json", "  src/", "  package.json", "  README.md"]) {
      const el = document.createElement("div");
      el.textContent = f;
      if (f.includes(".mcp.json")) el.style.cssText = "color:#e8ecf1;background:#1c2433;border-radius:5px;padding:0 6px;margin-left:-6px";
      files.appendChild(el);
    }
  });
}

/** Renders a file in the editor pane (syntax-tinted JSON). */
async function agentShowFile(page, name, content) {
  await page.evaluate(({ name, content }) => {
    document.getElementById("editor").innerHTML =
      `<div style="color:#6b7688;font-size:12px;margin-bottom:8px;border-bottom:1px solid #2a3140;padding-bottom:6px">${name} — workspace</div>` +
      content.replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/"([^"]+)":/g, '<span style="color:#7ee787">"$1"</span>:')
        .replace(/: "([^"]*)"/g, ': <span style="color:#a5d6ff">"$1"</span>');
  }, { name, content });
  await page.waitForTimeout(600);
}

function chatBlock(who, html) {
  const styles = {
    user: "background:#182236;border:1px solid #2d4266;border-radius:10px;padding:8px 14px;margin:8px 0;color:#dce7f7",
    agent: "background:#121a18;border:1px solid #2a4a3c;border-radius:10px;padding:8px 14px;margin:8px 0;color:#d3e8dc",
    sys: "color:#6b7688;font-family:ui-monospace,monospace;font-size:12.5px;margin:6px 0",
    tool: "font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:#9db4d0;border-left:2px solid #35507a;padding:4px 12px;margin:6px 0;white-space:pre-wrap",
  };
  return `<div style="${styles[who]}">${html}</div>`;
}

async function agentAppend(page, who, html) {
  const block = chatBlock(who, html);
  await page.evaluate((markup) => {
    const el = document.createElement("div");
    el.innerHTML = markup;
    const node = el.firstChild;
    document.getElementById("chat").appendChild(node);
    node.scrollIntoView({ block: "end" });
  }, block);
  await page.waitForTimeout(700);
}

/** Types the user's prompt into the input line, then sends it. */
async function agentPrompt(page, text) {
  await page.evaluate(async (t) => {
    const input = document.getElementById("input");
    for (const ch of t) {
      input.textContent += ch;
      await new Promise((r) => setTimeout(r, 26));
    }
    await new Promise((r) => setTimeout(r, 500));
    input.textContent = "";
  }, text);
  await agentAppend(page, "user", `<b>Вы:</b> ${text.replace(/</g, "&lt;")}`);
}

/**
 * Finds the user's CURRENT password off-camera: bootstrap-provisioned users
 * rotate to `<password>b` on their first browser login (forced change), so
 * the plain value shows a visible "incorrect" frame when tried first.
 * If neither works yet, a warm-up login consumes the rotation off-camera.
 */
async function currentPassword(browser, login, password, baseUrl) {
  const probe = async (candidate) => {
    const r = await fetch(`${baseUrl}/api/users/me?fields=login`, {
      headers: { authorization: `Basic ${Buffer.from(`${login}:${candidate}`).toString("base64")}` },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    return r && r.ok;
  };
  if (await probe(`${password}b`)) return `${password}b`;
  if (await probe(password)) {
    // Consume a pending rotation off-camera if there is one. Provisioned
    // users carry passwordChangeRequired; the wizard-created admin does
    // not, so re-probe afterwards and return whichever value truly works.
    const ctx = await browser.newContext();
    const warm = await ctx.newPage();
    await browserLogin(warm, login, password, baseUrl).catch(() => {});
    await ctx.close();
    return (await probe(`${password}b`)) ? `${password}b` : password;
  }
  return password;
}

/** On-camera login — the viewer watches credentials being typed. */
async function vLogin(page, login, password, baseUrl, whoLine, quest = null) {
  await caption(page, whoLine);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" }); // YouTrack redirects to /login itself
  if (quest) await questLog(page, quest.goal, quest.steps, quest.current); // DOM wiped by goto — re-inject
  const user = page.locator("#username, input[name='username']").first();
  await user.waitFor({ state: "visible", timeout: 30_000 });
  await page.mouse.move(VP.width / 2, VP.height * 0.55, { steps: 25 }); // cursor drifts on-screen instead of spawning at 0,0
  await page.waitForTimeout(700);
  await vtype(page, user, login);
  await vtype(page, page.locator("#password, input[name='password']").first(), password, { delay: 70 });
  await vclick(page, page.getByRole("button", { name: /log in/i }).first(), { settle: 1_000 });
  await page.waitForTimeout(2_500);
  if (page.url().includes("/hub/auth/restore")) {
    // Forced rotation shouldn't appear (probed off-camera) — handle if it
    // does: YouTrack demands a NEW password, so rotate to `<pw>b` like the
    // bootstrap helper does, then log in again if no session was granted.
    const rotated = `${password}b`;
    await vtype(page, page.locator("#password"), rotated);
    await vtype(page, page.locator("#passwordRepeat"), rotated);
    await vclick(page, page.getByRole("button", { name: /change password/i }).first(), { settle: 4_000 });
    const granted = await page.evaluate(() => Object.keys(localStorage).some((k) => k.endsWith("-token"))).catch(() => false);
    if (!granted) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      const u2 = page.locator("#username, input[name='username']").first();
      await u2.waitFor({ state: "visible", timeout: 30_000 });
      await vtype(page, u2, login);
      await vtype(page, page.locator("#password, input[name='password']").first(), rotated, { delay: 70 });
      await vclick(page, page.getByRole("button", { name: /log in/i }).first(), { settle: 2_500 });
    }
  }
  // First-ever login lands on /welcome with the JetBrains survey — the
  // session token is not stored until it's dismissed and the app loads.
  // The survey renders a beat late, so retry the dismissal in the poll.
  const deadline = Date.now() + 30_000;
  for (;;) {
    const authed = await page.evaluate(() => Object.keys(localStorage).some((k) => k.endsWith("-token"))).catch(() => false);
    if (authed) break;
    if (Date.now() > deadline) throw new Error(`visible login failed for ${login}`);
    await dismissSurveys(page);
    await page.waitForTimeout(800);
  }
  if (quest) await questLog(page, quest.goal, quest.steps, quest.current);
  if (lastCap) await caption(page, lastCap); // SPA navigation wiped it — restore
  await page.mouse.move(VP.width * 0.5, VP.height * 0.45, { steps: 20 }); // respawn the cursor on the new page
  await page.waitForTimeout(2_000); // let the post-login SPA settle
}

/**
 * JetBrains' first-login survey ("Tell us a bit about yourself") blocks the
 * UI in every fresh browser profile — a person would close it, so we do:
 * visible click on the corner ✕, Escape as fallback.
 */
async function dismissSurveys(page) {
  const survey = page.getByText(/tell us a bit about yourself/i).first();
  if (!(await survey.isVisible().catch(() => false))) return false;
  await caption(page, "Опрос JetBrains при первом входе — закрываем крестиком");
  // Walk up from the heading to the white card, click the corner ✕ by coords.
  const corner = await survey.evaluate((el) => {
    let n = el;
    for (let i = 0; i < 8 && n.parentElement; i += 1) {
      const r = n.parentElement.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.75 || r.height > window.innerHeight * 0.8) break;
      n = n.parentElement;
    }
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width - 26, y: r.y + 40 };
  }).catch(() => null);
  if (corner) {
    await page.mouse.move(corner.x, corner.y, { steps: 20 });
    await page.waitForTimeout(450);
    await page.mouse.click(corner.x, corner.y);
    await page.waitForTimeout(900);
    if (!(await survey.isVisible().catch(() => false))) return true;
  }
  const xBtn = page.locator('button[aria-label*="lose" i], button[title*="lose" i]').first();
  if (await xBtn.isVisible().catch(() => false)) {
    await vclick(page, xBtn, { settle: 600 }).catch(() => {});
    if (!(await survey.isVisible().catch(() => false))) return true;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  return !(await survey.isVisible().catch(() => false));
}

/** Creates the first issue through the UI — a clean YouTrack has none.
 *  Issues → New issue button → summary → Create. */
/** Navigates the way a person does: sidebar Issues → click the issue row. */
async function openIssue(page, idReadable, cap, quest = null) {
  await caption(page, cap);
  if (await dismissSurveys(page)) await caption(page, cap);
  if (quest) await questLog(page, quest.goal, quest.steps, quest.current);
  const nav = page.getByRole("link", { name: /^Issues$/ }).first();
  if (await nav.isVisible().catch(() => false)) {
    await vclick(page, nav, { settle: 1_800 });
  }
  if (await dismissSurveys(page)) {
    await caption(page, cap);
    if (quest) await questLog(page, quest.goal, quest.steps, quest.current);
  }
  const link = page.getByRole("link", { name: idReadable, exact: true }).first();
  await link.waitFor({ state: "visible", timeout: 30_000 });
  await vclick(page, link, { settle: 2_200 });
}

/** REST helper for the customer YouTrack (admin basic auth). */
async function extRest(method, route, body) {
  const r = await fetch(`${EXT_YT_HOST_URL}${route}`, {
    method,
    headers: { authorization: basicAuth, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/**
 * The sync projection target on the customer YouTrack: a dedicated SPEC
 * project plus the fields the projection writes (SpecId/SpecKind/etc.).
 * `spec-graph-sync --provision` tops up link types and enum values, but the
 * project and its fields are one-time admin work — exactly what a customer
 * admin does once, so it lives in pre-stage, not on camera.
 */
async function provisionSpecProject() {
  const me = (await extRest("GET", "/api/users/me?fields=id")).body;
  const projects = (await extRest("GET", "/api/admin/projects?fields=id,shortName")).body ?? [];
  let spec = projects.find((p) => p.shortName === "SPEC");
  if (!spec) {
    const res = await extRest("POST", "/api/admin/projects?fields=id,shortName", { name: "Spec", shortName: "SPEC", leader: { id: me.id } });
    assert.equal(res.status, 200, `SPEC project create failed: ${JSON.stringify(res.body)}`);
    spec = res.body;
  }
  // Drop stale cards from a previous recording — the projection reconciles
  // but a clean slate keeps the dashboard honest.
  const stale = (await extRest("GET", "/api/issues?query=project:SPEC&fields=id&$top=500")).body ?? [];
  for (const it of stale) await extRest("DELETE", `/api/issues/${it.id}`);

  // The customer's team must be able to READ the SPEC project — the board
  // widget queries `project: SPEC` as the viewer, and an invisible project
  // is an invalid query value, not just an empty result.
  const specHub = (await extRest("GET", "/hub/api/rest/projects?query=SPEC&fields=id,key,name")).body?.projects?.find((p) => p.key === "SPEC");
  for (const login of ["mia", "noa"]) {
    const u = (await extRest("GET", `/hub/api/rest/users?query=login:${login}&fields=id,login`)).body?.users?.find((x) => x.login === login);
    if (u && specHub) await extRest("POST", `/hub/api/rest/projects/${specHub.id}/team/users`, { id: u.id });
  }

  const globals = { SpecId: "text", ContentHash: "text", Evidence: "text", SpecKind: "enum[1]" };
  const existing = (await extRest("GET", "/api/admin/customFieldSettings/customFields?fields=id,name")).body ?? [];
  const ids = new Map(existing.map((f) => [f.name, f.id]));
  for (const [name, fieldType] of Object.entries(globals)) {
    if (ids.has(name)) continue;
    const res = await extRest("POST", "/api/admin/customFieldSettings/customFields?fields=id,name", { fieldType: { id: fieldType }, name });
    assert.equal(res.status, 200, `field ${name} create failed: ${JSON.stringify(res.body)}`);
    ids.set(name, res.body.id);
  }
  const attached = new Set(((await extRest("GET", `/api/admin/projects/${spec.id}/customFields?fields=field(name)`)).body ?? []).map((r) => r.field?.name));
  for (const name of ["SpecId", "ContentHash", "Evidence"]) {
    if (attached.has(name)) continue;
    const res = await extRest("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      $type: "TextProjectCustomField", field: { id: ids.get(name) }, canBeEmpty: true,
    });
    assert.equal(res.status, 200, `attach ${name} failed: ${JSON.stringify(res.body)}`);
  }
  if (!attached.has("SpecKind")) {
    let bundle = (await extRest("GET", "/api/admin/customFieldSettings/bundles/enum?fields=id,name&query=SpecKind")).body?.[0];
    if (!bundle) {
      const res = await extRest("POST", "/api/admin/customFieldSettings/bundles/enum?fields=id", {
        name: "SpecKind values",
        values: [{ name: "ROADMAP" }, { name: "FUNCTIONAL_REQUIREMENT" }, { name: "TASK" }],
      });
      assert.equal(res.status, 200, `SpecKind bundle failed: ${JSON.stringify(res.body)}`);
      bundle = res.body;
    }
    // Typed entity refs are mandatory here — bare ids return 500.
    const res = await extRest("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      $type: "EnumProjectCustomField",
      field: { id: ids.get("SpecKind"), $type: "CustomField" },
      bundle: { id: bundle.id, $type: "EnumBundle" },
      canBeEmpty: true, emptyFieldText: "No SpecKind",
    });
    assert.equal(res.status, 200, `attach SpecKind failed: ${JSON.stringify(res.body)}`);
  }
  // The stock duplicates workflow throws runtime errors on this fixture
  // instance (dangling duplicate links from deleted probe issues) and blocks
  // ALL issue creation — detach it from every project.
  const allProjects = (await extRest("GET", "/api/admin/projects?fields=id,shortName")).body ?? [];
  for (const p of allProjects) {
    const workflows = (await extRest("GET", `/api/admin/projects/${p.id}/workflows?fields=id,workflow(name)`)).body ?? [];
    for (const w of workflows) {
      if (w.workflow?.name?.includes("duplicates")) await extRest("DELETE", `/api/admin/projects/${p.id}/workflows/${w.id}`);
    }
  }
  return spec;
}

/** The envelope's `ok` only means the call parsed — a refused patch carries
 *  `data.outcome === "REFUSED"` (e.g. ELICITATION_REQUIRED) and commits
 *  nothing. Returns { j, refused } — callers decide how to surface it. */
function patchOutcome(r) {
  const j = JSON.parse(r.content?.[0]?.text ?? "{}");
  return { j, refused: j.data?.outcome === "REFUSED" ? j.data.error ?? { code: "REFUSED" } : (j.ok === false ? j.error ?? { code: "ERR" } : null) };
}

/** Seed corpus via real MCP calls — the customer's pre-existing specs. */
async function seedTenantCorpus(mcp, issueId) {
  let n = 0;
  // requestIds must be unique per run — the service replays a cached APPLIED
  // for a known (requestId, payload) pair without committing anything.
  const stamp = Date.now();
  const patch = async (spec, intent, extra = {}) => {
    const args = { intent, requestId: `seed-${stamp}-${++n}`, reason: "existing specs", spec, dryRun: false, ...extra };
    // ELICITATION_REQUIRED is a one-shot gate per (spec, doc); CONFLICT can
    // be a post-migrate read race — both resolve on a clean retry.
    let { j, refused } = patchOutcome(await mcp.callTool({ name: "spec_patch", arguments: args }));
    for (const code of ["ELICITATION_REQUIRED", "CONFLICT"]) {
      if (refused?.code !== code) continue;
      await new Promise((r) => setTimeout(r, 2_000));
      ({ j, refused } = patchOutcome(await mcp.callTool({ name: "spec_patch", arguments: { ...args, requestId: `seed-${stamp}-${++n}-${code}` } })));
    }
    log(`seed ${intent} ${spec}: ok=${j.ok} outcome=${j.data?.outcome ?? "-"} ${refused?.code ?? j.error?.message ?? ""}`.slice(0, 140));
    assert.ok(j.ok !== false && !refused, `seed ${intent} ${spec}: ${refused?.code ?? j.error?.message ?? "failed"} ${refused?.message ?? ""}`);
    assert.equal(j.data?.outcome, "APPLIED", `seed ${intent} ${spec}: expected APPLIED, got ${j.data?.outcome}`);
    return j;
  };
  const claim = async (spec) => {
    const r = await mcp.callTool({ name: "spec_claim", arguments: { spec } });
    assert.ok(JSON.parse(r.content[0].text).ok !== false, `claim ${spec} failed`);
  };
  const release = (spec) => mcp.callTool({ name: "spec_release", arguments: { spec } }).catch(() => {});
  // Doc-level append tolerant of partial state: insert_at_eof when the doc
  // exists, replace_document (create) when it doesn't.
  const appendDoc = async (spec, document, text, title) => {
    try {
      await patch(spec, "patch", { operations: [{ kind: "insert_at_eof", document, text }] });
    } catch (e) {
      if (!/does not exist/.test(e.message)) throw e;
      await patch(spec, "patch", { operations: [{ kind: "replace_document", document, content: `# ${title}\n\nStatus: DRAFT\n${text}` }] });
    }
  };
  // Idempotent: a re-run may find leftovers — skip what already exists.
  // The catalog returns { kind: "specs", specs: ["slug", ...] }.
  const cat = await mcp.callTool({ name: "spec_catalog", arguments: { view: "specs" } });
  const catData = JSON.parse(cat.content?.[0]?.text ?? "{}").data ?? {};
  const have = new Set(Array.isArray(catData.specs) ? catData.specs : []);

  if (!have.has("acme-portal")) {
    // Their existing spec — the portal work that predates this demo.
    await claim("acme-portal");
    try { await patch("acme-portal", "createSpec", { title: "Acme Portal" }); }
    catch (e) { if (!/already exists|SPEC_EXISTS|EXISTS/i.test(e.message)) throw e; }
    await appendDoc("acme-portal", "FR.md",
      "\n## FR-1 — Журнал аудита админ-действий\n\nСистема ДОЛЖНА записывать каждое действие администратора: кто, когда и что изменил.\n", "Acme Portal");
    await appendDoc("acme-portal", "NFR.md",
      "\n## NFR-SEC-1 — Журнал не редактируется\n\nЗаписи аудита ДОЛЖНЫ быть append-only: ни администратор, ни сама система не могут изменить или удалить запись задним числом.\n", "Acme Portal");
    await appendDoc("acme-portal", "ACCEPTANCE_CRITERIA.md",
      "\n## AC-1.1 — Видимость записи\n\n**Given** админ изменил настройку, **when** открыт журнал аудита, **then** запись содержит автора, время и diff изменения.\n", "Acme Portal");
    await appendDoc("acme-portal", "TASKS.md",
      "\n## TASK-1 — Аудит-лог в админке\n\n- **Status:** todo\n\n**Implements:** FR-1\n\n**Refs:** NFR-SEC-1\n\n- **Done When:** действия админов видны в журнале аудита\n", "Acme Portal");
    await release("acme-portal");
  }

  if (!have.has("roadmap-growth")) {
    // Their roadmap — a milestone task refs the covered spec's FR, which is
    // what deriveScope reads: REFS/IMPLEMENTS edges from the roadmap spec's
    // own FR/TASK nodes define coverage and feed assembleRoadmap.
    await claim("roadmap-growth");
    try { await patch("roadmap-growth", "createSpec", { title: "Growth roadmap" }); }
    catch (e) { if (!/already exists|SPEC_EXISTS|EXISTS/i.test(e.message)) throw e; }
    try { await patch("roadmap-growth", "createRoadmap", { title: "Growth roadmap" }); }
    catch (e) { if (!/already|exist|marker/i.test(e.message)) throw e; }
    await appendDoc("roadmap-growth", "ROADMAP.md", `\n## Scope\n\n**Refs:** acme-portal:FR-1\n`, "Growth roadmap");
    await appendDoc("roadmap-growth", "TASKS.md",
      "\n## TASK-1 — Портал: аудит и контроль\n\n- **Status:** todo\n\n**Refs:** acme-portal:FR-1\n\n- **Done When:** аудит выкачен на портал\n", "Growth roadmap");
    try { await patch("roadmap-growth", "assembleRoadmap"); }
    catch (e) { log(`assembleRoadmap skipped: ${e.message.slice(0, 100)}`); }
    await release("roadmap-growth");
  }
}

async function serviceRest(token, method, route, body) {
  const response = await fetch(`${SERVICE_URL}${route}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * The customer's side of the story that runs in CI, not in the UI: clone the
 * specs repo and project the graph into their YouTrack (spec-graph-sync).
 * Runs off-camera with a caption — a cron job, not a person.
 */
async function runProjectionSync(extA2, adminUserId, extServiceIds) {
  const cloneDir = path.join(OUT, "acme-specs-sync");
  await rm(cloneDir, { recursive: true, force: true });
  await execFileAsync("git", ["clone", "-q", "git://127.0.0.1:9418/acme-specs.git", cloneDir], { timeout: 60_000 });
  const syncToken = (await extA2.createPermanentToken({ userId: adminUserId, name: "video-sync", serviceIds: extServiceIds })).token;
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "spec-graph-sync.mjs"), "--host", EXT_YT_HOST_URL, "--project", "SPEC"],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, OMP_SPEC_KIT_ROOT: path.join(cloneDir, "acme", "gamma"), YOUTRACK_TOKEN: syncToken },
      timeout: 120_000,
    },
  );
  assert.match(stdout, /"outcome":"SYNCED"/, `sync failed: ${stdout.slice(-400)}`);
  return stdout;
}

async function collectVideos(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".webm")).map((f) => path.join(dir, f));
  files.sort();
  return files;
}

async function concatToMp4(parts, outFile) {
  const listFile = path.join(OUT, "concat.txt");
  await writeFile(listFile, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  await execFileAsync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", listFile,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart",
    outFile,
  ], { timeout: 300_000 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const admin = createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD });
  const app = await admin.appByName(APP_NAME).catch(() => null);
  assert.ok(app, "spec-graph-app must be installed on the operator YouTrack");

  // Pre-stage the tenant world so the story flows without dead air. The
  // customer YouTrack already exists — the demo shows only OUR app install.
  log("pre-staging ext YouTrack + ACME project + tenant repo");
  const ext = await ensureExtYoutrack({ logger: log });
  const carol = await admin.findUserByLogin("carol");
  const serviceIds = [await admin.youtrackServiceId(), await admin.hubServiceId()];
  const ownerToken = await admin.createPermanentToken({ userId: carol.id, name: "video-owner", serviceIds });
  await serviceRest(ownerToken.token, "POST", "/idp/unbind", { tenant: EXT_TENANT });
  const extA = extAdmin();
  const extProject = await extA.createProject({ name: "Acme E2E", shortName: "ACME", leaderId: (await extA.meNative()).id });
  const hubProjectId = await extA.hubProjectId("ACME");
  for (const login of ["mia", "noa", "oda"]) {
    await extA.addUserToProjectTeam({ hubProjectId, userId: ext.users[login].id });
  }
  // Clean tenant: the app must be ABSENT — the video installs the ZIP on
  // camera. The project has the customer's own backlog (nothing about
  // spec-kit) — mia just opens her normal task and the panel is there.
  const extApp = await extA.appByName(APP_NAME).catch(() => null);
  if (extApp) await extA.uninstallApp(extApp.id);
  // The system-wide banner persists across runs — reset it so clip 1 shows
  // the admin enabling it from a clean slate and Mia meets it on camera.
  await extRest("POST", "/api/admin/globalSettings/appearanceSettings", { globalBanner: "", globalBannerEnabled: false });
  const staleIssues = await fetch(`${EXT_YT_HOST_URL}/api/issues?query=project:ACME&fields=id`, {
    headers: { authorization: basicAuth }, signal: AbortSignal.timeout(30_000),
  }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  for (const it of staleIssues ?? []) {
    await fetch(`${EXT_YT_HOST_URL}/api/issues/${it.id}`, { method: "DELETE", headers: { authorization: basicAuth }, signal: AbortSignal.timeout(30_000) });
  }
  const seededIssues = [];
  for (const summary of ["Перевести портал на SSO", "Лимиты API для мобильного клиента"]) {
    const created = await fetch(`${EXT_YT_HOST_URL}/api/issues?fields=idReadable`, {
      method: "POST",
      headers: { authorization: basicAuth, "content-type": "application/json" },
      body: JSON.stringify({ summary, project: { id: extProject.id } }),
      signal: AbortSignal.timeout(30_000),
    }).then(async (r) => {
      assert.ok(r.ok, `seed issue failed: ${r.status}`);
      return r.json();
    });
    seededIssues.push(created.idReadable);
  }
  // Fresh tenant repo every recording — stale migrations break bind-verify.
  // And drop the service's cached clone: after a bare-repo reset the old
  // checkout still carries acme-portal etc., so the migration verify fails.
  const mountKey = createHash("sha256").update(`${EXT_REPO_URL}|main`, "utf8").digest("hex").slice(0, 12);
  await execFileAsync("docker", ["exec", "spec-auth-e2e-spec-git-1", "sh", "-c",
    `rm -rf "${EXT_REPO_PATH}" && git init --bare --initial-branch=main "${EXT_REPO_PATH}"`]);
  // Restart the service: its in-memory graph/services/claims/replay-map only
  // refresh when git reports movement — a deleted-and-recreated clone leaves
  // last run's specs visible forever. A restart is the honest reset.
  await execFileAsync("docker", ["restart", "spec-auth-e2e-spec-registryd-1"], { timeout: 60_000 });
  await waitFor(`${SERVICE_URL}/mcp`, {
    timeoutMs: 90_000,
    accept: (r) => r.status === 400 || r.status === 401 || r.status === 405 || r.ok,
    label: "spec-registryd after restart",
  });
  await execFileAsync("docker", ["exec", "spec-auth-e2e-spec-registryd-1", "rm", "-rf", `/data/clones/${mountKey}`]);

  // Vendor-side step, off-camera — binding the customer's IdP is the
  // operator's job, not the customer's. One REST call binds their YouTrack
  // AND their specs repo (server migrates it). The response carries the
  // one-time install block the admin pastes into the app settings on camera.
  const bindRes = await serviceRest(ownerToken.token, "POST", "/idp/bind", {
    ...extBindBody({ serviceToken: ext.serviceToken }),
    repo: { url: EXT_REPO_URL, token: "e2e-unused-git-daemon", branch: "main" },
  });
  await admin.revokePermanentTokens({ userId: carol.id, name: "video-owner" });
  assert.equal(bindRes.status, 200, `idp/bind failed: ${JSON.stringify(bindRes.body).slice(0, 300)}`);
  assert.ok(bindRes.body?.install?.serviceBridgeToken, "idp/bind returned no install block");
  assert.ok(bindRes.body?.repos?.["acme/gamma"]?.migrated?.commit, `repo bind did not migrate: ${JSON.stringify(bindRes.body?.repos)}`);
  const install = { serviceUrl: bindRes.body.install.serviceUrl, bridgeToken: bindRes.body.install.serviceBridgeToken };

  // The SPEC projection target exists on any real customer instance once
  // the sync is adopted — project + fields are plain admin REST work.
  await provisionSpecProject();

  // Their pre-existing spec corpus: real spec_patch commits as mia, so the
  // board already has a roadmap → requirement → task chain before the demo.
  const extServiceIds = [await extA.youtrackServiceId(), await extA.hubServiceId()];
  const miaSeedToken = (await extA.createPermanentToken({ userId: ext.users.mia.id, name: "video-seed", serviceIds: extServiceIds })).token;
  // Previous recordings leave Mia's dashboards behind — wipe them so the
  // on-camera "New dashboard" is the only one.
  for (const d of (await fetch(`${EXT_YT_HOST_URL}/api/dashboards?fields=id`, { headers: { authorization: `Bearer ${miaSeedToken}` } }).then((r) => r.json()).catch(() => [])) ?? []) {
    await fetch(`${EXT_YT_HOST_URL}/api/dashboards/${d.id}`, { method: "DELETE", headers: { authorization: `Bearer ${miaSeedToken}` } }).catch(() => {});
  }
  // X-Spec-Project pins the scope — without it writes land in the operator's
  // default corpus instead of the customer's bound repo.
  const seedMcp = await mcpSession({ mcpServers: { "omp-spec-kit": { url: `${SERVICE_URL}/mcp`, headers: { Authorization: `Bearer ${miaSeedToken}`, "X-Spec-Idp": EXT_TENANT, "X-Spec-Project": "acme/gamma" } } } });
  // The bind's migrate commit just landed — wait until the service's corpus
  // view is FRESH (SPEC_REGISTRY_SYNC_MS=5000): gamma-spec present AND none
  // of the previous recording's specs still visible. A stale view makes the
  // seed skip creation entirely, and the agent later hits PATH_FORBIDDEN on
  // documents that were never written.
  {
    const stale = /acme-portal|roadmap-growth|acme-sso|zz-probe/;
    const deadline = Date.now() + 30_000;
    for (;;) {
      const cat = await seedMcp.callTool({ name: "spec_catalog", arguments: { view: "specs" } });
      const specs = JSON.parse(cat.content?.[0]?.text ?? "{}").data?.specs ?? [];
      if (specs.includes("gamma-spec") && !specs.some((s) => stale.test(s))) break;
      if (Date.now() > deadline) throw new Error(`tenant corpus never settled: ${JSON.stringify(specs)}`);
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  try {
    await seedTenantCorpus(seedMcp, seededIssues[0]);
  } finally {
    await seedMcp.close();
  }

  const browser = await chromium.launch({ channel: "chrome", headless: false, slowMo: 160 });
  const parts = [];
  try {
    // ══ Part 1 — install the app ZIP into the customer's own YouTrack ════
    {
      const { context, page, dir } = await newRecording(browser, "01-admin");
      await titleCard(page, "omp-spec-kit — подключаем к своему YouTrack", "Свой YouTrack + ZIP из релиза — ставится за пару минут", 3800);

      // Honest prerequisite, on camera: the whole demo runs on a local
      // docker-compose stack — and we show the actual `up -d` first, not a
      // "trust me it is running" ps on a pre-existing stand.
      {
        // Child processes inherit this shell's proxy env — strip it so the
        // curls we show hit localhost directly (same as a plain terminal).
        const noProxyEnv = { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "" };
        const { stdout: upStdout, stderr: upStderr } = compose(["up", "-d", "youtrack-ext", "spec-git", "spec-registryd"]);
        // docker compose writes container status to stderr on Windows — merge both.
        const upOut = `${upStdout}\n${upStderr}`;
        const { stdout: psTable } = compose(["ps", "--format", "table {{.Service}}\\t{{.Status}}\\t{{.Ports}}", "youtrack-ext", "spec-git", "spec-registryd"]);
        const ytCode = (await execFileAsync("curl", ["-s", "-o", "NUL", "-w", "%{http_code}", EXT_YT_HOST_URL], { env: noProxyEnv }).catch(() => ({ stdout: "000" }))).stdout.trim();
        const svcCode = (await execFileAsync("curl", ["-s", "-o", "NUL", "-w", "%{http_code}", `${SERVICE_URL}/mcp`], { env: noProxyEnv }).catch(() => ({ stdout: "000" }))).stdout.trim();
        const gitRefs = (await execFileAsync("git", ["ls-remote", "git://127.0.0.1:9418/acme-specs.git"], { env: noProxyEnv }).catch(() => ({ stdout: "(no refs — пустой репозиторий)" }))).stdout;
        await termInit(page, "terminal — поднимаем стенд перед демо");
        await page.waitForTimeout(600); // setContent wiped the cursor element — let the injector respawn
        await caption(page, [
          "Стенд — локальный docker-compose: YouTrack, git с спеками, сервис реестра",
          "Поднимаем одной командой и проверяем, что всё отвечает",
        ]);
        await termCmd(page, "docker compose -p spec-auth-e2e -f tests/e2e/compose.yml up -d youtrack-ext spec-git spec-registryd", "поднимаем три сервиса стенда одной командой");
        // On an already-running stack compose prints short "Running" lines;
        // keep only the container status lines so the output stays readable.
        const upLines = upOut.split("\n").map((l) => l.trim()).filter((l) => /Running|Started|Healthy|Created|Running/.test(l));
        await termOut(page, upLines.length ? upLines.slice(0, 8) : ["(тихо — все три контейнера уже подняты)"]);
        await termCmd(page, "docker compose -p spec-auth-e2e -f tests/e2e/compose.yml ps --format \"table {{.Service}}\\t{{.Status}}\\t{{.Ports}}\" youtrack-ext spec-git spec-registryd", "какие сервисы подняты и на каких портах слушают");
        await termOut(page, psTable.trimEnd().split("\n"));
        await termCmd(page, `curl -s -o NUL -w "%{http_code}" ${EXT_YT_HOST_URL}`, "YouTrack отвечает на :8082? ждём 200");
        await termOut(page, [`${ytCode}   ← YouTrack на localhost:8082`], ytCode === "200" ? "#5fd98a" : "#ff7a7a");
        await termCmd(page, `curl -s -o NUL -w "%{http_code}" ${SERVICE_URL}/mcp`, "сервис реестра спек слушает :8643? /mcp — только POST, поэтому 405 = жив");
        await termOut(page, [`${svcCode}   ← spec-registryd на localhost:8643 (405 — эндпоинт ждёт MCP-POST, это норма)`], svcCode === "405" || svcCode === "200" ? "#5fd98a" : "#ff7a7a");
        await termCmd(page, "git ls-remote git://127.0.0.1:9418/acme-specs.git", "git-репозиторий спек отвечает по git:// — выводит его refs");
        await termOut(page, gitRefs.trimEnd().split("\n"));
        await termOut(page, [
          "✓ стенд поднят и отвечает: YouTrack, git-репозиторий спек, spec-registryd — всё на 127.0.0.1",
        ], "#5fd98a");
        await page.waitForTimeout(1_600);
      }

      const adminQuest = {
        goal: "Часть 1 · Подключение omp-spec-kit к YouTrack",
        steps: ["Войти под администратором", "Скачать ZIP с релиза на GitHub", "Apps → Add app → Upload ZIP", "serviceUrl + bridgeToken — выдал сервис при привязке", "Включить для проекта ACME", "Системный баннер-подсказка"],
      };
      const extAdminPw = await currentPassword(browser, "admin", ADMIN_PASSWORD, EXT_YT_HOST_URL);
      await vLogin(page, "admin", extAdminPw, EXT_YT_HOST_URL, "Входим под администратором — приложения ставит админ", { ...adminQuest, current: 0 });
      await dismissSurveys(page);

      // Where the ZIP comes from: the public GitHub release of omp-spec-kit.
      // Show the latest release tag + the app asset, and really download it —
      // the customer gets exactly this file, not a hand-built artifact.
      await questLog(page, adminQuest.goal, adminQuest.steps, 1);
      await caption(page, [
        "Откуда берётся ZIP: релизы omp-spec-kit на GitHub",
        "github.com/stgmt/omp-spec-kit/releases/latest — открываем",
      ]);
      await page.goto("https://github.com/stgmt/omp-spec-kit/releases/latest", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_500); // GitHub hydrates the release card lazily
      await questLog(page, adminQuest.goal, adminQuest.steps, 1);
      const zipAsset = page.locator('a[href*="spec-graph-app"][href$=".zip"]').first();
      // Assets live in a lazy include-fragment — scroll to it, expand if needed.
      for (let i = 0; i < 8 && !(await zipAsset.count()); i++) {
        await page.mouse.move(780, 500);
        await page.mouse.wheel(0, 450);
        await page.waitForTimeout(900);
      }
      if (!(await zipAsset.count())) {
        const summary = page.locator("details summary, details .Details-content--title, summary:has-text('Assets')").filter({ hasText: /assets/i }).first();
        if (await summary.count()) await summary.click().catch(() => {});
      }
      await zipAsset.waitFor({ state: "visible", timeout: 30_000 });
      await zipAsset.scrollIntoViewIfNeeded().catch(() => {});
      await caption(page, [
        "Релизы omp-spec-kit → Assets → spec-graph-app-*.zip — на проде файл берут отсюда",
        "В записи ставим свежую сборку из dist/ — на шаг новее опубликованного релиза",
      ]);
      const zipBox = await zipAsset.boundingBox().catch(() => null);
      if (zipBox) {
        await page.mouse.move(zipBox.x + zipBox.width / 2, zipBox.y + zipBox.height / 2, { steps: 30 });
        await page.waitForTimeout(1_400);
      }
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
        zipAsset.click().catch(() => {}),
      ]);
      await page.waitForTimeout(2_200); // let Chrome's download bubble be seen
      if (dl) log(`github release asset downloaded: ${dl.suggestedFilename()}`);
      await page.goto(EXT_YT_HOST_URL + "/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1_800);
      await dismissSurveys(page);
      await questLog(page, adminQuest.goal, adminQuest.steps, 2);
      await caption(page, [
        "Меню Administration → раздел Apps — сюда ставятся приложения",
        "Add app → Upload ZIP — выбираем ZIP, который только что скачали с релиза",
      ]);
      await vclick(page, page.locator('div[data-test="ring-dropdown administration"]'), { settle: 1_200 });
      await vclick(page, page.locator('a[href*="admin/apps"]').first(), { settle: 2_000 });
      await caption(page, [
        `Upload ZIP → ${APP_ZIP_FILE} — обычный системный диалог выбора файла`,
        "После загрузки YouTrack сам открывает карточку приложения",
      ]);
      // The Add-app button and its dropdown live top-right — exactly under
      // the quest box. Hide it for the upload beat so the install is seen.
      await questOverlay(page, false);
      await vclick(page, page.getByRole("button", { name: /add app/i }).first(), { settle: 800 });
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 15_000 }),
        vclick(page, page.getByRole("button", { name: /upload zip file/i }).first(), { settle: 200 }),
      ]);
      await chooser.setFiles(APP_ZIP_PATH);
      // The "is uploaded!" toast text is not reliable across versions — the
      // card selection (?selected=<appId>) is the durable confirmation.
      await page.waitForURL(/[?&]selected=\d+-/, { timeout: 60_000 });
      await page.waitForTimeout(2_000); // let the opened card be seen
      await questOverlay(page, true);
      await caption(page, [
        "Карточка Spec Service открылась — приложение установлено. Теперь настройки",
        "Вкладка Settings — два поля из install-блока, который сервис показал один раз при привязке YouTrack",
      ]);
      await questLog(page, adminQuest.goal, adminQuest.steps, 3);
      const settingsTab = page.locator('a[data-test="ring-link"], button[data-test="ring-link"]').filter({ hasText: /^Settings/ }).first();
      await vclick(page, settingsTab, { settle: 1_200 });
      await vtype(page, page.locator('input[name="serviceUrl"]'), install.serviceUrl, { delay: 40, hint: "адрес spec-registryd — из install-блока при привязке IdP" });
      await vtype(page, page.locator('input[name="serviceBridgeToken"]'), install.bridgeToken, { delay: 20, hint: "bridge-секрет приложение↔сервис — не юзерский токен; показывается один раз" });
      await vclick(page, page.getByRole("button", { name: /^save$/i }).first(), { settle: 1_200 });
      await questLog(page, adminQuest.goal, adminQuest.steps, 4);
      await caption(page, [
        "Вкладка Projects → Manage projects — включаем приложение для ACME",
        "Без этого виджет не появится в задачах проекта",
      ]);
      const projectsTab = page.locator('a[data-test="ring-link"], button[data-test="ring-link"]').filter({ hasText: /^Projects/ }).first();
      await vclick(page, projectsTab, { settle: 1_200 });
      await vclick(page, page.locator('[data-test="manage-ptojects"]'), { settle: 900 });
      const dlg = page.locator('[role="dialog"], [data-test="ring-dialog-container"]').filter({ hasText: /manage projects/i }).first();
      await dlg.waitFor({ state: "visible", timeout: 15_000 });
      const acmeRow = dlg.locator("button, [role='checkbox'], li, label").filter({ hasText: /Acme E2E/i }).first();
      await vclick(page, (await acmeRow.boundingBox()) ? acmeRow : dlg.getByText(/Acme E2E/i).first(), { settle: 400 });
      await vclick(page, dlg.locator('[data-test="ok-button"], button:has-text("Save")').first(), { settle: 1_200 });
      await questLog(page, adminQuest.goal, adminQuest.steps, 5);
      await caption(page, [
        "Опционально: нативный системный баннер YouTrack — подсказка всей команде",
        "Включает админ в Global Settings — API уведомлений у приложений нет, делается вручную",
      ]);
      await page.goto(`${EXT_YT_HOST_URL}/admin/settings`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5_000);
      const bannerCb = page.locator('input[ng-model="settings.appearanceSettings.globalBannerEnabled"]');
      await bannerCb.waitFor({ state: "attached", timeout: 30_000 });
      // The ring checkbox input is visually hidden (zero-layout box) — glide
      // to the section label for the camera, then DOM-click the input; a real
      // mouse press lands on the icon overlay and never reaches it.
      const bannerRowLabel = page.getByText("System-wide banner", { exact: true }).first();
      await bannerRowLabel.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(800);
      // Idempotent: a previous recording may have left the banner enabled —
      // click only when it is off, else the toggle disables it on camera.
      let bannerDirty = false;
      if (!(await bannerCb.isChecked().catch(() => false))) {
        await glide(page, bannerRowLabel).catch(() => {});
        await bannerCb.evaluate((el) => el.click());
        await page.waitForTimeout(1_200);
        bannerDirty = true;
      }
      const bannerTa = page.locator('textarea[ng-model="settings.appearanceSettings.globalBanner"]');
      await bannerTa.waitFor({ state: "visible", timeout: 15_000 });
      const bannerText = "Spec Service подключён — настройте ИИ-агентов: главное меню → Spec Service";
      // pressSequentially appends — re-recordings must clear the field first.
      if ((await bannerTa.inputValue()) !== bannerText) {
        await bannerTa.fill("");
        await vtype(page, bannerTa, bannerText, { delay: 18 });
        bannerDirty = true;
      }
      // Global Settings renders Save only while the form is dirty — an
      // already-configured banner (re-recording) shows no button at all.
      if (bannerDirty) {
        const saves = page.getByRole("button", { name: /^save$/i });
        let saveBtn = null;
        for (let i = 0; i < await saves.count(); i++) {
          if (await saves.nth(i).boundingBox().catch(() => null)) { saveBtn = saves.nth(i); break; }
        }
        if (saveBtn) await vclick(page, saveBtn, { settle: 1_800 });
        else await saves.first().evaluate((el) => el.click());
      }
      await caption(page, "Баннер — стандартная фича YouTrack, видна всем на каждой странице");
      await page.waitForTimeout(1_600);
      await caption(page, "Приложение установлено и настроено — дальше работает разработчик");
      await page.waitForTimeout(1_600);
      await context.close();
      parts.push(...await collectVideos(dir));
    }

    // ══ Part 2 — Mia: banner → Spec Service page → .mcp.json → agent ══
    {
      const { context, page, dir } = await newRecording(browser, "02-mia");
      await titleCard(page, "Часть 2 — начало работы", "Меню Spec Service → .mcp.json → агент пишет спеки", 3600);

      const miaQuest = {
        goal: "Часть 2 · Начало работы",
        steps: ["Войти в свой YouTrack", "Баннер → меню Spec Service", "Страница: репозиторий уже привязан", "Получить свой .mcp.json", "Задача: только контекст", "Подключить MCP в агенте", "Промпт: задача → спека → публикация"],
      };
      const miaPw = await currentPassword(browser, "mia", EXT_USERS.mia.password, EXT_YT_HOST_URL);
      await vLogin(page, "mia", miaPw, EXT_YT_HOST_URL, "Входим в YouTrack", { ...miaQuest, current: 0 });
      // The discovery hook is the admin-configured system banner from part 1 —
      // the native YouTrack mechanism. App-side notifications don't exist.
      await caption(page, [
        "Сверху — тот самый баннер из части 1: «настройте ИИ-агентов → Spec Service»",
      ]);
      await page.waitForTimeout(2_600);
      await questLog(page, miaQuest.goal, miaQuest.steps, 1);
      await caption(page, "Главное меню → Spec Service — у приложения своя страница в YouTrack");
      const navLink = page.locator('a[href*="app/spec-graph-app/spec-app"]').first();
      if (!(await navLink.isVisible().catch(() => false))) {
        const more = page.locator('button:has-text("More"), [role="button"]:has-text("More"), a:has-text("More")').first();
        if (await more.count()) await vclick(page, more, { settle: 1_200 });
      }
      await vclick(page, navLink, { settle: 3_000 });
      const frame = await frameWith(page, '[data-testid="wizard"], [data-testid="no-access"]');
      await page.waitForTimeout(1_200);
      // Vendor bound the tenant repo inside the IdP Bind — the page already
      // shows acme/gamma → acme-specs.git as active, nothing to configure here.
      await frame.locator('[data-testid="repo-status-active"]').waitFor({ state: "attached", timeout: 30_000 });
      const boundRow = await frame.locator('[data-testid="repo-list"]').innerText();
      assert.match(boundRow, /acme\/gamma[\s\S]*acme-specs\.git/);
      await page.waitForTimeout(1_800);

      await questLog(page, miaQuest.goal, miaQuest.steps, 2);
      await caption(page, [
        "acme/gamma → acme-specs.git [active] — репозиторий спек привязан заранее, Мии настраивать нечего",
        "Specs visible to you: 3 — там уже лежат спеки её проекта: gamma-spec, acme-portal, roadmap-growth",
      ]);
      await page.waitForTimeout(3_000);

      const { stdout: landed } = await execFileAsync("docker", [
        "exec", "spec-auth-e2e-spec-git-1", "git", `--git-dir=${EXT_REPO_PATH}`,
        "show", "main:acme/gamma/.specs/gamma-spec/README.md",
      ]);
      assert.match(landed, /Gamma Spec/i);

      await questLog(page, miaQuest.goal, miaQuest.steps, 3);
      await caption(page, [
        "Жмём «Get my .mcp.json» — страница генерирует готовый конфиг с токеном",
        "url сервиса + Bearer + X-Spec-Idp: acme — агент увидит только проект acme/gamma, чужие спеки недоступны",
      ]);
      await vclick(page, frame.locator('[data-testid="agent-mint"]'), { settle: 800 });
      await frame.locator('[data-testid="agent-mcp"]').waitFor({ state: "visible", timeout: 60_000 });
      await frame.locator('[data-testid="agent-mcp"]').scrollIntoViewIfNeeded().catch(() => {});
      const miaSnippet = JSON.parse(await frame.locator('[data-testid="agent-mcp"]').innerText());
      assert.equal(miaSnippet.mcpServers["omp-spec-kit"].headers["X-Spec-Idp"], EXT_TENANT);
      await page.waitForTimeout(2_800);

      const miaMcp = await mcpCallWithSnippet(miaSnippet, "spec_catalog", { view: "specs" });
      const catalog = JSON.stringify(miaMcp.result.structuredContent ?? miaMcp.result);
      assert.match(catalog, /gamma-spec/);
      assert.doesNotMatch(catalog, /alpha-spec/);
      await page.waitForTimeout(1_200);

      // Her real task meanwhile: the issue widget is now a thin context
      // card — repo state plus a link to the page. Anti-slop assert: no
      // onboarding controls may exist on an issue page anymore.
      await questLog(page, miaQuest.goal, miaQuest.steps, 4);
      await openIssue(page, seededIssues[0], "А в самой задаче — тонкая карточка: привязанный репозиторий и ссылка на страницу. Онбординга в ишью больше нет", { ...miaQuest, current: 4 });
      const issueFrame = await frameWith(page, '[data-testid="spec-context"], [data-testid="no-access"]', 30_000);
      await issueFrame.locator('[data-testid="repo-status-active"]').waitFor({ state: "attached", timeout: 30_000 });
      const chip = await issueFrame.locator('[data-testid="repo-chip"]').first().innerText();
      assert.match(chip, /acme\/gamma/);
      const appLink = issueFrame.locator('[data-testid="spec-app-link"]');
      assert.match(await appLink.getAttribute("href") ?? "", /\/app\/spec-graph-app\/spec-app\?step=agent/);
      for (const f of page.frames()) {
        for (const banned of ["wizard", "agent-panel", "agent-mint", "agent-mcp", "repo-form", "idp-form"]) {
          assert.equal(await f.locator(`[data-testid="${banned}"]`).count(), 0, `issue page must not contain ${banned}`);
        }
      }
      await caption(page, [
        "Карточка показывает acme/gamma [active] и «Open Spec Service» → страницу с шага агента",
        "Никаких форм привязки и .mcp.json в задаче — онбординг живёт только на странице",
      ]);
      await page.waitForTimeout(2_400);

      // ── IDE: paste the snippet, reload MCP, drive the agent ──────────
      await questLog(page, miaQuest.goal, miaQuest.steps, 5);
      await agentInit(page, "IDE · acme-workspace — агент с MCP");
      await page.waitForTimeout(500); // setContent wiped the cursor element — let the injector respawn it
      await page.mouse.move(VP.width * 0.35, VP.height * 0.4, { steps: 20 });
      await caption(page, [
        "В IDE: вставляем .mcp.json со страницы Spec Service в конфиг агента — как есть, без правок",
        "Сохраняем → перезагружаем MCP",
      ]);
      await agentShowFile(page, ".mcp.json", JSON.stringify(miaSnippet, null, 2));
      await page.waitForTimeout(2_200);

      // Real MCP session under mia's minted token — the tool list is what
      // the agent actually got after reload.
      const agent = await mcpSession(miaSnippet);
      const tools = await agent.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      await agentAppend(page, "sys", `⟳ MCP servers reloaded`);
      await agentAppend(page, "sys", `✓ omp-spec-kit — ${toolNames.length} tools: ${toolNames.join(", ")}`);
      await caption(page, [
        "После reload поднялся omp-spec-kit — список инструментов вернул сам сервис",
        "Сессия идёт по токену Мии — сервис видит её, а не админа",
      ]);
      await page.waitForTimeout(1_600);

      const issueId = seededIssues[0];
      await questLog(page, miaQuest.goal, miaQuest.steps, 6);
      await caption(page, [
        `Промпт: разбери задачу ${issueId} из YouTrack и собери по ней спеку`,
        "Агент сам прочитает задачу, посмотрит граф спек и предложит план",
      ]);
      await agentPrompt(page, `Возьми задачу ${issueId} из YouTrack — ${EXT_YT_HOST_URL}/issue/${issueId} — и сделай по ней спеку: посмотри, что рядом по домену, и предложи план работ.`);

      // The agent's YouTrack read: a real REST fetch, rendered as a tool call.
      const issueRes = await extRest("GET", `/api/issues/${issueId}?fields=idReadable,summary,description`);
      const issue = issueRes.body;
      assert.ok(issue?.idReadable, `issue ${issueId} not found via REST: ${issueRes.status}`);
      await agentAppend(page, "tool",
        `<span style="color:#6fb4ff">→ youtrack REST</span>  GET /api/issues/${issueId}\n` +
        `<span style="color:#8b93a5">   ${(issue.summary ?? "").replace(/</g, "&lt;")}</span>`);
      const catalogRes = await agent.callTool({ name: "spec_catalog", arguments: { view: "specs" } });
      const catalogJson = catalogRes.structuredContent ?? JSON.parse(catalogRes.content[0].text);
      const catalogSpecs = ((catalogJson?.data?.specs) ?? []).map((s) => s.slug ?? s).join(", ");
      await agentAppend(page, "tool",
        `<span style="color:#6fb4ff">→ spec_catalog</span>  { view: "specs" }\n` +
        `<span style="color:#8b93a5">   ${catalogSpecs} — её проект, чужих спек тут нет</span>`);
      // The agent's plan is grounded in the actual committed graph — a real
      // spec_graph call, not narration: which edges sit next to the domain.
      const graphRes = await agent.callTool({ name: "spec_graph", arguments: { view: "edges", canonicalId: "acme-portal:FR-1" } });
      const graphJson = graphRes.structuredContent ?? JSON.parse(graphRes.content[0].text);
      const graphEdges = ((graphJson?.data?.edges) ?? []).slice(0, 4);
      const edgeLines = graphEdges.map((e) => `   ${e.from}  —${e.type}→  ${e.to}`).join("\n") || "   (нет рёбер)";
      await agentAppend(page, "tool",
        `<span style="color:#6fb4ff">→ spec_graph</span>  edges acme-portal:FR-1\n` +
        `<span style="color:#8b93a5">${edgeLines}</span>`);
      await agentAppend(page, "agent",
        `<b>Агент:</b> Задача «${issue.summary}». По графу: acme-portal:FR-1 уже реализует TASK-1 — домен смежный, но своя спека чище.\n` +
        `План: новая спека <b>acme-sso</b> — FR-1 из формулировки задачи, TASK-1 под неё, milestone в roadmap-growth.`);

      const run = `v-${Date.now()}`;
      try {
        await agentAppend(page, "tool", `<span style="color:#6fb4ff">→ spec_claim</span>  acme-sso  <span style="color:#8b93a5">// write-lease на спеку</span>`);
        const claimRes = await agent.callTool({ name: "spec_claim", arguments: { spec: "acme-sso" } });
        assert.ok(JSON.parse(claimRes.content[0].text).ok !== false, "claim acme-sso failed");

        // The service gate shows up live below — first createSpec gets
        // REFUSED: ELICITATION_REQUIRED, the agent retries after the hint.

        await caption(page, [
          "Агент спрашивает перед публикацией — спека станет видна всей команде",
          "claim = эксклюзивная запись: чужая параллельная правка честно вернёт CONFLICT",
        ]);
        await agentAppend(page, "agent", `<b>Агент:</b> Запишу спеку в репозиторий acme/gamma — её увидит вся команда. Публикую?`);
        await agentPrompt(page, "да, публикуй");

        const patch = async (spec, intent, extra, render) => {
          await agentAppend(page, "tool", render);
          const args = { intent, requestId: `${run}-${spec}-${intent}`, reason: `spec for ${issueId}`, spec, dryRun: false, ...extra };
          let { j, refused } = patchOutcome(await agent.callTool({ name: "spec_patch", arguments: args }));
          if (refused?.code === "ELICITATION_REQUIRED") {
            await agentAppend(page, "sys", `⛔ REFUSED: ELICITATION_REQUIRED — сервис требует прочитать skill://spec-elicitation перед созданием документов`);
            await agentAppend(page, "tool", `<span style="color:#6fb4ff">→ read</span>  skill://spec-elicitation → учёл гейты, повторяю`);
            ({ j, refused } = patchOutcome(await agent.callTool({ name: "spec_patch", arguments: { ...args, requestId: `${run}-${spec}-${intent}-r` } })));
          }
          if (refused?.code === "CONFLICT") {
            await new Promise((r) => setTimeout(r, 2_000));
            ({ j, refused } = patchOutcome(await agent.callTool({ name: "spec_patch", arguments: { ...args, requestId: `${run}-${spec}-${intent}-c` } })));
          }
          assert.ok(j.ok !== false && !refused, `${intent} ${spec}: ${refused?.code ?? j.error?.message ?? "failed"}`);
          return j;
        };

        await caption(page, [
          "Каждый spec_patch — атомарный коммит бота в acme-specs.git",
          "createSpec → FR-1 → TASK-1 → NFR → milestone в роадмапе",
        ]);
        await patch("acme-sso", "createSpec", { title: "SSO для портала" },
          `<span style="color:#6fb4ff">→ spec_patch</span>  createSpec  acme-sso  <span style="color:#5fd98a">// committed</span>`);
        await patch("acme-sso", "patch", { operations: [{ kind: "insert_at_eof", document: "FR.md",
            text: `\n## FR-1 — ${issue.summary}\n\nСистема ДОЛЖНА пускать пользователей портала через корпоративный SSO — без отдельного пароля.\n` }] },
          `<span style="color:#6fb4ff">→ spec_patch</span>  FR.md += «FR-1 — ${issue.summary}»  <span style="color:#5fd98a">// committed</span>`);
        await patch("acme-sso", "patch", { operations: [{ kind: "insert_at_eof", document: "TASKS.md",
            text: `\n## TASK-1 — ${issueId}: ${issue.summary}\n\n- **Status:** todo\n\n**Implements:** FR-1\n\n- **Done When:** вход через корпоративный IdP работает от начала до конца\n` }] },
          `<span style="color:#6fb4ff">→ spec_patch</span>  TASKS.md += «TASK-1 — ${issueId}: …» · Implements FR-1  <span style="color:#5fd98a">// committed</span>`);
        // Depth for the board's right lanes — a real NFR node, not decoration.
        const nfrText = `\n## NFR-SEC-1 — Сессия SSO не вечна\n\nСессия SSO НЕ ДОЛЖНА жить дольше 8 часов без повторной аутентификации у корпоративного IdP.\n`;
        const nfrRender = `<span style="color:#6fb4ff">→ spec_patch</span>  NFR.md += «NFR-SEC-1 — сессия ≤ 8ч»  <span style="color:#5fd98a">// committed</span>`;
        try {
          // requestId must differ from the TASKS.md patch above — same intent
          // "patch" + same spec would collide and come back CONFLICT.
          await patch("acme-sso", "patch", { requestId: `${run}-acme-sso-nfr`,
            operations: [{ kind: "insert_at_eof", document: "NFR.md", text: nfrText }] }, nfrRender);
        } catch {
          await patch("acme-sso", "patch", { requestId: `${run}-acme-sso-nfr-create`,
            operations: [{ kind: "replace_document", document: "NFR.md",
              content: `# SSO для портала\n\nStatus: DRAFT\n\n# Non-Functional Requirements\n${nfrText}` }] }, nfrRender);
        }
        // The lease is per-spec — linking the roadmap needs its own claim.
        // deriveScope reads REFS/IMPLEMENTS edges from the roadmap spec's own
        // TASK/FR nodes — a milestone task is the authored link, a bare Refs
        // line on the document would land on the doc node, not the graph.
        await agentAppend(page, "tool", `<span style="color:#6fb4ff">→ spec_claim</span>  roadmap-growth`);
        const claimRm = await agent.callTool({ name: "spec_claim", arguments: { spec: "roadmap-growth" } });
        assert.ok(JSON.parse(claimRm.content[0].text).ok !== false, "claim roadmap-growth failed");
        await patch("roadmap-growth", "patch", { operations: [{ kind: "insert_at_eof", document: "TASKS.md",
            text: `\n## TASK-2 — SSO-роллаут\n\n- **Status:** todo\n\n**Refs:** acme-sso:FR-1\n\n- **Done When:** SSO включён для всех пользователей портала\n` }] },
          `<span style="color:#6fb4ff">→ spec_patch</span>  roadmap-growth · TASK-2 «SSO-роллаут» Refs acme-sso:FR-1  <span style="color:#5fd98a">// committed</span>`);
        await patch("roadmap-growth", "assembleRoadmap", {},
          `<span style="color:#6fb4ff">→ spec_patch</span>  assembleRoadmap → scope += acme-sso  <span style="color:#5fd98a">// committed</span>`);
        await agent.callTool({ name: "spec_release", arguments: { spec: "acme-sso" } });
        await agent.callTool({ name: "spec_release", arguments: { spec: "roadmap-growth" } });

        const { stdout: head } = await execFileAsync("docker", [
          "exec", "spec-auth-e2e-spec-git-1", "git", `--git-dir=${EXT_REPO_PATH}`, "log", "--format=%h %s", "-1", "main",
        ]);
        await agentAppend(page, "agent", `<b>Агент:</b> Готово — <b>acme-sso</b> в репозитории. Последний коммит: <code>${head.trim().slice(0, 60)}</code>`);
        await agentAppend(page, "sys", `spec_release acme-sso, roadmap-growth — leases dropped`);

        // Proof beats for the spec-minded viewer: the document as it lies in
        // the repo, and who authored every commit — real reads, not narration.
        const frDoc = await agent.callTool({ name: "spec_documents", arguments: { action: "read", spec: "acme-sso", doc: "FR.md" } });
        const frJson = frDoc.structuredContent ?? JSON.parse(frDoc.content[0].text);
        const frText = frJson?.data?.content ?? "";
        await agentAppend(page, "tool", `<span style="color:#6fb4ff">→ spec_documents</span>  read acme-sso / FR.md`);
        await agentShowFile(page, "acme-sso/.specs/FR.md", frText || "(пусто)");
        await caption(page, [
          "Спека, как она лежит в репозитории — FR-1 прямо из формулировки задачи ACME",
        ]);
        await page.waitForTimeout(3_000);
        const { stdout: gitlog } = await execFileAsync("docker", [
          "exec", "spec-auth-e2e-spec-git-1", "git", `--git-dir=${EXT_REPO_PATH}`,
          "log", "--format=%h %an · %s", "-4", "main",
        ]);
        await agentAppend(page, "tool",
          `<span style="color:#6fb4ff">→ git log</span>  acme-specs.git\n` +
          `<span style="color:#8b93a5">${gitlog.trim().split("\n").map((l) => "   " + l).join("\n")}</span>`);
        await caption(page, [
          "git log: каждая правка — коммит от бота сервиса, руками в .specs никто не пушит",
        ]);
        await page.waitForTimeout(2_200);
      } finally {
        await agent.close();
      }

      // Off-camera CI beat: the repo → tracker projection. Captioned as
      // such — no person does this in the UI.
      await caption(page, [
        "За кадром: CI прогоняет spec-graph-sync — клонирует acme-specs и проецирует граф в YouTrack",
        "карточки SPEC-* + снапшот SPEC:SYNC-STATE — виджеты читают только закоммиченное",
      ]);
      const adminUser = await extA.findUserByLogin("admin");
      const syncOut = await runProjectionSync(extA, adminUser.id, extServiceIds);
      const createdCards = [...syncOut.matchAll(/"issue":"(SPEC-\d+)"/g)].length;
      log(`projection sync: ${createdCards} cards`);
      await page.waitForTimeout(1_400);
      await context.close();
      parts.push(...await collectVideos(dir));
    }

    // ══ Part 3 — the dashboard: roadmap → requirement → task ══════════
    {
      const { context, page, dir } = await newRecording(browser, "03-board");
      await titleCard(page, "Часть 3 — где это видно в YouTrack", "Дашборд: трасса от роадмапа до задачи, которую разобрал агент", 3600);

      const boardQuest = {
        goal: "Часть 3 · Трассировка",
        steps: ["Войти в свой YouTrack", "Dashboards → новый дашборд", "Add widget → Spec Board", "Цепочка: роадмап → требование → задача"],
      };
      const miaPw2 = await currentPassword(browser, "mia", EXT_USERS.mia.password, EXT_YT_HOST_URL);
      await vLogin(page, "mia", miaPw2, EXT_YT_HOST_URL, "Входим обратно в YouTrack", { ...boardQuest, current: 0 });
      await dismissSurveys(page);
      await questLog(page, boardQuest.goal, boardQuest.steps, 1);
      await caption(page, "Dashboards → New dashboard — собираем свой вид");
      // Dashboard toolbar buttons sit top-right, under the quest box.
      await questOverlay(page, false);
      await vclick(page, page.locator('[data-test="ring-link dashboard-button"]'), { settle: 2_000 });
      await vclick(page, page.locator('[data-test="new-dashboard-button"]'), { settle: 1_000 });
      const nameInput = page.locator('[data-test="dashboard-name-input"]');
      await nameInput.waitFor({ state: "visible", timeout: 15_000 });
      await vtype(page, nameInput, "Specs — трассировка", { delay: 40 });
      await page.waitForTimeout(800);
      await vclick(page, page.locator('[data-test="create-button"]'), { settle: 2_000 });
      await questLog(page, boardQuest.goal, boardQuest.steps, 2);
      await caption(page, "Add widget → Spec Board — виджет нашего приложения");
      await vclick(page, page.locator('[data-test="add-widget-button"]'), { settle: 1_800 });
      const boardItem = page.locator('[data-test*="ring-list-item"]').filter({ hasText: /^Spec Board/ }).first();
      await boardItem.waitFor({ state: "visible", timeout: 15_000 });
      await vclick(page, boardItem, { settle: 2_500 });
      await page.waitForTimeout(3_000); // widget iframe loads the snapshot
      await questOverlay(page, true);
      // defaultDimensions (12fr x 8fr) in the app manifest makes the widget
      // land at full dashboard width on its own — no manual resize needed.
      await caption(page, [
        "Виджет заявляет свой размер в манифесте — сразу разворачивается на весь дашборд",
        "defaultDimensions: 12fr × 8fr — никакого ручного ресайза",
      ]);
      await page.waitForTimeout(2_500);
      await questLog(page, boardQuest.goal, boardQuest.steps, 3);
      await page.waitForTimeout(1_500); // the final step marker registers
      await questOverlay(page, false);  // the trace beats need the full canvas

      // The widget iframe holds .node-card[data-id="<canonicalId>"] — hovering
      // a card runs highlightLineage: upstream+downstream light up, the rest
      // dim; clicking pins the focus and opens the link drawer.
      const widget = await (async () => {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
          for (const f of page.frames()) {
            if (await f.locator('[data-id="acme-sso:TASK-1"]').count().catch(() => 0)) return f;
          }
          await page.waitForTimeout(800);
        }
        return null;
      })();

      await caption(page, [
        "Наводишь на карточку — её цепочка подсвечивается, остальное гаснет",
        "Все связи — из закоммиченного снапшота: то, что агент только что записал",
      ]);
      if (widget) {
        const hoverCard = async (id) => {
          const card = widget.locator(`[data-id="${id}"]`).first();
          if (await card.count().catch(() => 0)) {
            await card.scrollIntoViewIfNeeded().catch(() => {});
            const box = await card.boundingBox().catch(() => null);
            if (box) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
              await page.waitForTimeout(1_700);
            }
          }
        };
        // Trace the chain both ways: roadmap → milestone → FR → task.
        await hoverCard("roadmap-growth:ROADMAP");
        await hoverCard("roadmap-growth:TASK-2");
        await hoverCard("acme-sso:FR-1");
        await hoverCard("acme-sso:TASK-1");
        await hoverCard("acme-portal:FR-1");
        await hoverCard("acme-portal:TASK-1");

        await caption(page, [
          "Клик по карточке — справа панель связей: кто покрывает, кто реализует",
          "acme-sso:TASK-1 — та самая задача Мии ACME из YouTrack; IMPLEMENTS → FR-1; роадмап покрывает спеку",
        ]);
        await vclick(page, widget.locator('[data-id="acme-sso:TASK-1"]').first(), { settle: 2_000 });
        await page.waitForTimeout(2_200);
        // And the roadmap card — its milestone task carries the spec refs.
        await vclick(page, widget.locator('[data-id="roadmap-growth:ROADMAP"]').first(), { settle: 2_000 });
        await page.waitForTimeout(1_500);

        // Camera pan across the canvas — the board is wider than the widget:
        // NFR/AC lanes live to the right of the FR column.
        await caption(page, [
          "Канвас шире экрана — двигаем вправо: NFR, AC и остальные линии",
          "zoom −/+ и скролл — обычная навигация по доске",
        ]);
        const pan = async (to) => {
          await widget.evaluate(async (target) => {
            const board = document.getElementById("v1-board");
            if (!board) return;
            const max = board.scrollWidth - board.clientWidth;
            const goal = Math.max(0, Math.min(max, target * max));
            const from = board.scrollLeft;
            for (let i = 1; i <= 45; i++) {
              board.scrollLeft = from + (goal - from) * i / 45;
              await new Promise((r) => setTimeout(r, 33));
            }
          }, to);
        };
        await pan(1);
        await page.waitForTimeout(1_800);
        await pan(0);
        await page.waitForTimeout(1_200);
      }
      await page.waitForTimeout(4_000);
      await page.screenshot({ path: path.join(dir, "board-final.png") });
      await context.close();
      parts.push(...await collectVideos(dir));
    }
  } finally {
    await browser.close();
  }

  log(`concatenating ${parts.length} clips → mp4`);
  const outFile = path.join(OUT, "omp-spec-kit-onboarding.mp4");
  await concatToMp4(parts, outFile);
  console.log(`\n\x1b[32mVIDEO READY:\x1b[0m ${outFile}`);
  console.log(`parts: ${parts.join("\n  ")}`);
}

main().catch((error) => {
  console.error(`\x1b[31mVIDEO FAILED:\x1b[0m ${error.stack || error}`);
  process.exitCode = 1;
});

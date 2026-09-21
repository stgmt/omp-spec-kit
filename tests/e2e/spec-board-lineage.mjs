#!/usr/bin/env node
/**
 * Regression: Spec Board hover must highlight the TRANSITIVE lineage, not
 * just direct neighbors. Bug: hovering acme-sso:FR-1 lit its two TASKs but
 * left roadmap-growth:ROADMAP dark and the ROADMAP->TASK-2 wire inactive,
 * so the rope never ran the full committed chain.
 *
 * Runs against the live compose stack `spec-auth-e2e` (ext YouTrack :8082)
 * with the dogfood fixture already seeded — same precondition as
 * dogfood-video.mjs. If the acme-sso/roadmap-growth nodes are absent the
 * test fails loudly saying to seed first.
 *
 * Usage:
 *   node tests/e2e/spec-board-lineage.mjs
 */
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserLogin } from "./lib/browser.mjs";
import { ADMIN_PASSWORD } from "./lib/bootstrap.mjs";
import { EXT_USERS, EXT_YT_HOST_URL } from "./lib/idp-fixture.mjs";
import { createYouTrackAdmin } from "./lib/youtrack.mjs";

const DASHBOARD_NAME = "spec-board-lineage-regression";

async function litState(widget) {
  return widget.evaluate(() => ({
    lit: [...document.querySelectorAll(".node-card.highlighted-upstream, .node-card.highlighted-downstream")].map((c) => c.dataset.id),
    wires: [...document.querySelectorAll(".flow-wire.active")].map((w) => `${w.dataset.src} -> ${w.dataset.tgt}`),
  }));
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    // mia's REST client: mint a YouTrack-scoped permanent token via admin
    // (Basic auth is only enabled for the admin bootstrap, verified live).
    const admin = createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD, baseUrl: EXT_YT_HOST_URL });
    const miaUser = await admin.findUserByLogin("mia");
    assert.ok(miaUser, "user mia not found — ext fixture not provisioned");
    const ytServiceId = await admin.youtrackServiceId();
    const { token } = await admin.createPermanentToken({ userId: miaUser.id, name: `spec-board-lineage-${Date.now()}`, serviceIds: [ytServiceId] });
    const mia = createYouTrackAdmin({ login: "mia", password: EXT_USERS.mia.password, baseUrl: EXT_YT_HOST_URL });
    mia.call = ((orig) => (method, pathname, opts = {}) => orig(method, pathname, { ...opts, auth: `Bearer ${token}` }))(mia.call);

    // Fresh dashboard every run — earlier video runs leave stale boards.
    for (const d of (await mia.call("GET", "/api/dashboards?fields=id,name")) ?? []) {
      if (d.name === DASHBOARD_NAME) await mia.call("DELETE", `/api/dashboards/${d.id}`, { expect: [200, 204] });
    }
    // Dashboard + Spec Board widget at full width via REST — verified live:
    // POST .../widgets accepts {key, widget:{id}, x, y, width, height} in grid
    // units; width 12 spans the dashboard (~1336px at 1600 viewport), so no
    // manual resize is needed and card hovers land. The widget itself is a
    // sandboxed iframe and cannot enlarge its own cell.
    const app = await admin.appByName("spec-graph-app");
    const boardWidget = (await admin.call("GET", `/api/admin/apps/${app.id}?fields=id,widgets(id,key)`)).widgets.find((w) => w.key === "spec-board");
    assert.ok(boardWidget, "spec-board widget not registered on the installed app");
    const dashboard = await mia.call("POST", "/api/dashboards?fields=id,name", { body: { name: DASHBOARD_NAME } });
    assert.ok(dashboard?.id, "dashboard create returned no id");
    await mia.call("POST", `/api/dashboards/${dashboard.id}/widgets?fields=id,x,y,width,height`, {
      body: { key: "spec-board", widget: { id: boardWidget.id }, x: 0, y: 0, width: 12, height: 8 },
    });

    const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
    try {
      await browserLogin(page, "mia", EXT_USERS.mia.password, EXT_YT_HOST_URL);
      await page.goto(`${EXT_YT_HOST_URL}/dashboard?id=${dashboard.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(9000);

      let widget = null;
      for (let i = 0; i < 20 && !widget; i++) {
        for (const f of page.frames()) {
          if (await f.locator('[data-id="acme-sso:FR-1"]').count().catch(() => 0)) { widget = f; break; }
        }
        if (!widget) await page.waitForTimeout(800);
      }
      assert.ok(widget, "Spec Board frame with acme-sso:FR-1 not found — run tests/e2e/dogfood-video.mjs once to seed the fixture corpus");

      const hover = async (id) => {
        await widget.locator(`[data-id="${id}"]`).first().hover();
        await page.waitForTimeout(1200);
        return litState(widget);
      };

      // FR-1: the full rope ROADMAP -> milestone -> FR -> impl TASK lights.
      let s = await hover("acme-sso:FR-1");
      for (const id of ["roadmap-growth:ROADMAP", "roadmap-growth:TASK-2", "acme-sso:TASK-1"]) {
        assert.ok(s.lit.includes(id), `FR-1 hover must light ${id}, lit=${JSON.stringify(s.lit)}`);
      }
      assert.ok(s.wires.includes("roadmap-growth:ROADMAP -> roadmap-growth:TASK-2"), `FR-1 hover must light the ROADMAP->TASK-2 wire, wires=${JSON.stringify(s.wires)}`);

      // ROADMAP: coverage reaches both downstream FRs through milestones.
      s = await hover("roadmap-growth:ROADMAP");
      for (const id of ["roadmap-growth:TASK-1", "roadmap-growth:TASK-2", "acme-portal:FR-1", "acme-sso:FR-1"]) {
        assert.ok(s.lit.includes(id), `ROADMAP hover must light ${id}, lit=${JSON.stringify(s.lit)}`);
      }
      for (const w of ["roadmap-growth:ROADMAP -> roadmap-growth:TASK-1", "roadmap-growth:ROADMAP -> roadmap-growth:TASK-2", "roadmap-growth:TASK-1 -> acme-portal:FR-1", "roadmap-growth:TASK-2 -> acme-sso:FR-1"]) {
        assert.ok(s.wires.includes(w), `ROADMAP hover must light wire ${w}, wires=${JSON.stringify(s.wires)}`);
      }

      // Negative: a leaf impl task lights only its own edge — the transitive
      // walk must not smear the whole graph. ROADMAP has no path to TASK-1.
      s = await hover("acme-sso:TASK-1");
      assert.deepEqual(s.lit.sort(), ["acme-sso:FR-1"], `TASK-1 hover must light only FR-1, lit=${JSON.stringify(s.lit)}`);
      assert.ok(!s.wires.some((w) => w.includes("roadmap-growth")), `TASK-1 hover must not light roadmap wires, wires=${JSON.stringify(s.wires)}`);

      console.log("PASS  spec-board-lineage  transitive hover lineage verified (3 hovers, wires incl. negative case)");
    } finally {
      for (const d of (await mia.call("GET", "/api/dashboards?fields=id,name").catch(() => [])) ?? []) {
        if (d.name === DASHBOARD_NAME) await mia.call("DELETE", `/api/dashboards/${d.id}`, { expect: [200, 204] }).catch(() => {});
      }
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
}

await main();

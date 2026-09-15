import { YT_URL } from "./compose.mjs";

/**
 * Browser helpers shared by the live E2E (run-live.mjs) and the UI-driven
 * BDD suite (app-install-live). Real headless Chrome only — no mocks.
 *
 * Browser login with deterministic password rotation. Admin-provisioned
 * credentials carry `passwordChangeRequired`, so the FIRST browser login for
 * a fresh volume completes the forced change (to `<password>b`); later runs
 * log in with the rotated value. Candidate list keeps this idempotent.
 */
export async function browserLogin(page, login, password) {
  const candidates = [password, `${password}b`];
  for (const candidate of candidates) {
    let formReady = false;
    for (let attempt = 0; attempt < 3 && !formReady; attempt += 1) {
      await page.goto(`${YT_URL}/login`, { waitUntil: "domcontentloaded" });
      formReady = await page.locator("#username, input[name='username']").first()
        .waitFor({ state: "visible", timeout: 25_000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!formReady) throw new Error(`login form did not render for ${login} (at ${page.url().slice(0, 100)})`);
    await page.locator("#username, input[name='username']").first().fill(login);
    await page.locator("#password, input[name='password']").first().fill(candidate);
    await page.getByRole("button", { name: /log in/i }).first().click();
    await page.waitForTimeout(4_000);
    if (page.url().includes("/hub/auth/restore")) {
      const rotated = `${password}b`;
      await page.locator("#password").click();
      await page.locator("#password").type(rotated, { delay: 20 });
      await page.locator("#passwordRepeat").click();
      await page.locator("#passwordRepeat").type(rotated, { delay: 20 });
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /change password/i }).first().click({ timeout: 30_000 });
      await page.waitForTimeout(5_000);
      // forced change does not grant a session: log in again with the new value
      await page.goto(`${YT_URL}/login`, { waitUntil: "domcontentloaded" });
      await page.locator("#username, input[name='username']").first().waitFor({ state: "visible", timeout: 30_000 });
      await page.locator("#username, input[name='username']").first().fill(login);
      await page.locator("#password, input[name='password']").first().fill(rotated);
      await page.getByRole("button", { name: /log in/i }).first().click();
      await page.waitForTimeout(4_000);
    }
    const deadline = Date.now() + 30_000;
    let authed = false;
    while (Date.now() < deadline) {
      authed = await page.evaluate(() => Object.keys(localStorage).some((key) => key.endsWith("-token"))).catch(() => false);
      if (authed) break;
      await page.waitForTimeout(1_000);
    }
    if (authed) {
      await page.goto(`${YT_URL}/issues`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4_000);
      if (!page.url().includes("/hub/auth/login") && !page.url().includes("/login")) return;
    }
  }
  throw new Error(`browser login failed for ${login}: no working session with any candidate password`);
}

/** Polls page frames until the service widget renders success or error. */
export async function widgetFrame(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const marker = await frame.locator('[data-testid="spec-list"], [data-testid="service-error"]').count().catch(() => 0);
      if (marker > 0) return frame;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error(`service widget did not render (frames: ${page.frames().map((f) => f.url()).join(", ").slice(0, 300)})`);
}

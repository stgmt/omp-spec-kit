import { chromium } from "playwright-core";
import { containerLogs, waitFor, YT_URL } from "./compose.mjs";

const CHROME_CHANNEL = "chrome";

function wizardTokenFromLogs(logs) {
  const match = logs.match(/wizard_token=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

async function waitForWizardToken({ serviceName = "youtrack", getLogs, timeoutMs = 180_000, intervalMs = 3_000 } = {}) {
  const readLogs = getLogs ?? (() => containerLogs(serviceName, { tail: 500 }));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const token = wizardTokenFromLogs(readLogs());
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`wizard token not found in ${serviceName} container logs within the timeout`);
}

export async function youtrackNeedsWizard(url = YT_URL) {
  const response = await fetch(`${url}/api/config`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!response || !response.ok) return true;
  const text = await response.text();
  return !text.trim().startsWith("{");
}

async function clickWhenEnabled(page, locator, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await locator.isVisible().catch(() => false)) && (await locator.isEnabled().catch(() => false))) {
      await locator.click();
      return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
}

/**
 * Completes the YouTrack Configuration Wizard in a real browser (system
 * Chrome, no bundled browsers). One-time per volume; the wizard token is
 * printed in the container logs. Flow verified live on 2025.3:
 * welcome link -> base URL (Next + Continue dialog) -> admin credentials ->
 * license (Finish) -> setup wait page -> /api/config serves JSON.
 */
export async function completeWizard({ adminPassword, url = YT_URL, serviceName = "youtrack", getLogs, logger = console.log }) {
  const token = await waitForWizardToken({ serviceName, getLogs });
  logger(`wizard: completing setup in browser (token ${token.slice(0, 6)}…)`);
  const browser = await chromium.launch({ channel: CHROME_CHANNEL, headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    await page.goto(`${url}/?wizard_token=${token}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    await page.locator("a", { hasText: "Set up" }).first().click();
    await page.waitForTimeout(2_500);

    for (let step = 1; step <= 10; step += 1) {
      const adminLogin = page.locator('input[name="adminLogin"]');
      if (await adminLogin.count()) {
        if (!(await adminLogin.first().inputValue().catch(() => ""))) await adminLogin.first().fill("admin");
      }
      const password = page.locator('input[name="password"]');
      const confirmPassword = page.locator('input[name="confirmPassword"]');
      if ((await password.count()) && (await password.first().isVisible().catch(() => false))) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await password.first().fill("");
          await password.first().type(adminPassword, { delay: 15 });
          await confirmPassword.first().fill("");
          await confirmPassword.first().type(adminPassword, { delay: 15 });
          await page.waitForTimeout(400);
          if ((await password.first().inputValue()) === (await confirmPassword.first().inputValue())) break;
        }
      }
      const confirm = page.getByRole("button", { name: "Continue", exact: true }).first();
      if ((await confirm.isVisible().catch(() => false)) && (await confirm.isEnabled().catch(() => false))) {
        await confirm.click();
        await page.waitForTimeout(2_500);
        continue;
      }
      const finish = page.getByRole("button", { name: "Finish", exact: true }).first();
      if (await finish.isVisible().catch(() => false)) {
        await clickWhenEnabled(page, finish);
        break;
      }
      const next = page.getByRole("button", { name: "Next", exact: true }).first();
      if (await next.isVisible().catch(() => false)) {
        await next.click({ timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(2_000);
        continue;
      }
      throw new Error(`wizard stuck at step ${step} (${page.url()})`);
    }
    await waitFor(`${url}/api/config`, {
      label: "YouTrack setup to finish",
      timeoutMs: 300_000,
      accept: async (response) => response.ok && (await response.text()).trim().startsWith("{"),
    });
    // /api/config can answer from the frontend bundle while the installer is
    // still committing; the Hub API answers only after YouTrack itself is up.
    const basic = `Basic ${Buffer.from(`admin:${adminPassword}`).toString("base64")}`;
    const deadline = Date.now() + 300_000;
    for (;;) {
      const response = await fetch(`${url}/hub/api/rest/users/me?fields=id,login`, {
        headers: { authorization: basic, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (response?.ok && (await response.text()).trim().startsWith("{")) break;
      if (Date.now() > deadline) throw new Error("YouTrack setup did not finish within the timeout");
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    logger("wizard: YouTrack is configured");
  } finally {
    await browser.close();
  }
}

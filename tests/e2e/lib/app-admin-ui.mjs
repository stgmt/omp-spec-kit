import { YT_URL } from "./compose.mjs";

/**
 * Operator-path helpers for the UI-driven app installation BDD suite. Every
 * action goes through the real YouTrack 2025.3 admin UI in headless Chrome —
 * selectors verified live against jetbrains/youtrack:2025.3.161254:
 *  - "Add app…" dropdown -> "Upload ZIP file…" fires a NATIVE filechooser
 *    (no dropzone, no input[type=file] in the DOM).
 *  - The app card opens automatically after upload (?selected=<appId>);
 *    its tabs are a[data-test="ring-link"] elements.
 *  - Settings fields are named inputs (serviceUrl/serviceBridgeToken); a
 *    "Save" button appears only once the form is dirty — no autosave.
 *  - The Projects tab exposes "Manage projects" (data-test has a JetBrains
 *    typo: "manage-ptojects") -> checkbox dialog -> ok-button "Save".
 * Only roles/text/name selectors — no generated class names.
 */

/** Dismisses the onboarding toast when it blocks the page. */
async function dismissOnboarding(page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.count()) await gotIt.first().click().catch(() => {});
}

export async function openAppsPage(page) {
  await page.goto(`${YT_URL}/admin/apps`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /add app/i }).first().waitFor({ state: "visible", timeout: 30_000 });
  await dismissOnboarding(page);
}

/**
 * Uploads the built package through the native file chooser, exactly as the
 * "Upload ZIP file…" menu does for a human operator. Returns after YouTrack
 * confirms the upload with its toast and selects the app card.
 */
export async function uploadAppZip(page, zipPath) {
  await page.getByRole("button", { name: /add app/i }).first().click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15_000 }),
    page.getByRole("button", { name: /upload zip file/i }).click(),
  ]);
  await chooser.setFiles(zipPath);
  await page.getByText(/is uploaded!/i).first().waitFor({ state: "visible", timeout: 60_000 });
}

/** App card tabs carry data-test="ring-link"; the sidebar "Projects" does not. */
export async function openAppTab(page, tabName) {
  const tab = page.locator('a[data-test="ring-link"], button[data-test="ring-link"]')
    .filter({ hasText: new RegExp(`^${tabName}`) }).first();
  await tab.waitFor({ state: "visible", timeout: 30_000 });
  await tab.click();
}

/**
 * Fills the app settings form and clicks the Save button that YouTrack only
 * renders once the form is dirty.
 */
export async function fillAppSettings(page, settings) {
  for (const [name, value] of Object.entries(settings)) {
    await page.locator(`input[name="${name}"]`).fill(value);
  }
  await page.getByRole("button", { name: /^save$/i }).first().click();
  // The form returns to a clean state once the save lands.
  await page.getByRole("button", { name: /^save$/i }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
}

/**
 * Projects tab -> "Manage projects" -> check the project row -> Save.
 * Runs against a fresh install where no projects are attached yet.
 */
export async function attachAppToProjectViaUI(page, projectName) {
  await page.locator('[data-test="manage-ptojects"]').click();
  const dialog = page.locator('[data-test="ring-dialog-container edit-projects-list-dialog"], [data-test="ring-dialog-container"]').first();
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  await dialog.locator("button").filter({ hasText: new RegExp(projectName, "i") }).first().click();
  await dialog.locator('[data-test="ok-button"]').click();
  await dialog.waitFor({ state: "detached", timeout: 15_000 });
}

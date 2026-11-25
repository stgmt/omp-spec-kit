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
 * Opens the "Add app…" dropdown and confirms its "Upload ZIP file…" item is
 * rendered before clicking it. YouTrack can paint the button before the Ring
 * UI dropdown is interactive, so verify the menu rather than waiting for a
 * filechooser that a swallowed click could never produce.
 *
 * Trusted input is a precondition: the host Chrome 157 channel drops pointer
 * and key events on this admin page, so callers must use a browser that
 * delivers them (see the suite's chromium.launch in the delivery steps).
 */
async function openUploadMenuItem(page) {
  const addApp = page.getByRole("button", { name: /add app/i }).first();
  const uploadItem = page.getByRole("button", { name: /upload zip file/i }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await uploadItem.isVisible().catch(() => false)) return;
    await addApp.click();
    await uploadItem.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  }
  throw new Error(`"Upload ZIP file…" did not appear after clicking "Add app…" (${page.url()})`);
}

/**
 * Uploads the built package through the native file chooser, exactly as the
 * "Upload ZIP file…" menu does for a human operator. Returns after YouTrack
 * selects the uploaded app's card (?selected=<appId>) — the "is uploaded!"
 * toast text is not reliable across YouTrack versions.
 */
export async function uploadAppZip(page, zipPath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await openUploadMenuItem(page);
    const uploadItem = page.getByRole("button", { name: /upload zip file/i }).first();
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 15_000 }).catch(() => null);
    await uploadItem.click();
    const chooser = await chooserPromise;
    if (!chooser) continue; // the click landed before the menu handler was live
    await chooser.setFiles(zipPath);
    await page.waitForURL(/[?&]selected=\d+-/, { timeout: 60_000 });
    return;
  }
  throw new Error(`"Upload ZIP file…" did not open a file chooser (${page.url()})`);
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

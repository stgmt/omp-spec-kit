import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(REPO_ROOT, "tools", "spec-graph-app");
const APP_FILES = Object.freeze([
  "manifest.json",
  "spec-writeback.js",
  "widgets",
  "prototypes.html",
  "prototypes-data.json",
]);

function fail(message) {
  console.error(`youtrack-app-deploy: ${message}`);
  process.exit(1);
}

function readToken() {
  if (process.env.YOUTRACK_TOKEN) return process.env.YOUTRACK_TOKEN.trim();
  const tokenFile = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".omp", "youtrack-admin-token");
  if (existsSync(tokenFile)) return readFileSync(tokenFile, "utf8").trim();
  return "";
}

const baseUrl = (process.env.YOUTRACK_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const token = readToken();
if (!token) fail("no YouTrack token: set YOUTRACK_TOKEN or write ~/.omp/youtrack-admin-token");
for (const entry of APP_FILES) {
  if (!existsSync(path.join(APP_DIR, entry))) fail(`missing app entry ${entry}`);
}

const workDir = mkdtempSync(path.join(tmpdir(), "spec-graph-app-"));
const zipPath = path.join(workDir, "spec-graph-app.zip");
try {
  const zip = spawnSync(
    "powershell",
    ["-NoProfile", "-Command",
      `Compress-Archive -Path ${APP_FILES.map((f) => `'${path.join(APP_DIR, f)}'`).join(",")} -DestinationPath '${zipPath}'`],
    { stdio: "inherit" },
  );
  if (zip.status !== 0 || !existsSync(zipPath)) fail("Compress-Archive failed");

  const form = new FormData();
  form.set("file", new Blob([readFileSync(zipPath)], { type: "application/zip" }), "spec-graph-app.zip");
  const res = await fetch(`${baseUrl}/api/admin/apps/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) fail(`import failed: HTTP ${res.status} ${await res.text()}`);
  const app = await res.json();
  console.log(`youtrack-app-deploy: uploaded ${APP_FILES.length} entries -> app ${app.id} at ${baseUrl}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

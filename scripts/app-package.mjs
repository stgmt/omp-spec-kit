/**
 * YouTrack app package model (TASK-16): derives the shippable file set from
 * manifest.json instead of a hand-maintained list, and builds the package —
 * a staged directory plus a deterministic ZIP. Dev-only files (prototypes,
 * previously committed archives) never enter the set because nothing
 * references them.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path, { posix } from "node:path";
import yazl from "yazl";

// Fixed timestamp, explicit mode, and stored (uncompressed) entries keep the
// archive byte-deterministic: mode differs between NTFS and Linux, and
// deflate output may differ across zlib versions shipped with Node.
// Local-component construction + forceDosTimestamp are deliberate: yazl
// encodes DOS time via the Date's *local* getters, while its UT extra field
// stores the absolute epoch. A fixed DOS tuple therefore requires a local
// Date, and a fixed archive requires dropping the epoch-bearing UT field —
// otherwise identical trees hash differently across build timezones.
const ZIP_MTIME = new Date(1980, 0, 1);
const ZIP_MODE = 0o100664;

const HTML_REF = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
const JS_REF = /(?:from|require\(|import\()\s*["']([^"']+)["']/g;

function fail(message) {
  throw new Error(`app-package: ${message}`);
}

function toPackagePath(rel) {
  const p = posix.normalize(rel.split(path.sep).join("/"));
  if (p.startsWith("../") || p === ".." || posix.isAbsolute(p)) {
    fail(`manifest path escapes the app root: ${rel}`);
  }
  return p;
}

function isExternalRef(ref) {
  return /^(?:https?:|\/\/|#|data:|mailto:)/i.test(ref);
}

function localRefs(rel, content) {
  const refs = [];
  const patterns = /\.(?:html?|css)$/i.test(rel) ? [HTML_REF] : /\.(?:m?js)$/i.test(rel) ? [JS_REF] : [];
  for (const re of patterns) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(content));) {
      const ref = m[1];
      if (isExternalRef(ref) || ref.includes("${")) continue;
      if (re === HTML_REF || ref.startsWith(".")) refs.push(ref);
    }
  }
  return refs;
}

/**
 * Returns the sorted list of package-relative POSIX paths: manifest.json,
 * settings.json when present, every widget index under widgets/, every
 * http handler, plus local files those reference transitively.
 */
export function derivePackageFiles(appDir) {
  const manifestPath = path.join(appDir, "manifest.json");
  if (!existsSync(manifestPath)) fail(`manifest.json not found in ${appDir}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const seen = new Set();
  const queue = ["manifest.json"];
  if (existsSync(path.join(appDir, "settings.json"))) queue.push("settings.json");
  for (const w of manifest.widgets ?? []) {
    queue.push(posix.join("widgets", toPackagePath(w.indexPath)));
  }
  for (const h of manifest.httpHandlers ?? []) {
    queue.push(/\.m?js$/i.test(h.file) ? h.file : `${h.file}.js`);
  }

  while (queue.length) {
    const rel = toPackagePath(queue.shift());
    if (seen.has(rel)) continue;
    const abs = path.join(appDir, rel);
    if (!existsSync(abs)) fail(`manifest references missing file: ${rel}`);
    seen.add(rel);
    const content = readFileSync(abs, "utf8");
    for (const ref of localRefs(rel, content)) {
      queue.push(posix.join(posix.dirname(rel), ref));
    }
  }
  return [...seen].sort();
}

/**
 * Copies the derived file set into outDir and writes a deterministic ZIP
 * (sorted entries, forward slashes, fixed mtime) to zipPath.
 * Returns { files, outDir, zipPath, sha256, bytes }.
 */
export async function buildPackage(appDir, { outDir, zipPath }) {
  const files = derivePackageFiles(appDir);

  await rm(outDir, { recursive: true, force: true });
  for (const rel of files) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(appDir, rel), target);
  }

  await mkdir(path.dirname(zipPath), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const rel of files) {
    zip.addFile(path.join(appDir, rel), rel, { mtime: ZIP_MTIME, mode: ZIP_MODE, compress: false, forceDosTimestamp: true });
  }
  zip.end();
  await new Promise((resolve, reject) => {
    zip.outputStream.pipe(createWriteStream(zipPath)).on("close", resolve).on("error", reject);
  });

  const bytes = readFileSync(zipPath);
  return {
    files,
    outDir,
    zipPath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

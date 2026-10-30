import { writeFileSync } from "node:fs";

export function writeRuntimeManifest({ path, manifest, fs = null }) {
  const target = fs?.writeFileSync ?? writeFileSync;
  target(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function upgradeManifest(manifest, { hostUrl }) {
  if (typeof hostUrl !== "string" || hostUrl.length === 0) {
    throw new TypeError("hostUrl is required to upgrade a manifest");
  }
  return { ...manifest, hostUrl };
}

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PROBE_FILE = "probe-omp-discovery-v17.3.7.mjs";

/**
 * Runs the pinned OMP manager-handoff probe from the disposable Bun host
 * installed by the BDD image. Non-zero exits are returned because an
 * incomplete receipt is itself an asserted negative test result.
 */
export async function runPinnedManagerProbe({ runtimeHost, cwd, packageRoot, verifiedPackageRoot, home, agentRoot }) {
  const [distManifest, launcher] = await Promise.all([
    readFile(path.join(verifiedPackageRoot, "dist", "manifest.json")),
    readFile(path.join(verifiedPackageRoot, "bin", "omp-spec-kit-mcp")),
  ]);
  const expectedDistManifestSha256 = createHash("sha256").update(distManifest).digest("hex");
  const expectedLauncherSha256 = createHash("sha256").update(launcher).digest("hex");
  const result = spawnSync(
    "bun",
    [
      path.join(runtimeHost, PROBE_FILE),
      "--runtime-root",
      path.join(runtimeHost, "node_modules", "@oh-my-pi", "pi-coding-agent"),
      "--cwd",
      cwd,
      "--package-root",
      packageRoot,
      "--expected-dist-manifest-sha256",
      expectedDistManifestSha256,
      "--expected-launcher-sha256",
      expectedLauncherSha256,
      "--phase-mode",
      "bounded",
      "--phase-timeout-ms",
      "30000",
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        LANG: process.env.LANG ?? "C.UTF-8",
        CI: "1",
        HOME: home,
        USERPROFILE: home,
        PI_CODING_AGENT_DIR: agentRoot,
        OMP_PROFILE: "bounded-probe",
      },
      timeout: 120000,
      windowsHide: true,
    },
  );

  if (result.error) throw result.error;
  if (result.signal !== null) throw new Error(`pinned OMP probe was terminated by ${result.signal}`);

  let receipt;
  try {
    receipt = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`pinned OMP probe did not emit one JSON receipt: ${error.message}; stderr: ${result.stderr}`);
  }
  return {
    exitCode: result.status,
    stderr: result.stderr,
    expectedDistManifestSha256,
    expectedLauncherSha256,
    receipt,
  };
}

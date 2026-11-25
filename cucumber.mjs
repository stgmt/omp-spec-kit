
const messagePath = process.env.OMP_SPEC_KIT_BDD_MESSAGE_PATH;
const stdoutMessages = process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1";

// The coordinator evaluates this file with the real argv before forking
// parallel workers; workers only see `runtime/parallel/worker.mjs` in argv.
// Translate feature-path targeting into env flags so worker-side step files
// can gate their hooks reliably.
if (process.argv.some((arg) => arg.includes("app-install-live.feature"))) {
  process.env.OMP_SPEC_KIT_LIVE_E2E = "1";
}
if (process.argv.some((arg) => arg.includes("youtrack-spec-delivery.feature"))) {
  process.env.OMP_SPEC_KIT_DELIVERY_LIVE = "1";
}
if (process.argv.some((arg) => /release-evidence|release-candidate|lifecycle-producers/.test(arg))) {
  process.env.OMP_SPEC_KIT_RC_BDD = "1";
}

const options = {
  import: ["tests/support/**/*.mjs", "tests/step-definitions/**/*.mjs"],
  format: stdoutMessages
    ? messagePath
      ? ["message", ["message", messagePath]]
      : ["message"]
    : messagePath
      ? ["progress", ["message", messagePath]]
      : ["progress"],
  parallel: 1,
  strict: true,
};

const dockerRelease = process.env.OMP_SPEC_KIT_BDD_CONTAINER === "1";
const releaseRequested = dockerRelease || process.argv.includes("release") || process.argv.includes("--profile=release");
export const release = releaseRequested ? {
  ...options,
  paths: ["tests/features/release-contract.feature", "tests/features/release-evidence.feature"],
  tags: "@release-evidence or @id:SCEN-mri-malformed-json-recovery",
} : {};

export default dockerRelease ? release : { ...options, paths: [] };

const messagePath = process.env.OMP_SPEC_KIT_BDD_MESSAGE_PATH;
const stdoutMessages = process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1";

// The coordinator evaluates this file with the real argv before forking
// parallel workers; workers only see `runtime/parallel/worker.mjs` in argv.
// Translate feature-path targeting into env flags so worker-side step files
// can gate their hooks reliably.
if (process.argv.some((arg) => arg.includes("app-install-live.feature"))) {
  process.env.OMP_SPEC_KIT_LIVE_E2E = "1";
}
if (process.argv.some((arg) => /release-evidence|release-candidate|lifecycle-producers/.test(arg))) {
  process.env.OMP_SPEC_KIT_RC_BDD = "1";
}

export default {
  // Host scripts pass their feature explicitly; the Docker producer keeps the
  // release-evidence projection isolated from host-only lifecycle scenarios.
  paths: process.env.OMP_SPEC_KIT_BDD_CONTAINER === "1" ? ["tests/features/release-evidence.feature"] : [],
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
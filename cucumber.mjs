const messagePath = process.env.OMP_SPEC_KIT_BDD_MESSAGE_PATH;
const stdoutMessages = process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1";

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
const messagePath = process.env.OMP_SPEC_KIT_BDD_MESSAGE_PATH;
const stdoutMessages = process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1";

export default {
  // Historical v0.3.x feature projections stay available for regression
  // commands. The unfiltered release stream contains the executable
  // v0.4.0 release-integrity scenarios; lifecycle producer evidence is run
  // separately by the distribution workflow on the host checkout.
  paths: ["tests/features/release-evidence.feature"],
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
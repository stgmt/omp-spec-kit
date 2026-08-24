export default {
  paths: ["tests/features/**/*.feature", ".specs/mcp-release-integrity/mcp-release-integrity.feature"],
  import: ["tests/support/**/*.mjs", "tests/step-definitions/**/*.mjs"],
  format: process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1" ? ["message"] : ["progress"],
  parallel: 1,
  strict: true,
};

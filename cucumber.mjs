export default {
  paths: ["tests/features/**/*.feature"],
  import: ["tests/support/**/*.mjs", "tests/step-definitions/**/*.mjs"],
  format: ["progress"],
  parallel: 1,
  strict: true,
};

const messagePath = process.env.OMP_SPEC_KIT_BDD_MESSAGE_PATH;
const stdoutMessages = process.env.OMP_SPEC_KIT_BDD_MESSAGE_STDOUT === "1";

export default {
  // All feature projections remain selectable by tag; release workflows
  // invoke the exact tag they need instead of silently running zero cases.
  // The host release stream includes the archive and release-integrity gates.
  // Lifecycle producer evidence is run separately by the distribution workflow.
  // Keep the paths broad so @safe-authoring and @mcp-release-integrity both execute.
  paths: ["tests/features/**/*.feature"],
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
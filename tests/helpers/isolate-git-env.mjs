/**
 * Side-effect loader for the test scripts: clears the git context variables a
 * pre-commit hook hands to its children (see ./git-env.mjs). Imported with
 * `node --import` so every test file in the run is covered, including ones
 * added later.
 */
import { isolateGitEnvironment } from "./git-env.mjs";

const cleared = isolateGitEnvironment();
if (cleared.length > 0) {
  process.stderr.write(`[test env] cleared inherited git context: ${cleared.join(", ")} (a hook started this run)\n`);
}

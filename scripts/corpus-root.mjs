import { statSync } from "node:fs";
import path from "node:path";

export function resolveCorpusRoot({ root = process.env.OMP_SPEC_KIT_CORPUS_ROOT } = {}) {
  if (!root || !path.isAbsolute(root)) {
    throw new Error("OMP_SPEC_KIT_CORPUS_ROOT must explicitly name an absolute corpus root");
  }
  if (!statSync(path.join(root, ".specs"), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`OMP_SPEC_KIT_CORPUS_ROOT has no .specs directory: ${root}`);
  }
  return root;
}

// Reproduction for the TARGET_INDETERMINATE diagnostics/asymmetry bugs.
// Run: node scripts/repro-path-guard-selectors.mjs
import { classifyToolCall } from "../src/enforcement/classifier.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (toolName, input) => classifyToolCall({ toolName, input, cwd: root }, { root });

const show = (label, r) =>
  console.log(
    `${label}\n   action=${r.action} code=${r.code ?? "-"}\n   reason=${r.reason ?? "-"}\n`,
  );

console.log(`platform=${process.platform}  root=${root}\n`);

console.log("== A. Same selector path, different tools ==");
const sel = "src/enforcement/classifier.js:10-20";
show(`read  {path:"${sel}"}`, run("read", { path: sel }));
show(`grep  {path:"${sel}"}`, run("grep", { path: sel }));
show(`glob  {path:"${sel}"}`, run("glob", { path: sel }));

console.log("== B. Which target does the block name? ==");
// first target resolves fine, second is indeterminate (empty string)
show(
  'read {paths:["src", ""]}  <- offender is the empty string',
  run("read", { paths: ["src", ""] }),
);

console.log("== C. Plain directory targets ==");
show('glob {path:"."}', run("glob", { path: "." }));
show('grep {path:"."}', run("grep", { path: "." }));

console.log("== D. Nameable offender alongside a valid target ==");
// "src" resolves; the URI is indeterminate on every platform.
show(
  'read {paths:["src", "http://example.com/x"]}',
  run("read", { paths: ["src", "http://example.com/x"] }),
);
// win32 only: selectors stay unsafe for mutation tools, so this one is the offender.
show(
  'write {paths:["src", "src/foo.js:1-5"]}',
  run("write", { paths: ["src", "src/foo.js:1-5"] }),
);

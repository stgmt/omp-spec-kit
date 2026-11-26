// Source-side re-export. The installer keeps the built
// `dist/enforcement/setup-warning.js` under `enforcement/` (where its
// `./project-binding.js` import resolves) and writes this same re-export at the
// installed `hosts/codex/` path.
export * from "../../enforcement/setup-warning.js";

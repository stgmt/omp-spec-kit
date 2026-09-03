# Next normal release — variants (2026-09-04)

Status: planning only, no version bump, no tag, no release.

## Facts (HEAD `8d79cc4`, `main`, clean)

- `package.json:3`: `0.6.0`, `engines.node 22`. `plugins/omp-spec-kit/package.json:3`: `0.6.0`, `engines.omp 18.0.11`.
- `tag v0.6.0 = 8b3c278`, `HEAD = 8d79cc4`. Two commits above tag, both in `origin/main`:
  - `daba8e5 fix: guard Windows selectors and spec execution edges` — `src/enforcement/classifier.js +58`, `src/adapters/document-service.js` (`plugin 0.5.0 -> 0.6.0`), tests + `plugins/dist`.
  - `8d79cc4 chore: remove local audit and skill-gate artifacts` — deletes `audit-reports/` (13 tracked files), `package/`, `src/hooks/`, `tests/enforcement/`.
- `git diff v0.6.0..HEAD --stat`: 21 file, 271+/2033-.
- `npm run check:spec-corpus`: `clean; version=0.6.0; specs=3; canonical-docs=45; graph-nodes=452; graph-edges=985; markdown-files=52`.
- `npm run check:spec-port`: `census=46; contracts=8/10/23/27/25/49`.
- `docs/validation/release-status-v0.6.0.json`: `SHIPPED`, `toolCount 49`, `tagCommit 8b3c278`, archive `423424 B`, `sha256 c3d91e…`.
- `ROADMAP.md:40-54`: `v0.6.0` shipped (49 tools). Next is `v0.7.0 automatic plan gate` — check plan bytes after OMP selects plan, before approval UI, shared Interactive+ACP gate, fail-closed on error/timeout.
- `.specs`: `plugin-distribution`, `spec-mcp-access-gate`, `spec-mcp-operations`. No `automatic-plan-gate` spec exists.
- Spec tasks: `plugin-distribution` 10 done / 2 planned (`TASK-11` safe authoring, `TASK-7` next release path); `spec-mcp-access-gate` 0 done / 6 todo (`TASK-1..6`); `spec-mcp-operations` 1 done / 7 todo / 13 planned.
- `CHANGELOG.md:53-55`: `Unreleased: none` — stale, contradicts 2 unreleased commits.
- `plugins/omp-spec-kit/dist/manifest.json`: `pluginVersion 0.6.0`.
- `npm test` green after both commits (build, verify, dogfood 49, safe-authoring 17/102, staged 13/78, docker-bdd 7/69).
- Deleted `audit-reports/` contained evidence referenced by `.specs/spec-mcp-access-gate/README.md:20` (`omp-spec-kit-v0.6.0-omp-authority-…md`) and `FILE_CHANGES.md:23` (`mcp-access-gate-*.md`). Code has zero references to `src/hooks`, `tests/enforcement`, `package/package.json` (verified by grep in `src/`, `plugins/`, `scripts/`, `.github/`).

Semver note: `daba8e5` alone is a patch by semver (bugfix, no new API). Shipping it as `v0.6.1` would be correct but user rejected micro. All variants below are minor/major — each adds user-visible behavior to justify the bump.

## Variant A — `v0.7.0` Automatic Plan Gate (roadmap-faithful minor)

Scope: implement `ROADMAP.md v0.7.0` exactly. New OMP gate validates exact selected plan bytes before approval UI opens. One shared gate for Interactive + ACP. Fail-closed with bounded reason on fail/timeout/unavailable. No directory-scan guessing.

Requires:
- New `.specs/automatic-plan-gate` (15 docs: FR/AC/NFR/REQUIREMENTS/DESIGN/TASKS/feature/schema/README).
- Runtime: `src/gate/` extension + `pi.on(tool_call|plan)` registration grounded in pinned OMP `18.0.11` (`tool-wrapper.ts`, `types.ts`, `runner.ts`, `mcp/manager.ts`). Bundle via `scripts/build-plugin.mjs`.
- Tests: valid/invalid/changed-content/error/timeout × 2 approval modes, exact path/title/content/digest assertions. Full `omp-safe-authoring-development-proof` 4 gates + pinned OMP E2E from foreign cwd (`spec_overview -> propose_patch -> apply_proposed_patch`).
- Docs: `ROADMAP v0.7.0 shipped`, `CHANGELOG ## 0.7.0`, `release-status-v0.7.0.json`, version bump in 3 places (`package.json`, `plugins/omp-spec-kit/package.json`, `dist/manifest.json`).

Proof: `build && verify && dogfood && test:safe-authoring && test:staged && test:bdd && test:release-integrity && release:preflight --tag v0.7.0 && archive smoke (default + safe-authoring) && attestation && installed dogfood`.

Effort: 1–2 weeks. Risk: medium. OMP HookAPI surface research, approval-flow contract change, new spec from zero. Current `HEAD` fixes ride along as included bugfixes.

## Variant B — `v0.7.0` Hardened Safe-Authoring (spec-debt closure minor) — RECOMMENDED

Scope: turn current unreleased work into a legitimate minor by closing the access-gate spec and promoting the classifier work from silent fix to documented feature. No new plan-gate hook.

Includes:
1. `daba8e5` as documented behavior, not silent fix:
   - Windows `read` selectors `:1 :1-2 :1+2 :1- :1..2` + lists + `:raw :conflicts` + combos — formal support matrix in spec + BDD (`read-selectors`, `execution-edges` already added, extend with `L`-prefix + `..` edge).
   - `code/command` `.specs` literal guard (`RAW_SPEC_WRITE`) for eval/context-mode/shell — document as security feature with allowlist semantics + limits (no full shell parser — state explicitly).
2. Close `spec-mcp-access-gate` 6 todo (`TASK-1..6`): exact allowlist, containment, registration/bundle, real fixtures, pinned OMP contract grounding, non-MCP path coverage. Mark done only with real fixtures, not doc edits.
3. Fix stale metadata: `CHANGELOG Unreleased`, `document-service.js` version already fixed, `dist/manifest.json` sync, `release-status` renewal.
4. Resolve `audit-reports/` deletion consequence: either restore the two files referenced by active specs from `v0.6.0` tag into `docs/validation/` (preferred — keeps spec links resolvable) or amend the two spec lines via `propose_patch -> apply_proposed_patch` to point at tag history. Do not leave dangling `audit-reports/…` links in a minor.
5. Keep `package/`, `src/hooks/skill-gate.js`, `tests/enforcement/skill-gate-live-omp.test.mjs` deleted (no code references; prototype not wired to build/manifest/CI). No resurrection.

Proof: same gate chain as A minus plan-gate matrix, plus `spec-mcp-access-gate` 7 scenarios green and `check:spec-corpus`/`check:spec-port` clean. Tool-E2E matrix required only if tool contracts change (if selector support changes contract version, run full `@tool-e2e` on built server + archive launcher).

Effort: 2–4 days. Risk: low-medium. Blast radius is classifier + specs + docs. No approval-flow change. Gives users a visible reason to upgrade (Windows reliability + execution guard) while satisfying semver-minor.

## Variant C — `v1.0.0` Stable Contract Freeze (major)

Scope: declare `49-tool` surface stable. Freeze tool names/schemas/errors, remove or explicitly deprecate legacy profiles (`v0.3.2` 8-tool, `v0.4.1` 10-tool, `v0.5` 27-tool), commit to semver-compat, publish OMP `18.x` support matrix, lifecycle upgrade/rollback guarantees.

Requires: B plus breaking-change inventory (what is removed/renamed), migration notes, `plugin-distribution:TASK-7/11` done, all `spec-mcp-operations` planned tasks triaged (defer or complete — cannot ship major with 13 planned + 7 todo silently open), restored or replaced evidence for every `audit-reports/` link, full release-operator chain including GitHub Release + attestation + downloaded-asset smoke.

Effort: 3–6 weeks. Risk: high if done now. Premature: spec debt open, evidence just deleted, no deprecation window given to users. A forced major now would either freeze unfinished contracts or smuggle breaking changes without need.

## Recommendation

Do **B now, A next, C later**.

- B is the only normal release achievable in days with low risk that honestly justifies a minor: it converts a patch-sized diff into a user-visible hardening feature + spec closure.
- A is the correct following minor (`v0.8.0` if B takes `v0.7.0`) — it needs a full new spec and OMP hook grounding, must not be rushed into the same tag.
- C must wait until specs are done and evidence is restored; cutting `1.0` on open tasks repeats the `v0.4.0 -> v0.4.1` supersede pattern.

If roadmap pressure overrides pragmatism, do A directly and fold B into it — but state the 1–2 week delay to Windows users explicitly. Do not do C now.

## Next action for B (on approval)

1. `propose_patch` new `.specs` deltas for selector matrix + execution guard + `audit-reports` link repair; `apply_proposed_patch` after review.
2. Close `spec-mcp-access-gate:TASK-1..6` with real fixtures; `npm run check:spec-corpus && check:spec-port`.
3. Bump `0.6.0 -> 0.7.0` in `package.json`, `plugins/omp-spec-kit/package.json`, rebuild `dist/manifest.json`; write `CHANGELOG ## 0.7.0`; draft `release-status-v0.7.0.json`.
4. `npm test && test:release-integrity && release:preflight --tag v0.7.0 && archive smoke ×2 && attestation && installed dogfood`, then tag + GitHub Release (per `release-operator` skill, never npm).

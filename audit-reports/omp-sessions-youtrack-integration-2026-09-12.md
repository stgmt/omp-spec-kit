# Deep research: OMP sessions → YouTrack integration (2026-09-12)

Scope: all OMP agent sessions on this PC (`~/.omp/agent/sessions/**`) scanned for `youtrack` (119 files matched across 6 project dirs). Real YouTrack work for this repo lives in **3 top-level sessions**; everything else is subagent/scout noise.

## Session inventory

| Session | Window | Size | Role |
|---|---|---|---|
| `01a07964` (2026-09-07) | 01:03–06:33 | 1.2 MB | **Decision session**: plane.so → alternatives research → YouTrack Server chosen; ROADMAP committed |
| `01a07f5a` (2026-09-08) | 09-08 04:50 → 09-10 16:47 | 33.8 MB | **Main build session**: spec interview → implement → staging demo → UX overhaul → MCP-only refactor → Phase A delivered |
| `01a08864` (2026-09-09) | 09-09 22:58 → 09-10 08:33 | 1.7 MB | **Parallel session**: roadmap-specs feature + speclistener-vs-MCP confusion resolved |
| `01a08c19` (2026-09-10) | 16:14–19:46 | 289 KB | Crash/quota forensics (why work stopped: 291 dead turns, all models 429) |
| `01a08c58` (2026-09-10) | 17:23–20:23 | 17 KB | lean-ctx probe — incidental |

Cross-project hits (`presentation-reels` ×31, `omp-dynamic-workflows` ×4, `omp-reviewer-kit` ×4, `omp-context-kit` ×2, `OneDrive-Desktop` ×1) are scout/subagent files that read this repo's skills and logs — no independent YouTrack work.

## Timeline of what was asked

### Session 1 — 2026-09-07 (decision)
1. "Extension for plane.so to integrate our specs, PoC on current project, deep research on plane.so APIs"
2. Iterated: custom nodes/views? extension API? self-hosted only; alternatives to plane.so
3. Deep research of options → user picked **"1. YouTrack Server"**
4. "Update ROADMAP: link to research file + commitment to integrate YouTrack" (visual execution tracking, 10x onboarding)
5. "коммит пуш" → commit `825031a` (2026-09-07 06:32)

Artifact: `audit-reports/youtrack-visualization-research-2026-09-07.md` — YouTrack App over Plane.so (no in-client plugin UI), Azure DevOps (Windows+SQL, stagnant), Redmine (2000s UI), Jira DC (Forge cloud-only, $$$).

### Session 2 — 2026-09-08→10 (build, ~70 subagent runs)
1. Read visual-graph specs + research → step-by-step requirements interview
2. Adversarial + "нейрослоп" reviews of drafted requirements
3. AC interview (strict: N nodes = N cards; status table as-is; Approve click changes tracker **and** spec TASKS file)
4. "реализуй спеки" — built tracker app: `manifest.json` (`spec-panel` under issue + `spec-board` dashboard widget)
5. Staging demo on `localhost:8080` (admin/admin didn't fit; stock cards created for realism)
6. **UX revolt** (screenshot): "robot-readable only, no markup, no crosslinks to FR/NFR/AC/DESIGN" → requirement rework → HTML prototypes → "hybrid of all four" → refactor plan
7. Board called "откровенно нейрослоп" → V1 Flow / V2 Cluster / V3 Lineage prototypes → implementation plan
8. Screenshot bug audit → discovery: sync bypassed MCP ("577+ calls per sync = second mini-mapper") → **"надо все делать через мсп"** → deep analysis → refactor plan → **spec refactor first**, then adapter per SOLID/DRY/KISS/BDD/DDD/OOP replacing "легаси говно"
9. MCP/plugin restart saga (reinstalling plugin on live sessions kills the MCP door in all windows — later confirmed in forensics)
10. **"ок делай все до врайтбека"** (×3) → Phase A execution
11. Final: "статус и что дальше" (16:36) → Phase A complete report (16:47). Session ends.

### Session 3 — 2026-09-09→10 (parallel, roadmap feature)
- `DOC_NOT_FOUND` on ROADMAP.md → user: "specs per feature are too low-level; need roadmap folder, traced into the graph, waterfall phases"
- Created `.specs/roadmap-roadmaps/` (dogfood meta-roadmap), kernel `ROADMAP` entity kind, cross-spec `IMPLEMENTS` edges
- Resolved confusion: `speclistener` (spec-graph-sync :8787) vs `.mcp.json` MCP server — two different processes

## What exists now (repo state)

**All uncommitted** — `git status`: entire feature is untracked/modified work.

| Artifact | State |
|---|---|
| `.specs/youtrack-visualization/` (12 docs, 12 FR/AC/SCEN) | complete spec |
| `scripts/spec-graph-sync.mjs` (557 ln) | composition root: McpStdioClient→installed-plugin MCP, YT REST, projection+state stores |
| `src/adapters/youtrack-projection.js` (500 ln) | domain: buildProjectionPlan, 8 link types, idempotent repair, BUTTON_TRANSITIONS, writeback maps |
| `tools/spec-graph-app/` | manifest v1.0.18, spec-panel + spec-board widgets, spec-writeback.js (50 ln), prototypes |
| `tests/spec-graph-sync/` | sync.test.js **6/6 green**, writeback.test.js |
| `ROADMAP.md` | Phase A marked delivered w/ proof; Phase B deferred → issue #31; new v1.6.0 roadmap-specs section |
| `.specs/roadmap-roadmaps/` | new spec, all 4 TASKs **planned** |
| kernel `ROADMAP` kind | in `src/kernel/types.js` + rebuilt `plugins/.../dist` |
| GitHub issue [#31](https://github.com/stgmt/omp-spec-kit/issues/31) | OPEN — writeback tracker |

Live proof (staging SPEC project, 2026-09-10): `CARD_DRIFT` → `SYNCED` (25 writes) → `SKIPPED` parity-equal; BoardSnapshotV1 pointer on SPEC-365 = 408 nodes / 457 edges / 408 cardIds; app id 144-67 enabled globally; Spec Board on dashboard 166-3.

## Where it stopped — outstanding work

1. **TASK-7 writeback** (issue #31): start `--serve` w/ sync cron (Scheduled Task/systemd), upload `spec-writeback.js` workflow, E2E curl test, decide on unreachable-listener semantics (currently silent console.warn, no retry)
2. **TASK-11 fixtures**: empty scope / size failure / partial failure / duplicate identity uncovered
3. **Browser visual acceptance**: headless daemon exit=21, cross-origin iframes — only DOM-presence + data contract verified
4. **roadmap-roadmaps implementation**: spec written, kernel kind added, all tasks `planned`
5. **Uncommitted everything**: incl. 17 dirty `spec-mcp-operations/*` files flagged as user's unsaved work
6. **Staging YouTrack** (`localhost:8080`): currently DOWN
7. Operational caveat found: reinstalling the plugin while OMP sessions are open kills the MCP door in every live window (~6 min outage, fixed by reinstall completing)

## Last actual requests (verbatim essence)

- `2026-09-10 16:36` "статус и что дальше" → answered 16:47 with Phase A done + remaining list. **This is the last YouTrack-relevant exchange.**
- Before that, the standing order was "делай все до врайтбека" — fulfilled.
- Work then stopped due to provider quota exhaustion (muse-spark 429 until 09-14, gemini-3.8 ~10h, sonnet-5 conn errors — see `audit-reports/omp-crash-forensics-2026-09-10.md`).

## Spec contract (`.specs/youtrack-visualization/README.md`)

YouTrack is never a second source of truth; panel+board consume one committed BoardSnapshotV1 from `SPEC:SYNC-STATE`; identity `SpecId=<slug>:<localId>`; exactly 8 link types (satisfies, satisfied-by, verifies, covers, implements, implemented-by, depends-on, constrains); sync skips only on fingerprint+parity match; only TASK status writes back via `spec_patch`; V1/V2/V3 views share one snapshot.

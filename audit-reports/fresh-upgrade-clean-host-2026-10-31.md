# Fresh install and upgrade — clean-host evidence

Date: 2026-10-31
Stack: `spec-demo` on `http://127.0.0.1:8089` (YouTrack, `spec-git`, `spec-registryd`)
App: `spec-graph-app` 1.0.39
Mode: `node skills/spec-stack-setup/setup.mjs --no-demo`

## Setup

- Removed the previous `spec-demo` volumes (`yt-*`, `service-data`, `git-data`) so the run starts with an empty YouTrack and an empty specs repo.
- Ran setup with `--no-demo`; template seeding is skipped (`phase 5 - --no-demo: skipping template seeding`).
- The setup exits non-zero only at **phase 9 (OpenCode guard)**: the host's global OpenCode config points at the operator stack `http://127.0.0.1:8650/mcp`, while the demo serves `8644`. The guard refuses to overwrite a different stack (fail-closed) and does not affect the delivery under test.

## Fresh install

| Check | Result |
|---|---|
| Specs served by the service | `spec_catalog view:specs` → **0 specs** |
| Committed snapshot | `SPEC-1`, `complete: true`, `nodeCount: 0`, `edgeCount: 0`, `nodes: []`, `edges: []` |
| Dashboard | one `Spec Stack` (`166-3`) with one `spec-board` widget |
| Sharing | `All Users` + `spec-demo-users` |
| Board UI | renders `Нет синхронизированных карточек SPEC в проекте.` — an honest empty state, not an error |
| Spec Service health | settings ok, service ok, 1/1 repo bound, dashboard ok, snapshot `0 nodes, 0 edges`, specs `0`, next action `create specs in the bound repository` |
| Main navigation | standard items only; no Spec Graph item |

Screenshots:

- `.tmp/fresh-zero-specs-dashboard.png`
- `.tmp/fresh-zero-specs-health.png`

## Upgrade / reinstall

Re-imported the same `spec-graph-app-1.0.39.zip` and re-ran the dashboard
provisioner against the same stack:

| Check | Before | After |
|---|---|---|
| App id / version | `144-67` / `1.0.39` | `144-67` / `1.0.39` |
| Specs | `[]` | `[]` |
| `Spec Stack` dashboards | `1` | `1` |
| `spec-board` widgets on it | `1` | `1` |
| Dashboard id | `166-3` | `166-3` |
| Snapshot nodes / edges | `0 / 0` | `0 / 0` |

The provisioner reported `created: false`, `replaced: 1`, `atomic: false` and
the same sharing groups — no duplicate dashboard.

## Defect found and fixed

On the re-run, YouTrack 2025.3 rejected the replacement widget with:

```
400 {"error":"Bad Request","error_description":"'key' should be unique within a dashboard"}
```

`ensureWidget` only treated `409` or `duplicate|already exists` as the
duplicate-key refusal, so the re-run failed instead of replacing the board.
The guard now also recognizes `should be unique` / `unique within`, performs the
documented delete-then-create fallback, and a unit test
(`tests/unit/service/spec-dashboard-setup.test.mjs`) covers the 400 shape.

## Result

- Fresh install: **0 valid specs**, valid empty snapshot, dashboard present and shared, setup health explains the next action.
- Upgrade/reinstall: app identity, specs, dashboard id, widget, sharing, and snapshot are preserved; no duplicate dashboard.
- `tests/unit/service/spec-dashboard-setup.test.mjs`: 7/7 pass.

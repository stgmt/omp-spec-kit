# YouTrack Server visualization research (2026-09-07)

Decision: YouTrack Server App as in-UI spec-graph viewer. Rejected: Plane.so (no in-client plugin UI — only OAuth/webhooks/MCP/agents), Azure DevOps Server hub (viable but Windows+SQL Server, stagnant), Redmine (full plugins but 2000s UI), Jira Data Center (Forge Cloud-only, $$$ P2).

## Why

Specs = 3 slugs, 45 docs, 495 nodes, 1071 edges — all in markdown, all in creator's head.
Newcomer/agent path today: ask agent → re-read hundreds of files → re-derive graph.
With YouTrack: TASKS + FR/AC as issues + links → kanban + traceability visible, 10x onboarding.

## Extension surface (verified 2026-09-07)

- Apps: package of modules — widgets, forms, extra pages, automation. Sources:
  `https://www.jetbrains.com/help/youtrack/devportal/apps-documentation.html`,
  `https://github.com/JetBrains/youtrack-apps` (`create-youtrack-app` scaffold, `youtrack-app` upload/download/validate/configure/inspect).
- Extension points (verified): `ISSUE_BELOW_SUMMARY`, `ISSUE_ABOVE_ACTIVITY_STREAM`, `ISSUE_FIELD_PANEL_FIRST`, `DASHBOARD_WIDGET`, `ADMINISTRATION_MENU_ITEM`, `MARKDOWN` (embed in issue/article/comment via `CustomWidgetAPILayer`). Full list: `apps-reference-extension-points.html`. Guards supported.
- Manifest: `manifest.json` at package root, widgets in `widgets/<key>/index.html`. Deploy: `npm run build` + `npm run upload -- --host <url> --token <permanent-token>` (Update Project permission).
- REST: JSON, always enabled, `Authorization` with permanent token (`Manage Permanent Tokens`), `Accept/Content-Type: application/json`. Manipulates projects, custom fields + value sets, agile boards, issue link types. Source: `youtrack-rest-api-reference.html`. Exact resource paths (`/api/issues` etc.) to confirm against live `<host>/api/docs` — guessed doc URLs 404'd, not fabricated.

## Mapping (PoC slice: spec-mcp-operations, 288 nodes)

- Project `OSP` + custom fields `SpecKind` (FR/NFR/AC/TASK/SCENARIO/DOC), `SpecId` (TEXT, e.g. `TASK-10`), `ContentHash`, `Evidence` (URL). YouTrack has no hard issue types — typing via fields.
- Link types `satisfies / verifies / implements` for FR→AC, TASK→FR, SCEN→AC edges.
- Identity: `SpecId = <slug>:<nodeId>`; fingerprint `b0f85953…` in widget settings — match = zero sync calls.
- Sync direction: text Git→YouTrack one-way; TASK states optionally bidirectional via `onChange` workflow → `spec_patch`.
- PoC order: 28 TASK + 10 FR + edges first (visible win), then full 288. Docs-as-Articles later.

## Skeleton

```
spec-graph-app/
  manifest.json                      # widgets: spec-panel (ISSUE_BELOW_SUMMARY) + spec-board (DASHBOARD_WIDGET)
  widgets/spec-panel/index.html      # neighborhood graph TASK→FR→AC, click-through, Approve/Verify buttons
  widgets/spec-board/index.html      # full spec graph, zoom/filter by SpecKind
  src/sync.mjs                       # spec_catalog → spec_entities → spec_graph → YouTrack REST upsert
```

## Limits (honest)

- Animations/transitions = own JS in widget; no ready TASK→FR button API — links + own render.
- MCP read from widget not proven — widget reads YouTrack REST, external sync reads spec_graph/MCP.
- >2-level hierarchy rules via workflow types; flat issues + links preferred for PoC.

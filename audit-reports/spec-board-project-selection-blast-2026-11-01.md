# Spec Board project selection — blast radius and options

Date: 2026-11-01
Status: analysis only; no code changed
Surface: `tools/spec-graph-app/widgets/spec-board/index.html`

## 1. Current behavior

The board renders every spec in the committed corpus. The toolbar has spec
pills only (`Все спеки` + one pill per slug); there is no project selector.

Live operator marker (`SPEC:SYNC-STATE`, app 1.0.39):

- 709 nodes, 10 specs, one project `stgmt/omp-spec-kit`;
- marker length 383,013 chars of YouTrack's 512,000 limit (74.8%);
- `specProjects` maps all 10 slugs to `stgmt/omp-spec-kit`.

Filtering today is also inconsistent across views:

| View | Filter source |
|---|---|
| V1 Traceability Flow | `selectedSpec` (`index.html:1188-1190`, `1395`) |
| V2 Cluster Canvas | iterates every `availableSpecs` and all `RAW_NODES` (`1654-1655`); `selectedSpec` only changes when a card is clicked |
| V3 Lineage Inspector | renders all `RAW_NODES` (`1805`); `selectedSpec` only affects the id label |

So "no project selection" and "spec selection does not apply to V2/V3" are the
same design gap: there is no single `visibleNodes` source.

## 2. Key data-model finding

The marker **already carries the project map**:

- `specProjects: { "<spec-slug>": "<project-id>" }` is written by the
  projection (`src/adapters/youtrack-projection.js:428`) and built from the
  per-project mounts (`src/service/projection.js:120-125`).
- The widget already receives it: `loadCommittedSnapshot()` returns
  `{ marker, snapshot }`, so `committed.marker.specProjects` is in memory.
- Multi-project behavior is covered:
  `tests/service/projection.test.mjs:140` maps `demo-spec` → `demo/stack`;
  `tests/service/projection.test.mjs:629` maps `acme-spec` → `acme/unbound`.
- A slug served by two projects is rejected
  (`src/service/projection.js:108-123`), so `slug -> project` is a function and
  a project filter cannot be ambiguous.

Consequence: **client-side project selection needs no kernel, service,
projection, marker, or YouTrack API change.** A per-node `project` field would
grow the marker by O(nodes); the existing map grows by O(specs) and is already
committed.

## 3. Measured blast radius

### 3.1 Code size and touch points

| Item | Measure |
|---|---|
| `spec-board/index.html` | 1,733 lines, 70,151 bytes |
| `selectedSpec` references | 15 |
| `RAW_NODES.filter` sites | 3 |
| `availableSpecs` references | 4 |
| View renderers | 3 (`renderVariant1`, `renderVariant2`, `renderVariant3`) |
| Files mentioning `spec-board` | 15 |
| Sync/projection tests using `specProjects` | 5 |
| Board E2E | `tests/e2e/spec-board-lineage.mjs` |
| Package contract test | `tests/app-package.test.mjs` |

### 3.2 Option A (client-side) — files

- `tools/spec-graph-app/widgets/spec-board/index.html` (selector + shared
  `visibleNodes` + all three views);
- `tools/spec-graph-app/manifest.json` (version bump only);
- `tests/app-package.test.mjs` (selector markup/contract);
- `tests/e2e/spec-board-lineage.mjs` or a focused board E2E (project switch,
  counts, persistence);
- `tools/spec-graph-app/README.md`, `docs/specs-repo-operations.md`;
- spec `youtrack-visualization` (FR/AC for project selection).

Estimated: **1–2 days**, one product file.

### 3.3 Option B (per-dashboard setting) — additional files

- `tools/spec-graph-app/manifest.json` (`settingsSchemaPath` for
  `spec-board`);
- widget reads widget settings and pins one project;
- `scripts/spec-dashboard-setup.mjs` (pass `settings.project` in
  `ensureWidget`);
- dashboard provisioning tests/docs; duplicate dashboards per project become a
  deliberate pattern.

Estimated: **2–3 days**; no data-model change.

### 3.4 Option C (server-side project scope) — files

- `src/kernel/query/service.js` (`board` args/validation, `boardProjection`,
  `scope.mode: "project"`);
- `src/adapters/youtrack-projection.js` (scope/snapshot contract);
- `src/service/projection.js` (per-project board construction);
- `src/adapters/youtrack-store.js` (marker scope);
- `src/service/spec-branches.js`/`repos.js` if the scope must resolve a
  project's specs;
- tests: projection, sync, store, http-mcp, board E2E;
- widget request/selector.

Estimated: **4–6 days**, schema/marker version change, higher regression risk.
Benefit only when the corpus/marker grows beyond the 512k budget or strict
per-project payload isolation is required.

### 3.5 Option D (one pointer per project)

Separate `SPEC:SYNC-STATE:<project>` issues, per-project publish/cleanup, and a
widget that selects the pointer. Touches projection, sync, store, cleanup,
dashboard, tests and migration. Estimated **1–2 weeks**; not justified now.

### 3.6 Option E (native YouTrack project context)

Not viable: dashboards are global; `DASHBOARD_WIDGET` has no project entity
context. A dashboard cannot inherit "the current project".

## 4. Options and trade-offs

| Option | Scope | Pros | Cons |
|---|---|---|---|
| **A. Client-side selector from `specProjects`** | one widget + tests/docs | zero backend/schema change; uses existing authoritative map; works with legacy marker fallback; fast | project names become visible in the UI (already in marker); filtering 709 nodes in memory (negligible); must fix V2/V3 filtering |
| **B. Per-dashboard widget setting** | manifest settings + widget + provisioner | a dashboard can be pinned to one project; smaller UI | needs a settings schema and provisioning changes; multiple dashboards if users need several projects; no ad-hoc switching unless combined with A |
| **C. Server-side project scope** | kernel/projection/store/sync/tests | smaller payload for very large corpora; strict isolation | marker/scope schema change; 8–10 files; higher risk; still needs UI |
| **D. Pointer per project** | projection/sync/store/cleanup | strongest isolation and per-project freshness | heaviest; migration and cleanup complexity |
| **E. Native project context** | — | — | not supported by YouTrack dashboards |

## 5. Recommended UX for Option A

1. Add a labelled `<select id="project-select">` in the toolbar/header:
   `All projects` (default) followed by the project IDs from
   `specProjects`, sorted; add `Unassigned` only when some visible specs have no
   mapping (legacy marker).
2. Build `projectSpecs = new Set(slugs where specProjects[slug] === selectedProject)`;
   filter `availableSpecs` by it.
3. Build one `visibleNodes` function
   `node => (project === 'ALL' || specProjects[node.specSlug] === project) && (spec === 'ALL' || node.specSlug === spec)`
   and use it in **all three** views, the stats badge, the default focus, and
   the search/focus helpers.
4. If the selected spec is not in the new project, reset it to `ALL`.
5. Persist the selection in `localStorage` and `?project=<id>`; an unknown value
   falls back to `ALL`.
6. Legacy marker without `specProjects` (or `null`): hide the selector and keep
   the current behavior.
7. Label the selector `Project`, show the node/spec count for the current
   selection, and keep the `All projects` option first.

Draft acceptance criteria:

- Given a marker with `specProjects` covering two projects, when the user
  selects a project, then V1/V2/V3 render only that project's nodes, the spec
  pills list only its specs, and the counts match; `All projects` restores the
  full board.
- Given a legacy marker without `specProjects`, the selector is hidden and the
  board renders the full corpus.
- The selection survives a reload (URL/localStorage); an unknown project falls
  back to `All projects`.
- The marker bytes and the query payload do not change.

## 6. Risks

- **Visibility**: `stgmt/omp-spec-kit`-style project IDs become selectable in a
  dashboard shared with `All Users`. They are already present in the marker,
  but the UI surfaces them; if this is sensitive, use short labels or an
  allow-list in widget settings.
- **Legacy markers**: `specProjects` is null/absent before projection v6;
  the selector must degrade to today's board.
- **V2/V3 consistency**: adding a project filter without fixing the existing
  spec filter would leave V2/V3 showing all specs; do both in one change.
- **Long/many projects**: use a searchable select or truncate labels; the map
  is O(specs), not O(nodes).
- **Unassigned specs**: only possible with a stale/partial marker; show
  `Unassigned` rather than silently hiding them.

## 7. Recommendation

Ship **A** first: it is the smallest change that satisfies "choose a project",
uses the already-authoritative `specProjects` map, and fixes the V1/V2/V3
filter inconsistency. Add **B** only when a dashboard must be permanently
pinned to one project. Keep **C/D** as scale/isolation options, not now.

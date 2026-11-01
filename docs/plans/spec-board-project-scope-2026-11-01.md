# Spec Board project scope — C+D hybrid work plan

Date: 2026-11-01
Status: implemented in 3.0.6 (see `CHANGELOG.md` and
`audit-reports/youtrack-spec-delivery-scenarios-2026-11-01.md`).
Supersedes the client-only Option A in
`audit-reports/spec-board-project-selection-blast-2026-11-01.md`.

## 1. Decision

Use a **server-side project scope + per-project committed pointers** hybrid:

- **C (server-side scope)**: the service builds one board per project from that
  project's mount and exposes `spec_graph board { project }`; the kernel stays
  pure and receives the resolved `specSlugs`.
- **D (per-project pointers)**: each project board is published to its own
  `SPEC:SYNC-STATE:<project>` pointer, so no single issue carries the whole
  corpus and the 512 000-character limit stops being a global ceiling.
- The root `SPEC:SYNC-STATE` issue becomes the **index** (project → pointer id,
  counts, unassigned) and keeps the aggregate snapshot for `All projects`.
- **Unassigned** is a first-class bucket: specs not present in `specProjects`
  are published to `SPEC:SYNC-STATE:__unassigned__`.
- **No legacy fallbacks**: a marker without a valid v7 index fails closed with a
  named error; the board never silently renders the aggregate. Old v6 markers
  are reprojected to v7 before the board is readable.
- **Unknown project selection resolves to Unassigned**, never to All. An
  unknown `?project=` value is treated as the unassigned bucket; if that bucket
  is empty, the board shows an honest empty state.

## 2. Data model

```
SPEC:SYNC-STATE                     root issue
  marker: BoardSnapshotV1
    scope: { mode: "corpus", specSlugs: [...] }   # aggregate = All projects
    projects: [
      { id: "stgmt/omp-spec-kit", pointer: "SPEC-101", nodeCount: 709 },
      { id: "acme/gamma",         pointer: "SPEC-102", nodeCount: 42 }
    ]
    unassigned: { pointer: "SPEC-103", nodeCount: 0 } | null
    specProjects: { "<slug>": "<project>" }          # authoritative routing map

SPEC:SYNC-STATE:<project-key>       per-project issue
  marker: BoardSnapshotV1
    scope: { mode: "project", project: "stgmt/omp-spec-kit", specSlugs: [...] }
    snapshot.nodes: only that project's nodes
    specProjects: full map (routing) or project subset

SPEC:SYNC-STATE:__unassigned__      unassigned issue (only when non-empty)
```

`project-key` is the URL-safe encoding of the project id (`/` → `--`); the
marker carries the real `project` value, so the key is not parsed back.

## 3. Work breakdown

### Phase 0 — contract (0.5 day)

- `youtrack-visualization`: add FR/AC for the project index, per-project
  pointers, unassigned bucket, unknown-selection fallback, and fail-closed
  behavior for a missing v7 index.
- `docs/specs-repo-operations.md` and `tools/spec-graph-app/README.md`: describe
  the pointer model and the selector.
- Design review for the new scenarios.

### Phase 1 — server-side boards (1 day)

- `src/service/dispatch.js` already resolves the request `project` and routes
  the kernel call through that project's mount, so `spec_graph board` with a
  `project` argument is scoped today; verify the contract and add explicit
  coverage for it.
- `src/service/projection.js`: while iterating mounts, keep
  `projectBoards[projectId]` in addition to the aggregate; compute
  `unassignedSlugs = allSlugs - union(specProjects)`.
- Service `spec_graph board { project }`:
  - `project` resolves to that project's mount board;
  - `__unassigned__` resolves to the unassigned slugs (or an empty board);
  - unknown project is an explicit `UNKNOWN_PROJECT` result, not a silent All.
- Keep `spec_graph board` without `project` as the aggregate.
- Tests: two-project fixture, unknown project, unassigned, duplicate slug.

### Phase 2 — per-project pointers and root index (1.5 days)

- `src/adapters/youtrack-store.js`:
  - `publishCommitted` writes the root aggregate plus one signed marker per
    project and the unassigned marker;
  - root index is written last; a partial project failure keeps the previous
    pointer and marks root `complete: false`;
  - stale project pointers are deleted only after the new root index is
    committed;
  - per-pointer size guard (512k) applies to each project marker.
- `src/service/projection.js`: call the multi-pointer publisher with the
  project boards.
- `scripts/spec-graph-sync.mjs` and `src/adapters/youtrack-projection.js`:
  carry `projects`/`unassigned` through the plan and marker.
- Tests: `tests/spec-graph-sync/store.test.js` (multi-pointer, partial failure,
  stale cleanup, size), `tests/service/projection.test.mjs` (per-project
  boards), `tests/spec-graph-sync/sync.test.js` (routing/plan).

### Phase 3 — widget selector (1.5 days)

- `tools/spec-graph-app/widgets/spec-board/index.html`:
  - read the root index, add a project `<select>`: `All projects`, projects,
    `Unassigned`;
  - on project selection, load that pointer by issue id and validate
    `scope.project`;
  - unknown `?project=` → Unassigned (empty state if absent);
  - persist through `host.storage` when available, else `host.storeCache`
    (`localStorage` and the parent URL are blocked in YouTrack's sandboxed
    dashboard iframe); `?project=` is honored when the widget location exposes
    it;
  - one `visibleNodes` for V1/V2/V3 (project + spec + kind + search);
  - spec pills filtered to the project; invalid spec resets to `ALL`;
  - unreadable/missing v7 index → named fail-closed error, never the aggregate.
- `tools/spec-graph-app/manifest.json`: app 1.0.40.
- E2E: `tests/e2e/spec-board-lineage.mjs` or a new focused script:
  switch project, counts, unassigned fallback, persistence, fail-closed on a
  missing v7 index.

### Phase 4 — migration, evidence, release (1 day)

- `PROJECTION_VERSION` 7; first sync publishes project pointers and the index;
  the widget requires the v7 index and fails closed on a v6 marker.
- Fresh/upgrade: root index + project pointers created once; a reinstall keeps
  the same ids; removing a project deletes its pointer.
- Release app 1.0.40 / package 3.0.6 with the full release gate.
- Spec/release evidence: per-project marker sizes, selector E2E, unknown →
  Unassigned.

## 4. Acceptance criteria

1. A marker with two projects and one unassigned spec has a root index listing
   both projects and the unassigned bucket; each project pointer contains only
   that project's nodes and stays under 512 000 characters.
2. `spec_graph board { project }` returns the project board; an unknown project
   returns `UNKNOWN_PROJECT`; no silent corpus fallback.
3. The widget selector lists `All projects`, every project, and `Unassigned`;
   unknown `?project=` resolves to Unassigned, not All.
4. V1/V2/V3 respect the same project/spec/kind/search filter; counts match.
5. A marker without a valid v7 index fails closed with a named error and never
   renders the aggregate; a v6 marker must be reprojected first.
6. A partial pointer failure leaves the previous pointer intact and marks the
   root `complete: false`; a retry converges; stale project pointers are removed.
7. Reinstall/upgrade preserves root/project pointer ids and does not duplicate
   pointers.

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Multi-pointer publish is not atomic | root index written last; previous pointers kept on failure; `complete:false` |
| 512k per project still exceeded | per-project size guard with `MARKER_TOO_LARGE` naming the project; split further only if needed |
| Pointer duplication | deterministic SpecId/summary keyed by project; root index is the lookup; publish reconciles lowest verified id like today |
| Unknown project silently shows All | explicit `UNKNOWN_PROJECT` server result; widget renders Unassigned/empty |
| v6 marker before reprojection | projection publishes v7 on boot/first sync; the widget reports `PROJECTION_INDEX_REQUIRED` instead of rendering stale aggregate |
| Project names leak to All Users | names are already in the signed marker; optionally add a display-label map later |
| Stale project pointer after rename | root index diff deletes pointers absent from the new project set |
| Dashboard iframe is sandboxed | localStorage/parent URL blocked; use `host.storage`/`host.storeCache`; `?project=` only when the host location exposes it |

## 6. Execution order

1. Contract and design review.
2. Service per-project boards + tests.
3. Multi-pointer publisher + root index + tests.
4. Widget selector + E2E.
5. Projection v7, fresh/upgrade evidence, app 1.0.40, release 3.0.6.

Estimated total: **5–6 working days**; Phase 1 and Phase 2 can land together
behind `PROJECTION_VERSION=7`.

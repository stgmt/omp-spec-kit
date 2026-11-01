# Project context integration — agents, MCP, registry and YouTrack

Date: 2026-11-01
Status: **delivered in the working tree (unreleased); verification recorded below**.
Steps 0–4 are implemented and the Step 5 commands were run on the same tree.
The project selector and v7 project pointers delivered in 3.0.6 remain the
completed board baseline, not proof that an agent connection selects the right
project — that gap is what Steps 1–4 close.

This is the same plan file updated in place, not a parallel plan: the delivered
board work keeps its own record in Appendix A. It supersedes the client-only
proposal in `audit-reports/spec-board-project-selection-blast-2026-11-01.md`.
Publication (tag, GitHub release, app publication) is still a separate explicit
action: nothing here authorises a release cut.

## 1. Problem and outcome

An agent working in one repository must not receive another project's catalog,
then report that a required specification does not exist. Changing the active
project must not require restarting or reconnecting the MCP server.

Reported incident: an agent could not find `native-task-review`; a read carrying
`declaredWorktree` returned `NOT_FOUND`. Treat the reported failure as observed.
The exact configuration and loaded executable of that failing session have not
been recovered; do not infer that restarting its process fixes the architecture.

Required outcome: the agent session, every MCP operation, the authoritative
specification repository and the YouTrack view agree on the selected project.
Two concurrent sessions may use different projects through the same service.
There is no process-global mutable "current project".

## 2. What already exists, and where the integration stops

| Evidence | Observed behavior | Consequence |
|---|---|---|
| `src/mcp/server.js:138-192,299-314`; `src/adapters/query-service.js:245-269` | The local stdio runtime routes a call by `declaredWorktree` and caches a separate service for each physical root. | Reuse this local isolation; do not describe the entire implementation as inherently single-root. |
| Read-only real-server probe below | One server process served root A, root B and A again without restarting. | Restart is not the required selection mechanism. |
| `src/adapters/tool-contracts.js:592-674,764-768` | The validator accepts routing metadata, but generated public schemas omit it on most tools and set `additionalProperties:false`. | An internal capability is not a usable typed client contract. |
| Real `initialize` / `tools/list` probe | `spec_catalog`, `spec_documents`, `spec_patch` expose neither `project` nor `declaredWorktree`; `mcp_preflight` exposes only the latter. | Fix schema discovery, not merely instructions telling the agent to pass hidden arguments. |
| `src/service/dispatch.js:99-122,144-208` | HTTP routing already supports an explicit `project`, then a connection header, then the caller default; authorization checks explicit project scope. | Reuse the dispatcher and project mounts; remove accidental connection-wide selection. |
| `src/service/mounts.js:181-198,399-467,524-546,590-600` | Repository bindings, materialized corpora, graph services and write locks already have project-level owners. | No second project registry, graph store or routing daemon is needed. |
| `scripts/install-host.mjs:32-60`; host installers; packaged `.mcp.json` | Installation writes one `X-Spec-Project`; the shared installer defaults to `stgmt/omp-spec-kit` when no project is supplied. | A successful installation can silently select the wrong project for another repository. |
| `src/enforcement/setup-warning.js:32-78`; `src/hosts/opencode/setup.mjs:23-51` | A configured endpoint is enough to suppress the warning; the selected project's ownership is not checked. The warning recommends restarting the session. | "Connected" and "bound to this project" must become different states. |
| Live mounted `mcp_preflight` probe below | A request declaring the reviewer-kit workspace still reported project `stgmt/omp-spec-kit`, no declared workspace, and successful root matching. | Current admission facts do not prove that the caller's intended workspace was selected. |
| `src/service/projection.js:108-130`; `scripts/spec-graph-sync.mjs:388-405` | The aggregate rejects duplicate node/spec slugs across projects; writeback resolves a project through a flat `specProjects[slug]` map. | Project identity must survive aggregation and writeback, not stop at the selector. |
| `src/service/ops/registry.js:20-35` | The unscoped listing path takes the complete registry index; this operation does not itself filter that index by `ctx.scopes`. | Verify and enforce authorization before exposing cross-project discovery. |

### Recorded read-only probes

1. Started the actual `src/mcp/server.js`, not `createRootedServices` directly.
   One process handled `initialize`, `tools/list` and three `spec_catalog` calls.
   A and B were existing frozen corpus fixtures. A returned four spec slugs,
   B returned three different slugs, then A returned its original four.
   A's returned root identity was stable and different from B's. No writes.
2. Through the mounted MCP tool, called
   `mcp_preflight({declaredWorktree:"E:/repos/omp-reviewer-kit"})`.
   The response reported `project:"stgmt/omp-spec-kit"`,
   `worktree:{declared:null,served:null,matchesResolvedRoot:true}`,
   `mutationReady:true`. This proves the reported fields do not establish
   caller-to-project agreement. It does not identify which deployed adapter
   dropped or failed to interpret the declaration.
3. Read the governing specifications through MCP:
   `spec-registry-service` / `DESIGN.md`, `FR.md`;
   `spec-mcp-operations` / `DESIGN.md`;
   `youtrack-visualization` / `FR.md`.
   The registry design already requires a project on the protocol boundary and
   remote MCP for managed projects. Those requirements are not a new backend.

## 3. Preserve the completed YouTrack baseline

Keep the existing per-project boards and signed committed pointers:
`SPEC:SYNC-STATE` is the root index, `SPEC:SYNC-STATE:<project-key>` owns each
project board, and the unassigned pointer exists when needed.
Keep root-last publication, completeness validation, size guards and repair.

Keep the existing selector, sandbox-compatible host storage, and explicit
Unassigned empty state. An unknown widget selection resolves to Unassigned,
**not** All. That presentation rule must never become an MCP routing fallback.

`All projects` is an authorized read view, not a target for specification
mutations. Selecting a dashboard project must not change another agent's session
or the server's default project.

Evidence for the delivered board work:
`CHANGELOG.md`,
`audit-reports/youtrack-spec-delivery-scenarios-2026-11-01.md`,
`docs/decisions/widget-marker-trust.md`.
The latter's required marker edit permissions still need deployment verification;
a browser-side signature check cannot replace those permissions.

## 4. Target contract

### 4.1 One project identity, existing repository authority

- Use the existing canonical `owner/project` identity and repository bindings.
  A workspace path, spec slug, YouTrack project short name and registry project
  ID are different values; do not substitute one for another.
- A managed code checkout is not a local specification corpus. Its canonical
  specifications live on the repository's spec branches and are served through
  the registry. Sending its Windows path to a Linux server is not a repository
  binding or a remote filesystem lookup.
- Reuse the existing host/project configuration as a selection hint, checked
  against the service's authoritative repository binding and allowed scopes.
  Do not add a second mapping database. A repository with several candidate
  projects needs an explicit selection; never choose the first match.
- Never infer filesystem targets from ordinary text, `cwd` values inside command
  payloads, or command strings. Only explicitly designated context/path fields
  participate in project resolution.

### 4.2 Session context and public MCP arguments

- For managed HTTP calls, publish `project` in the central input-schema source
  for every project-scoped operation. The same declared contract must drive
  `tools/list`, validation, dispatch and packaged clients.
- A host supplies the session's verified project when the tool call omits it.
  An explicit authorized project remains an explicit per-call selection and
  does not replace the default of any session. Never make the LLM remember to
  repeat an invisible parameter.
- Remove the hardcoded installer project and connection-wide selection through
  `X-Spec-Project` / global `OMP_SPEC_PROJECT` as routing defaults. Migrate every
  packaged declaration, installer and client in the same cutover; do not retain
  an old-header fallback, alias tool, or compatibility branch.
- Context-free discovery may list only the caller's allowed projects.
  A scoped operation without a resolved project refuses before reading a spec.
  Missing, unknown, ambiguous and unauthorized projects are different outcomes.
- Local stdio routing by `declaredWorktree` remains a local/test transport
  capability, not an alternative backend for managed projects. Describe its
  semantics separately in the one schema generator and transport instructions.
  HTTP must not silently accept a local-path routing instruction it cannot honor.

### 4.3 Truthful admission and result identity

- `mcp_preflight` distinguishes connection health, project selection,
  repository binding, corpus availability and write readiness.
  It must not return a successful root match merely because a service compares
  its own materialized root with itself.
- Show the actual served registry project in the existing response provenance
  contract for scoped results. Define that field centrally and migrate existing
  duplicate/preflight-only representations rather than adding competing owners.
- Physical-root hashes remain local root identities; they are not a comparison
  between a Windows code checkout and a server-side materialized corpus.
- Preserve stable cause code `REPOSITORY_ROOT_FINGERPRINT_MISMATCH`, exposing only
  `activeProjectRootId` and `resolvedRootId` for root-identity conflicts.
  Do not echo absolute paths, repository credentials or token values.
- A valid selected project with no requested spec may return `NOT_FOUND`.
  Unresolved/mismatched project selection must fail earlier with its own
  actionable diagnosis, never masquerade as a missing document.

### 4.4 Isolation through writes and projections

- Reuse `MountManager`'s per-project services and write locks.
  Bind patch previews, fingerprints, leases, published versions and apply
  requests to the same selected project. A preview from A cannot apply to B,
  even when document bytes and local spec IDs happen to match.
- Shared adapter identity is `(project, specSlug, localId)`. Keep kernel-local
  IDs local to a project; qualify identities at the shared registry/tracker
  boundary. Two independent projects in different repositories may use the same
  slug without overwriting each other or disabling the aggregate board.
- Replace the flat slug-to-project routing map and every consumer together.
  Task status writeback uses the card's verified project plus spec/task identity,
  never a search for the first project containing that slug.
- Keep existing canonical branch naming and rejection of conflicting bindings
  within one repository. Supporting equal branch names for distinct projects
  in the same repository is not added by this plan.
- Keep Git specifications authoritative; YouTrack is a read projection except
  governed task status changes. Setup/discovery/binding integrations must be
  exposed through MCP, not new synchronization scripts or tracker-side stores.

## 5. Execution order and change boundaries

### Step 0 — pin the failing route and formalize the common contract

Files/sources:
`src/adapters/tool-contracts.js`, `src/mcp/server.js`,
`src/service/dispatch.js`, `src/service/http.js`,
the active host's MCP declaration and loaded package manifest.

- Capture the failing session's host, transport, endpoint, advertised schema,
  requested workspace/project, served project and loaded package digest.
  Redact secrets. Compare deployed code with source, not version strings alone.
- Resolve the observed loss of `declaredWorktree` before attributing it to one
  particular adapter. Do not repeat the already reported missing-document check
  as if it establishes a new cause.
- Update the existing specifications, through MCP and their dedicated spec
  branches: `spec-registry-service`, `spec-mcp-access-gate`,
  `spec-mcp-operations`, `youtrack-visualization`, `youtrack-spec-delivery`.
  Keep shared transition/question rules in their existing common owner.
- Define request/result fields, selection precedence and refusal semantics
  before implementation. No new façade per entity and no second project registry.

Exit: executable, public-boundary scenarios distinguish wrong project from an
actually missing spec; the two-transport contract and all consumers are named.

### Step 1 — make the real MCP boundary project-aware

Files:
`src/adapters/tool-contracts.js` (`jsonSchemaFor`,
`validateContractArguments`, `MCP_SERVER_INSTRUCTIONS`),
`src/service/dispatch.js` (`resolveProject`, `callTool`, `toolListPayload`),
`src/service/http.js` (`wireProtocolHandlers`),
`src/service/index.js` (`preflightSetup`),
`src/adapters/document-service.js` (`mcpPreflight`),
`src/adapters/query-service.js` (provenance).

- Generate and accept the same context fields; remove hidden metadata and
  instructions promising unsupported routing.
- Select the project per operation, before graph lookup and before writes.
  Reject unresolved selection instead of using a connection's first project.
- Make preflight and every returned project identity truthful.
- Preserve local `createRootedServices` isolation; do not solve remote selection
  by starting a local process against each product checkout.

Exit: one initialized real MCP connection alternates A/B/A with correct
catalogs/documents and unchanged process/connection; advertised schemas accept
the actual calls. Wrong-context admission cannot return a false successful match.

### Step 2 — finish authorized discovery and repository binding

Files:
`src/service/ops/registry.js`, `src/service/mounts.js`,
`src/service/onboarding.js`, `src/service/index.js`,
the existing repository-binding application services.

- Scope project discovery/index construction to verified caller scopes before
  returning metadata. An unqualified listing must not disclose unrelated
  projects or access their repositories as a side effect.
- Expose required project discovery/setup/binding actions through the existing
  typed MCP registry façade; keep its handlers thin over the existing services.
  Update mutating-operation authorization, annotations and schemas when adding
  binding actions; a listing façade must not accidentally grant read-only users
  setup/write privileges.
- Check explicit workspace/repository selection against the authoritative
  binding. Missing binding returns setup instructions, not another project's
  catalog. Binding changes invalidate only that project's existing caches.

Exit: a caller with A access cannot enumerate/read/write B; an A+B caller can
choose either on one connection. Fresh setup, empty project and ambiguous
repository selection have distinct honest outcomes.

### Step 3 — carry live session context from every supported agent

Files:
`src/v0.1/extension.js`, `src/enforcement/adapter.js`,
`src/enforcement/setup-warning.js`,
`src/hosts/opencode/plugin.mjs`, `src/hosts/opencode/setup.mjs`,
`src/hosts/codex/normalize.mjs`, `src/hosts/codex/sessionstart.mjs`,
`scripts/install-host.mjs`, `scripts/install-opencode-guard.mjs`,
`scripts/install-codex-guard.mjs`,
`plugins/omp-spec-kit/.mcp.json`.

- Resolve selection from each session's current workspace/configuration, not
  `process.cwd()` captured at install or one global environment variable.
- Reuse supported typed input replacement at the MCP call boundary; do not
  rewrite arbitrary command strings, add a proxy daemon or register duplicate
  tools. Compose with the existing access gate rather than replacing it.
- In installed OMP source, `ExtensionRunner.cwd` reads
  `sessionManager.getCwd()` per session and `sessionId` reads
  `getSessionId()` (`extensibility/extensions/runner.ts:759-786`).
  `ToolCallEventResult.input` is replacement execution input, revalidated before
  scheduling; its contract also covers nested `write xd://` dispatches
  (`extensibility/shared-events.ts:331-352`).
  Use those existing facilities; verify actual plugin visibility and handler
  composition in a live OMP session before declaring automatic injection done.
- Exercise both direct MCP calls and OMP's `write xd://` form. Input replacement
  is not proof that every host invokes the same hook. Check OpenCode, Codex and
  Claude against their installed contracts; any missing native hook is an
  explicit implementation prerequisite, not a silent model-memory fallback.
- On a supported workspace switch, re-resolve only that session's context;
  another session remains on its own project. Do not restart the MCP service.
- Warn once about a missing/wrong project binding even when the endpoint is
  configured. Remove advice to restart merely to select another project.

Exit: two real agent sessions use A and B concurrently; moving one to B changes
its next call, without affecting the other session or the MCP connection.
Each supported host proves selection through its actual installed call path.

### Step 4 — preserve identity through YouTrack and task writeback

Files:
`src/service/projection.js` (`mergedBoard`),
`src/adapters/youtrack-projection.js`, `src/adapters/youtrack-store.js`,
`scripts/spec-graph-sync.mjs` (`HttpBoardReader`, `HttpTaskStatusWriteback`),
`tools/spec-graph-app/widgets/spec-board/index.html`,
the existing Spec Panel and Spec Service page.

- Carry project-qualified shared identities through nodes, edges, card lookup,
  pointers, spec selection and status writeback. Update all flat
  `specProjects`/unqualified-card consumers in one cutover.
- Migrate existing card/pointer identities deterministically, without duplicate
  tasks or losing native statuses. An old index is not read through a fallback:
  publish the complete new representation, then switch the root index.
- Keep completeness/size/signature checks and root-last publication. Failed
  migration does not advertise a completed index; retry is idempotent.
- Key stored view preferences to their service/board context. A dashboard
  selection never becomes another agent's default or an authorization grant.
- Setup/help displays the selected project and repository binding; all app
  configuration stays under Administration → Integrations, not the main menu.
- Verify the documented service/admin-only marker edit permissions on the
  deployed tracker; no HMAC secret is shipped to the browser.

Exit: equal spec/task local IDs in two different project repositories coexist
on the shared board; changing status on B's card affects only B's source and
returns the same project context through MCP.

### Step 5 — prove the complete path, then package the cutover

Existing verification owners:
`tests/service/http.test.mjs`, `tests/repos.test.mjs`,
`tests/service/worktree-routing.test.mjs`,
`tests/service/projection.test.mjs`,
`tests/spec-graph-sync/{cli,store,sync,writeback}.test.js`,
`tests/e2e/spec-board-project-selector.mjs`,
`tests/features/youtrack-spec-delivery.feature`.

- Extend behavioral tests at their real consumer boundary. The current
  `worktree-routing` tests invoke `createRootedServices` directly: they do not
  prove tool discovery, HTTP dispatch or a real agent's context propagation.
  The selector script's fake Host API is not a substitute for live YouTrack.
- The cross-project proof landed at the real consumer boundary instead of a
  standalone runner: `tests/service/project-scope.test.mjs` starts the real
  service with one bound repository per project and asserts catalog/document
  isolation, scope-filtered listings, reader refusal on the mutating variants
  and the unbound-project setup path; `tests/service/http.test.mjs` drives one
  real connection through A/B/A with the session default unchanged;
  `tests/spec-graph-sync/projection-migration.test.js` proves the v8 marker
  migration converges. A separate `tests/e2e/project-context.mjs` would only
  duplicate those three and is not created.
- Add executable scenarios to the appropriate existing specs only after
  non-vacuous design review. Do not adjust thresholds, delete assertions,
  refresh oracle inputs or narrow scenario selection to obtain a green result.
- Rebuild packaged clients and host declarations from their existing owners.
  Do not leave source correct but the installed schema/launcher stale.
- Remove obsolete global routing defaults and contradictory restart/worktree
  instructions in the same delivery. No old-tool registry or compatibility shim.

Verification commands and recorded results on the delivered tree:

| Command | Recorded result |
|---|---|
| `npm run test:service` | 98 tests, 0 fail — includes `project-scope` (two real repositories, scope filtering, reader refusal, setup path), `project-not-configured`, `http` (A/B/A on one connection) and `projection`. |
| `npm run test:unit` | 508 tests, 0 fail — includes `projection-migration` and the host guard suites. |
| `npm run dogfood:mcp:candidate` | All 10 published tools execute against the candidate runtime; no unadvertised routing argument is needed. |
| `npm run test:safe-authoring` / `npm run test:staged` / `npm run test:bdd` | 27 scenarios / 162 steps, 66 scenarios / 396 steps, 8 scenarios / 77 steps — all passing; the Docker run republished the canonical stream and the release-candidate fixture was recaptured from it. |
| `npm run verify` | Marketplace, package payload, spec port (tools=10), app validation and placement pass; blast gate 26 220 / 27 000 bytes; mutation gate 170/170 killed, 0 survivors. |
| `npm run tool:e2e:live` | Passed against the live auth contour (`spec-auth-e2e`, rebuilt from this tree): 16 served tools, all checked tools returned successful envelopes, `complete: true` with a scenario-backed `spec_evidence`. |
| `npm run test:delivery-live` | Passed: 6 scenarios / 57 steps on the live compose stack, including the new "configured endpoint warns until the workspace is bound" split. |

On this workstation use native Git Bash, not the system WSL `bash` launcher.
No release is inferred from a successful test run; publishing is a separate
explicit action. Generated reports do not substitute for behavior observations.

## 6. Acceptance matrix

| Case | Required observable behavior |
|---|---|
| Agent B opens required docs while connection was first used by A | B's own catalog/documents; no restart, reconnect or guessed absolute corpus path. |
| One connection alternates A/B/A | Correct distinct results and served-project identity on every response; final A unchanged. |
| Two sessions call concurrently; one changes workspace | Session-local routing; no last-writer-wins global project. |
| Public tool discovery and host argument validation | Legal project context visible for every scoped tool; no rejection of an argument the instructions require. |
| Context absent, ambiguous, unknown or unbound | An explicit selection/setup error before content access; no default to the first project, All or Unassigned. |
| The selected project genuinely lacks the requested spec | Honest `NOT_FOUND` attributed to that selected project, not a restart instruction. |
| Explicit authorized cross-project call | Only that call targets B; the host session default remains A and the result identifies B. |
| Unauthorized project or unscoped discovery | No content/metadata leakage, repository access or side effects outside verified scopes. |
| Wrong-context preflight or unsupported remote path declaration | No false `matchesResolvedRoot:true` / write-ready claim; clear actionable refusal or verified project context. |
| Preview prepared in A, apply sent to B | Refusal before journal/write/push; both repositories unchanged by the refused apply. |
| Same spec/task IDs in independent project repositories | Separate board cards, edges, snapshots, claims and writeback destinations. |
| Existing v7 tracker state and a partial migration failure | No duplicate cards, no certified partial index; retry converges without old-format fallback. |
| Installed OMP/OpenCode/Codex/Claude entry paths | Project selection proven on the actual host route; direct and nested OMP MCP forms are both exercised. |
| Fresh project and project with no specs | Setup/empty state says which project is selected; another project's specs are never substituted. |
| YouTrack selector, reinstall and second user | Authorized view persists only within its board/service context; main navigation remains clean. |

## 7. Risks and implementation prerequisites

| Risk / unresolved fact | Required resolution |
|---|---|
| The failing agent's precise loaded adapter/configuration is not yet pinned | Step 0 captures that route and compares its digest/schema before code changes. |
| `declaredWorktree` can disappear between host and remote admission | Trace the actual argument path; do not infer the responsible layer from one version number. |
| One repository legitimately maps to several projects | Require explicit per-session selection; never guess by directory basename or first registry row. |
| A host does not support typed per-call context propagation | Establish its native supported integration point before implementation; do not add an unverified hook or rely on prompt memory. |
| OMP hook ordering or nested `xd://` bypasses context enrichment | Prove the installed input-replacement path together with the existing access gate and approval semantics. |
| Static token/header settings leak selection between sessions | Remove global project defaults; keep authentication separate from project selection. |
| Unscoped registry operations expose other projects | Apply verified-scope filtering before index construction and before returning metadata. |
| Flat shared identities conflate equal slugs | Project-qualified adapter identity, atomic consumer migration and live writeback proof. |
| Concurrent writes or rebinding reuse stale state | Existing project locks/cache invalidation; project-bound fingerprints/proposals; cross-project apply refusal. |
| Shared Docker restart interrupts unrelated services | No restart as a project-selection fix; infrastructure recovery is separate from routing acceptance. |

Execution dependencies: Step 0 → Step 1 → Steps 2 and 3 → Step 4 → Step 5.
Keep implementation phases as dependency ordering, not supported compatibility
versions. Do not reopen the completed board selector as a replacement for fixing
the agent-to-registry path.

## Appendix A — delivered baseline: Spec Board project scope (3.0.6)

Kept verbatim as the record of the finished board-side work; the plan above
does not reopen it. Section numbers inside this appendix are the original ones.

Date: 2026-11-01
Status: **implemented in 3.0.6** (see `CHANGELOG.md` and
`audit-reports/youtrack-spec-delivery-scenarios-2026-11-01.md`).
Supersedes the client-only Option A in
`audit-reports/spec-board-project-selection-blast-2026-11-01.md`.

### 1. Decision

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

### 2. Data model

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

### 3. Work breakdown

#### Phase 0 — contract (0.5 day)

- `youtrack-visualization`: add FR/AC for the project index, per-project
  pointers, unassigned bucket, unknown-selection fallback, and fail-closed
  behavior for a missing v7 index.
- `docs/specs-repo-operations.md` and `tools/spec-graph-app/README.md`: describe
  the pointer model and the selector.
- Design review for the new scenarios.

#### Phase 1 — server-side boards (1 day)

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

#### Phase 2 — per-project pointers and root index (1.5 days)

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

#### Phase 3 — widget selector (1.5 days)

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

#### Phase 4 — migration, evidence, release (1 day)

- `PROJECTION_VERSION` 7; first sync publishes project pointers and the index;
  the widget requires the v7 index and fails closed on a v6 marker.
- Fresh/upgrade: root index + project pointers created once; a reinstall keeps
  the same ids; removing a project deletes its pointer.
- Release app 1.0.40 / package 3.0.6 with the full release gate.
- Spec/release evidence: per-project marker sizes, selector E2E, unknown →
  Unassigned.

### 4. Acceptance criteria

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

### 5. Risks and mitigations

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

### 6. Execution order

1. Contract and design review.
2. Service per-project boards + tests.
3. Multi-pointer publisher + root index + tests.
4. Widget selector + E2E.
5. Projection v7, fresh/upgrade evidence, app 1.0.40, release 3.0.6.

Estimated total: **5–6 working days**; Phase 1 and Phase 2 can land together
behind `PROJECTION_VERSION=7`.

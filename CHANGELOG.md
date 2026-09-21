# Changelog

All notable changes to `omp-spec-kit`. Claims are limited to recorded evidence.

## 2.6.0 — 2026-09-21

### Added

- **Spec Board transitive hover lineage** (`tools/spec-graph-app/widgets/spec-board/index.html`): hovering a node highlights the full upstream/downstream chain (e.g. ROADMAP → milestone TASK → FR) instead of one-hop neighbors — BFS over committed edges with a visited cap and a precomputed reverse adjacency map. Live regression coverage in `tests/e2e/spec-board-lineage.mjs` (`npm run test:e2e:board-lineage`).
- **Spec Board lands fullscreen**: `defaultDimensions` `12fr × 8fr` in `manifest.json` makes the dashboard widget render at full grid width when added — verified live at 1336×1462 px in a 1600 px viewport, no manual resize.
- **New skill `skills/spec-stack-setup/`**: cross-platform one-command demo contour — `docker compose up -d` (three services, `name:` in compose), YouTrack wizard + tenant groups + service token + `projects.json`, registryd restart, app ZIP import via `POST /api/admin/apps/import`, settings + project attach, template specs loaded through real MCP calls, SPEC projection sync, ready Spec Board dashboard link. Idempotent on re-run.
- **Template specs shipped with the skill** — `spec-stack-skill` (FR×4, NFR×3, AC×4, TASK×4, three Gherkin scenarios) and `roadmap-stack` (roadmap + three milestone tasks) producing real cross-spec edges on the board.
- `tests/e2e/lib/wizard.mjs` gains an optional `getLogs` override so a foreign compose project's container logs feed the wizard token.
- `tests/e2e/compose.yml`: `name: spec-auth-e2e` + default `SPEC_AUTH_E2E_CONFIG` — a bare `docker compose up -d` works in `tests/e2e`.

### Fixed

- Kernel Gherkin parser now recognizes `Example:`, `Scenario Template:`, and tab-indented `Scenario:`/`Scenario Outline:` headers (cucumber-js superset), restoring parity with the v2.4 design-review gate; previously a gated-applied scenario could silently miss the spec graph (no `@id:SCEN` enforcement, no node).
- Fixed latent `ReferenceError: splitTableRow` in `src/kernel/parsers/gherkin.js`: any `.feature` with an `Examples:` block crashed graph builds since the v0.2.0 kernel commit. Row-splitting semantics match `splitPipeCells` in `src/kernel/parsers/markdown.js`.
- `DESIGN_REVIEW_REQUIRED` recovery hint now points to the `engineering-anti-bike` skill template, cutting agent recovery round-trips.

### Changed

- Dogfood video terminal segment shows the real `docker compose up -d` output (Compose status captured from stderr), annotates each command with a `#` comment line, and drops the manual dashboard-resize scene made obsolete by `defaultDimensions`.

## 2.4.0 — 2026-09-18

Merges the 1.3.x line (released as v1.4.0) into the 2.x product: scenario-authoring design review lands on the consolidated surface.

### Added

- `spec_patch` refuses any change to a `.feature` document containing a `Scenario:` or `Scenario Outline:` header unless the request carries a valid `designReview` payload (closed schema `omp-spec-kit/design-review@1`). Missing reviews return `DESIGN_REVIEW_REQUIRED`; malformed reviews return `DESIGN_REVIEW_INVALID`; the normalized review is bound into the proposal hash and a bounded receipt names each reviewed document with its after-hash.
- The host `tool_call` policy blocks a `spec_patch` call that writes scenario content into a `.feature` document without `designReview` before dispatch.
- New skill `engineering-anti-bike`: evidence-first claims, prior-art scan before custom implementation, self-test/fake-green check at BDD scenario authoring, and hypothesis Q&A discipline.
- Shared authoring error-code normalization extracted into `src/authoring/error-codes.js`; the MCP branch of the tool-call classifier is a dedicated helper.

## 2.5.0 — 2026-09-19

### Changed — onboarding moved off issues onto the app's own page

- **`spec-app` @ `MAIN_MENU_ITEM`**: a "Spec Service" page in the YouTrack main menu now hosts the full onboarding stepper (repo state/bind, verify, `.mcp.json` mint + paste-token fallback). `?step=agent` deep-links to the agent step. Installing the ZIP no longer surfaces setup inside issues — it creates nothing in the tracker.
- **`spec-service-panel` reduced to a context card**: linked spec (when `SpecId` is set), repo status chips, and an `Open Spec Service` link — no wizard, bind forms, or MCP config inside an issue.
- **Discovery via the native System-wide banner** (admin-configured in Global Settings); the apps API exposes no user-notification channel, so none is fabricated.
- App version 1.0.24. Decision doc: `docs/decisions/app-page-onboarding.md`.

### Fixed

- **Failed repo bind no longer wedges the project**: `mounts.forSource` resolved `error`-status rows through `for()`, which throws `REPO_BINDING_REQUIRED` for external projects — a single `MIGRATION_TREE_MISMATCH` left every retry and catalog read dead. `forSource` now resolves an `error` row to its `migratedFrom` mount (or the default); `for()` still refuses reads/writes.

### Formalized

- **YouTrack-app request signature** extracted as `classifyRequest()` — `Bearer <bridgeToken>` matching a bound IdP's `bridgeTokenHash` plus asserted `X-Spec-User` is now a named, single-point contract; `X-Spec-User` on direct tokens is ignored. Decision doc: `docs/decisions/youtrack-app-request-signature.md`.
- App settings descriptions now state where values come from (the once-shown install block / self-hosted URL); `serviceUrl` deliberately has no default.
- New auth coverage: per-user bridge resolution under one install, forged/unknown/out-of-tenant `X-Spec-User` (`UNKNOWN_USER`, `NO_SCOPES`), `BANNED`, direct-token spoof immunity, onboarding `TOKEN_MISMATCH`.
feat/spec-registry-service

## [2.3.0] — 2026-09-17

Guided onboarding in the YouTrack widget — the member journey that previously existed only as REST endpoints is now a real UI flow, proven end-to-end in a browser.

### Added

- **Guided onboarding wizard** in the `spec-service-panel` widget: *1 · Specs repository* (probe + bind & migrate, `required` badge for unbound tenant projects), *2 · Verify it works* (migration evidence — commit SHA + landed document count — plus a dry-run/real test patch against the user's own specs), *3 · Connect your agent* (one click renders the ready `.mcp.json`).
- **`POST /onboarding/token` is routed through the app bridge** (`spec-handler.js`) — the widget can finally reach the endpoint; before this, "get my .mcp.json" existed only for curl users.
- **Caller-supplied token fallback**: `/onboarding/token` accepts `token` — for tenants whose service token may not mint, the user pastes a permanent token from their YouTrack profile; the service verifies it resolves to the same caller (`TOKEN_INVALID`/`TOKEN_MISMATCH`) and wraps it in the snippet. Never persisted or logged.
- **`MINT_NOT_PERMITTED`**: Hub 403s during minting map to a dedicated error so the UI can offer the paste-token fallback instead of dying at the last step.
- **Mint capability probing**: `/idp/probe` and `/idp/bind` report `capabilities.mintTokens` so the admin learns at bind time whether members' tokens can be minted; the binding record and `/idp/bindings` carry it.
- **Migration evidence**: `POST /repos/bind` returns `migrated: {commit, documents}` (pushed SHA + landed file count) or `null`; `POST /onboarding/token` returns `login` and `project` alongside the snippet.
- Widget: copy button with sandboxed-iframe fallback (select-all + Ctrl+C), explicit token-rotation warning, Dismiss clears the secret from the DOM, `NO_SCOPES` users see an honest no-access state, readers never see bind controls, the hardcoded `alpha-spec` demo button is replaced by a patch test on the user's real specs.
- E2E fixture: `publicUrl` in the live config so IdP-bind install instructions carry the network-reachable service URL.

### Proven in the live BDD suite (7 scenarios, 93 steps, real Chrome + real stack)

- Alice clicks "Get my .mcp.json" in the widget; the generated token is used against the real `/mcp` — the copied artifact is the verified artifact.
- Mia (external tenant) completes the full arc in the widget: `required` → probe → bind → migration commit/count shown → `.mcp.json` pinned to `X-Spec-Idp: acme` → token authenticates as `mia` scoped to `acme/gamma` only.
- Oda (no scope groups) sees the no-access state and no onboarding controls.
- Noa (reader) sees the tenant specs, no bind controls, and still gets a working `.mcp.json`.

## [2.2.1] — 2026-09-16

Adversarial-review hardening of the external-IdP feature plus the missing half of the multi-tenant story: customer specs now live in the customer's own repository, never the operator's.

### Security fixes (v2.2.0 review findings)

- **Project-claim takeover refused**: an external binding may no longer claim a project managed by the operator config or already claimed by another tenant — binding `stgmt/alpha` previously handed the customer's users the operator's specs, writes included (`IDP_PROJECT_TAKEN`, 409).
- **Binding hijack refused**: only the binder or an owner may change or re-point an existing tenant binding; a stranger could previously overwrite any binding with their own YouTrack and rotate the bridge secret under the installed app.
- **Fan-out resilience**: a dead or unreachable bound IdP no longer fails authentication for every caller — the fan-out skips it; a token no reachable IdP verifies returns 401, and `UNAVAILABLE` (503) is returned only when a dead IdP might have been the token's issuer.
- **SSRF tightening**: `::1`, `0.0.0.0`, link-local/cloud-metadata (`169.254.*`), and v4-mapped IPv6 destinations are never bindable; credentials embedded in the YouTrack URL (`user:pass@host`) are stripped before storage.

### Tenant specs live in the tenant's repository

- `POST /idp/bind` accepts an optional `repo {url, token, branch?, username?, migrate?}` block binding every declared project to the customer's own specs repo in the same call; per-project results are reported under `repos`.
- **External-tenant projects have no default repo**: an unbound external project refuses all data operations with `REPO_BINDING_REQUIRED` — the operator's shared repository is no longer a silent landing zone for customer specs.
- `POST /onboarding/token` accepts the same `repo` block so a user can point their default scope at their own repository when minting an agent token.
- `POST /repos/bind` accepts external-tenant projects (tenant writers/owners self-bind), and `idp/unbind` drops the tenant's repo bindings with the binding.
- `/me` reports unbound external projects as `status: "required"`; publish, registry, drift and sync now cover bound external projects and tolerate unbound ones.
- Widget: the IdP bind form carries the specs-repo fields, and unbound external projects render a `required` badge.

### Re-bind semantics

- Identical re-bind is a no-op (`unchanged`); the same URL with different scope/group parameters is refused (`IDP_EXISTS`) — changing a tenant's shape now requires an explicit unbind first.

### Tests

- `tests/idps.test.mjs` now 9/9: adds project-claim refusal, stranger re-bind refusal, drifted re-bind refusal, cross-tenant URL/project claims, credential-in-URL stripping, `REPO_BINDING_REQUIRED` gating, repo-block wiring with real migration into the customer repo, unbind repo-cleanup, and a unit-level dead-IdP fan-out proof.
- `test:app-install-live` 46/46 steps: the widget bind carries the tenant repo block, the migrated `gamma-spec` is verified inside the tenant's own bare repo, then mia reads it through her app under tenant `acme`.

## [2.2.0] — 2026-09-16

### External identity providers — bring-your-own YouTrack (TASK-13)

A customer's own YouTrack can now be bound as a tenant identity provider: their users authenticate against their own Hub, get scopes/roles from the binding, and their installed app talks to the service under the new tenant — all configured from the YouTrack widget, no operator config edit required.

- **REST**: `GET /idp/bindings`, `POST /idp/probe|bind|unbind` — any verified operator-YouTrack user may bind; the binder or an owner may unbind. Probe checks reachability + user-enumeration capability before anything persists.
- **Binding model**: one binding = one tenant (`idp_bindings`/`idp_credentials` store tables). `hubGroups` gate scopes, `roleGroups` map their YouTrack groups to owner/writer/reader; bound projects count as configured — the customer needs no operator-side `projects.json` entry.
- **Auth registry**: `auth.js` verifies direct tokens by deterministic fan-out across bound IdPs (`X-Spec-Idp` is a routing hint, never authorization); app-bridge secrets resolve by sha256 map and assert `X-Spec-User` against the bound YouTrack.
- **Credentials**: the bound `serviceToken` is sealed AES-256-GCM (same vault as repo credentials) and unsealed only inside the auth path; the minted `serviceBridgeToken` is returned exactly once in `install {serviceUrl, serviceBridgeToken}` — `serviceUrl` comes from `config.publicUrl` (new optional key) or the request host.
- **Widget**: "Your own YouTrack" section — tenant/URL/token/projects/groups form, test connection, bind, per-tenant status badges, unbind, and a persistent one-time install block that survives widget re-renders.
- **.mcp.json**: onboarding snippets for bound tenants carry `X-Spec-Idp` so MCP clients route to the right IdP.
- **Tenant isolation**: external users cannot nest-bind IdPs, never see operator scopes, and lose access on unbind within the auth-cache TTL.

### Tests

- `tests/idps.test.mjs` (6/6): probe policy/token matrix, bind, direct+bridge auth, tenant isolation, group gating, external write path, restart persistence, unbind revocation — against a real second YouTrack (`youtrack-ext`, compose port 8082).
- `test:app-install-live` now 44/44 steps: alice binds through the widget UI, the app installs on the ext YouTrack via the official `youtrack-app` CLI with the minted settings, `mia` sees her tenant's `gamma-spec` in a real browser, unbind revokes both token and bridge secret.

### Fixed

- Widget: the one-time IdP install block no longer disappears on the widget's own post-bind refresh.
- E2E: `browserLogin` tolerates YouTrack versions where a forced password change already grants a session.

## 2.1.0 — 2026-09-16

Bring-your-own specs repository. Any project can leave the shared service-owned specs repository for a customer-controlled Git remote; the service binds, migrates, routes, and publishes against the bound remote while keeping every previously published version readable.

### Added

- Per-project repository binding: `POST /repos/probe`, `POST /repos/bind`, `POST /repos/unbind`, `GET /repos` REST endpoints on the service. Binding requires a verified writer/owner role plus project scope; readers and out-of-scope callers are refused.
- Snapshot migration: `bind` with `migrate: true` copies the project's current `.specs` tree into the target repository (no Git history transfer, write-lock artifacts stripped), commits and pushes it with the service bot identity, and flips routing only after the copy is verified.
- Migration-safe versioned reads: the publish ledger records the repository URL and branch of every published version, so releases cut before a migration keep resolving from the previous repository clone.
- Credential vault: repository tokens are sealed with AES-256-GCM (key from `SPEC_REGISTRY_SECRETS_KEY`), scoped to the repository URL they were bound for, never returned by the API, and redacted from logs.
- Repository policy: remote URLs are checked against a host/scheme allowlist before any network access; `file:` URLs are accepted only when explicitly listed.
- `X-Spec-Project` request header as a scope-checked default project hint; onboarding `.mcp.json` snippets can carry it so one MCP endpoint serves multiple projects without re-authenticating.
- YouTrack widget repository section: project picker (scope-aware), remote URL/branch/token fields, test-connection, bind-and-migrate, unbind, and live binding status.
- Multi-mount sync and drift isolation: one unreachable bound repository no longer stalls the periodic sync pass, drift reporting, or service boot for the rest.

### Changed

- `MountManager` is now a per-repository mount registry (`mounts.for(project)` resolves the project's active remote and its dedicated clone); the default shared repository is unchanged for unbound projects.
- `GET /me` reports each scoped project's binding state (repository URL, branch, status).

### Migration notes

- Existing projects keep working against the default shared repository; binding is opt-in per project.
- Migration is a snapshot copy, not a history move: versions published before the move stay published and keep resolving from the old clone through the ledger.
- Operators should set `SPEC_REGISTRY_SECRETS_KEY` before accepting bindings; without it the service refuses to store credentials.

## 2.0.0 — 2026-09-16

Centralized specification registry release. Canonical specifications move out of product repositories into a dedicated, service-owned specs repository; all specification reads and writes go through the `spec-registryd` MCP service.

### Breaking changes

- The in-repository `.specs` corpus is retired as the canonical store and as a read path. Consumers and agents must read and write specifications through the service; direct local-corpus access is refused at the access boundary.
- Service calls require YouTrack-backed authentication: verified identity, roles, and per-project scopes; anonymous or unscoped access is refused.
- `spec_documents` gains an optional `version` parameter for published snapshots (additive; unversioned reads keep current-HEAD semantics).

### Added

- `spec-registryd` service: per-project mounts with boot recovery, MCP endpoint on the official SDK, transactional write path (one in-flight transaction per project, verified-user claims, pushes authored by the service bot), SQLite store, registry index, drift detection, and reconcile-on-fetch sync; ships as a self-contained compose stack.
- Immutable publication: an authored `Status: ACTIVE` at canonical HEAD publishes an annotated git tag `spec/<project>/<slug>/<version>` plus an insert-only ledger row (version → tree digest → commit). Re-publishing identical content is a no-op; different content under an existing version is rejected and surfaced in `GET /drift` as `publish-rejected`.
- Versioned reads (FR-12): `spec_documents(action:"read", version)` resolves through the ledger and serves bytes from the tagged commit with digest re-verification and path containment.
- Onboarding API: per-user YouTrack token minting (one token per login+purpose, previous revoked, value never stored) returning a ready `.mcp.json` snippet.
- Managed (remote) plugin mode for OMP projects; YouTrack app with auth-path HTTP handler and a service panel widget, packaged in CI via the official `youtrack-app` CLI with byte-stable zip output.
- Canonical-write protection: `npm run check:specs-repo` posture gate (privacy + collaborator boundary hard-fail; rulesets/branch-protection report-only), refusal to push non-bot commits, break-glass events in `/drift`, and an operator runbook (`docs/specs-repo-operations.md`).

### Fixed

- Diverged service clones reconcile instead of stalling all writes; git context can no longer hijack a service worktree.
- Concurrent writes serialize correctly: a burst of parallel patches yields one immediate apply plus retryable `CONFLICT` for the rest; retries produce a linear, fully bot-authored history.
- The service never publishes commits authored outside the bot identity (`FOREIGN_COMMITS` refusal); out-of-band pushes are detected and reconciled, then published.

### Migration notes

- Point agents at the service: obtain a token via the onboarding endpoint (or the widget's connect action when it ships), then place the returned `.mcp.json` snippet in the agent's MCP configuration.
- Existing published versions are addressable via `version` on read tools; unpinned reads continue to return canonical HEAD.
- Local `.specs` trees in product repositories are historical artifacts only; they are neither read nor written.

## 1.4.0 — 2026-09-18

Anti-bike protection release: scenario-authoring changes now require a design review, and the engineering discipline ships as a skill.

### Added

- `spec_patch` refuses any change to a `.feature` document containing a `Scenario:` or `Scenario Outline:` header unless the request carries a valid `designReview` payload (closed schema `omp-spec-kit/design-review@1`): a named external or user-visible boundary, 2-8 evidence references including at least one test and one non-test kind, 1-5 rejected alternatives, and a self-test check reporting a passed positive case and a mutation that failed as expected. Missing reviews return `DESIGN_REVIEW_REQUIRED`; malformed reviews return `DESIGN_REVIEW_INVALID`; the normalized review is bound into the proposal hash and a bounded receipt names each reviewed document with its after-hash.
- The host `tool_call` policy blocks a `spec_patch` call that writes scenario content into a `.feature` document without `designReview` before dispatch.
- New skill `engineering-anti-bike`: evidence-first claims, prior-art scan before custom implementation, self-test/fake-green check at BDD scenario authoring, and hypothesis Q&A discipline.

### Changed

- Shared authoring error-code normalization extracted into `src/authoring/error-codes.js`; the MCP branch of the tool-call classifier is a dedicated helper.

## 1.3.0 — 2026-09-13

Roadmap canonical document and governed auto-assembly release.

### Added

- `ROADMAP` is a conditional canonical document kind: `ROADMAP.md` is canonical only for `roadmap-*` specs (slug-prefix detection is authoritative). The graph builder auto-generates a `<slug>:ROADMAP` aggregate node and a `DECLARES` edge from the document node, making the roadmap entity a real canonical graph node instead of a board-only synthetic.
- Pure deterministic roadmap assembler (`src/kernel/roadmap/assemble.js`): derives scope from `Implements:`/`Refs:` edges in the roadmap spec's own FR/TASK nodes, collects FR/UC/US items from covered specs, derives status from implementing task relationships, sorts by code-point order, and merges generated content inside `<!-- roadmap:auto:start -->` / `<!-- roadmap:auto:end -->` markers. Authored bytes outside markers are sovereign; unchanged graph produces byte-identical output (idempotent).
- `replace_marked_region` operation in `applyOperation`: replaces content between HTML comment markers with duplicate-marker detection.
- `createRoadmap` and `assembleRoadmap` intents in `spec_patch`: create a ROADMAP.md skeleton with marker region for `roadmap-*` specs, and assemble the generated region from the live graph through the governed receipted transactional path. The 10-tool MCP surface is unchanged; intent count rises from 13 to 15.
- E2e BDD coverage for roadmap intents: refusal on non-roadmap specs, apply with receipt, and idempotent re-run (staged-mcp.feature).

### Fixed

- Phase 1 commit (611c70a) was incomplete: core source changes in `types.js`, `fs.js`, `build.js`, and `check-spec-corpus.mjs` were not staged. Restored source/commit parity in `dc30d07`.

### Local verification

- 86 unit tests, 26 safe-authoring BDD scenarios, 66 staged-MCP BDD scenarios pass.
- Mutation gate: 168/168 mutants killed. Tool surface: 10/10.
- Live YouTrack sync: PARITY achieved (478 nodes, 467 links). ROADMAP card live on board.
- Live `assembleRoadmap` write: 83 items assembled, idempotent re-run confirmed.
- Live writeback round trip: YouTrack `Fixed` on SPEC-525 (`roadmap-roadmaps:TASK-8`) swept to `.specs` `done` through `StatusSweepService`.

### Widget verification

- App `spec-graph-app` (`144-67`) is uploaded, attached to project SPEC, and enabled (`ProjectAppConfiguration` `181-16`).
- Two widget extensions are registered: `spec-panel` (`163-15`, `ISSUE_BELOW_SUMMARY`) and `spec-board` (`163-16`, `DASHBOARD_WIDGET`).
- Widget content is served byte-identical to source through `/api/appResources/144-67/widgets/{spec-panel,spec-board}/index.html` (10834 and 61361 bytes respectively, `diff` reports identical).
- Issue `3-496` returns `spec-panel` in its `widgets` array via `/api/issues/3-496?fields=...`.
- `spec-board` appears in `/api/admin/widgets/general` (dashboard widget catalog).
- Access logs confirm the widget was loaded in a real browser session on 2026-09-08: `200 GET /api/appResources/144-67/widgets/spec-panel/index.html` and `200 GET /api/appResources/144-67/widgets/spec-board/index.html` from an authenticated Edge browser.
- Headless Chrome render of the widget URL shows expected `YTApp is not defined` because the YouTrack Host API is only available inside the YouTrack iframe sandbox; the widget HTML itself loads and parses correctly.

### Known limitations

- The ROADMAP aggregate card on YouTrack is currently isolated (0 links): the graph has a `DECLARES` edge from the document node but no `CONTAINS` edges from the aggregate, so the card has no visual relationships yet.

## 1.3.2 — 2026-09-14

Guarded-authoring and anchor-parity release.

### Added

- `spec_patch` now rejects proposals that introduce definition-integrity violations (`INVALID_LOCAL_ID`, `MALFORMED_HEADING`, `DUPLICATE_DEFINITION`), comparing per-document diagnostic counts before and after the change: pre-existing violations never block unrelated edits, repairs keep passing, and the single gate covers both dryRun previews and applies.

### Fixed

- Heading anchors (`glfm-anchor@2`) collapse the hyphen runs left by removed punctuation, trim the edges, and drop underscores — matching the Marksman slug convention every authored corpus link uses and the corpus gate's own anchor check; 79 previously unresolvable corpus links now resolve, and sibling `<spec>.feature` documents are valid link targets.
- `blocked`, `ready`, `in-progress`, and `deferred` task statuses normalize to themselves instead of silently displaying as `unknown`.

## 1.3.1 — 2026-09-13

Diagnostic-coverage release: definition-shaped headings can no longer vanish silently.

### Fixed

- Near-miss definition headings now surface as diagnostics for every role. The malformed-candidate check was dead code for the six roles whose ID prefix differs from the role name (FR, AC, DEC, RF, FC, SCHEMA), and a definition-shaped heading at an unsupported heading level produced no diagnostic at all; both classes now report `MALFORMED_HEADING` / `INVALID_LOCAL_ID` with level-aware messages.
- A trailing parenthetical annotation no longer turns a canonical task status into `unknown` (`done (2026-09-13)`).

### Changed

- The repository's own specification corpus conforms to the canonical grammar it enforces: `Depends On` reference-field casing in plugin-distribution, definition heading levels in spec-registry-service, and registry-service AC identifiers renumbered to `AC-N.M` under their governing FRs with thematic NFR categories.

## 1.2.0 — 2026-09-13

Specification authoring safety and access-boundary release.

### Added

- First creation of a missing canonical Markdown specification file is stopped once with `ELICITATION_REQUIRED`, a machine-readable skill target, and no filesystem or graph mutation; the exact write can be retried after elicitation.
- Real MCP BDD coverage exercises the running server across restart, retry, lock contention, feature-file, noncanonical-path, refusal-replay, and no-side-effect cases.

### Fixed

- Read selectors are stripped consistently for every read-only MCP path, and rejected access targets are named in the error.

## 1.1.0 — 2026-09-05

Agent UX and error-hygiene release.

### Added

- Direct specification reads through `read`, `grep`, and `glob` now fail with `SPEC_READ_REDIRECT` and bounded recovery guidance to `spec_documents`, while mutating and executable paths remain `RAW_SPEC_WRITE`.
- `spec_documents(action: "read", readForEdit: true)` returns exact document content together with its SHA-256 digest, byte count, and headings.
- `spec_patch` accepts an omitted root fingerprint and binds the live graph snapshot; supplied stale fingerprints still fail closed with an opaque root-mismatch cause.
## 1.0.0 — 2026-09-05

Promotes the bounded 10-tool MCP surface and transactional `spec_patch` authoring path to the stable major release.

### Changed

- Published the stable 10-tool surface: 9 bounded read-only tools and one transactional `spec_patch` tool.
- Preserved bounded entity, graph, document, evidence, and Markdown queries with pagination, projections, cursors, and traversal limits.
- Promoted the v0.10.2 safe-authoring and release-integrity proof to v1.0.0 with exact archive and commit-bound attestation evidence.
## 0.10.2 — 2026-09-05

Consolidates safe specification authoring into a single closed `spec_patch` tool with `dryRun` preview and atomic transaction semantics, eliminating the separate proposal and application lifecycle.

### Changed

- Replaced public tools `spec_propose_patch` and `apply_proposed_patch` with a single closed `spec_patch` tool (`specPatch` operation, `intent` discriminator).
- Consolidated tool surface to exactly 10 tools: 9 read-only tools and 1 mutating tool (`spec_patch`).
- Default `dryRun: true` (or omitted) performs pure in-memory preview with bounded unified diff and resulting-spec validation with zero filesystem modifications.
- Explicit `dryRun: false` compiles the internal proposal, verifies snapshot fingerprint and document preimages under exclusive spec lock, and executes atomic commit via same-filesystem staging and rename swap.
- Removed public proposal IDs, proposal hashes, expected document arrays, and the string `approval: "approve"` parameter from client input schemas.
- Hard cut on all 38 superseded tool names: calls return standard protocol error `-32602` without custom migration hints or backward-compatibility fallbacks.

## 0.8.2 — 2026-09-04

Corrective release unifying specification validation and diagnostics inspection into one task-oriented branch with self-describing `oneOf` input schemas.

### Changed

- Replaced overlapping `spec_inspect` branches `specValidation` and `diagnostics` with a single unified `validation` branch returning overall validation verdict (`VALID`/`INVALID`), scope counts (`errors`, `warnings`, `info`, `total`), and filtered diagnostics.
- Validation verdict and scope totals are computed pre-filter across all diagnostics in the resolved scope (`corpus` or `specifications`), while `severities`, `codes`, and `paths` filters affect only the returned `items` and `counts.matched`.
- Every discriminated `oneOf` branch across consolidated tools exports an explicit `title` (`<discriminator>: <variant>`) and `description`, and discriminator properties carry instructions guiding branch selection.

### Removed

- Removed `specValidation` and `diagnostics` check branches from `spec_inspect` and excised `validateSpec` from kernel query operations without backward-compatibility shims.

## 0.8.1 — 2026-09-04

Consolidated 11-tool surface minor: 49/38 tools cut to 11 task-oriented tools with discriminated branches, zero compatibility shims, and fail-closed surface blast limits.

### Fixed

- Ordinary shell command text is no longer treated as a filesystem target by the specification access gate; explicit spec references and indeterminate direct paths remain fail-closed.
- Root-fingerprint conflicts now carry a typed cause and bounded recovery with opaque root identities, preflight guidance, and no physical paths.
- Candidate package, manifest, and deterministic tar modes are canonical across platforms: 0755 under bin/ and 0644 elsewhere; added Windows/Ubuntu capture-and-compare CI.

### Removed

- Hard-cut of 27 superseded tools without backward-compatibility shims: all legacy read, navigation, and mutation facade tools excised from runtime discovery and handlers.
- Release-stage abstraction (`OMP_SPEC_KIT_STAGE`): single 11-tool surface with no compatibility stages.

### Added

- Consolidated 11 tools: `mcp_preflight`, `spec_catalog`, `spec_entities`, `spec_graph`, `spec_documents`, `spec_inspect`, `spec_tasks`, `spec_evidence`, `spec_markdown`, `spec_propose_patch`, `apply_proposed_patch`.
- Discriminated `oneOf` input schemas with `additionalProperties: false` and strict validation rejecting cross-branch and unknown fields.
- Authoritative domain type dictionary via `spec_catalog(view: "types")` returning 15 entity kinds and 7 edge types.
- Fail-closed surface blast measurement script (`scripts/measure-mcp-tool-blast.mjs`) verifying <= 25,499 bytes catalog size, <= 2,000 description characters, and zero retired tool names.
- Deterministic in-memory mutation testing gate (`scripts/check-tool-surface-mutations.mjs`) requiring zero surviving mutants.
## 0.7.0 — 2026-09-04

Hardened safe-authoring minor for OMP 18.0.11. Same 49-tool surface as v0.6.0; no tool added or removed.

### Added

- Windows read selectors are a documented gate feature: `:1`, `:1-2`, `:1+2`, `:1-`, `:1..2`, comma lists, `L`-prefixed numbers, `:raw`, `:conflicts`, and `raw:<range>` / `<range>:raw` combos. Selectors strip only for `read`; `write` and other mutators receive no stripping. `:0` and malformed selectors fall through to normal containment.
- Execution-payload specification guard: recursive inspection of `code` and `command` values for an obvious `.specs` path segment, blocked with `RAW_SPEC_WRITE` for eval, context-mode, and shell calls. Lexical guard, not a shell parser; dynamically assembled paths are an explicit non-goal.
- `spec-mcp-access-gate` FR-8/FR-9 with AC-8.1/AC-9.1, requirements trace, and BDD `read-selectors` / `execution-edges` matrices (now with `L`-prefix, list, and nested-payload cases).

### Fixed

- `src/adapters/document-service.js` reported `plugin: "0.5.0"`; now follows the package version (`0.7.0`).
- `spec-mcp-access-gate` README and FILE_CHANGES no longer reference deleted `audit-reports/` paths; they point at `docs/validation/release-status-v0.6.0.json` and pinned OMP sources.
- `spec-mcp-access-gate` TASK-5/TASK-6 headings use canonical `TASK-N:` form so status transitions parse.
- `toolContractsForStage` accepts the `v0.7.0` stage alongside `v0.6.0`; launchers, MCP server, classifier default, and dogfood accept `v0.7.0` with `v0.6.0` retained for backward compatibility.

### Removed

- Local-only `audit-reports/` (13 tracked files), reference `package/package.json`, and the unconnected `src/hooks/skill-gate.js` + `tests/enforcement/skill-gate-live-omp.test.mjs` prototype pair. No runtime, build, or CI input referenced them.

## 0.6.0 — 2026-09-02

Safe-authoring release for OMP 18.0.11 (shipped; changelog entry recorded retroactively in 0.7.0).

- Single 49-tool MCP server with enforcement-only extension; proposal-first mutations with CAS, atomic apply, and rollback.
- Strict `.specs` access gating for non-MCP reads, searches, enumeration, shell, edits, and writes.
- Published release proof: `docs/validation/release-status-v0.6.0.json`.

## 0.5.4 — 2026-09-02

Corrective release: accurate evidence and navigation release notes.

- Generates release notes for the actual additive v0.5 27-tool surface instead of the superseded ten-tool text.
- Keeps published candidate, archive, evidence, and tag identities in the release receipt.

## 0.5.3 — 2026-09-02

Corrective release: clean-checkout publication and deterministic E2E proof.

- Tracks the repository-owned evidence fixtures required by archive verification.
- Makes installed-version assertions follow the package version instead of a stale literal.
- Gives the complete tool-E2E staged scenarios a bounded runtime in CI.

## 0.5.2 — 2026-09-02

Corrective release for the v0.5 evidence and navigation surface.

- Tracks the repository-owned passing, failed, and incomplete evidence fixtures required by the complete tool-E2E matrix and release archive smoke.
- Fixes clean-checkout release verification so the official GitHub workflow can build, attest, and publish the exact candidate archive.


## 0.5.0 — 2026-09-01

Evidence and navigation release candidate for OMP 18.0.11.

- Adds an additive 27-tool direct MCP surface: the v0.4.1 ten-tool compatibility profile, 15 bounded navigation/validation tools, and get_test_result plus get_scenario_trace.
- Keeps evidence storage and parsing repository-owned, with SHA-256 source identity and graph/scenario binding that rejects stale passing evidence after corpus mutation.
- Verifies passing, failed, incomplete, unknown, invalid-input, safe-authoring apply, and stale-conflict paths against a disposable real specification corpus.
## 0.4.1 — 2026-09-01

Corrective safe-authoring release for OMP 18.0.11; v0.4.0 is superseded because the normal shipped launcher exposed the historical eight-tool profile unless an ambient stage variable was injected.

### Fixed

- Shipped POSIX and Windows launchers select the v0.4.1 ten-tool surface themselves; OMP extension discovery and direct server startup also default to v0.4.1 when no stage override is present.
- Added an exact-release-archive smoke that extracts the candidate archive, unsets OMP_SPEC_KIT_STAGE, OMP_SPEC_KIT_PACKAGE_ROOT, and OMP_SPEC_KIT_ROOT, exercises JSON-RPC, and rejects unsolicited stdout.
- Release verification now runs release-integrity BDD, verifies GitHub artifact attestations with gh attestation verify, binds distribution evidence to the peeled tag commit, and compares existing releases against the peeled tag commit rather than GitHub targetCommitish metadata.

## 0.4.0 — 2026-09-01

Published safe-authoring release for OMP `18.0.11`; v0.3.2 remains the read-only predecessor.

- Keeps the eight bounded read tools and adds exactly two proposal-first tools: `propose_patch` and `apply_proposed_patch`.
- Adds deterministic proposal preview, approval-bound apply, document-level CAS, replay-safe receipts, rollback-on-failure, and strict `.specs` access gating.
- Verifies a provenance-bound 45-document corpus, installed OMP manager execution, lifecycle install/upgrade/rollback producers, Docker BDD, nine closed MRI receipts, and digest-bound GitHub release assets.
- Published release proof: `docs/validation/release-status-v0.4.0.json`.

## Unreleased

No unreleased changes recorded.

## 0.3.2 — 2026-08-28

Honesty follow-up on the public v0.3.1 release. Upgrade from v0.3.0 and rollback to v0.3.0 remain required.

### Fixed

- Release receipts for the GitHub Actions transaction, evidence honesty, and schema containment now require real producers; local runs omit those cells instead of inventing a pass.
- Rollback now proves the project tree hash is unchanged, the same way upgrade already did.
- Published GitHub release files are attested: the archive, candidate manifest, and evidence record.

## 0.3.1 — 2026-08-27

First public corrective release after the v0.3.0 MCP project-root defect.

### Fixed

- MCP package launch now preserves the active OMP project cwd rather than forcing package cwd.
- Invalid JSON-RPC request objects receive terminal `-32600` responses.
- Candidate verification binds package tree/archive bytes, peeled tag, Cucumber messages, public safety, lifecycle, and requirement receipts.

### Advisory

- v0.3.0 MCP results are superseded for the active-project-root defect; see `docs/advisories/v0.3.0-mcp-root.md`.


## 0.2.0 — 2026-08-23

Read-only specification kernel: parse, identity, graph, and bounded query over a repository's `.specs` corpus.

### Added

- `src/kernel/**` (shipped as `dist/kernel/**`): role-aware Markdown/Gherkin parsers (FR/AC/TASK definitions in owning documents only), lossless duplicate election, typed edge resolution, conservation invariants, complete GLFM heading/anchor/link inventory with collision-safe `glfm-anchor@1` allocation, eight-operation fail-closed query service (`inventory`, `getNode`, `findNodes`, `getEdges`, `trace`, `diagnostics`, `overview`, `markdownInventory`) with fingerprint-bound cursors, and a contained filesystem reader that refuses symlinks/junctions before any content read.
- Kernel Docker BDD suite: real-corpus determinism (60 docs / 48 FR / 725 headings / 431 links vs an independently captured manifest), adversarial anchors, duplicate election, typed diagnostics, fail-closed envelopes, junction refusal, pagination bounds.
- v0.2.0 lifecycle evidence: `docs/validation/distribution-lifecycle-v0.2.0.md` (payload digest `e7106747…c1e`).

### Fixed

- Parser correctness from adversarial review: underscore-preserving heading anchors, `mailto:` autolinks, empty inline destinations, fragment-only self-links, absolute structured-field spans, Setext 1+ underlines, post-fence indented code, junction refusal before read, `INVALID_PARAMETER` page bounds.

### Not in this release

- MCP projection (v0.3), authoring/mutation (later). `spec_inventory` v0.1 behavior is unchanged apart from the version constant.

## 0.1.0 — 2026-08-23

First installable release: one OMP marketplace, one plugin package, one extension entry, one read-only tool.

### Added

- `spec_inventory` — bounded, read-only inventory of direct `.specs` children in the active project: lexical order, canonical 15-document accounting, hard caps (200 specs / 100 diagnostics), symlink/escape refusal, abort support, zero writes.
- `.omp-plugin/marketplace.json` root catalog with the single `omp-spec-kit` plugin entry (`./plugins/omp-spec-kit`, `0.1.0`).
- Plugin guidance: `skills/spec-inventory/SKILL.md` and `commands/spec-inventory.md`.
- Deterministic build (`scripts/build-plugin.mjs`) with committed, hash-manifested `dist/` payload; closed validators for catalog, package, and release consistency (`scripts/verify-*.mjs`).
- Docker-only Cucumber suite (`scripts/docker-bdd.sh`): 17 scenarios / 105 steps, including read-only byte-preservation, bounds/conservation, failure containment, symlink-swap refusal, strict request rejection, and built-extension registration/execution.
- GitHub Actions `verify` (PR/push) and tag-gated `release` workflow with idempotent, commit-bound publishing.

### Evidence

- Installed lifecycle bound to release commit `a959a1af3abeb1fc61eefda48b011a6470a6d621`: clean install → fresh-session invocation (`pluginVersion 0.1.0`, `status ok`) → uninstall (fresh-session tool absence) → exact-candidate reinstall → re-invocation; user-owned bytes preserved throughout. See `docs/validation/distribution-lifecycle.md`.
- First release: prior-version upgrade/rollback is inapplicable by contract.

### Not in this release

- No graph/query kernel, MCP server, authoring, mutation, CAS, or write capability. These are separately gated stages (`ROADMAP.md`).

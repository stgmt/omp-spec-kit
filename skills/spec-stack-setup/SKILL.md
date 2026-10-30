---
name: spec-stack-setup
description: Brings the local spec-registry demo stack to a fully working state — docker compose up, YouTrack wizard, app ZIP install + settings, template spec loaded via MCP, and a ready Spec Board dashboard link. Use when the user asks to start/bring up the spec stack, the demo stand, or wants a working Spec Board link on localhost.
---

# Spec Stack Setup

Owns the demo contour in this directory: **one YouTrack** (IdP *and* tenant —
operator == customer), **spec-git** (bare specs repo + git daemon), and
**spec-registryd** (the MCP spec registry). Everything runs on `127.0.0.1`.

## Run

```sh
node skills/spec-stack-setup/setup.mjs
```

`docker compose up -d` from this directory works too (`name:` in compose.yml
pins the project) — but `setup.mjs` is the complete path: it also completes
the YouTrack wizard, writes the service config, installs the app, seeds the
template spec and provisions the dashboard.

## Installing the skill

This repo's `skills/` directory is not auto-discovered by agent CLIs. To make
the skill available, copy or link it into the agent's skill path:

```sh
# OMP / generic agents
cp -r skills/spec-stack-setup .agents/skills/spec-stack-setup
# Claude Code
cp -r skills/spec-stack-setup .claude/skills/spec-stack-setup
```

The skill is self-contained (SKILL.md + setup.mjs + compose.yml + template/);
no other repo files are needed at runtime.

## Teardown

```sh
docker compose down        # stop the stack, keep volumes (rerun converges)
docker compose down -v     # full reset — drops YouTrack data, the clone, the db
```

Re-running `setup.mjs` after `down` (without `-v`) converges to the same
state. After `down -v` the next run performs the full first-time bootstrap
again (wizard, groups, token, specs, dashboard).

## What setup.mjs does

1. `docker compose up -d` — all three services (a placeholder config is
   written first so the registryd bind-mount always resolves).
2. Waits for YouTrack on `http://127.0.0.1:8089`; completes the Configuration
   Wizard headlessly on first run (admin password `SpecDemo!2026`).
3. Creates the tenant groups (`spec-demo-*`), puts admin in them, mints the
   service token and writes `runtime/projects.json`.
4. Restarts `spec-registryd` and waits for `/mcp` on `127.0.0.1:8644`.
5. Builds + uploads `spec-graph-app` via `POST /api/admin/apps/import`, applies
   `serviceUrl`/`serviceBridgeToken`, attaches it to the `DEMO` project, and
   verifies the package: `spec-app` must be declared at
   `ADMINISTRATION_MENU_ITEM` and no widget may target `MAIN_MENU_ITEM`. A
   package built before the move is rejected instead of being installed as a
   fallback, so the left navigation never regains the entry.
   (`apps/import` is an internal YouTrack endpoint — it works on the bundled
   version but is not a stable public API; the manual equivalent is
   Administration → Apps → Add app → Upload ZIP.)
6. Loads every `template/<slug>/` corpus into the registry through real MCP
   calls (`spec_claim` → `spec_patch replace_document` → `spec_release`):
   `spec-stack-skill` (FR/NFR/AC/TASK/feature scenarios) + `roadmap-stack`
   (the roadmap and its milestone tasks — `createRoadmap` only accepts
   `roadmap-*` slugs, so it ships as a second spec, which is also what makes
   the cross-spec edges on the board).
7. Provisions the `SPEC` projection (project + custom fields + `spec-graph-sync`
   run) so the board's `SPEC:SYNC-STATE` pointer exists. The service starts
   with `SPEC_REGISTRY_PROJECTION=0` and is flipped to `1` only after the
   project, the `SpecKind` and `Type` bundles and the link types exist; the
   skill then waits for the pointer and at least one card before it reports
   success. After that the service keeps the projection fresh itself: every
   confirmed write and every reconciled remote move re-projects cards + the
   snapshot — `spec-graph-sync` stays only as the bootstrap/manual tool. The
   marker carries `projectionVersion`, so a code upgrade self-reprojects.
   Projection is on by default for every install: there is no opt-in step and
   no "create the SPEC project later" prerequisite.
8. Creates the `Spec Stack` dashboard with the `spec-board` widget at
   `width: 12, height: 8` grid cells (the manifest's `defaultDimensions`
   `12fr × 8fr` covers widgets added by hand through the UI) and prints
   the link.
9. Installs the OpenCode guard when `~/.config/opencode/` exists: copies the
   built enforcement tree and the OpenCode host adapter into
   `~/.config/opencode/plugins/omp-spec-kit/`, writes
   `~/.config/opencode/spec-kit-guard.json`, and registers the registry as a
   **remote** MCP server (`spec-registry`) in `opencode.json`. The guard
   blocks every direct write/read of `.specs` and accepts `spec_patch` only
   from that server; a local stdio server is refused. A detected OpenCode
   install must succeed — the phase fails instead of skipping. The three
   authoring skills (`spec-elicitation`, `spec-inventory`,
   `engineering-anti-bike`) are copied to `~/.config/opencode/skills/`.
10. Installs the Codex guard when `~/.codex/` exists: copies the adapter into
    `~/.codex/spec-kit-guard/`, merges one `PreToolUse` group into
    `~/.codex/hooks.json`, adds `[mcp_servers.spec_registry]` (streamable HTTP
    + `bearer_token_env_var`) to `config.toml`, and exports the token for new
    processes. Codex blocks on exit 2; a stdio registry entry is refused.
    Run `/hooks` once in Codex to trust the new hook. The three authoring
    skills are copied to `~/.codex/skills/`.

## Writeback (tracker → spec), optional

`docker compose --profile writeback up -d` additionally starts
`spec-listener` (`spec-graph-sync --serve` inside the service image). The
YouTrack *spec-writeback* workflow rule POSTs card state changes to
`http://spec-listener:8787/writeback`; the listener re-verifies ownership
against the signed `SPEC:SYNC-STATE` marker and applies `spec_patch` through
the registry's `/mcp` — a real bot commit + push, so the next projection run
confirms the status instead of reverting the card.

Required env (`.env` next to compose.yml):

| Var | Meaning |
| --- | --- |
| `YOUTRACK_TOKEN` | admin token — listener re-verifies cards against the tracker |
| `SPEC_AGENT_TOKEN` | onboarding-issued agent token scoped to the spec projects (`POST /onboarding/token`); identities land in `Spec-Author` trailers |
| `SPEC_WRITEBACK_TOKEN` | shared secret the tracker rule sends as `LISTENER_TOKEN` |
| `SPEC_SYNC_MARKER_KEY` | **must equal the service's value** — mismatched secrets make ownership checks fail every writeback |
| `SPECS_BRANCH` | branch of the specs repository the service writes (default `main`); a repo binding that names another branch is rejected |

`SPEC_REGISTRY_URL` and `SPEC_AGENT_TOKEN` are required for `--serve`: without
them the listener refuses to start. There is no local-checkout fallback — the
canonical corpus is served only by the registry. Only one writer may project:
do not scale `spec-registryd` replicas while projection is on.

## Output

```
━━━ spec-stack ready ━━━
YouTrack:    http://127.0.0.1:8089
Login:       admin / SpecDemo!2026
Specs:       roadmap-stack — Spec Stack — roadmap,
             spec-stack-skill — Spec Stack Setup Skill
Dashboard:   http://127.0.0.1:8089/dashboard?id=…
```

Everything is idempotent: re-running converges (find-or-create groups/project,
`replace_document` for spec docs, re-provisioned widget).

## Requirements

- Docker with compose v2
- Node.js ≥ 22
- A system Chrome (the one-time YouTrack wizard runs via `playwright-core`
  `channel: "chrome"` — only when a fresh volume needs it)

## Ports

| Service        | Host (preferred)     | In-network            |
| -------------- | -------------------- | --------------------- |
| youtrack       | `127.0.0.1:8089`     | `youtrack:8080`       |
| spec-git       | `127.0.0.1:9419`     | `spec-git:9418`       |
| spec-registryd | `127.0.0.1:8644`     | `spec-registryd:8642` |

These are clear of the e2e stack (`8081/8082/9418/8643`) so both can run
side by side.

The host ports are **preferred, not guaranteed**. Before `compose up`,
setup probes each candidate: a port held by a foreign process or answering
as a foreign service is skipped, and the stack lands on the next free port
via a generated `compose.override.yml`. On re-run the stack keeps its own
published bindings; a registry already answering with this stack's instance
fingerprint is reattached, not remapped. The published endpoints are then
written into `runtime/projects.json` as `hostUrl` (host-facing) and
`internalUrl` (container network) — treat that manifest, not this table, as
the source of truth.

### Repairing stale consumer configs

Client MCP configs freeze on whatever URL/token existed at onboarding time.
If the stack moved ports or was re-provisioned, run the doctor:

```bash
node scripts/spec-registry-doctor.mjs            # report only
node scripts/spec-registry-doctor.mjs --repair   # repoint + re-issue tokens
```

It audits `~/AppData/Roaming/devin/mcp_config.json`,
`~/.codeium/windsurf/mcp_config.json` and `./.mcp.json`, reports each entry
as `ok` / `unreachable` / `unauthorized` / `wrong-instance`, and repairs the
broken ones against the manifest's `hostUrl` — re-issuing tokens through
`/onboarding/token` (host audience). `${file:...}` token references are
rewritten inside the referenced file, never inlined.

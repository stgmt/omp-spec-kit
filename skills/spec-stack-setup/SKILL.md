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

`docker compose up -d` from this directory works too (`.env` pins the project
name) — but `setup.mjs` is the complete path: it also completes the YouTrack
wizard, writes the service config, installs the app, seeds the template spec
and provisions the dashboard.

## What setup.mjs does

1. `docker compose up -d` — all three services (a placeholder config is
   written first so the registryd bind-mount always resolves).
2. Waits for YouTrack on `http://127.0.0.1:8089`; completes the Configuration
   Wizard headlessly on first run (admin password `SpecDemo!2026`).
3. Creates the tenant groups (`spec-demo-*`), puts admin in them, mints the
   service token and writes `runtime/projects.json`.
4. Restarts `spec-registryd` and waits for `/mcp` on `127.0.0.1:8644`.
5. Builds + uploads `spec-graph-app` via `POST /api/admin/apps/import`, applies
   `serviceUrl`/`serviceBridgeToken`, attaches it to the `DEMO` project.
6. Loads every `template/<slug>/` corpus into the registry through real MCP
   calls (`spec_claim` → `spec_patch replace_document` → `spec_release`):
   `spec-stack-skill` (FR/NFR/AC/TASK/feature scenarios) + `roadmap-stack`
   (the roadmap and its milestone tasks — `createRoadmap` only accepts
   `roadmap-*` slugs, so it ships as a second spec, which is also what makes
   the cross-spec edges on the board).
7. Provisions the `SPEC` projection (project + custom fields + `spec-graph-sync`
   run) so the board's `SPEC:SYNC-STATE` pointer exists.
8. Creates the `Spec Stack` dashboard with the `spec-board` widget at
   `12fr × 8fr` and prints the link.

## Output

```
━━━ spec-stack ready ━━━
YouTrack:    http://127.0.0.1:8089
Login:       admin / SpecDemo!2026
Spec:        spec-stack-skill — Spec Stack Setup Skill
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

| Service        | Host                 | In-network            |
| -------------- | -------------------- | --------------------- |
| youtrack       | `127.0.0.1:8089`     | `youtrack:8080`       |
| spec-git       | `127.0.0.1:9419`     | `spec-git:9418`       |
| spec-registryd | `127.0.0.1:8644`     | `spec-registryd:8642` |

These are clear of the e2e stack (`8081/8082/9418/8643`) so both can run
side by side.

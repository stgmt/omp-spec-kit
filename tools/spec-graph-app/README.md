# Spec Graph — YouTrack app

In-UI spec-graph viewer backed by `spec-registryd`. The installable package is
built in CI from this directory — never commit a hand-made archive.

Installing the ZIP creates nothing in the tracker. The app adds a **Spec
Service** page under **Administration → Integrations**
(`ADMINISTRATION_MENU_ITEM`) — never to the main left navigation — the
whole member journey lives there: repository binding and verification, the
`.mcp.json` mint, and the IdP console for operators. Issue pages carry only
the read-only **Spec Panel** (neighbors and tracker transitions) — no setup
link, no onboarding inside tasks. Optional discovery aid: the native
system-wide banner an admin configures in Global Settings.

## Install into your YouTrack

Pick one of two routes. Both need a YouTrack account with **Update Project**
(or Low-level Admin Write) permission.

### Route 1 — upload the release ZIP (UI)

1. Download `spec-graph-app-<version>.zip` from the GitHub release assets.
2. In YouTrack: **Administration → Apps → Add app… → Upload ZIP file**.
3. Open the app, fill in `serviceUrl` and `serviceBridgeToken`, then attach it
   to your project (**Usages → Add project**).

### Route 2 — one command (official JetBrains CLI)

```text
npm run build:youtrack-app
npx youtrack-app app upload --host https://your-ytrack.example --token <perm-token> --directory dist/spec-graph-app
npx youtrack-app app attach --host <same> --token <same> --app spec-graph-app --project <PROJECT-KEY>
```

The permanent token needs `Update Project` on the target project. Set
`serviceUrl`/`serviceBridgeToken` afterwards in Administration → Apps →
Spec Graph → Settings, or reuse the e2e `globalConfig` call.

## Dashboard and health

The **Spec Service** page (Administration → Integrations) runs a health check
before any service call and offers **Provision dashboard**:

- the dashboard is `Spec Stack` with exactly one `spec-board` embedding,
  full width (`12`), pointing at the currently installed app widget;
- a stale embedding, a narrow width, or duplicate boards are repaired on the
  next provision; a healthy second run performs no writes;
- sharing with `All Users` is mandatory — a missing group fails the provision
  instead of reporting a ready dashboard;
- the Snapshot row reads the committed `SPEC:SYNC-STATE` issue. Set the
  optional `markerProject` app setting when the pointer lives in a YouTrack
  project other than `SPEC`.

Known limitation: YouTrack has no dashboard-sharing delta endpoint, so the
share step reads the dashboard and posts the full snapshot back. A widget
added by another user in the few milliseconds between the read and the post
can be lost; the next health check reports the resulting state and a rerun
repairs the board. The headless provisioner
(`scripts/spec-dashboard-setup.mjs`) has the same contract.

## What CI produces

`npm run build` (also `build:youtrack-app` alone) emits:

- `dist/spec-graph-app/` — the staged package directory the CLI uploads;
- `dist/spec-graph-app-<version>.zip` — deterministic ZIP for the UI upload
  path, the release assets, and the future Marketplace listing.

The package set is derived from `manifest.json` (widgets, http handlers,
settings) plus files they reference — add a module to the manifest and it
ships automatically. `youtrack-app app validate` runs inside `npm run verify`.

## Marketplace (later)

The listing metadata phase adds `url`, icons, `changeNotes`, and vendor
contact fields to `manifest.json`, then publishes the same ZIP through the
JetBrains Marketplace so admins install via **Browse JetBrains Marketplace**
with update linkage.

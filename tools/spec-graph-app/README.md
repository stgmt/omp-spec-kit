# Spec Graph — YouTrack app

In-UI spec-graph viewer backed by `spec-registryd`. The installable package is
built in CI from this directory — never commit a hand-made archive.

Installing the ZIP creates nothing in the tracker. The app adds a **Spec
Service** page to the main YouTrack menu (`MAIN_MENU_ITEM`) — the whole
member journey lives there: repository binding and verification, the
`.mcp.json` mint, and the IdP console for operators. Issue pages carry only
a thin context card (linked spec, repo status, a link to the page) — no
onboarding inside tasks. Optional discovery aid: the native system-wide
banner an admin configures in Global Settings.

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

# Decision: onboarding lives on the app's page, never inside an issue

Status: accepted (2026-09-18)

## Problem

The `spec-service-panel` issue widget carried the full onboarding stepper —
repository binding, verification, and the `.mcp.json` mint. That made a task
into a configuration surface: an issue card "magically" offering agent setup
reads as fabrication, and the install story implied the ZIP created or
repurposed issues. Installing the app must create nothing in the tracker.

## Decision

- **`spec-app` @ `MAIN_MENU_ITEM`** — a real YouTrack page in the main
  navigation ("Spec Service") hosts the entire stepper: repository state and
  binding for authorized users, migration verification, token minting with
  the paste-token fallback, and the generated `.mcp.json` with copy controls.
  `?step=agent` deep-links to the agent step; the page awaits
  `host.navigation.getAppLocation()` before the first render so the deep-link
  is not lost to the async-render race.
- **`spec-service-panel` is a thin context card** — the linked spec when the
  issue carries `SpecId`, repo status chips, and an `Open Spec Service` link
  (with `?step=agent`). No wizard, no bind forms, no MCP config. An issue
  without a linked spec shows an honest empty state — ordinary customer tasks
  do not have `SpecId` (only projected SPEC mirror cards do).
- **Discovery = native System-wide banner** — configured by an administrator
  in Global Settings. The apps API exposes no way for an app to post user
  notifications (`/api/notifications` is read-only), so none is fabricated;
  the banner is presented as an admin action, not an app feature.

## Consequences

- One canonical setup surface reachable from every page; the issue card keeps
  only what is issue-specific.
- The app page URL is `app/<app>/<widget>` (single `/app/` segment — verified
  live, not `/apps/`); the card link and the BDD steps use it.
- BDD anti-regression: a scenario asserts an issue page contains zero
  onboarding testids (`wizard`, `agent-panel`, `agent-mint`, `agent-mcp`,
  `repo-form`, `idp-form`).

## Related defect fixed along the way

`mounts.forSource` resolved non-active binding rows through `for()`, which
throws `REPO_BINDING_REQUIRED` for external projects — a failed bind
(`status: "error"`) permanently wedged the project: every retry and every
catalog read died on the same error. `forSource` now resolves an `error` row
to its `migratedFrom` mount (or the default), while `for()` still refuses
reads/writes — the error state stays honest, the retry stays possible.

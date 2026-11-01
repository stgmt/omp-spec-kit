# `youtrack-spec-delivery` scenarios — execution evidence

Date: 2026-11-01
Spec: `youtrack-spec-delivery` (6 scenarios, valid: 0 errors / 0 warnings)
Executable suite: `tests/features/youtrack-spec-delivery.feature` +
`tests/step-definitions/youtrack-spec-delivery.steps.mjs`
Stack: live compose `spec-auth-e2e` (`YouTrack http://127.0.0.1:8081`,
`spec-registryd http://127.0.0.1:8643`), app 1.0.48

## Cucumber run

```text
npm run test:delivery-live
6 scenarios (6 passed)
56 steps (56 passed)
2m 33.844s
```

The release workflow runs the same command after `tool:e2e:live`
(`.github/workflows/release.yml`). The suite bootstraps its own stack with
`run-live.mjs --bootstrap-only --skip-app`, uploads the built ZIP through
Administration → Apps, and executes every scenario against the real service,
YouTrack, and chrome.

| Scenario | Implemented check | Result |
|---|---|---|
| `SCEN-delivery-placement` — fresh install keeps the main navigation clean | UI upload + attach + settings; installed widget placement; `/issues` has no app link; the anchor issue has no `Open Spec Service` | passed |
| `SCEN-delivery-health` — setup page explains what is missing before settings | handler executed in `vm` with `settings: {}` (missing keys, no token leak), then a live page with an unreachable URL renders six health rows and the next action | passed |
| `SCEN-delivery-second-user` — a second user sees the shared dashboard | the headless provisioner creates/shares `Spec Stack`; the page's provision verifies it; `bob` (reader) opens it and sees the committed `spec-board` nodes | passed |
| `SCEN-delivery-upgrade` — reinstall preserves specs and dashboard | re-upload the same ZIP, converge the dashboard, assert the app id/version, catalog, and one `spec-board` | passed |
| `SCEN-delivery-demo` — opt-in demo can be loaded and deleted | MCP creates a `demo: true` spec with FR/NFR/AC/TASK/SCENARIO; the owner deletes it; cards and snapshot nodes disappear, `alpha-spec` survives | passed |
| `SCEN-delivery-agent-warning` — warning once when unconfigured | the real OpenCode plugin emits one bounded text part, stays silent afterwards, never blocks, contains no secret, and stays silent for a configured project | passed |

## Notes

- The health scenario exercises both halves of REQ-4: the handler answers
  `health/app` before settings exist (YouTrack does not mount a widget while
  required settings are empty), and the live page keeps the health checklist
  when the service is unreachable instead of replacing it with a dead error.
- Dashboard writes from the widget host did not complete on YouTrack 2025.3
  (the request never reaches the server). The app therefore verifies the
  persisted dashboard and reports the canonical command
  (`scripts/spec-dashboard-setup.mjs`) on a write timeout; the headless
  provisioner performs creation, stale/duplicate repair, and sharing
  idempotently and is covered by `tests/unit/service/spec-app-dashboard.test.mjs`.
- Supporting checks: `check-app-placement` (1.0.48), `tests/app-package.test.mjs`,
  and the dashboard module behavior tests.

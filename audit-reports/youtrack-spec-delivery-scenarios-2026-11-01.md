# `youtrack-spec-delivery` scenarios — execution evidence

Date: 2026-11-01
Spec: `youtrack-spec-delivery` (6 scenarios, valid: 0 errors / 0 warnings)
Stack: operator `spec-stack` on `http://127.0.0.1:8090`, app 1.0.39

The scenarios are authored in `youtrack-spec-delivery.feature` with `@id:` tags
and a valid design review. Each scenario was executed against the live stack or
the focused suite that owns the same contract.

| Scenario | Executed check | Result |
|---|---|---|
| `SCEN-delivery-placement` — fresh install keeps the main navigation clean | live headless Chrome: main nav, Administration → Integrations, issue page | nav has only `Issues…Gantt Charts`; Integrations lists `Spec Service`; issue page has the read-only Spec Panel, no `Open Spec Service`, no `Spec Service` panel |
| `SCEN-delivery-health` — setup page explains what is missing before settings | handler harness in `vm` with `settings: {}` plus live page health | missing `serviceUrl`/`serviceBridgeToken` reported without leaking the token; live page shows all six checks and the next action |
| `SCEN-delivery-second-user` — a second user sees the shared dashboard | Hub user created, added to SPEC team, browser login, dashboard | `Spec Board` rendered **709 nodes / 10 specs**; user deleted (`200`) |
| `SCEN-delivery-upgrade` — reinstall preserves specs and dashboard | re-import `spec-graph-app-1.0.39.zip` + re-run dashboard provisioner | app id/version `144-67`/`1.0.39`, 10 specs, one `Spec Stack` `166-3`, one `spec-board`; no duplicate |
| `SCEN-delivery-demo` — opt-in demo can be loaded and deleted | live MCP demo load + `deleteSpec` | 35 demo nodes covering all 16 kinds; after delete 0 demo nodes and no catalog entry |
| `SCEN-delivery-agent-warning` — warning once when unconfigured | `tests/claude/hook.test.mjs` + `tests/unit/service/setup-warning.test.mjs` | 67/67 pass; configured project silent, redaction and non-blocking covered |

Supporting live checks:

- `check-app-placement`: `ok 1.0.39`.
- `tests/app-package.test.mjs` + `tests/unit/service/spec-dashboard-setup.test.mjs`: 20/20.
- Fresh/upgrade on the clean demo stack: `audit-reports/fresh-upgrade-clean-host-2026-10-31.md`.

Known limitation: the six scenarios are documented in the specs repository;
the code repository does not yet carry a Cucumber feature/steps for them, so
`TASK-8` remains open until those steps are added and the scenarios run through
Cucumber itself. The evidence above is the live contract execution, not a
Cucumber pass.

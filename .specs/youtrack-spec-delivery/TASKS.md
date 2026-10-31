# Tasks

## TASK-1: Release contract and install modes

- **Status:** todo
- **Implements:** FR-1, FR-2
- **Done When:** ZIP/CLI install works; `fresh` and `upgrade` modes are explicit; fresh does not seed; upgrade preserves settings, dashboard, share, and marker.

## TASK-2: Dashboard provisioner

- **Status:** todo
- **Implements:** FR-3
- **Done When:** one idempotent operation creates/updates `Spec Stack`, adds the full-width `spec-board` widget, and shares with `All Users`; a second run makes no duplicate.

## TASK-3: Setup wizard and health/doctor

- **Status:** todo
- **Implements:** FR-4
- **Done When:** the app names package/settings/attach/dashboard/snapshot prerequisites, tests the connection, and renders before service settings exist.

## TASK-4: Demo fixture

- **Status:** todo
- **Implements:** FR-5
- **Done When:** an explicit demo action creates one demo spec with 1–2 of every entity kind and the full edge chain, marked demo, idempotent, absent from fresh production.

## TASK-5: Delete spec and entity

- **Status:** todo
- **Implements:** FR-6
- **Done When:** owner/writer can delete the demo spec or one entity with confirmation; source/cards/links/snapshot are cleaned; reader denied; dependents refused without force; audit recorded.

## TASK-6: Coding-agent warning

- **Status:** todo
- **Implements:** FR-7
- **Done When:** SessionStart/OMP warning fires once on missing corpus/MCP, stays silent when configured, redacts secrets, and never blocks.

## TASK-7: Release evidence

- **Status:** todo
- **Implements:** FR-8
- **Done When:** clean-host, second-user, fresh/upgrade/delete, package, and redaction evidence is recorded.

## TASK-8: Spec scenarios and review

- **Status:** todo
- **Implements:** FR-1..FR-8
- **Done When:** executable scenarios for the acceptance criteria are authored with a valid design review and pass against the real stack.

## TASK-9: Placement regression

- **Status:** todo
- **Implements:** FR-9
- **Done When:** the package declares no `MAIN_MENU_ITEM`; `spec-app` is `ADMINISTRATION_MENU_ITEM`; the installed page is listed under Administration → Integrations; the live E2E asserts both.

## TASK-10: Placement gate for package, docs, and release candidate

- **Status:** done
- **Implements:** FR-9, AC-9.1, AC-9.2
- **Done When:** `scripts/check-app-placement.mjs` passes for the source app and the staged candidate; `npm run check:app-placement` is part of `npm run verify`; release preflight runs the gate before publishing; install docs do not pin an old app ZIP; the stale extracted `release-candidate/spec-graph-app` tree is untracked and gitignored.

# Design

## Boundaries

- `youtrack-visualization` owns projection and board rendering.
- `spec-registry-service` owns the registry service, packaging, and onboarding endpoints.
- `spec-mcp-operations` owns `spec_patch`.
- This specification owns delivery, fresh/upgrade, dashboard provisioning/sharing, setup health, demo lifecycle, deletion UX, and agent warnings.

## Components

1. **Release package** — `tools/spec-graph-app` built into a deterministic ZIP; CLI upload/attach remains the official headless path.
2. **Install mode** — `fresh` or `upgrade`; fresh does not seed, upgrade preserves.
3. **Dashboard provisioner** — one operation that finds/creates `Spec Stack`, adds/updates the full-width `spec-board` widget, and merges `All Users` into `readSharingSettings`.
4. **Setup page** — the existing `spec-app` wizard gains a dashboard step and a health/doctor panel; it must render before service settings exist.
5. **Demo** — an opt-in fixture with all entity kinds, 1–2 each, marked `demo: true`.
6. **Deletion** — a service intent/operation and UI controls for whole spec and entity; projection cleanup uses `removeStaleCards`.
7. **Agent warning** — a Claude Code `SessionStart` hook and an OMP extension event; shared diagnostic core, host-specific adapter.

## Fresh vs upgrade

Fresh detection is explicit: the install command has `--mode fresh|upgrade`; the app also detects an existing bound corpus/dashboard and never deletes on an unknown state. Fresh shows the empty state and an optional demo button. Upgrade re-runs projection and updates the existing dashboard in place.

## Delete semantics

- Whole spec: remove the spec from the canonical source (or archive with a hidden-from-projection flag), remove projected cards/links/snapshot nodes, and audit. Canonical branch deletion requires the dedicated audited operation; the existing `spec_branch delete` guard stays intact.
- Entity: remove the definition block from its owning document, update the traceability rows, refuse if inbound references remain unless `force`, then reproject.
- UI: board node drawer and Spec Service spec list; confirmation and role gate; demo badge.

## Agent warning

The diagnostic runs at session start. It checks the project corpus, `omp-spec-kit` MCP configuration, registry reachability, and version. It writes one bounded context message. Failures are swallowed; the hook never blocks.

## Evidence

A clean-host E2E covers install → settings → attach → dashboard → second-user view; a fresh/upgrade/delete matrix; package digest/validation; and warning redaction.

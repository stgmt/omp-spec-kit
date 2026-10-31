# Functional Requirements

## FR-1: Versioned ZIP and CLI delivery

The release SHALL provide the app as a deterministic ZIP and through the official `youtrack-app` CLI upload/attach path. The manifest version SHALL match the release artifact and `youtrack-app app validate` SHALL pass.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-versioned-package)

## FR-2: Fresh install and upgrade are different states

A fresh install with no project corpus SHALL render zero valid specs and a setup empty state. An upgrade or reinstall of an existing corpus SHALL preserve and reproject the existing specs, settings, dashboard, share, and marker; it SHALL NOT create duplicate cards or dashboards.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-fresh-vs-upgrade)

## FR-3: Canonical shared dashboard

The delivery SHALL provision one `Spec Stack` dashboard with one full-width `spec-board` widget and SHALL share it with `All Users`. A re-run SHALL find and update the same dashboard, not create another one.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-canonical-dashboard)

## FR-4: Setup wizard and health

The app SHALL show the next setup action for package, settings, project attachment, dashboard, and committed snapshot. It SHALL provide a connection test and a health/doctor view that names every missing prerequisite.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-setup-health)

## FR-5: Opt-in full-set demo

An explicit demo action SHALL create one demo spec containing 1–2 instances of every entity kind and the full edge chain. The demo SHALL be marked, idempotent, and absent from a fresh production install.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-demo-full-set)

## FR-6: Delete spec and entity

An owner or writer SHALL be able to delete a demo spec and an individual entity with confirmation. Deletion SHALL remove the source definition, projected cards, links, and snapshot nodes; it SHALL refuse unresolved dependents unless an explicit force is supplied, and SHALL audit the action.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-delete-demo)

## FR-7: Coding-agent setup warning

The plugin SHALL emit a bounded, non-blocking setup warning through the host hook/extension when the project has no corpus or the MCP/registry configuration is missing. It SHALL name one next action, emit once per session, redact secrets, and stay silent when configured.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-agent-warning)

## FR-8: Release evidence

The release SHALL record a clean-host install, a second-user dashboard check, a fresh/upgrade/delete matrix, package validation, and warning redaction.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-release-evidence)

# Requirements

## Scope

Deliver the Spec Graph app to YouTrack users, provision a shared dashboard, keep fresh installs empty, preserve upgrades, provide an opt-in full-set demo with deletion, and warn the coding agent through hooks when setup is missing.

## REQ-1: Distribution

ZIP and official CLI are the v1 channels. The package is versioned, validated, and attached to the release. Marketplace is out of scope.

## REQ-2: Fresh vs upgrade

A fresh project contains no valid specs in the dashboard. An upgrade or reinstall preserves and reprojects existing specs, settings, dashboard, and share.

## REQ-3: Dashboard

One canonical `Spec Stack` dashboard contains one full-width `spec-board` widget and is shared with `All Users`. Provisioning is idempotent.

## REQ-4: Setup help

The app shows the next setup action (package, settings, attach, dashboard, snapshot), can test the connection, and exposes a health/doctor status.

## REQ-5: Demo

An explicit demo action creates one demo spec with 1–2 instances of every entity kind and the full edge chain. The demo is marked and can be deleted.

## REQ-6: Deletion

An owner/writer can delete a demo spec or one entity. Deletion removes source, cards, links, and snapshot nodes, refuses unsafe dependents, and is audited.

## REQ-7: Agent warnings

A non-blocking hook/extension warning names the missing setup (corpus, MCP, registry) once per session, without secrets, and stays silent when configured.

## REQ-8: Evidence

Clean-host install, second-user dashboard visibility, fresh/upgrade/delete matrix, package validation, and redaction are recorded.

## Traceability

| Requirement | Functional requirements | Acceptance criteria |
|---|---|---|
| REQ-1 | FR-1 | AC-1.1 |
| REQ-2 | FR-2 | AC-2.1 |
| REQ-3 | FR-3 | AC-3.1 |
| REQ-4 | FR-4 | AC-4.1 |
| REQ-5 | FR-5 | AC-5.1 |
| REQ-6 | FR-6 | AC-6.1 |
| REQ-7 | FR-7 | AC-7.1 |
| REQ-8 | FR-8 | AC-8.1 |

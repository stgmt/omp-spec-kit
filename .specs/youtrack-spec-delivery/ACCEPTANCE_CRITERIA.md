# Acceptance Criteria

## AC-1.1: Versioned package

Given the release candidate, when the app is built, then the ZIP is deterministic, its manifest version matches the release, and `youtrack-app app validate` passes.

## AC-2.1: Fresh vs upgrade

Given a clean project, when the app is installed and the dashboard is provisioned, then the board shows zero valid specs and a setup empty state. Given an existing corpus, when the app is upgraded, then the same specs, settings, dashboard, share, and marker remain and no duplicate dashboard appears.

## AC-3.1: Canonical dashboard

Given a YouTrack instance, when the delivery provisions the dashboard, then one `Spec Stack` dashboard exists with one full-width `spec-board` widget and `readSharingSettings` includes `All Users`; a second run does not create a second dashboard.

## AC-4.1: Setup health

Given missing settings, attachment, dashboard, or snapshot, when the setup page or doctor runs, then it names each missing prerequisite and the next action; a connection test reports a bounded, secret-free result.

## AC-5.1: Demo full set

Given an explicit demo action, when it completes, then one demo spec contains 1–2 instances of every entity kind and the full edge chain, is marked as demo, and is not present after a fresh production install.

## AC-6.1: Delete demo

Given a demo spec or entity and an owner/writer, when deletion is confirmed, then the source, cards, links, and snapshot nodes are removed; a reader is refused; unresolved dependents are refused without force; an audit record exists.

## AC-7.1: Agent warning

Given the plugin installed without a corpus or MCP/registry configuration, when a session starts, then one bounded warning names the next action and does not block; when configured, no warning is emitted; secrets are absent.

## AC-8.1: Release evidence

Given the release candidate, when the evidence is assembled, then it contains the clean-host install, second-user dashboard, fresh/upgrade/delete matrix, package validation, and warning redaction results.

## AC-9.1: Integrations only

Given an installed Spec Graph package, when an administrator opens Administration → Integrations, then the Spec Service page is listed there; no Spec Graph widget declares `MAIN_MENU_ITEM`, and the main left navigation contains no Spec Graph item.

## AC-9.2: Current package, docs, and release candidate are clean

Given the current `tools/spec-graph-app/manifest.json`, the install documentation, and a freshly assembled release candidate, when each is inspected, then the manifest and the staged candidate declare `spec-app` at `ADMINISTRATION_MENU_ITEM` and no widget at `MAIN_MENU_ITEM`; any app ZIP version pinned in current install docs equals the current app version; the tracked extracted release-candidate tree is absent.

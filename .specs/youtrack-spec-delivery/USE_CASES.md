# Use Cases

## UC-1: Install and provision

**Actor:** YouTrack administrator.

1. Install the release package through the UI or the official CLI.
2. Configure `serviceUrl` and `serviceBridgeToken`; attach the app to the project.
3. Provision `Spec Stack` with one full-width `spec-board` widget.
4. Share the dashboard with `All Users`.
5. Open the dashboard as a non-admin user and verify the board or an honest empty state.

## UC-2: Fresh vs upgrade

**Actor:** administrator or returning user.

- Fresh project: no .specs corpus, no cards, no valid specs; dashboard empty state; optional demo button.
- Upgrade/reinstall: existing corpus and cards are reprojected; settings, dashboard, share, and marker are preserved; no duplicate dashboard.

## UC-3: Delete the demo

**Actor:** owner or writer.

1. Open the demo spec or entity.
2. Confirm deletion.
3. The service removes the source, cards, links, and snapshot nodes; the board returns to its real state.
4. A reader is refused; an audit record is written.

## UC-4: Agent setup warning

**Actor:** coding agent session.

1. The plugin is installed in a project.
2. The session-start diagnostic finds no corpus or missing MCP/registry configuration.
3. The hook injects one bounded warning with a concrete next action; work is not blocked.
4. When configuration is complete, no warning is emitted.

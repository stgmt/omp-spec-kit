# YouTrack Spec Graph delivery and setup

Status: DRAFT

This specification owns the **delivery** of the Spec Graph app to YouTrack users and the setup help around it. It does not redefine projection, the registry write path, or the kernel graph.

The release outcome is a working shared **Spec Stack** dashboard, not only a ZIP file. Fresh installs start empty; upgrades preserve existing specs. A demo corpus is an explicit opt-in and can be deleted by the user. The coding agent receives setup warnings through hooks when the plugin is installed but not configured.

## Documents

- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Design](DESIGN.md)
- [Tasks](TASKS.md)
- [File changes](FILE_CHANGES.md)
- [Fixtures](FIXTURES.md)
- [Scenarios](youtrack-spec-delivery.feature)
- [Schema](youtrack-spec-delivery_SCHEMA.md)

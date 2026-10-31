# Research

- Existing specs: `youtrack-visualization` owns projection and board views; `spec-registry-service` owns app distribution (`FR-17`), packaging (`TASK-16`), and guided onboarding (`TASK-19`); `spec-mcp-operations` owns `spec_patch`.
- Existing code: `skills/spec-stack-setup/setup.mjs` already provisions a dashboard and shares it in the demo contour; `tests/e2e/lib/youtrack.mjs` has the capture-verified dashboard sharing call.
- Existing deletion: `archiveSpec` archives a spec, `deleteSpecDoc` deletes a document, and `spec_branch delete` refuses canonical branches. No dashboard delete UI and no per-entity delete intent exist.
- Existing warning surface: the plugin has a Claude Code `PreToolUse` hook only; no session-start setup warning.
- Gap: delivery, fresh/upgrade semantics, dashboard sharing, demo full-set, deletion, and agent warnings are not owned by one spec.

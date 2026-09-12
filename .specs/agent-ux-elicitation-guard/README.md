# Agent UX elicitation guard

**Problem:** an agent wrote a full specification with unsupported numeric claims and no clarifying questions. Kernel checks stayed green because they verify link closure, not meaning.

**Change:** before the first real apply to a missing canonical Markdown document the agent is stopped once, pointed at one canonical elicitation memo, and only then allowed to write. Later edits are never stopped. The ticket is keyed by specification slug plus document name, and a multi-document request receives one refusal listing all missing Markdown targets. Previews, existing documents, canonical feature files, and non-canonical paths are outside the guard.

**Authority:** one canonical memo for the agent plus one short shared hint string in code. No full-text copies.

## Documents

- [Research](RESEARCH.md)
- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Non-functional requirements](NFR.md)
- [Design](DESIGN.md)
- Scenarios: agent-ux-elicitation-guard.feature
- [Tasks](TASKS.md)
- [File changes](FILE_CHANGES.md)
- [Fixtures](FIXTURES.md)
- [Schema](agent-ux-elicitation-guard_SCHEMA.md)
- [Changelog](CHANGELOG.md)
- [User stories](USER_STORIES.md)
- [Use cases](USE_CASES.md)

## Scope and limits

The guard applies to every canonical Markdown document accepted by isCanonicalDocument, separately for each specification/document pair. It is a mechanical write-boundary nudge, not a judge of question quality. The agent owns source reading and gap analysis through the canonical memo; the authoring service owns only missing-file detection, one-time ticketing, refusal, and retry availability.

A service restart forgets tickets and may issue one fresh stop for a still-missing target. Direct filesystem writes outside the authorized MCP path are outside this feature.

## Release boundary

This is later authoring and mutation work. It does not claim delivery in read-only v0.1.0, v0.2, or v0.3 stages. Release remains subject to the cumulative product:FR-6 gate, including plugin-distribution:FR-13, spec-kernel:FR-14 for both v0.2 and v0.3 with typed predecessor linkage, and spec-authoring-workflow:FR-13.

## Evidence

Evidence is the public safe-authoring and staged MCP scenarios, focused edge tests including service restart, package and corpus checks, live-loader smoke, Docker BDD, and mutation checks. The policy owner is src/authoring/elicitation-guard.js; generated distribution files come only from scripts/build-plugin.mjs. Qualitative question quality remains a review concern, not an automated assertion.

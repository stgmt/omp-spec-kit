# User Stories

## US-1: Admin installs a working board

As a YouTrack administrator, I want to install the Spec Graph app and end with a shared dashboard, so that users see the specification graph without reading repository files.

**Independent Test:** Clean YouTrack, install the release ZIP or CLI, configure the service, attach the project, provision the dashboard, and open it as a non-admin user.

## US-2: User starts clean or upgrades safely

As a project member, I want a fresh install to show no valid specs and an explicit demo, while an upgrade keeps my existing specs, so that the product never invents or loses a corpus.

**Independent Test:** Fresh project shows zero valid specs; an existing project upgraded in place keeps its cards and board.

## US-3: User removes the demo

As a user who loaded the demo, I want to delete the demo spec or individual demo entities, so that my dashboard returns to its real state.

**Independent Test:** Delete one entity and then the whole demo spec; source, cards, links, and snapshot nodes disappear without orphan cards.

## US-4: Agent warns about missing setup

As a coding agent user, I want a bounded warning when the spec plugin is installed but the project or MCP endpoint is not configured, so that I can fix setup before guessing.

**Independent Test:** A fresh plugin project emits one non-blocking warning; a configured project emits none.

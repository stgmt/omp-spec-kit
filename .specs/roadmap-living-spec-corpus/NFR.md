# Non-Functional Requirements

## NFR-SCOPE-1: A phase is done only with its own evidence

A phase SHALL be reported as done only when the acceptance criteria of the referenced feature specification are green on a release candidate and the run is recorded in that specification. A roadmap SHALL NOT claim a capability whose specification still reports draft, and the assembled view SHALL reflect the task statuses rather than a hand-written claim.

## NFR-COMPAT-1: Release gate is a conjunction

The release SHALL require the accepted candidate gates of `plugin-distribution` and `spec-mcp-operations` for the release candidate, plus the evidence of all four wave-1 specifications. This roadmap adds to those gates and SHALL NOT loosen them.

# Acceptance Criteria

## AC-1.1: Roadmap kernel type

**WHEN** `spec_catalog(view: "types")` is called
**THEN** entityKinds SHALL include ROADMAP with label "Roadmap"

## AC-2.1: Roadmap-to-feature tracing

**GIVEN** a roadmap spec with TASKs linking to feature spec FRs via `Implements:`
**WHEN** `spec_graph` traverses from a roadmap TASK
**THEN** the target feature spec FR SHALL be reachable via an IMPLEMENTS edge

## AC-3.1: Roadmap lifecycle

**GIVEN** a roadmap spec with README profile declaring `status: active`
**WHEN** product ROADMAP.md is read
**THEN** it SHALL include the roadmap spec in its planned releases

## AC-4.1: Roadmap visualization

**GIVEN** a YouTrack spec board
**WHEN** filtered by entity kind ROADMAP
**THEN** roadmap phases and their cross-spec edges SHALL be visible

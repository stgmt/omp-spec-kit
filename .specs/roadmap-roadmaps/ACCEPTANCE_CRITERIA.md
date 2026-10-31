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

## AC-5.1: Canonical roadmap document

**GIVEN** a `roadmap-*` spec containing ROADMAP.md
**WHEN** the kernel builds the graph
**THEN** the canonical node `<specSlug>:ROADMAP` SHALL exist and other specs SHALL be able to reference it

## AC-6.1: Scope-derived assembly

**GIVEN** a roadmap spec whose FR/TASK definitions implement entities of specs A and B
**WHEN** the generated region is assembled
**THEN** it SHALL contain requirement-level items from specs A and B only, grouped by spec

## AC-6.2: Deterministic output

**GIVEN** an unchanged canonical graph
**WHEN** assembly runs twice
**THEN** both generated regions SHALL be byte-identical

## AC-7.1: Derived status

**GIVEN** a covered FR whose implementing TASKs are all done
**WHEN** the generated region is assembled
**THEN** the item SHALL render `done`; with mixed task statuses it SHALL render `in progress`; with no implementing tasks it SHALL render `planned`

## AC-8.1: Merge preserves authored

**GIVEN** a ROADMAP.md with authored text and notes outside the markers
**WHEN** re-assembly runs against a changed graph
**THEN** every byte outside the markers SHALL be preserved

## AC-8.2: Vanished items removed

**GIVEN** a generated item whose source node no longer exists in the graph
**WHEN** re-assembly runs
**THEN** the item SHALL be absent from the generated region while authored references to it outside the markers survive

## AC-8.3: Missing markers refused

**GIVEN** a ROADMAP.md without a well-formed `roadmap:auto` marker pair
**WHEN** assembly is attempted
**THEN** it SHALL fail with a typed diagnostic and write nothing

## AC-9.1: MCP roadmap lifecycle

**GIVEN** a live MCP server
**WHEN** a roadmap spec is created, assembled, and re-assembled through `spec_patch` intents
**THEN** each write SHALL produce a receipt and the final document SHALL match a direct kernel assembly

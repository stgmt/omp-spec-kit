# User Stories

## US-1: Specification author receiving automatic conformance feedback

As a specification author editing `.specs/**` Markdown in an OMP session, I want conformance findings to appear automatically after each write so that I learn about broken references, duplicate definitions, and structural violations without invoking a tool call.

**Independent test:** Open a spec document, introduce a malformed cross-reference, save; verify the diagnostic appears through OMP's native `lsp.diagnosticsOnWrite` path with the correct code, file, line, and message from the kernel finding.

## US-2: Agent navigating spec definitions through LSP primitives

As an OMP coding agent working on specifications, I want to use `textDocument/definition`, `textDocument/references`, and `textDocument/hover` on spec identifiers so that symbol-aware navigation follows the same kernel anchor registry used by the extension and MCP adapter, including ambiguity semantics on collision.

**Independent test:** Position cursor on a qualified reference `spec-kernel:FR-9` in a spec document; invoke `definition`; verify the response targets the exact heading span in `spec-kernel/FR.md`. Repeat for an ambiguous bare ID and verify candidates are returned.

## US-3: Agent completing spec aliases without typos

As an OMP coding agent composing cross-references, I want completion suggestions over registered aliases so that I can reference existing definitions without memorizing exact slug:local-id spellings.

**Independent test:** Type a partial alias prefix in a Markdown link destination; invoke `completion`; verify the list contains only registered canonical IDs matching the prefix.

## US-4: Agent inspecting spec structure through document outline

As an OMP coding agent or human reader, I want a `documentSymbol` outline of a spec document so that I can see the hierarchical structure of FRs, ACs, tasks, and other spec nodes without parsing headings manually.

**Independent test:** Request `documentSymbol` on a spec FR.md; verify the result lists every FR definition node with correct ranges and nesting.

## US-5: Scenario consumer viewing run results and provenance through hover

As a specification consumer reviewing scenario status, I want hover information on scenario references to surface result and provenance fields from the kernel graph so that I can assess freshness without leaving the editor.

**Independent test:** Hover over a `@id:SCEN-*` tag in a `.feature` file; verify the hover content includes the scenario's current result status and evidence provenance from the graph.

## US-6: Step author receiving defined/undefined/ambiguous step diagnostics

As a `.feature` file author using cucumber-runner or pytest-bdd conventions, I want step-line diagnostics indicating whether each step is defined, undefined, or ambiguous so that I can fix binding issues before running tests.

**Independent test:** Write a `.feature` file with one bound step, one unbound step, and one ambiguous step; verify three diagnostics appear with the correct severity and message, matching the oracle verdict on shared fixtures.

## US-7: Release owner verifying adapter-to-service parity

As a release owner evaluating the LSP adapter for release, I want a fingerprint-bound parity check proving that LSP definition, references, and diagnostics answers equal kernel query service answers on shared fixtures so that I can trust the projection does not reinterpret results.

**Independent test:** Run the CHK-FR8-01 parity harness on the reference fixture set; verify all definition, references, and diagnostics responses match the kernel service byte-for-byte on the declared corpus fingerprint.

## US-8: Fixture reviewer validating real-producer step fixtures

As a fixture reviewer, I want step-layer fixtures to carry real-producer provenance and reviewed ground truth so that oracle-parity evidence is traceable and reproducible.

**Independent test:** Inspect the fixture manifest for a step-binding fixture; verify producer, version, SHA-256, license disposition, and expected step-verdict ground truth are recorded per `spec-kernel:FR-11` posture.

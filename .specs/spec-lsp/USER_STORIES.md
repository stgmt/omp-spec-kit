# User Stories

## US-1: Specification author receiving automatic conformance feedback

As a specification author editing `.specs/**` Markdown in an OMP session, I want conformance findings to appear automatically after each write so that I learn about broken references, duplicate definitions, and structural violations without invoking a tool call.

**Independent test:** Open a spec document, introduce a malformed cross-reference, save; verify the diagnostic appears through OMP's native `lsp.diagnosticsOnWrite` path with the correct code, file, line, and message from the kernel finding.

## US-2: Editor or MCP adapter navigating spec definitions through LSP primitives

As an editor user or the MCP adapter, I want `textDocument/definition`, `textDocument/references`, and `textDocument/hover` on spec identifiers so that symbol-aware navigation follows the same kernel anchor registry used by the extension, including ambiguity semantics on collision. The OMP coding agent does not use those LSP primitives; it calls MCP `spec_get_node` / `spec_get_edges`. Later FR-16 adds other read names; it does not replace those first-slice tools.

**Independent test:** In the editor, or via the MCP adapter consuming LSP internally, position the cursor on a qualified reference `spec-kernel:FR-9`; the editor or MCP adapter uses `textDocument/definition`; verify the response targets the exact heading span in `spec-kernel/FR.md`. Repeat for an ambiguous bare ID and verify candidates are returned. Independently, the agent calls MCP `spec_get_node` for the same identifier and does not use `textDocument/definition`.

## US-3: Editor or MCP adapter completing spec aliases without typos

As an editor user or the MCP adapter composing a Markdown cross-reference, I want completion suggestions over registered aliases so that I can reference existing definitions without memorizing exact slug:local-id spellings. The OMP coding agent completes aliases through MCP `spec_find_nodes` (and later FR-16 `find_by_tags`), not `textDocument/completion`.

**Independent test:** In the editor, type a partial alias prefix in a Markdown link destination; the editor or MCP adapter uses `completion`; verify the list contains only registered canonical IDs matching the prefix. The agent does not use `textDocument/completion`; it calls MCP find/search.

## US-4: Editor or MCP adapter inspecting spec structure through document outline

As an editor user or the MCP adapter, I want a `documentSymbol` outline of a spec document so that I can see the hierarchical structure of FRs, ACs, tasks, and other spec nodes without parsing headings manually. The OMP coding agent inspects structure through MCP (`spec_find_nodes` / `spec_inventory`, later FR-16 `list_specs` / `get_spec_status`), not `documentSymbol`.

**Independent test:** In the editor, request `documentSymbol` on a spec FR.md; verify the result lists every FR definition node with correct ranges and nesting. The agent does not use `textDocument/documentSymbol`; it calls MCP.


## US-5: Scenario consumer viewing kernel scenario fields through hover

As a specification consumer reviewing a scenario tag, I want hover to show the kernel's stored scenario fields (name, keyword, tags, step texts) so that I do not confuse editor hover with a test-run dashboard.

**Independent test:** Hover over a `@id:SCEN-*` tag; verify hover includes kernel `SCENARIO` attributes and does not include run result, provenance, or freshness.

## US-6: Release owner proving step-layer absence

As a release owner, I want this stage to refuse step defined/undefined/ambiguous diagnostics so that we do not invent a second step index while the kernel has no `StepBinding` nodes and cannot read `tests/step-definitions/**`.

**Independent test:** Open a `.feature` with unbound steps; verify zero step-binding diagnostics; verify production `lspServers` does not list `@cucumber/language-server`.

## US-7: Release owner verifying adapter-to-service parity

As a release owner evaluating the LSP adapter for release, I want a fingerprint-bound parity check proving that LSP definition, references, and diagnostics answers equal kernel query service answers on shared fixtures so that I can trust the projection does not reinterpret results.

**Independent test:** Run the CHK-FR8-01 parity harness on the reference fixture set; verify all definition, references, and diagnostics semantics normalize to byte-identical `LspKernelProjectionV1` bytes on the declared real-corpus fingerprint, with only transport metadata removed.

## US-8: Release owner keeping oracle parity out of this stage

As a release owner, I want oracle parity against `@cucumber/language-server` excluded from this stage's release conjunction so that we do not require an unsatisfiable comparison against a kernel graph that has no step bindings.

**Independent test:** Inspect the stage evidence manifest; verify CHK-FR12-01 is an absence proof, not an oracle-match proof.

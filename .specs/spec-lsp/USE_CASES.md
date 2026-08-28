# Use Cases

## UC-1: Automatic post-write conformance diagnostics on a spec document

**Actor:** Specification author or OMP coding agent.

**Precondition:** The LSP server is registered through the plugin's `lspServers` manifest and started (lazily or eagerly). A `.specs/<slug>/FR.md` file is open in the OMP session.

**Flow:**
1. The actor edits and saves the file.
2. OMP's `lsp.diagnosticsOnWrite` triggers `textDocument/didSave`.
3. The server re-evaluates the touched spec incrementally against the kernel graph.
4. Kernel conformance findings are mapped 1:1 to LSP diagnostics with code, file, line, and message.
5. OMP displays the diagnostics in the editor surface.

**Postcondition:** Diagnostics reflect the current kernel state for the saved file. No mutation occurred.

## UC-2: Navigate from a cross-reference to its definition

**Actor:** OMP coding agent or human reader.

**Precondition:** A spec document containing a qualified reference `.specs/spec-kernel:FR-9` is open.

**Flow:**
1. The actor positions the cursor on the reference text.
2. The actor invokes `textDocument/definition`.
3. The server resolves the reference through the kernel anchor registry.
4. If unambiguous, the response targets the exact heading span in the source document.
5. If ambiguous, the response returns all candidates per `spec-kernel:FR-4` semantics.

**Postcondition:** Navigation result matches the kernel query service answer for the same reference.

## UC-3: Find all references to a spec definition

**Actor:** OMP coding agent.

**Precondition:** A spec definition heading is selected.

**Flow:**
1. The actor invokes `textDocument/references` with `includeDeclaration: true`.
2. The server queries the kernel backlinks index for the canonical ID.
3. All reference occurrences across `.specs/**` and `.feature` files are returned with locations.

**Postcondition:** Reference set matches the kernel `getEdges` answer for `REFS` edges targeting the node.

## UC-4: Complete a partial alias in a Markdown link

**Actor:** OMP coding agent composing a cross-reference.

**Precondition:** The cursor is inside a Markdown link destination in a spec document.

**Flow:**
1. The actor invokes `textDocument/completion` with the partial prefix.
2. The server queries registered aliases from the kernel node index.
3. Matching canonical IDs are returned as completion items.

**Postcondition:** Completion list contains only valid registered aliases matching the prefix.

## UC-5: View document outline of a spec file

**Actor:** Human reader or agent.

**Precondition:** A canonical spec document is open.

**Flow:**
1. The actor invokes `textDocument/documentSymbol`.
2. The server maps kernel spec nodes in that document to a hierarchical symbol tree.
3. FR, AC, TASK, and other definition nodes appear with ranges and nesting.

**Postcondition:** Outline reflects the kernel's parsed node inventory for that document.

## UC-6: Hover over a scenario tag to see kernel scenario fields

**Actor:** Specification consumer.

**Precondition:** A `.feature` file with scenario tags is open; the kernel graph contains `SCENARIO` nodes.

**Flow:**
1. The actor hovers over an `@id:SCEN-*` tag.
2. The server looks up the scenario node in the kernel graph.
3. Kernel `SCENARIO` attributes (name, keyword, tags, step texts) are rendered. Run result, provenance, and freshness are not shown.

**Postcondition:** Hover content matches stored kernel fields only.

## UC-7: Confirm this stage emits no step-binding diagnostics

**Actor:** Release owner.

**Precondition:** A `.feature` file with unbound steps is open.

**Flow:**
1. Diagnostics are published for the file.
2. No defined/undefined/ambiguous step diagnostic appears.
3. Production `lspServers` does not list `@cucumber/language-server`.
4. The adapter does not scan `tests/step-definitions/**`.

**Postcondition:** CHK-FR7-01 and CHK-FR12-01 absence proofs pass. A future step layer still requires a kernel `StepBinding` change.


## UC-8: Reject an out-of-scope root or symlink

**Actor:** System boundary.

**Precondition:** An LSP initialization request arrives with a workspace root outside `.specs/**` or containing symlinks.

**Flow:**
1. The server validates the root against `spec-kernel:FR-7` containment posture.
2. External roots, symlinks, junctions, and reparse points are refused.
3. An error diagnostic explains the refusal.

**Postcondition:** No indexing occurs outside the permitted scope.

## UC-9: Honest absence when kernel graph is unavailable

**Actor:** Any client.

**Precondition:** The kernel graph failed to build or is not yet available.

**Flow:**
1. A navigation or diagnostic request arrives.
2. The server detects the absent graph state.
3. Diagnostics explain why the graph is unavailable rather than returning degraded fake resolution.

**Postcondition:** No fabricated answers; the client receives an actionable explanation.

## UC-10: Verify adapter-to-service parity on shared fixtures

**Actor:** Release evaluator.

**Precondition:** Shared fixture corpus with known kernel answers.

**Flow:**
1. The parity harness sends identical requests to both the LSP adapter and the kernel query service.
2. Responses are compared byte-for-byte on the declared corpus fingerprint.
3. Any divergence fails the CHK-FR8-01 check.

**Postcondition:** Parity evidence record is produced for the release gate.

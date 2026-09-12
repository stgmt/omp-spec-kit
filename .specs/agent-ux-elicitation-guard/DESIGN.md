# Design

## Bounded contexts

Three contexts own this change.

1. Agent memo owns behavior: trigger, source plus gap plus question steps, dumb-question ban, do-it-now mode.
2. Contract module owns the short shared hint and its references from server instructions and the stop error.
3. Authoring path owns the one-time ticket: detect missing target, refuse once with zero bytes changed under write lock, allow on retry.

The kernel owns nothing new. Graph validation, fingerprints, and containment stay exactly as they are. The raw-write enforcement hook does not carry elicitation text.

## Candidate boundary

A compiled change is a candidate when beforeMissing is true, it is not a delete, and its document name is accepted by isCanonicalDocument. The allowed document names remain centralized in isCanonicalDocument; the guard creates no second filename list. Existing documents, canonical .feature files, previews, and non-canonical paths are excluded.

## Nudge protocol

1. An apply operation (dryRun false) arrives for a canonical Markdown document.
2. The authoring path determines whether the document currently exists on disk.
3. If the document is missing and no ticket exists for specification plus document, it returns ELICITATION_REQUIRED with memo path, sorted target documents, and retry rule, records the ticket, and writes nothing. It does not commit, refresh the graph, create a receipt, or update applied state. Preview calls (dryRun true) return PREVIEW without recording a ticket.
4. A multi-document request (such as createSpec) creating multiple missing Markdown documents receives one refusal for the request, listing all targets in stable order, and records tickets for all of them.
5. The retry finds the tickets recorded and commits atomically under the existing lock.
6. Every later write to an existing document skips the check entirely.

Ticket state is an in-memory set keyed by spec plus document, scoped to the cached authoring service lifetime, never persisted. A restart reissues at most one stop per still-missing document, which is the safe direction.

## Memo outline

Trigger: first creation for any document accepted by isCanonicalDocument. Steps: collect cited sources, rank gaps as blocking versus nice, ask one question per blocking gap through the question dialog, write after answers or explicit do-it-now. Ban: no question whose answer changes nothing, repeats sources, or lacks a gap. Do-it-now: write at once with sourced numbers only plus marked unknowns.

## Hint wiring

One exported constant in the authoring module, re-exported by the contract module. Server instructions append one sentence referencing the memo. The stop error reuses the same sentence. No surface copies the memo body. The raw-write enforcement hook does not carry elicitation text.

## Headless impact

Automatic flows meet at most one refusal per apply request and pass on retry, including a changed retry. No second code path is needed. Existing documents are unaffected. Scenario suites that fill fresh specs gain one expected refusal plus retry per new spec.

## Verification matrix

Unit plus integration tests cover missing-document detection, refusal with zero bytes, retry success, service-restart reissue, no second stop on subsequent edits, preview exemption, and pre-existing document exemption. Inspection, link sweep, package verification, corpus check, and the affected scenario suites close the change. Qualitative question quality remains a separate manual review concern, not an automated pass claim.

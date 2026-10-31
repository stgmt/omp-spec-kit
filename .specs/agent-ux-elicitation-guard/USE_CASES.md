# Use Cases

## UC-1: First write to a missing canonical Markdown document is stopped once

An agent writes a missing canonical document. The authoring path refuses the write, changes zero bytes, and returns the elicitation memo path with retry guidance. The agent reads the memo, assesses gaps, and asks the user.

## UC-2: Retry after the stop succeeds

The same agent repeats the write to the same document, with a valid retry payload. The authoring path accepts it and commits atomically. No second stop occurs for that document.

## UC-3: Later edits are never stopped

An agent edits a document that already exists. The authoring path processes the write with no elicitation check, exactly as before this change.

## UC-4: Explicit do-it-now still meets the stop once

A user says write now without questions. The agent attempts the write, meets the one-time stop, reads the memo, and then writes with only sourced numbers plus explicitly marked unknowns. The stop costs one roundtrip and is never skipped.

## UC-5: Automatic run retries once and proceeds

An automatic run without a human fills a new document. Its first attempt is refused with a typed error. The runner retries the operation once and the commit succeeds. Existing documents in the same run are unaffected.

## UC-6: Preview does not consume the stop

An agent previews a write for a missing target. The service returns PREVIEW without creating a ticket or files. The first real apply still receives the one-time refusal.

## UC-7: Multi-document creation receives one stop

A createSpec request creates several missing Markdown documents and a feature file. The feature file is excluded; one refusal lists all missing Markdown targets, and the retry commits the complete request.

## UC-8: Restart safely forgets process-local tickets

The service restarts while a target is still missing. The first new process attempt may receive one fresh refusal; its retry then succeeds. No hidden ledger is required.

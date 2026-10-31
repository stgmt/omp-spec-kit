# Agent UX elicitation guard Schema

The guard adds no stored schema entity. Ticket state is an in-memory set keyed by spec plus document and never persisted.

## Error envelope

The refusal uses the standard kernel error envelope with code ELICITATION_REQUIRED, the target spec plus document list, the memo path, and the retry rule. No new envelope field is introduced.

## Ticket key

The key is the pair of spec slug plus document name. Tickets are created lazily on refusal and allow the retry to commit. A restart drops all tickets, which reissues at most one stop per still-missing document.

## Candidate boundary

A candidate is a compiled change with beforeMissing true, no delete marker, and a document name ending in .md. The allowed canonical names still come from isCanonicalDocument. Existing documents, canonical .feature files, previews, and non-canonical paths are excluded.

## Error envelope

The refusal uses the standard authoring result shape: ok true, data.outcome REFUSED, and data.error with code ELICITATION_REQUIRED, retryable false, skill skill://spec-elicitation, the sorted target document list, and the short retry hint. No new persistent schema entity or receipt is created by the refusal.

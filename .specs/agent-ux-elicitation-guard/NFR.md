# Non-Functional Requirements

## NFR-UX-1: Single extra roundtrip

The stop SHALL cost at most one refused call per apply request, including a multi-document request. The typed error SHALL expose the memo path, sorted target documents, and retry rule through its fields, while its human-readable hint SHALL reuse the shared constant.

## NFR-COMPAT-1: Automatic runs survive

A retry after the stop SHALL succeed with no human present once the ticket is recorded, regardless of payload changes. No automatic flow SHALL need a second code path.

## NFR-DETERMINISM-1: Same input same verdict

Within the supported Node runtime and canonical path rules, missing-document status plus operation SHALL yield the same stop or pass verdict. Target documents SHALL use locale-independent code-point ordering, and ticket state SHALL be keyed by spec plus document only within the cached authoring service.

## NFR-SAFETY-1: Refused write changes nothing

A refused first write SHALL leave repository files and directory entries unchanged, create no receipt or graph update, and expose no partial file to readers.

## NFR-MAINTAIN-1: Single wording source

Rule wording SHALL exist in exactly two places: the full memo body and the short shared hint. Every other surface SHALL link, never copy.

## NFR-SCOPE-1: No hidden persistence

The guard SHALL use process-local memory only. It SHALL not create a ledger, hidden file, database row, directory, or network record for a first-write ticket.

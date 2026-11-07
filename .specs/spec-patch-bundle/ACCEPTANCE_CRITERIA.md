# Acceptance Criteria

## AC-1.1: Unified diff with hunks and context

**GIVEN** a bundle that changes three documents
**WHEN** the preview is requested
**THEN** each document SHALL carry `@@` hunk headers with line counts, three lines of context, and an order by document name
**AND** applying the bundle SHALL produce bytes identical to the concatenated preview

## AC-2.1: Section-end append

**GIVEN** a document with a named section followed by another heading
**WHEN** `append_to_section` is applied to that section
**THEN** the text SHALL land immediately before the following heading and no other byte SHALL change

## AC-2.2: Keyed bullet upsert is idempotent

**GIVEN** a section that already contains a bullet for a key
**WHEN** the same upsert is applied twice
**THEN** the second application SHALL leave the document byte-identical and the bullet SHALL exist once

## AC-3.1: Ordered operations on one document

**GIVEN** two operations targeting the same document in one bundle
**WHEN** the bundle is applied
**THEN** both SHALL apply in array order in one transaction
**AND** a bundle whose second operation misses its selector SHALL change nothing and name the failing index

## AC-4.1: Explicit preview truncation

**GIVEN** a document whose diff exceeds the per-document budget
**WHEN** the preview is requested
**THEN** the envelope SHALL report the truncation flag, the byte budget and the affected line ranges

## AC-5.1: Create with authored documents

**GIVEN** a create intent carrying initial document contents
**WHEN** the intent is applied
**THEN** the specification SHALL exist with those bytes and no second call SHALL be required

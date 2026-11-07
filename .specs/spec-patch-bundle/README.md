# Patch Bundle

Status: DRAFT

Release 3.4.0, wave 1b of issue #51. One edit call SHALL express a whole authoring change and return one reviewable diff. The bundle already exists in a reduced form: several documents per call, one operation per document, no hunks and no context in the preview.

This specification owns: the preview diff format, the public section operation set, ordered operations on one document, explicit truncation reporting, and creating a specification together with its authored documents.

It does not own: the transaction and write lock (`spec-mcp-operations`), the design review gate for scenarios (`spec-mcp-operations`), or local resolution (`spec-local-corpus-mode`).

## Public states

- **DRAFT.** Today the preview field named `unifiedDiff` carries `--- before` and `+++ after` plus positional `-` and `+` lines with no hunks and no context, and a truncated preview is indistinguishable from a complete one. One operation per document is enforced by the server, so a second edit of the same document needs a second call.
- **Dependency:** this wave consumes the vocabulary already present in the authoring path (`insert_after_heading`, `replace_section`, `replace_in_section`), and adds only what is missing from the public set.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-patch-bundle.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-patch-bundle:FR-1`.

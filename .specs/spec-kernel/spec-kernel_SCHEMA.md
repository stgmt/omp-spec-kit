# Spec Kernel Schema

This is one core schema. Historical released carriers are decode-only compatibility boundaries; they are not parallel runtimes.

## SCHEMA-1: Source and occurrence model

`SourceDocument` is `{path, specSlug, documentKind, bytes, sha256}`. The fifteen canonical document names are `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<spec-slug>.feature`, `FIXTURES.md`, and `<spec-slug>_SCHEMA.md`.

Each parsed source produces occurrence records before indexes:

- `DefinitionOccurrence`: occurrence ID, spec slug, local ID, canonical ID or null, node kind or null, source span, bounded title/body, and `UNIQUE | AMBIGUOUS | REJECTED` outcome;
- `ReferenceOccurrence`: occurrence ID, source canonical ID, raw target, requested edge type, span, and exactly one `RESOLVED | UNRESOLVED` outcome;
- `Node`: qualified canonical ID, kind, title, source, body, attributes, and content hash;
- `ResolvedEdge`: occurrence ID, from, to, type, and span;
- `Diagnostic`: occurrence ID, closed code, severity, bounded sanitized message, remediation, safe span, and related identity.

Canonical IDs are `<spec-slug>:<local-id>`; local IDs are case-sensitive and never fuzzy-matched. A duplicate group retains every candidate, elects no node, and makes incoming references unresolved as ambiguous. A resolved edge must have existing permitted endpoints. All occurrence arrays and diagnostics are sorted by schema keys.

## SCHEMA-2: Four internal primitives

The core has exactly four internal primitives:

| Primitive | Input | Result |
|---|---|---|
| `inventory` | supplied source/spec filters | contained document and graph inventory |
| `findNodes` | kind, spec, ID, and bounded text filters | matching node summaries or full nodes |
| `traverse` | start ID, direction, edge filters, depth, visited, and page limits | bounded directed graph walk |
| `diagnostics` | severity, code, spec, path, and view filters | deterministic diagnostics, orphan views, status views, and structural validation views |

These are internal primitives, not an eleven-operation public catalog. They read one immutable graph and expose no mutation, release, authoring, or lifecycle method.

## SCHEMA-3: One cursor/error envelope

Every primitive uses the same envelope:

`CursorEnvelope<T> = { schemaVersion, requestId, primitive, graphFingerprint, filterDigest, ok, page, data, error, diagnostics }`.

`page = { limit, returned, totalMatched, nextCursor, truncated, responseBytes }`. The cursor binds schema version, graph fingerprint, primitive, normalized filters, projection, and last stable sort key; it is opaque, bounded to 512 ASCII bytes, and invalid/stale cursors return typed errors. Hard page limit is 200 and the default is 50. A completed chain is required before claiming exhaustive results.

Errors are closed and bounded: invalid request, unknown primitive, invalid parameter, limit exceeded, invalid/stale cursor, graph invalid/unavailable, not found, ambiguous identity, cancelled, response too large, containment/read failure, and internal invariant failure. Every error carries operation/primitive, parameter, expected constraint, retryability, safe path/identity, and related diagnostic IDs where applicable.

## SCHEMA-4: Limits and containment

The adapter accepts one explicit root and supplies only regular canonical documents under a valid immediate spec slug. It rejects absolute external paths, traversal, symlinks, junctions, reparse/mount substitutions, non-regular files, and unsafe ancestors before opening bytes. Public paths are NFC, slash-separated, repository-relative. The core receives cancellation explicitly and never reads a clock.

Hard limits: 100 specs, 2,000 documents, 2 MiB per document, 50 MiB aggregate bytes, 100,000 definition occurrences, 500,000 reference occurrences, 10,000 diagnostics, traversal depth 8, visited nodes 5,000, page 200, cursor 512 bytes, and response 1 MiB. Callers may choose lower limits only.

## SCHEMA-5: Determinism and fingerprint

Normalize UTF-8 BOM away and CRLF/CR to LF for parsing; normalize paths to NFC slash form; use explicit ASCII/code-point sorting and lexicographically ordered object keys. The fingerprint is SHA-256 over canonical JSON of normalized source-byte hashes, semantic parser schema, and membership-affecting limits, in sorted path order. Nodes, occurrences, edges, and diagnostics use stable schema sort keys. Query/MCP availability, request IDs, transport metadata, host state, and wall-clock values are excluded.

## SCHEMA-6: Compatibility mapping

The v0.3.2 released first slice is **SHIPPED** and preserves these exact MCP names as thin adapters over the core:

| Exact MCP name | Core primitive projection |
|---|---|
| `spec_inventory` | `inventory` |
| `spec_get_node` | `findNodes` exact canonical-ID filter |
| `spec_find_nodes` | `findNodes` |
| `spec_get_edges` | `traverse` depth-one projection |
| `spec_trace` | `traverse` |
| `spec_diagnostics` | `diagnostics` |
| `spec_overview` | `inventory` summary |
| `spec_markdown_inventory` | `inventory` of caller-supplied normalized document occurrences |

Each adapter validates transport input, calls one primitive, and returns the same canonical envelope after removing transport metadata. The names are a preserved compatibility first slice, not an exhaustive future catalog. Historical decoders/serializers and immutable fixture replay may retain released-format fields only.

## SCHEMA-7: Diagnostics views and graph validity

Diagnostic projections include parser errors, duplicate and unresolved-reference outcomes, orphan views, task/status summaries, and structural validation findings. Orphan/status/validation views describe graph structure and traceability only; they are not release eligibility or execution evidence. ERROR diagnostics set `valid=false`; WARNING and INFO do not. Diagnostics never invent nodes or edges to make a graph appear complete.

## SCHEMA-8: Conservation equations

`definitionOccurrences = uniqueDefinitionNodes + ambiguousDefinitionOccurrences + rejectedDefinitionOccurrences`.

`referenceOccurrences = resolvedEdgeOccurrences + unresolvedReferenceOccurrences`.

`discoveredDocuments = acceptedDocuments + rejectedDocuments`.

Every emitted occurrence is present in exactly one corresponding array/outcome, every resolved edge endpoint exists and is permitted, and every diagnostic count reconciles with its severity partition. Any failed equation emits `INVARIANT_VIOLATION` and invalidates the graph.

## SCHEMA-9: Historical boundary and provenance

The current core schema does not promise compatibility with arbitrary historical shapes. Released v0.2/v0.3/v0.3.2 decoders, serializers, and immutable fixture replay may retain compatibility with their released formats only, with claims bound to the existing real-corpus hashes and public receipt references. No historical receipt changes the current graph semantics or fingerprint.

## Read-complete operation projection

The v0.4.0 read-complete projection adds find_by_tags, list_tasks, list_phase_tasks, find_orphans, validate_anchor, list_specs, validate_requirement_metadata, policy_query_requirements, get_archival_proof, validate_spec, get_spec_status, mcp_preflight, list_spec_docs, read_spec_doc, and read_attachment. These fifteen names reuse this graph and its bounded containment rules; they do not create a second graph.

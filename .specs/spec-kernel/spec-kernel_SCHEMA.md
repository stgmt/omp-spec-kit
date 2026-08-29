# Spec Kernel Schema

This document preserves the exhaustive historical `spec-kernel@1` contract and defines the additive, separately gated `spec-kernel@2` capability contract in SCHEMA-14. Fields not listed here are forbidden. JSON names are camelCase. Required fields are always present; unavailable values are represented by `null` only where the type explicitly permits it. Public paths are NFC, `/`-separated, repository-relative, and never absolute.

## SCHEMA-1: Scalar identities

| Type | Grammar / meaning |
|---|---|
| `SpecSlug` | `[a-z0-9]+(?:-[a-z0-9]+)*` from the immediate directory under `.specs/` |
| `AuthoredLocalId` | `US-[1-9][0-9]*`, `UC-[1-9][0-9]*`, `RF-[1-9][0-9]*`, `RISK-[1-9][0-9]*`, `FR-[1-9][0-9]*`, `NFR-[A-Z][A-Z0-9-]*-[1-9][0-9]*`, `AC-[1-9][0-9]*\.[1-9][0-9]*`, `DEC-[1-9][0-9]*`, `TASK-[1-9][0-9]*`, `FC-[1-9][0-9]*`, `FIXTURE-[1-9][0-9]*`, `SCHEMA-[1-9][0-9]*`, or `SCEN-[a-z0-9]+(?:-[a-z0-9]+)*` |
| `GeneratedLocalId` | `DOC:<canonical-filename>` or `FILE:<normalized-repository-relative-path>` |
| `LocalId` | `AuthoredLocalId | GeneratedLocalId` |
| `CanonicalId` | `<SpecSlug>:<LocalId>`; split only on the first `:` |
| `OccurrenceId` | lowercase hex SHA-256 of canonical JSON `{path,startOffset,ordinal,kind,rawIdOrTarget}` |
| `GraphFingerprint` | lowercase 64-character SHA-256 hex |
| `Cursor` | opaque base64url ASCII, at most 512 bytes |
| `AnchorAlgorithmVersionV1` | literal `glfm-anchor@1` |
| `RewriteKey` | lowercase hex SHA-256 of canonical JSON `{path,startOffset,endOffset}` for one authored destination span |
| `ReleaseVersion` | canonical SemVer 2.0.0 string with no leading `v` |
| `KernelReleaseStage` | closed union `"v0.2" | "v0.3"` |
| `KernelEvidenceProfile` | closed union `"kernel-v0.2" | "kernel-v0.3"` |

IDs are case-sensitive. No trimming, zero-padding, percent-decoding, case correction, or fuzzy matching occurs.

## SCHEMA-2: Canonical documents

| `DocumentKind` | Required filename | Definition kinds allowed |
|---|---|---|
| `README` | `README.md` | none |
| `USER_STORIES` | `USER_STORIES.md` | `USER_STORY` (`US-N`) |
| `USE_CASES` | `USE_CASES.md` | `USE_CASE` (`UC-N`) |
| `RESEARCH` | `RESEARCH.md` | `RESEARCH_FINDING` (`RF-N`), `RISK` (`RISK-N`) |
| `REQUIREMENTS` | `REQUIREMENTS.md` | none; matrices are reference projections |
| `FUNCTIONAL_REQUIREMENTS` | `FR.md` | `FUNCTIONAL_REQUIREMENT` (`FR-N`) |
| `NON_FUNCTIONAL_REQUIREMENTS` | `NFR.md` | `NON_FUNCTIONAL_REQUIREMENT` (`NFR-<CATEGORY>-N`) |
| `ACCEPTANCE_CRITERIA` | `ACCEPTANCE_CRITERIA.md` | `ACCEPTANCE_CRITERION` (`AC-N.M`) |
| `DESIGN` | `DESIGN.md` | `DECISION` (`DEC-N`) |
| `TASKS` | `TASKS.md` | `TASK` (`TASK-N`) |
| `FILE_CHANGES` | `FILE_CHANGES.md` | `FILE_CHANGE` (`FC-N`); referenced paths generate `FILE` nodes |
| `CHANGELOG` | `CHANGELOG.md` | none |
| `FEATURE` | `<spec-slug>.feature` | `SCENARIO` from `@id:SCEN-...` |
| `FIXTURES` | `FIXTURES.md` | `FIXTURE` (`FIXTURE-N`) |
| `SCHEMA` | `<spec-slug>_SCHEMA.md` | `SCHEMA_ENTITY` (`SCHEMA-N`) |

Every accepted document also creates one `DOCUMENT` node with local ID `DOC:<filename>` and a `DECLARES` edge occurrence to each unique definition it contains. Unsupported names are `UNSUPPORTED_DOCUMENT`; case variants are not aliases.

Definition recognition is selected by `DocumentKind` before any heading production is matched. For the three shared requirement/task roles, the closed productions outside code are:

| Document kind | Accepted definition headings | Explicitly non-defining headings |
|---|---|---|
| `FUNCTIONAL_REQUIREMENTS` (`FR.md`) | ATX level 2 `## FR-N: <non-empty title>` or `## FR-N — <non-empty title>` | bare `FR-N`, other separators/levels, and every `FR-N` heading outside `FR.md` |
| `ACCEPTANCE_CRITERIA` (`ACCEPTANCE_CRITERIA.md`) | ATX level 2 or 3 `AC-N.M: <non-empty title>`, `AC-N.M — <non-empty title>`, or the bare exact heading `AC-N.M` | suffix/prose after a bare ID, other separators, and every `AC-N.M` heading outside `ACCEPTANCE_CRITERIA.md` |
| `TASKS` (`TASKS.md`) | ATX level 2 `## TASK-N: <non-empty title>` or `## TASK-N — <non-empty title>` | bare `TASK-N`, other separators/levels, and every `TASK-N` heading outside `TASKS.md` |

The em dash is literal U+2014 with one ASCII space on each side; the colon is followed by one ASCII space. A bare acceptance heading derives `title` from its exact local ID so the public node title remains non-empty. Same-looking IDs in another canonical document—including the `FR-N` grouping headings in product `ACCEPTANCE_CRITERIA.md` and IDs in requirement/task matrices—remain ordinary `MarkdownHeadingOccurrence` or reference prose and do not create a `DefinitionOccurrence`. A malformed candidate in the owning document yields the applicable typed diagnostic; arbitrary prose and grouping headings are never promoted heuristically.

## SCHEMA-3: Source and occurrence records

### `SourceSpan`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `path` | string | yes | Repository-relative canonical document path |
| `startLine` | integer ≥1 | yes | Inclusive 1-based line |
| `startColumn` | integer ≥1 | yes | Inclusive Unicode-scalar column |
| `endLine` | integer ≥1 | yes | End line |
| `endColumn` | integer ≥1 | yes | End-exclusive Unicode-scalar column |
| `startOffset` | integer ≥0 | yes | Inclusive normalized UTF-8 byte offset |
| `endOffset` | integer ≥0 | yes | End-exclusive normalized UTF-8 byte offset |

### `SourceDocument`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `path` | string | yes | `.specs/<slug>/<canonical-name>` |
| `specSlug` | `SpecSlug` | yes | Must agree with path |
| `documentKind` | `DocumentKind` | yes | Must agree with filename |
| `bytesBase64` | string | yes | Exact source bytes supplied to pure kernel |
| `sha256` | `GraphFingerprint` | yes | SHA-256 of exact bytes |


### `DefinitionOccurrence`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `occurrenceId` | `OccurrenceId` | yes | Stable occurrence identity |
| `specSlug` | `SpecSlug` | yes | Owning spec |
| `localId` | `LocalId | null` | yes | Null only if rejected before valid ID extraction |
| `canonicalId` | `CanonicalId | null` | yes | Qualified ID when valid |
| `nodeKind` | `NodeKind | null` | yes | Parsed kind when valid |
| `title` | string | yes | Bounded title, empty only for rejected occurrence |
| `body` | string | yes | Normalized body; may be empty |
| `span` | `SourceSpan` | yes | Definition source |
| `attributes` | `NodeAttributes` | yes | Kind-specific closed object |
| `outcome` | `UNIQUE | AMBIGUOUS | REJECTED` | yes | Final build classification |
| `diagnosticIds` | string[] | yes | Sorted associated diagnostic IDs |

### `ReferenceOccurrence`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `occurrenceId` | `OccurrenceId` | yes | Stable reference identity |
| `sourceCanonicalId` | `CanonicalId` | yes | Existing source definition/document identity |
| `rawTarget` | string | yes | Bounded authored target text |
| `requestedEdgeType` | `EdgeType` | yes | Edge semantic requested by syntax |
| `span` | `SourceSpan` | yes | Exact reference source |
| `outcome` | `RESOLVED | UNRESOLVED` | yes | Exactly one outcome |
| `resolvedEdgeId` | `OccurrenceId | null` | yes | Edge ID only when resolved |
| `unresolvedReason` | `UnresolvedReason | null` | yes | Reason only when unresolved |
| `candidateCanonicalIds` | `CanonicalId[]` | yes | Sorted bounded candidates, empty unless relevant |
| `diagnosticIds` | string[] | yes | Sorted associated diagnostics |

### `MarkdownHeadingOccurrence`

This inventory is independent of definition recognition: every accepted canonical Markdown document contributes every GLFM ATX level 1–6 and Setext level 1–2 heading outside fenced/indented code. Ordinary headings with no `LocalId` are retained.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `headingOccurrenceId` | `OccurrenceId` | yes | Stable identity from path, heading start, level, and raw text |
| `path` | string | yes | Owning canonical Markdown document |
| `level` | integer 1..6 | yes | Parsed heading level |
| `syntax` | `ATX | SETEXT` | yes | Authored heading form |
| `rawText` | string | yes | Exact normalized source content of the heading label, before rendered-text extraction |
| `plainText` | string | yes | GLFM-rendered heading text with inline markup removed and character references decoded |
| `anchorAlgorithmVersion` | `AnchorAlgorithmVersionV1` | yes | Anchor contract used |
| `baseAnchor` | string | yes | Anchor candidate before document-local collision allocation |
| `duplicateOrdinal` | integer ≥0 | yes | Smallest selected `N` whose candidate is absent from the complete previously emitted `canonicalAnchor` set |
| `canonicalAnchor` | string | yes | `baseAnchor` when selected ordinal is 0, otherwise `baseAnchor + "-" + duplicateOrdinal` |
| `span` | `SourceSpan` | yes | Exact heading source |
| `sectionSpan` | `SourceSpan` | yes | From heading start through the byte before the next heading of equal/higher level, or document end |

`glfm-anchor@1` derives `plainText` from the parsed GLFM inline tree, decodes character references, removes HTML tags and all Unicode punctuation except `_` and `-`, applies Unicode default lowercase independent of locale, replaces each Unicode whitespace scalar with `-`, and preserves all other scalars in order. It then processes headings in document order. For each heading it tests candidate `baseAnchor` for `N=0`, then `baseAnchor-N` for increasing integers, against the complete set of canonical anchors already emitted for that document; it selects the smallest unused candidate and immediately adds it to the set. `duplicateOrdinal` is that selected `N`, not merely the count of preceding headings with the same base. Conformance vectors SHALL include punctuation, entities, Unicode, empty rendered text, and collision sequences including `Foo`, `Foo`, `Foo-1` → `foo`, `foo-1`, `foo-1-1`; `Foo-1`, `Foo`, `Foo` → `foo-1`, `foo`, `foo-2`; and `Foo`, `Foo-1`, `Foo` → `foo`, `foo-1`, `foo-2`. Every emitted canonical anchor SHALL be pairwise unique. Changing any step requires a new `AnchorAlgorithmVersionV1`.

### `MarkdownLinkOccurrence`

The GLFM parse walks every semantic link node outside code and raw HTML: inline links, full/collapsed/shortcut reference links, and autolinks. Each rendered reference use is one occurrence even when multiple uses share one reference definition destination. Images are not links. Unused reference definitions are not semantic link occurrences.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `linkOccurrenceId` | `OccurrenceId` | yes | Stable semantic-use identity |
| `path` | string | yes | Source Markdown document |
| `syntax` | `INLINE | FULL_REFERENCE | COLLAPSED_REFERENCE | SHORTCUT_REFERENCE | AUTOLINK` | yes | Parsed GLFM link form |
| `labelText` | string | yes | Rendered link label, empty only when GLFM permits |
| `rawDestination` | string | yes | Exact normalized-source destination substring selected by `destinationSpan`, before GLFM escape/entity or URI decoding |
| `normalizedDestination` | string | yes | Deterministic URI/path/fragment representation used for resolution |
| `useSpan` | `SourceSpan` | yes | Exact semantic link-use span |
| `destinationSpan` | `SourceSpan` | yes | Exact replaceable destination source; for a reference use this is the shared definition destination |
| `rewriteKey` | `RewriteKey` | yes | Same value for uses sharing one destination span |
| `sourceHeadingOccurrenceId` | `OccurrenceId | null` | yes | Innermost containing heading section, null for document preamble |
| `outcome` | `INTERNAL_HEADING | INTERNAL_DOCUMENT | EXTERNAL | UNRESOLVED` | yes | Exactly one resolution class |
| `targetPath` | `string | null` | yes | Normalized repository-relative target document for internal outcomes |
| `targetAnchor` | `string | null` | yes | Decoded canonical fragment when authored; null for document-only/external targets |
| `targetHeadingOccurrenceId` | `OccurrenceId | null` | yes | Exact heading only for `INTERNAL_HEADING` |
| `externalScheme` | `string | null` | yes | Lowercase URI scheme only for `EXTERNAL` |
| `unresolvedReason` | `MALFORMED_DESTINATION | TARGET_DOCUMENT_MISSING | TARGET_ANCHOR_MISSING | TARGET_OUTSIDE_CORPUS | AMBIGUOUS_PATH | null` | yes | Non-null only for `UNRESOLVED` |
| `diagnosticIds` | string[] | yes | Sorted associated diagnostics |

Internal path resolution uses the source document directory, NFC `/` normalization, dot-segment removal without root escape, percent-decoding only for URI path/fragment comparison, and exact case-sensitive path and canonical-anchor matching. External URI schemes are never fetched.

## SCHEMA-4: Nodes and attributes

`NodeKind` is the closed union:

`DOCUMENT | USER_STORY | USE_CASE | RESEARCH_FINDING | RISK | FUNCTIONAL_REQUIREMENT | NON_FUNCTIONAL_REQUIREMENT | ACCEPTANCE_CRITERION | DECISION | TASK | FILE_CHANGE | FILE | SCENARIO | FIXTURE | SCHEMA_ENTITY`.

### `Node`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `canonicalId` | `CanonicalId` | yes | Unique graph key |
| `specSlug` | `SpecSlug` | yes | Owner |
| `localId` | `LocalId` | yes | Local identity |
| `kind` | `NodeKind` | yes | Discriminant |
| `title` | string | yes | Normalized title/path label |
| `body` | string | yes | Normalized body; empty for generated nodes |
| `span` | `SourceSpan` | yes | Definition/path declaration source |
| `documentKind` | `DocumentKind` | yes | Source document kind |
| `attributes` | `NodeAttributes` | yes | Exactly the kind-specific object below |
| `contentHash` | `GraphFingerprint` | yes | SHA-256 of canonical node payload excluding this field |

### `NodeAttributes` by `NodeKind`

All listed fields are required for their kind; no additional fields are permitted.

| Kind | Exact attributes |
|---|---|
| `DOCUMENT` | `{ filename: string, byteLength: integer, sourceSha256: GraphFingerprint }` |
| `USER_STORY` | `{ priority: string|null, actor: string|null, goal: string|null, benefit: string|null }` |
| `USE_CASE` | `{ actors: string[], preconditions: string[], postconditions: string[] }` |
| `RESEARCH_FINDING` | `{ evidenceRefs: string[], decision: string|null }` |
| `RISK` | `{ likelihood: string|null, impact: string|null, mitigations: string[] }` |
| `FUNCTIONAL_REQUIREMENT` | `{ normativeText: string }` |
| `NON_FUNCTIONAL_REQUIREMENT` | `{ category: string, normativeText: string, numericBudgets: string[] }` |
| `ACCEPTANCE_CRITERION` | `{ parentLocalId: string, earsText: string }` |
| `DECISION` | `{ rationale: string|null, tradeoff: string|null, alternatives: string[] }` |
| `TASK` | `{ status: "planned"|"todo"|"ready"|"in-progress"|"blocked"|"done"|"deferred"|"unknown", estimate: string|null, owner: string|null, doneWhen: string[] }` |
| `FILE_CHANGE` | `{ action: "create"|"edit"|"delete", planned: boolean, paths: string[] }` |
| `FILE` | `{ path: string, plannedAction: "create"|"edit"|"delete"|"reference" }` |
| `SCENARIO` | `{ featureName: string, scenarioKeyword: "Scenario"|"Scenario Outline", tags: string[], steps: { keyword:string, text:string }[], examples: { headers:string[], rows:string[][] }[] }` |
| `FIXTURE` | `{ fixtureType: "real"|"synthetic", provenanceRef: string|null, sha256: GraphFingerprint|null }` |
| `SCHEMA_ENTITY` | `{ schemaName: string, schemaVersion: string|null }` |

The closed authored status spellings present in the canonical corpus normalize as `Planned` → `planned`, `todo` → `todo`, and `Completed` → `done`; already-canonical lowercase enum values are preserved and an unrecognized label becomes `unknown`. In particular, the kernel never coerces `planned` to `todo` or drops `todo`. The external authoring reducer may transition only `todo | ready | in-progress | blocked | done`; `planned` is a distinct non-mutable planning state until a future accepted proposal explicitly defines normalization, and `deferred | unknown` are not reducer inputs.

## SCHEMA-5: Edges and endpoint matrix

`EdgeType` is `REFS | COVERS | TESTED_BY | IMPLEMENTS | DEPENDS_ON | DOCUMENTS | DECLARES`.

### `ResolvedEdge`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `edgeId` | `OccurrenceId` | yes | Same as originating reference occurrence ID |
| `from` | `CanonicalId` | yes | Existing source node |
| `to` | `CanonicalId` | yes | Existing target node |
| `type` | `EdgeType` | yes | Closed semantic |
| `span` | `SourceSpan` | yes | Authored reference source |

### `UnresolvedReason`

`MALFORMED_TARGET | UNQUALIFIED_CROSS_SPEC | MISSING_TARGET | AMBIGUOUS_TARGET | FORBIDDEN_ENDPOINT | REJECTED_SOURCE`.

### Allowed endpoint kinds

| Edge | Allowed from | Allowed to |
|---|---|---|
| `REFS` | any node | any node |
| `COVERS` | `ACCEPTANCE_CRITERION`, `USE_CASE`, `USER_STORY` | `FUNCTIONAL_REQUIREMENT`, `NON_FUNCTIONAL_REQUIREMENT` |
| `TESTED_BY` | `FUNCTIONAL_REQUIREMENT`, `NON_FUNCTIONAL_REQUIREMENT`, `ACCEPTANCE_CRITERION` | `SCENARIO` |
| `IMPLEMENTS` | `TASK`, `FILE_CHANGE`, `FILE` | `FUNCTIONAL_REQUIREMENT`, `NON_FUNCTIONAL_REQUIREMENT`, `ACCEPTANCE_CRITERION` |
| `DEPENDS_ON` | `TASK` | `TASK` |
| `DOCUMENTS` | `RESEARCH_FINDING`, `DECISION`, `FILE_CHANGE`, `FIXTURE`, `SCHEMA_ENTITY` | any node except `DOCUMENT` |
| `DECLARES` | `DOCUMENT` | any non-`DOCUMENT` node |

An edge outside this table is unresolved as `FORBIDDEN_ENDPOINT`; it never enters `edges`.

## SCHEMA-6: Diagnostics

`DiagnosticSeverity` is `ERROR | WARNING | INFO`.

`DiagnosticCode` is the closed union:

`UNSUPPORTED_DOCUMENT | INVALID_UTF8 | HASH_MISMATCH | FILE_TOO_LARGE | CORPUS_LIMIT_EXCEEDED | INVALID_SPEC_SLUG | PATH_MISMATCH | PATH_ESCAPE | SYMLINK_REJECTED | NON_REGULAR_FILE | IO_READ_FAILED | UNSUPPORTED_GHERKIN_DIALECT | MALFORMED_GHERKIN | MISSING_SCENARIO_ID | DUPLICATE_SCENARIO_ID_TAG | MALFORMED_HEADING | INVALID_LOCAL_ID | ID_NOT_ALLOWED_IN_DOCUMENT | DUPLICATE_DEFINITION | MALFORMED_REFERENCE | UNQUALIFIED_CROSS_SPEC_REFERENCE | BROKEN_REFERENCE | AMBIGUOUS_REFERENCE | FORBIDDEN_EDGE_ENDPOINT | MALFORMED_MARKDOWN_LINK | BROKEN_MARKDOWN_LINK | INVALID_AC_PARENT | INVARIANT_VIOLATION | DIAGNOSTIC_LIMIT_REACHED`.

### `Diagnostic`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `diagnosticId` | `OccurrenceId` | yes | Hash of code, span, canonical ID, and related spans |
| `code` | `DiagnosticCode` | yes | Closed machine code |
| `severity` | `DiagnosticSeverity` | yes | ERROR invalidates graph |
| `message` | string | yes | Bounded sanitized explanation |
| `remediation` | string | yes | Closed stable remediation key, e.g. `use-qualified-id` |
| `span` | `SourceSpan | null` | yes | Safe primary location or null |
| `relatedSpans` | `SourceSpan[]` | yes | Stable bounded supporting locations |
| `specSlug` | `SpecSlug | null` | yes | Owning spec when known |
| `localId` | `LocalId | null` | yes | Local ID when known |
| `canonicalId` | `CanonicalId | null` | yes | Qualified ID when known |
| `referenceOccurrenceId` | `OccurrenceId | null` | yes | Related reference when applicable |
| `details` | `{ expected:string|null, actual:string|null, limitName:string|null, limitValue:integer|null, observedValue:integer|null }` | yes | Exhaustive sanitized detail object |

Stable diagnostic sort: severity rank `ERROR`, `WARNING`, `INFO`; then `code`, `span.path|null`, `span.startOffset|null`, `canonicalId|null`, `diagnosticId`.

## SCHEMA-7: Immutable graph snapshot

### `GraphCounts`

All fields are required non-negative integers:

`discoveredDocuments`, `acceptedDocuments`, `rejectedDocuments`, `definitionOccurrences`, `uniqueDefinitionNodes`, `ambiguousDefinitionOccurrences`, `rejectedDefinitionOccurrences`, `referenceOccurrences`, `resolvedEdgeOccurrences`, `unresolvedReferenceOccurrences`, `markdownHeadingOccurrences`, `markdownLinkOccurrences`, `markdownInternalHeadingLinks`, `markdownInternalDocumentLinks`, `markdownExternalLinks`, `markdownUnresolvedLinks`, `markdownRewriteSites`, `generatedDocumentNodes`, `generatedFileNodes`, `diagnosticsError`, `diagnosticsWarning`, `diagnosticsInfo`.

### `GraphLimits`

Required integer fields: `maxSpecs`, `maxDocuments`, `maxBytesPerDocument`, `maxAggregateBytes`, `maxPathBytes`, `maxLinesPerDocument`, `maxDefinitionOccurrences`, `maxReferenceOccurrences`, `maxMarkdownHeadingOccurrences`, `maxMarkdownLinkOccurrences`, `maxDiagnostics`, `defaultPageLimit`, `maxPageLimit`, `defaultTraceDepth`, `maxTraceDepth`, `defaultTraceVisited`, `maxTraceVisited`, `maxSearchScalars`, `maxCursorBytes`, `maxResponseBytes`.

### `GraphSnapshot`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `schemaVersion` | literal `spec-kernel@1` | yes | Public schema |
| `anchorAlgorithmVersion` | `AnchorAlgorithmVersionV1` | yes | Heading-anchor contract |
| `fingerprint` | `GraphFingerprint` | yes | Content/limits fingerprint |
| `valid` | boolean | yes | False iff any ERROR or invariant failure |
| `limits` | `GraphLimits` | yes | Effective limits |
| `counts` | `GraphCounts` | yes | Conservation counters |
| `documents` | `{path:string,specSlug:SpecSlug,documentKind:DocumentKind,sha256:GraphFingerprint,byteLength:integer,accepted:boolean,diagnosticIds:string[]}[]` | yes | All discovered canonical candidates |
| `definitionCandidates` | `DefinitionOccurrence[]` | yes | Every definition occurrence, including unique/rejected |
| `nodes` | `Node[]` | yes | Unique nodes plus generated document/file nodes |
| `referenceOccurrences` | `ReferenceOccurrence[]` | yes | Every reference occurrence |
| `markdownHeadingOccurrences` | `MarkdownHeadingOccurrence[]` | yes | Every heading in accepted canonical Markdown |
| `markdownLinkOccurrences` | `MarkdownLinkOccurrence[]` | yes | Every semantic GLFM link use |
| `edges` | `ResolvedEdge[]` | yes | Resolved edge occurrences |
| `diagnostics` | `Diagnostic[]` | yes | Stable diagnostics |

Canonical sort: documents by path; candidates by canonicalId/null then span; nodes by canonicalId; references/edges by span then occurrence ID; Markdown headings by `span.path`, `span.startOffset`, `headingOccurrenceId`; Markdown links by `useSpan.path`, `useSpan.startOffset`, `linkOccurrenceId`; diagnostics by the diagnostic sort above. Canonical JSON sorts object keys lexicographically.

### Conservation invariants

```text
discoveredDocuments
  = acceptedDocuments + rejectedDocuments

definitionOccurrences
  = uniqueDefinitionNodes
  + ambiguousDefinitionOccurrences
  + rejectedDefinitionOccurrences

referenceOccurrences
  = resolvedEdgeOccurrences + unresolvedReferenceOccurrences

counts.markdownHeadingOccurrences
  = snapshot.markdownHeadingOccurrences.length

counts.markdownLinkOccurrences
  = counts.markdownInternalHeadingLinks
  + counts.markdownInternalDocumentLinks
  + counts.markdownExternalLinks
  + counts.markdownUnresolvedLinks
  = snapshot.markdownLinkOccurrences.length
```

`uniqueDefinitionNodes` excludes generated `DOCUMENT`/`FILE` nodes. Each ambiguous canonical ID has at least two candidates and no elected node. Every resolved edge endpoint exists and is allowed by the endpoint matrix. Every accepted Markdown heading has one heading occurrence. Every semantic GLFM link use has one link occurrence and exactly one outcome; `markdownRewriteSites` is the cardinality of distinct `rewriteKey` values and cannot exceed `markdownLinkOccurrences`.

## SCHEMA-8: Query request

### Common `QueryRequest`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `schemaVersion` | literal `spec-kernel@1` | yes | Requested contract |
| `requestId` | string|null | yes | Caller value echoed, max 128 scalars; null allowed |
| `operation` | `QueryOperation` | yes | Discriminant |
| `args` | operation-specific object | yes | Exact shape below |

`QueryOperation` is `inventory | getNode | findNodes | getEdges | trace | diagnostics | overview | markdownInventory`. These eight are the **v0.2 first slice**. Later [FR-16](FR.md#fr-16-generator-port-read-operations-beyond-the-eight) query members are `listSpecs`, `findByTags`, `listTasks`, `listPhaseTasks`, `findOrphans`, `validateAnchor`, `policyQuery`, `validateRequirementMetadata`, `archivalProof`, `validateSpec`, and `specStatus`; they are not v0.2 required members. [FR-17](FR.md#fr-17-mcp-adapter-document-and-preflight-io-not-a-v02v03-release-member) `list_spec_docs`, `read_spec_doc`, `read_attachment`, and `mcp_preflight` are MCP adapter I/O, not `QueryOperation` values.

### Operation `args`

| Operation | Exact fields (all required unless `?`) |
|---|---|
| `inventory` | `{ specSlugs: SpecSlug[], includeDocuments:boolean, limit:integer, cursor:Cursor|null }` |
| `getNode` | `{ canonicalId:CanonicalId, projection:"summary"|"full", includeIncidentCounts:boolean }` |
| `findNodes` | `{ specSlugs:SpecSlug[], kinds:NodeKind[], canonicalIds:CanonicalId[], text:string|null, projection:"summary"|"full", limit:integer, cursor:Cursor|null }` |
| `getEdges` | `{ canonicalId:CanonicalId, direction:"in"|"out"|"both", types:EdgeType[], aggregate:boolean, limit:integer, cursor:Cursor|null }` |
| `trace` | `{ canonicalId:CanonicalId, direction:"in"|"out"|"both", types:EdgeType[], maxDepth:integer, maxVisited:integer, projection:"summary"|"full", limit:integer, cursor:Cursor|null }` |
| `diagnostics` | `{ severities:DiagnosticSeverity[], codes:DiagnosticCode[], specSlugs:SpecSlug[], paths:string[], limit:integer, cursor:Cursor|null }` |
| `overview` | `{ specSlugs:SpecSlug[] }` |
| `markdownInventory` | `{ specSlugs:SpecSlug[], mode:"all"|"focus", focusPath:string|null, focusAnchor:string|null, direction:"in"|"out"|"both", outcomes:("INTERNAL_HEADING"|"INTERNAL_DOCUMENT"|"EXTERNAL"|"UNRESOLVED")[], includeHeadings:boolean, includeLinks:boolean, limit:integer, cursor:Cursor|null }` |
Empty filter arrays mean “all.” Unknown fields or missing required fields are invalid. `limit` must be 1 through `maxPageLimit`. For `markdownInventory`, `mode="all"` requires null focus fields and `direction="both"`; `mode="focus"` requires one normalized canonical Markdown `focusPath` and a non-null exact `focusAnchor` (the empty string is valid when `glfm-anchor@1` produces it). At least one include flag must be true. Focused `in` selects links whose `targetHeadingOccurrenceId` is the focused heading; focused `out` selects every link whose `useSpan` is contained by the focused heading’s `sectionSpan`, including nested subsection headings; `both` is their set union by `linkOccurrenceId`. A missing focus heading returns `HEADING_NOT_FOUND`.

The only focused result eligible to support a complete rename plan uses `direction="both"`, `outcomes=[]`, `includeHeadings=true`, and `includeLinks=true`, then consumes the entire cursor chain. Other filters remain valid read queries but SHALL report no completeness claim.

## SCHEMA-9: Exhaustive query result envelope

No result field exists outside this section.

### `QueryEnvelope`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `schemaVersion` | literal `spec-kernel@1` | yes | Response schema |
| `requestId` | string|null | yes | Echoed caller ID |
| `operation` | `QueryOperation|string` | yes | Echoed normalized operation, raw bounded string if unknown |
| `ok` | boolean | yes | Success discriminator |
| `graph` | `QueryGraphMeta|null` | yes | Present once request reaches a graph; null for pre-graph validation error |
| `page` | `QueryPage|null` | yes | Present for paged success; null otherwise |
| `data` | `QueryData|null` | yes | Present only when `ok=true` |
| `error` | `QueryError|null` | yes | Present only when `ok=false` |
| `diagnostics` | `DiagnosticSummary[]` | yes | Bounded diagnostics relevant to this request; never full arbitrary bodies |

Exactly one of `data` or `error` is non-null.

### `QueryGraphMeta`

| Field | Type | Required |
|---|---|---:|
| `schemaVersion` | literal `spec-kernel@1` | yes |
| `fingerprint` | `GraphFingerprint` | yes |
| `valid` | boolean | yes |
| `specCount` | integer | yes |
| `documentCount` | integer | yes |
| `nodeCount` | integer | yes |
| `edgeOccurrenceCount` | integer | yes |
| `unresolvedReferenceCount` | integer | yes |
| `markdownHeadingOccurrenceCount` | integer | yes |
| `markdownLinkOccurrenceCount` | integer | yes |
| `diagnosticCount` | integer | yes |

### `QueryPage`

| Field | Type | Required |
|---|---|---:|
| `limit` | integer | yes |
| `returned` | integer | yes |
| `totalMatched` | integer | yes |
| `cursor` | `Cursor|null` | yes |
| `nextCursor` | `Cursor|null` | yes |
| `truncated` | boolean | yes |
| `responseBytes` | integer | yes |

### Shared summaries

`SourceSummary` exact fields: `{ path:string, startLine:integer, startColumn:integer, endLine:integer, endColumn:integer }`.

`NodeSummary` exact fields: `{ canonicalId:CanonicalId, specSlug:SpecSlug, localId:LocalId, kind:NodeKind, title:string, source:SourceSummary, contentHash:GraphFingerprint, excerpt:string|null, incidentInCount:integer|null, incidentOutCount:integer|null }`.

`EdgeSummary` exact fields: `{ edgeId:OccurrenceId|null, from:CanonicalId, to:CanonicalId, type:EdgeType, source:SourceSummary|null, occurrenceCount:integer }`. `edgeId`/`source` are null only for aggregate rows.

`DiagnosticSummary` exact fields: `{ diagnosticId:OccurrenceId, code:DiagnosticCode, severity:DiagnosticSeverity, message:string, remediation:string, source:SourceSummary|null, canonicalId:CanonicalId|null }`.

`CandidateSummary` exact fields: `{ occurrenceId:OccurrenceId, canonicalId:CanonicalId|null, kind:NodeKind|null, title:string, source:SourceSummary, diagnosticIds:string[] }`.

`MarkdownHeadingSummary` exact fields: `{ headingOccurrenceId:OccurrenceId, path:string, level:integer, syntax:"ATX"|"SETEXT", plainText:string, anchorAlgorithmVersion:AnchorAlgorithmVersionV1, baseAnchor:string, duplicateOrdinal:integer, canonicalAnchor:string, source:SourceSummary, section:SourceSummary }`.

`MarkdownLinkSummary` exact fields: `{ linkOccurrenceId:OccurrenceId, path:string, syntax:"INLINE"|"FULL_REFERENCE"|"COLLAPSED_REFERENCE"|"SHORTCUT_REFERENCE"|"AUTOLINK", labelText:string, rawDestination:string, normalizedDestination:string, useSource:SourceSummary, destinationSource:SourceSummary, rewriteKey:RewriteKey, sourceHeadingOccurrenceId:OccurrenceId|null, outcome:"INTERNAL_HEADING"|"INTERNAL_DOCUMENT"|"EXTERNAL"|"UNRESOLVED", targetPath:string|null, targetAnchor:string|null, targetHeadingOccurrenceId:OccurrenceId|null, externalScheme:string|null, unresolvedReason:string|null, diagnosticIds:string[] }`.

`MarkdownInventoryItem` is exactly `{ kind:"heading", heading:MarkdownHeadingSummary }` or `{ kind:"link", relation:"INBOUND"|"OUTBOUND"|"BOTH"|"UNSCOPED", link:MarkdownLinkSummary }`.

`MarkdownInventoryTotals` exact fields: `{ allHeadings:integer, allLinks:integer, allInternalHeadingLinks:integer, allInternalDocumentLinks:integer, allExternalLinks:integer, allUnresolvedLinks:integer, allRewriteSites:integer, matchedHeadings:integer, matchedLinks:integer, matchedRewriteSites:integer }`. `all*` fields are unfiltered graph counts; `matched*` fields are counts after request filters and before pagination.

For `markdownInventory`, `QueryPage.totalMatched = matchedHeadings + matchedLinks`. Across a complete cursor chain with one fingerprint/filter digest, the sum of `returned` equals `totalMatched`, every matched heading/link occurrence ID appears exactly once, totals are byte-identical on every page, and `nextCursor=null` iff the chain is complete.

### `QueryData` by operation

Each success `data` is exactly one object below with matching `kind`.

| Kind | Exact fields |
|---|---|
| `inventory` | `{ kind:"inventory", specs:SpecInventory[], totals:InventoryTotals }` |
| `node` | `{ kind:"node", node:NodeSummary|Node, incomingCount:integer|null, outgoingCount:integer|null }` |
| `nodes` | `{ kind:"nodes", nodes:(NodeSummary|Node)[] }` |
| `edges` | `{ kind:"edges", edges:EdgeSummary[] }` |
| `trace` | `{ kind:"trace", start:CanonicalId, nodes:(NodeSummary|Node)[], edges:EdgeSummary[], frontier:CanonicalId[], maxDepthReached:integer, visitedCount:integer, cycleEdges:OccurrenceId[] }` |
| `diagnostics` | `{ kind:"diagnostics", items:Diagnostic[] }` |
| `overview` | `{ kind:"overview", counts:GraphCounts, limits:GraphLimits, diagnosticCodes:{code:DiagnosticCode,severity:DiagnosticSeverity,count:integer}[], nodeKinds:{kind:NodeKind,count:integer}[], edgeTypes:{type:EdgeType,count:integer}[] }` |
| `markdownInventory` | `{ kind:"markdownInventory", anchorAlgorithmVersion:AnchorAlgorithmVersionV1, focus:{path:string,canonicalAnchor:string,headingOccurrenceId:OccurrenceId}|null, items:MarkdownInventoryItem[], totals:MarkdownInventoryTotals }` |

`SpecInventory` exact fields: `{ specSlug:SpecSlug, valid:boolean, documentCount:integer, missingCanonicalDocuments:DocumentKind[], nodeCount:integer, edgeOccurrenceCount:integer, unresolvedReferenceCount:integer, errorCount:integer, warningCount:integer, infoCount:integer, documents:{path:string,documentKind:DocumentKind,sha256:GraphFingerprint,byteLength:integer,accepted:boolean}[] }`.

`InventoryTotals` exact fields: `{ specCount:integer, validSpecCount:integer, documentCount:integer, nodeCount:integer, edgeOccurrenceCount:integer, unresolvedReferenceCount:integer, errorCount:integer, warningCount:integer, infoCount:integer }`.

For `projection="full"`, arrays contain full `Node`; for `summary`, they contain `NodeSummary`. Mixed projection is forbidden.

## SCHEMA-10: Exhaustive query errors

`QueryErrorCode` is the closed union:

`INVALID_REQUEST | UNSUPPORTED_SCHEMA_VERSION | UNKNOWN_OPERATION | UNKNOWN_FIELD | MISSING_FIELD | INVALID_PARAMETER | LIMIT_EXCEEDED | INVALID_CURSOR | STALE_CURSOR | GRAPH_UNAVAILABLE | GRAPH_INVALID | NOT_FOUND | AMBIGUOUS_ID | HEADING_NOT_FOUND | RESPONSE_TOO_LARGE | CANCELLED | ADAPTER_CONTAINMENT_ERROR | ADAPTER_READ_ERROR | INTERNAL_INVARIANT_ERROR`.

### `QueryError`

Every error has every field below; non-applicable nullable values are `null` and arrays are empty.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `code` | `QueryErrorCode` | yes | Closed machine code |
| `message` | string | yes | Sanitized, at most 1,024 scalars |
| `operation` | `QueryOperation|string|null` | yes | Operation or bounded raw value |
| `parameter` | string|null | yes | Invalid/missing field path |
| `receivedType` | string|null | yes | JSON type, never full secret value |
| `receivedSummary` | string|null | yes | Redacted bounded summary |
| `expected` | string|null | yes | Expected grammar/range/type |
| `limitName` | string|null | yes | Limit identifier |
| `limitValue` | integer|null | yes | Effective limit |
| `observedValue` | integer|null | yes | Observed size/count |
| `specSlug` | `SpecSlug|null` | yes | Related spec |
| `localId` | `LocalId|null` | yes | Related local ID |
| `canonicalId` | `CanonicalId|null` | yes | Related canonical ID |
| `path` | string|null | yes | Repository-relative safe path |
| `anchor` | string|null | yes | Related canonical Markdown anchor |
| `headingOccurrenceId` | `OccurrenceId|null` | yes | Related heading occurrence |
| `linkOccurrenceId` | `OccurrenceId|null` | yes | Related semantic link occurrence |
| `rewriteKey` | `RewriteKey|null` | yes | Related destination rewrite site |
| `candidates` | `CandidateSummary[]` | yes | Bounded ambiguity candidates |
| `diagnosticIds` | string[] | yes | Related diagnostics |
| `retryable` | boolean | yes | Whether same request may succeed after external change/cancel reset |
| `causeCode` | `DiagnosticCode|null` | yes | Kernel/adapter diagnostic source |

Error ordering precedence when multiple validations fail: schema version, request shape, operation, unknown/missing fields, parameter types/grammars, limits, cursor, graph availability/validity, identity cardinality, focused heading existence, response size, cancellation, internal invariant. One request returns the first error by this precedence plus relevant diagnostic summaries.

## SCHEMA-11: Read-only MCP mapping

| MCP tool | Query operation | Input |
|---|---|---|
| `spec_inventory` | `inventory` | exact `inventory` args plus `schemaVersion`, `requestId` |
| `spec_get_node` | `getNode` | exact `getNode` args plus common fields |
| `spec_find_nodes` | `findNodes` | exact `findNodes` args plus common fields |
| `spec_get_edges` | `getEdges` | exact `getEdges` args plus common fields |
| `spec_trace` | `trace` | exact `trace` args plus common fields |
| `spec_diagnostics` | `diagnostics` | exact `diagnostics` args plus common fields |
| `spec_overview` | `overview` | exact `overview` args plus common fields |
| `spec_markdown_inventory` | `markdownInventory` | exact `markdownInventory` args plus common fields |

Each tool returns exactly one `QueryEnvelope` as structured content. MCP transport request IDs, protocol metadata, logs, and errors are not added to the canonical envelope. There are no mutation tools. This table is the **v0.3 first-slice** eight-tool mapping. Later FR-16 query operations and FR-17 adapter I/O grow MCP; they SHALL NOT delete these eight names.

## SCHEMA-12: Stable ordering

- Specs: `specSlug` ascending ASCII.
- Documents: `path` ascending Unicode code point after NFC.
- Nodes: `canonicalId` ascending.
- Non-aggregate edges: `from`, `to`, `type`, `source.path`, `source.startOffset`, `edgeId`.
- Aggregate edges: `from`, `to`, `type`.
- Markdown headings: `span.path`, `span.startOffset`, `headingOccurrenceId`.
- Markdown links: `useSpan.path`, `useSpan.startOffset`, `linkOccurrenceId`.
- Markdown inventory union: source path, source start offset, kind rank `heading` then `link`, occurrence ID; focused relation does not change the key.
- Trace: breadth-first depth, then canonical node ID; edge ordering as above.
- Candidates: `source.path`, `source.startOffset`, `occurrenceId`.
- Diagnostics: rule in SCHEMA-6.
- Count summaries: enum declaration order, not observed insertion order.

Pagination applies after filtering and stable sort. Cursors are bound to graph fingerprint, operation, normalized filters, projection, and the last sort key.

## SCHEMA-13: Kernel release evidence and eligibility

`KernelEvidenceRequirementId` is the closed union `FR-1 | FR-2 | FR-3 | FR-4 | FR-5 | FR-6 | FR-7 | FR-8 | FR-9 | FR-10 | FR-11 | FR-12 | FR-13`.

`V02MandatoryKernelCheckId` is the closed union `CHK-FR1-01 | CHK-FR2-01 | CHK-FR3-01 | CHK-FR4-01 | CHK-FR5-01 | CHK-FR6-01 | CHK-FR7-01 | CHK-FR8-01 | CHK-FR10-01 | CHK-FR11-01 | CHK-FR12-01 | CHK-FR13-01`.

`V03McpAdapterCheckId` is the closed union `CHK-FR9-01 | CHK-FR10-01 | CHK-FR12-01`: FR-9 proves service parity and the exact read-only registry, while the v0.3 instances of FR-10 and FR-12 prove the MCP-inclusive installed package and budgets.

`V03MandatoryKernelCheckId` is the closed union `V02MandatoryKernelCheckId | CHK-FR9-01`. `MandatoryKernelCheckId` is the union of both profiles. Callers cannot supply, narrow, or extend a required-check list.

| `targetStage` | `evidenceProfile` | Exact required checks | Prior-stage rule |
|---|---|---|---|
| `v0.2` | `kernel-v0.2` | every `V02MandatoryKernelCheckId`, exactly once; `CHK-FR9-01` is forbidden wrong-profile evidence | `acceptedV02Input=null`; candidate version is `0.2.x` |
| `v0.3` | `kernel-v0.3` | every `V03MandatoryKernelCheckId`, exactly once, including every `V03McpAdapterCheckId` at v0.3 scope | a hash-valid re-evaluated eligible v0.2 input is required; candidate version is `0.3.x` |

`CHK-FR10-01` is one stable check identity with a target-stage-defined assertion; its `KernelEvidenceRecord.targetStage`, `packageSurface`, artifact version, and artifact SHA-256 form one binding:

| `targetStage` / profile | Required `packageSurface` | Exact accepted proof |
|---|---|---|
| `v0.2` / `kernel-v0.2` | `OMP_EXTENSION_ONLY` | the dependency-absent installed v0.2 OMP extension package builds a graph and executes a query; no MCP server byte, execution, or evidence is required or accepted for this record |
| `v0.3` / `kernel-v0.3` | `OMP_EXTENSION_AND_MCP` | the installed v0.3 artifact contains both the OMP extension and MCP server, and both execute the shared kernel from that exact v0.3 artifact with ambient dependencies absent |

The check ID is not duplicated or renamed between profiles. A `CHK-FR10-01` record with the other stage, profile, package surface, release line, or artifact binding fails closed as `WRONG_PROFILE` or the more specific stage/artifact binding blocker.

Any missing or unknown `targetStage`/`evidenceProfile`, non-table pair, wrong candidate release line, caller-supplied required-check override, or record from another stage is invalid and produces an ineligible result. Unknown stages and profiles are never inferred or treated as a future-compatible profile.

`EvidenceStatus` is `PASS | FAIL | MISSING | STALE | MISMATCH | WAIVED | PARTIAL | UNVERIFIABLE`.

`EvidenceReference` exact fields: `{ kind:"TEST_REPORT"|"FIXTURE_MANIFEST"|"PACKAGE_REPORT"|"BENCHMARK_REPORT"|"REVIEW_REPORT", path:string, sha256:GraphFingerprint, claim:string }`. `path` is repository-relative, `claim` is 1..1,024 Unicode scalars, and the referenced immutable bytes must hash to `sha256`.

### `KernelEvidenceRecord`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `checkId` | `MandatoryKernelCheckId` | yes | Closed check; it must belong to the selected profile |
| `requirementId` | `KernelEvidenceRequirementId` | yes | Must match the check-number mapping |
| `targetStage` | `KernelReleaseStage` | yes | Must equal the enclosing manifest stage; cross-stage record reuse is rejected |
| `status` | `EvidenceStatus` | yes | Only `PASS` can satisfy a check |
| `evidence` | `EvidenceReference[]` | yes | Non-empty for `PASS`; stable order by kind/path/SHA |
| `artifactVersion` | `ReleaseVersion` | yes | Candidate version exercised and same release line as `targetStage` |
| `artifactSha256` | `GraphFingerprint` | yes | Exact packaged artifact exercised |
| `corpusFingerprint` | `GraphFingerprint | null` | yes | Required and manifest-equal for FR-11 and FR-12; allowed only when the check exercises corpus bytes |
| `fixtureIds` | string[] | yes | Non-empty for FR-11, otherwise exact evidence-declared set |
| `details` | string[] | yes | At most 64 deterministic facts of at most 1,024 scalars each; no timestamps or host-absolute paths |
| `packageSurface` | `"OMP_EXTENSION_ONLY" | "OMP_EXTENSION_AND_MCP" | null` | yes | Non-null only for `CHK-FR10-01`; exact value is selected by `targetStage` |

For v0.2, `CHK-FR10-01` requires `packageSurface=OMP_EXTENSION_ONLY` and exercises only the dependency-absent kernel plus OMP extension package; `CHK-FR12-01` exercises the v0.2 package/budget surface. Neither record depends on MCP bytes or MCP execution. For v0.3, `CHK-FR10-01` requires `packageSurface=OMP_EXTENSION_AND_MCP` and proves both the extension and MCP server execute from the exact enclosing v0.3 artifact; FR-10 and FR-12 are fresh v0.3-bound records over the MCP-inclusive artifact and budgets. A passing v0.2 record, an MCP-inclusive record presented to v0.2, or an extension-only record presented to v0.3 cannot be reused.

### `KernelReleaseEvidenceManifest`

| Field | Type | Required |
|---|---|---:|
| `schemaVersion` | literal `kernel-release-evidence@1` | yes |
| `targetStage` | `KernelReleaseStage` | yes |
| `evidenceProfile` | `KernelEvidenceProfile` | yes |
| `candidateVersion` | `ReleaseVersion` | yes |
| `artifactSha256` | `GraphFingerprint` | yes |
| `v02ParentArtifactSha256` | `GraphFingerprint | null` | yes; null for v0.2, exact accepted v0.2 parent artifact for v0.3 |
| `kernelSchemaVersion` | literal `spec-kernel@1` | yes |
| `anchorAlgorithmVersion` | literal `glfm-anchor@1` | yes |
| `corpusFingerprint` | `GraphFingerprint` | yes |
| `records` | `KernelEvidenceRecord[]` | yes |
| `packageGateCheckId` | literal `CHK-FR10-01` | yes |
| `fixtureGateCheckId` | literal `CHK-FR11-01` | yes |
| `budgetGateCheckId` | literal `CHK-FR12-01` | yes |

`EvidenceDocument` exact fields: `{ path:string, bytesBase64:string, sha256:GraphFingerprint }`. `sha256` is computed from the exact decoded bytes. `V02KernelReleaseEvaluationInput` is an input whose manifest pair is `v0.2`/`kernel-v0.2`, whose `v02ParentArtifactSha256` is null, and whose `acceptedV02Input` is null. `KernelReleaseEvaluationInput` exact fields are `{ schemaVersion:"kernel-release-evaluation-input@1", manifest:KernelReleaseEvidenceManifest, evidenceDocuments:EvidenceDocument[], acceptedV02Input:V02KernelReleaseEvaluationInput|null }`. v0.2 requires `acceptedV02Input=null`. v0.3 requires a non-null input that the evaluator recursively re-evaluates as eligible and whose manifest artifact SHA-256 equals `v02ParentArtifactSha256`; this bounded one-generation nesting is the same-lineage proof. Every distinct `EvidenceReference.path` in each generation must have exactly one matching document in that generation with the same SHA-256; duplicate, missing, extra, undecodable, or hash-mismatched documents block eligibility.

### `KernelReleaseEligibility`

Exact fields: `{ schemaVersion:"kernel-release-eligibility@1", targetStage:KernelReleaseStage|null, evidenceProfile:KernelEvidenceProfile|null, eligible:boolean, candidateVersion:ReleaseVersion, artifactSha256:GraphFingerprint, v02ParentArtifactSha256:GraphFingerprint|null, requiredCheckIds:MandatoryKernelCheckId[], passedCheckIds:MandatoryKernelCheckId[], blocking:{ checkId:MandatoryKernelCheckId|null, code:"MISSING"|"EXTRA"|"DUPLICATE"|"FAILED"|"STALE"|"MISMATCH"|"WAIVED"|"PARTIAL"|"UNVERIFIABLE"|"EMPTY_EVIDENCE"|"EVIDENCE_HASH_MISMATCH"|"ARTIFACT_BINDING_MISMATCH"|"CORPUS_BINDING_MISMATCH"|"GATE_BINDING_MISMATCH"|"UNKNOWN_STAGE"|"UNKNOWN_PROFILE"|"STAGE_PROFILE_MISMATCH"|"STAGE_VERSION_MISMATCH"|"STAGE_BINDING_MISMATCH"|"WRONG_PROFILE"|"V02_BASELINE_MISSING"|"V02_BASELINE_NOT_ELIGIBLE"|"V02_LINEAGE_MISMATCH", evidencePaths:string[] }[], evidenceFingerprint:GraphFingerprint }`.

`eligible` is true iff the recognized stage/profile pair is exact; candidate/record versions match its release line; the multiset of `records[].checkId` equals that profile’s required set exactly; every record is bound to that stage and is `PASS`; every evidence array is non-empty; every referenced evidence document is present exactly once and hash-valid; every record matches the candidate artifact binding; applicable corpus bindings match; `CHK-FR10-01` has the exact stage-selected `packageSurface`; and the package/fixture/budget gate IDs name their required passing records. v0.3 additionally requires the accepted v0.2 input and parent-artifact lineage checks above, plus all `V03McpAdapterCheckId` obligations. v0.2 rejects `CHK-FR9-01`, MCP-inclusive `CHK-FR10-01` evidence, and every MCP dependency; it requires no MCP implementation or evidence.

`requiredCheckIds` uses the selected profile’s declaration order; `passedCheckIds` is the declaration-ordered subset whose single record passes every validation. For an unknown or mismatched stage/profile, `requiredCheckIds` and `passedCheckIds` are empty and the corresponding recognized result field is null. `evidenceFingerprint` is SHA-256 of canonical JSON for the complete current manifest, the sorted current `{path,sha256}` evidence-document index, and for v0.3 the accepted v0.2 input’s evidence fingerprint. `blocking` is sorted by profile declaration order, then code, then evidence path; profile-level blockers with null check ID sort first. Duplicate records do not elect a winner. Eligibility evaluation is pure, creates no readiness evidence, and has no publication-authority field; it cannot clear pending public-init validation or the fail-closed license policy for future or changed imports.

## SCHEMA-14: `spec-kernel@2` capability contract

`spec-kernel@2` is additive and separately gated. It never changes `spec-kernel@1`, `glfm-anchor@1`, historical kernel-v0.2/v0.3 unions, cursors, fingerprints, checks, or receipts.

### V2 identities, profiles, and limits

```ts
type PositiveIntV2=number; // integer >=1, canonical decimal
type KernelSchemaVersionV2="spec-kernel@2";
type AnchorAlgorithmVersionV2="marksman-anchor@2";
type KernelCapabilityProfile="kernel-anchor-migration@1"|"kernel-step-bindings@1"|"kernel-generator-port-reads@1"|"kernel-adapter-io@1";
type DocumentKindV2=DocumentKind|"CAPABILITIES";
type CapabilityLocalIdV2=`CAP-${PositiveIntV2}`|`CAP-${PositiveIntV2}.${PositiveIntV2}`;
type StepBindingLocalIdV2=`STEP:${GraphFingerprint}`;
type AuthoredLocalIdV2=AuthoredLocalId|CapabilityLocalIdV2;
type GeneratedLocalIdV2=GeneratedLocalId|StepBindingLocalIdV2;
type LocalIdV2=AuthoredLocalIdV2|GeneratedLocalIdV2;
type CanonicalIdV2=`${SpecSlug}:${LocalIdV2}`;
type CapabilityCanonicalIdV2=`${SpecSlug}:${CapabilityLocalIdV2}`;
type StepBindingCanonicalIdV2=`step-bindings:${StepBindingLocalIdV2}`;
type NodeKindV2=NodeKind|"STEP_BINDING"|"CAPABILITY";
type EdgeTypeV2=EdgeType|"BINDS_STEP"|"DERIVES_FROM";
type DiagnosticCodeV2=DiagnosticCode|"STEP_UNDEFINED"|"STEP_AMBIGUOUS"|"STEP_PATTERN_UNSUPPORTED"|"STEP_SOURCE_REJECTED"|"CAPABILITY_DANGLING"|"CAPABILITY_ORPHAN"|"SPEC_WITHOUT_CAPABILITY"|"REQUIREMENT_METADATA_INVALID";
interface ResolvedLimitsV2 extends GraphLimits {maxStepDefinitionDocuments:number;maxStepDefinitionBytes:number;maxCapabilityDocuments:number;maxCapabilityNodes:number;maxStepBindingNodes:number;maxAnchorMigrationRows:number}
```

`CAP-N[.M]` uses positive non-zero decimal components and the owning spec slug. A step binding ID hashes canonical `{path,startOffset,patternKind,pattern,regexFlags}`; `regexFlags` is the unique canonical `i?m?s?u?` subset. Distinct flags always produce distinct IDs.

`marksman-anchor@2` lowercases Unicode, drops every scalar except Unicode letters/digits, whitespace and `-`, converts whitespace runs to `-`, collapses repeated `-`, trims ends, and allocates duplicate `base-N` using the smallest unused ordinal. V1/V2 anchors and cursors never mix.

### V2 source documents, metadata, nodes, and occurrences

```ts
interface StepDefinitionDocumentV2 {path:string;bytesBase64:string;sha256:GraphFingerprint}
interface CapabilityDocumentV2 {path:string;specSlug:SpecSlug;documentKind:"CAPABILITIES";bytesBase64:string;sha256:GraphFingerprint}
type VerificationMethodV2="unit"|"integration"|"bdd"|"manual"|"formal"|"none";
type SafetyClassV2="standard"|"safety-critical";
type DeliveryStateV2="specified"|"implemented"|"verified"|"deferred";
interface RequirementMetadataV2 {verificationMethod:VerificationMethodV2;safetyClass:SafetyClassV2;deliveryState:DeliveryStateV2}
type NodeSourceV2=
 | {kind:"CANONICAL_DOCUMENT";documentKind:DocumentKind;path:string;span:SourceSpan}
 | {kind:"STEP_DEFINITION";documentKind:null;path:string;span:SourceSpan}
 | {kind:"CAPABILITY_DOCUMENT";documentKind:"CAPABILITIES";path:string;span:SourceSpan};
interface StepBindingAttributesV2 {runner:"cucumber-js";patternKind:"cucumber-expression"|"regex";pattern:string;regexFlags:string;language:"js"}
interface CapabilityAttributesV2 {parentCapabilityId:CapabilityCanonicalIdV2|null;owners:CanonicalIdV2[];stage:string;archived:boolean}
type V1Attributes<K extends NodeKind>=NodeAttributes; // constrained to the exact SCHEMA-4 row selected by K
type AttributesForV2<K extends NodeKindV2>=
 K extends "STEP_BINDING"?StepBindingAttributesV2:
 K extends "CAPABILITY"?CapabilityAttributesV2:
 K extends "FUNCTIONAL_REQUIREMENT"?V1Attributes<"FUNCTIONAL_REQUIREMENT">&{metadata:RequirementMetadataV2|null}:
 K extends "NON_FUNCTIONAL_REQUIREMENT"?V1Attributes<"NON_FUNCTIONAL_REQUIREMENT">&{metadata:RequirementMetadataV2|null}:
 K extends NodeKind?V1Attributes<K>:never;
interface NodeV2<K extends NodeKindV2=NodeKindV2> {canonicalId:CanonicalIdV2;localId:LocalIdV2;specSlug:SpecSlug;kind:K;source:NodeSourceV2;title:string;body:string;attributes:AttributesForV2<K>;contentHash:GraphFingerprint}
type AnyNodeV2={[K in NodeKindV2]:NodeV2<K>}[NodeKindV2];
interface DefinitionOccurrenceV2<K extends NodeKindV2=NodeKindV2> {occurrenceId:OccurrenceId;specSlug:SpecSlug;localId:LocalIdV2|null;canonicalId:CanonicalIdV2|null;nodeKind:K|null;title:string;body:string;span:SourceSpan;attributes:AttributesForV2<K>;outcome:"UNIQUE"|"AMBIGUOUS"|"REJECTED";diagnosticIds:string[]}
interface ReferenceOccurrenceV2 {occurrenceId:OccurrenceId;sourceCanonicalId:CanonicalIdV2;rawTarget:string;requestedEdgeType:EdgeTypeV2;span:SourceSpan;outcome:"RESOLVED"|"UNRESOLVED";resolvedEdgeId:OccurrenceId|null;unresolvedReason:UnresolvedReason|null;candidateCanonicalIds:CanonicalIdV2[];diagnosticIds:string[]}
interface ResolvedEdgeV2 {edgeId:OccurrenceId;type:EdgeTypeV2;sourceCanonicalId:CanonicalIdV2;targetCanonicalId:CanonicalIdV2;span:SourceSpan}
interface DiagnosticV2 {diagnosticId:OccurrenceId;code:DiagnosticCodeV2;severity:DiagnosticSeverity;message:string;remediation:string;span:SourceSpan|null;relatedSpans:SourceSpan[];specSlug:SpecSlug|null;localId:LocalIdV2|null;canonicalId:CanonicalIdV2|null;referenceOccurrenceId:OccurrenceId|null;details:{expected:string|null;actual:string|null;limitName:string|null;limitValue:number|null;observedValue:number|null}}
```

`V1Attributes<K>` means the exact closed SCHEMA-4 attribute row for that V1 kind, not an open object. Requirement metadata is optional and parsed only from a fenced `yaml metadata` block in the owning FR/NFR section with exact `schemaVersion:1`, `verificationMethod`, `safetyClass`, and `deliveryState` keys; absent block stores `metadata:null`, invalid/extra fields emit `REQUIREMENT_METADATA_INVALID`. Metadata/null participates in content/fingerprint bytes; policyQuery `missingMethod:true` selects null metadata and never reads a side channel.

Step extraction accepts only statically analyzable cucumber-js `Given|When|Then|And|But` calls from contained `tests/step-definitions/**.{js,mjs}` files: first argument is one string literal Cucumber Expression or one JavaScript RegExp literal. Regex source and canonical flags are preserved; unsupported flags, constructors, variables, template expressions, callbacks without a pattern, or dynamic imports emit `STEP_PATTERN_UNSUPPORTED`/`STEP_SOURCE_REJECTED` and no node. Matching uses the closed cucumber-js expression/RegExp semantics for the stored kind/source/flags; the adapter adds no second matcher.

V2 input is exact `{canonicalDocuments:SourceDocument[],stepDefinitionDocuments:StepDefinitionDocumentV2[],capabilityDocuments:CapabilityDocumentV2[]}`. `BINDS_STEP` permits only `SCENARIO -> STEP_BINDING`; `DERIVES_FROM` permits `FUNCTIONAL_REQUIREMENT|NON_FUNCTIONAL_REQUIREMENT -> CAPABILITY` and child `CAPABILITY -> CAPABILITY` parent.

### Heading/link carriers and migration

```ts
interface MarkdownHeadingOccurrenceV2 {headingOccurrenceId:OccurrenceId;path:string;level:1|2|3|4|5|6;syntax:"ATX"|"SETEXT";rawText:string;plainText:string;anchorAlgorithmVersion:"marksman-anchor@2";baseAnchor:string;duplicateOrdinal:number;canonicalAnchor:string;span:SourceSpan;sectionSpan:SourceSpan}
interface MarkdownHeadingSummaryV2 {path:string;headingOccurrenceId:OccurrenceId;level:1|2|3|4|5|6;plainText:string;canonicalAnchor:string;span:SourceSpan}
interface MarkdownLinkOccurrenceV2 {linkOccurrenceId:OccurrenceId;path:string;syntax:"INLINE"|"FULL_REFERENCE"|"COLLAPSED_REFERENCE"|"SHORTCUT_REFERENCE"|"AUTOLINK";labelText:string;rawDestination:string;normalizedDestination:string;useSpan:SourceSpan;destinationSpan:SourceSpan;rewriteKey:RewriteKey;sourceHeadingOccurrenceId:OccurrenceId|null;outcome:"INTERNAL_HEADING"|"INTERNAL_DOCUMENT"|"EXTERNAL"|"UNRESOLVED";targetPath:string|null;targetAnchor:string|null;targetHeadingOccurrenceId:OccurrenceId|null;externalScheme:string|null;unresolvedReason:"MALFORMED_DESTINATION"|"TARGET_DOCUMENT_MISSING"|"TARGET_ANCHOR_MISSING"|"TARGET_OUTSIDE_CORPUS"|"AMBIGUOUS_PATH"|null;diagnosticIds:string[]}
interface AnchorMigrationRecordV2 {path:string;headingOccurrenceId:OccurrenceId;legacyAnchor:string;currentAnchor:string}
```

Migration covers every V2 heading once, sorts by path/span, preserves duplicates, proves pinned Marksman golden cases and leaves the V1 fixture unchanged.

### Closed `GraphSnapshotV2`

```ts
interface DocumentInventoryRowV2 {path:string;specSlug:SpecSlug;documentKind:DocumentKindV2;sha256:GraphFingerprint;byteLength:number;accepted:boolean;diagnosticIds:string[]}
interface GraphCountsV2 {
 discoveredDocuments:number;acceptedDocuments:number;rejectedDocuments:number;
 stepDefinitionDocuments:number;acceptedStepDefinitionDocuments:number;rejectedStepDefinitionDocuments:number;
 capabilityDocuments:number;acceptedCapabilityDocuments:number;rejectedCapabilityDocuments:number;
 definitionOccurrences:number;uniqueDefinitionNodes:number;ambiguousDefinitionOccurrences:number;rejectedDefinitionOccurrences:number;
 referenceOccurrences:number;resolvedEdgeOccurrences:number;unresolvedReferenceOccurrences:number;
 markdownHeadingOccurrences:number;markdownLinkOccurrences:number;markdownInternalHeadingLinks:number;markdownInternalDocumentLinks:number;markdownExternalLinks:number;markdownUnresolvedLinks:number;markdownRewriteSites:number;
 generatedDocumentNodes:number;generatedFileNodes:number;stepBindingNodes:number;capabilityNodes:number;bindsStepEdges:number;derivesFromEdges:number;anchorMigrationRecords:number;
 diagnosticsError:number;diagnosticsWarning:number;diagnosticsInfo:number;
}
interface GraphSnapshotV2 {schemaVersion:"spec-kernel@2";anchorAlgorithmVersion:"marksman-anchor@2";enabledCapabilities:KernelCapabilityProfile[];fingerprint:GraphFingerprint;valid:boolean;limits:ResolvedLimitsV2;counts:GraphCountsV2;documents:DocumentInventoryRowV2[];definitionCandidates:DefinitionOccurrenceV2[];nodes:AnyNodeV2[];referenceOccurrences:ReferenceOccurrenceV2[];markdownHeadingOccurrences:MarkdownHeadingOccurrenceV2[];markdownLinkOccurrences:MarkdownLinkOccurrenceV2[];anchorMigrationRecords:AnchorMigrationRecordV2[];edges:ResolvedEdgeV2[];diagnostics:DiagnosticV2[]}
```

Canonical sort lifts SCHEMA-7 to V2 types. Conservation requires all three document partitions; definition and reference equations; heading/link collection lengths; link outcome sum; rewrite-site distinct-key count; step/capability node counts; BINDS_STEP/DERIVES_FROM edge counts; migration rows equal heading rows; diagnostic severity counts; and every edge endpoint/type allowed. Fingerprint canonical JSON includes schema/anchor versions, exact enabled profiles, limits, every input hash, occurrence/node/edge/migration/diagnostic and all counts.

### V2 query request, data, and errors

```ts
type QueryOperationV2=QueryOperation|"listSpecs"|"findByTags"|"listTasks"|"listPhaseTasks"|"findOrphans"|"validateAnchor"|"policyQuery"|"validateRequirementMetadata"|"archivalProof"|"validateSpec"|"specStatus";
type TaskStatusV2="planned"|"todo"|"ready"|"in-progress"|"blocked"|"done"|"deferred"|"unknown";
type QueryRequestV2=
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"inventory";args:{specSlugs:SpecSlug[];includeDocuments:boolean;limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"getNode";args:{canonicalId:CanonicalIdV2;projection:"summary"|"full";includeIncidentCounts:boolean}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"findNodes";args:{specSlugs:SpecSlug[];kinds:NodeKindV2[];canonicalIds:CanonicalIdV2[];text:string|null;projection:"summary"|"full";limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"getEdges";args:{canonicalId:CanonicalIdV2;direction:"in"|"out"|"both";types:EdgeTypeV2[];aggregate:boolean;limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"trace";args:{canonicalId:CanonicalIdV2;direction:"in"|"out"|"both";types:EdgeTypeV2[];maxDepth:number;maxVisited:number;projection:"summary"|"full";limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"diagnostics";args:{severities:DiagnosticSeverity[];codes:DiagnosticCodeV2[];specSlugs:SpecSlug[];paths:string[];limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"overview";args:{specSlugs:SpecSlug[]}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"markdownInventory";args:{specSlugs:SpecSlug[];mode:"all"|"focus";focusPath:string|null;focusAnchor:string|null;direction:"in"|"out"|"both";outcomes:("INTERNAL_HEADING"|"INTERNAL_DOCUMENT"|"EXTERNAL"|"UNRESOLVED")[];includeHeadings:boolean;includeLinks:boolean;limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"listSpecs";args:{limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"findByTags";args:{tags:string[];specSlugs:SpecSlug[];limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"listTasks";args:{specSlug:SpecSlug;statuses:TaskStatusV2[];phase:string|null;requirementId:CanonicalIdV2|null;includeComments:boolean;limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"listPhaseTasks";args:{specSlug:SpecSlug;phase:string;statuses:TaskStatusV2[];limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"findOrphans";args:{specSlugs:SpecSlug[];codes:("UNCOVERED_FR"|"ORPHAN_TASK"|"SCENARIO_TAG_ORPHAN")[];limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"validateAnchor";args:{specSlug:SpecSlug;input:string;domain:"GRAPH_ID"|"MARKDOWN";documentPath:string|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"policyQuery";args:{specSlugs:SpecSlug[];verificationMethods:VerificationMethodV2[];safetyClasses:SafetyClassV2[];deliveryStates:DeliveryStateV2[];missingMethod:boolean|null;limit:number;cursor:Cursor|null}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"validateRequirementMetadata";args:{metadata:unknown}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"archivalProof";args:{specSlug:SpecSlug}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"validateSpec";args:{specSlug:SpecSlug;strictContracts:boolean}}
 | {schemaVersion:"spec-kernel@2";requestId:string|null;operation:"specStatus";args:{specSlug:SpecSlug;view:"status"|"counts"|"coverage"}};
interface SourceSummaryV2 {path:string;startLine:number;startColumn:number;endLine:number;endColumn:number}
interface NodeSummaryV2 {canonicalId:CanonicalIdV2;specSlug:SpecSlug;localId:LocalIdV2;kind:NodeKindV2;title:string;source:SourceSummaryV2;contentHash:GraphFingerprint;excerpt:string|null;incidentInCount:number|null;incidentOutCount:number|null}
interface EdgeSummaryV2 {edgeId:OccurrenceId|null;from:CanonicalIdV2;to:CanonicalIdV2;type:EdgeTypeV2;source:SourceSummaryV2|null;occurrenceCount:number}
interface DiagnosticSummaryV2 {diagnosticId:OccurrenceId;code:DiagnosticCodeV2;severity:DiagnosticSeverity;message:string;remediation:string;source:SourceSummaryV2|null;canonicalId:CanonicalIdV2|null}
interface SpecInventoryV2 {specSlug:SpecSlug;valid:boolean;documentCount:number;missingCanonicalDocuments:DocumentKindV2[];nodeCount:number;edgeOccurrenceCount:number;unresolvedReferenceCount:number;errorCount:number;warningCount:number;infoCount:number;documents:{path:string;documentKind:DocumentKindV2;sha256:GraphFingerprint;byteLength:number;accepted:boolean}[]}
interface InventoryTotalsV2 {specCount:number;validSpecCount:number;documentCount:number;nodeCount:number;edgeOccurrenceCount:number;unresolvedReferenceCount:number;errorCount:number;warningCount:number;infoCount:number}
interface MarkdownHeadingSummaryForQueryV2 {headingOccurrenceId:OccurrenceId;path:string;level:number;syntax:"ATX"|"SETEXT";plainText:string;anchorAlgorithmVersion:"marksman-anchor@2";baseAnchor:string;duplicateOrdinal:number;canonicalAnchor:string;source:SourceSummaryV2;section:SourceSummaryV2}
interface MarkdownLinkSummaryV2 {linkOccurrenceId:OccurrenceId;path:string;syntax:"INLINE"|"FULL_REFERENCE"|"COLLAPSED_REFERENCE"|"SHORTCUT_REFERENCE"|"AUTOLINK";labelText:string;rawDestination:string;normalizedDestination:string;useSource:SourceSummaryV2;destinationSource:SourceSummaryV2;rewriteKey:RewriteKey;sourceHeadingOccurrenceId:OccurrenceId|null;outcome:"INTERNAL_HEADING"|"INTERNAL_DOCUMENT"|"EXTERNAL"|"UNRESOLVED";targetPath:string|null;targetAnchor:string|null;targetHeadingOccurrenceId:OccurrenceId|null;externalScheme:string|null;unresolvedReason:string|null;diagnosticIds:string[]}
type MarkdownInventoryItemV2={kind:"heading";heading:MarkdownHeadingSummaryForQueryV2}|{kind:"link";relation:"INBOUND"|"OUTBOUND"|"BOTH"|"UNSCOPED";link:MarkdownLinkSummaryV2};
interface MarkdownInventoryTotalsV2 {allHeadings:number;allLinks:number;allInternalHeadingLinks:number;allInternalDocumentLinks:number;allExternalLinks:number;allUnresolvedLinks:number;allRewriteSites:number;matchedHeadings:number;matchedLinks:number;matchedRewriteSites:number}
interface QueryGraphMetaV2 {schemaVersion:"spec-kernel@2";fingerprint:GraphFingerprint;valid:boolean;specCount:number;documentCount:number;nodeCount:number;edgeOccurrenceCount:number;unresolvedReferenceCount:number;markdownHeadingOccurrenceCount:number;markdownLinkOccurrenceCount:number;diagnosticCount:number}
interface QueryPageV2 {limit:number;returned:number;totalMatched:number;cursor:Cursor|null;nextCursor:Cursor|null;truncated:boolean;responseBytes:number}
type QueryDataV2=
 | {kind:"inventory";specs:SpecInventoryV2[];totals:InventoryTotalsV2}
 | {kind:"node";node:AnyNodeV2|NodeSummaryV2;incomingCount:number|null;outgoingCount:number|null}
 | {kind:"nodes";nodes:(AnyNodeV2|NodeSummaryV2)[]}
 | {kind:"edges";edges:EdgeSummaryV2[]}
 | {kind:"trace";start:CanonicalIdV2;nodes:(AnyNodeV2|NodeSummaryV2)[];edges:EdgeSummaryV2[];frontier:CanonicalIdV2[];maxDepthReached:number;visitedCount:number;cycleEdges:OccurrenceId[]}
 | {kind:"diagnostics";items:DiagnosticV2[]}
 | {kind:"overview";counts:GraphCountsV2;limits:ResolvedLimitsV2;diagnosticCodes:{code:DiagnosticCodeV2;severity:DiagnosticSeverity;count:number}[];nodeKinds:{kind:NodeKindV2;count:number}[];edgeTypes:{type:EdgeTypeV2;count:number}[]}
 | {kind:"markdownInventory";anchorAlgorithmVersion:"marksman-anchor@2";focus:{path:string;canonicalAnchor:string;headingOccurrenceId:OccurrenceId}|null;items:MarkdownInventoryItemV2[];totals:MarkdownInventoryTotalsV2}
 | {kind:"spec-list";specs:{specSlug:SpecSlug;valid:boolean;documentCount:number;nodeCount:number;errorCount:number;warningCount:number}[];total:number;returned:number;truncated:boolean;nextCursor:Cursor|null}
 | {kind:"scenario-list";scenarios:{canonicalId:CanonicalIdV2;title:string;tags:string[];source:NodeSourceV2}[];total:number;returned:number;truncated:boolean;nextCursor:Cursor|null}
 | {kind:"task-list";tasks:{canonicalId:CanonicalIdV2;status:TaskStatusV2;phase:string|null;requirementIds:CanonicalIdV2[];owner:string|null;estimate:string|null;doneWhen:string[];comments:string[]}[];total:number;returned:number;truncated:boolean;nextCursor:Cursor|null}
 | {kind:"orphan-list";findings:DiagnosticSummaryV2[];total:number;returned:number;truncated:boolean;nextCursor:Cursor|null}
 | {kind:"anchor-validation";valid:boolean;domain:"GRAPH_ID"|"MARKDOWN";resolvedCanonicalId:CanonicalIdV2|null;targetPath:string|null;targetAnchor:string|null;candidates:CanonicalIdV2[]}
 | {kind:"requirement-list";requirements:{canonicalId:CanonicalIdV2;metadata:RequirementMetadataV2|null;source:NodeSourceV2}[];total:number;returned:number;truncated:boolean;nextCursor:Cursor|null}
 | {kind:"metadata-validation";valid:boolean;normalized:RequirementMetadataV2|null;findings:DiagnosticSummaryV2[]}
 | {kind:"archival-proof";specSlug:SpecSlug;verdict:"ARCHIVE"|"KEEP_FALSE_POSITIVE"|"ARCHIVE_BLOCKED";inboundRefs:EdgeSummaryV2[]}
 | {kind:"spec-validation";specSlug:SpecSlug;valid:boolean;verdict:"PASS"|"FAIL";findings:DiagnosticSummaryV2[];snapshotHashes:{path:string;sha256:GraphFingerprint}[]}
 | {kind:"spec-status";specSlug:SpecSlug;view:"status";status:{state:"VALID"|"INVALID";blockers:DiagnosticSummaryV2[]};counts:null;coverage:null}
 | {kind:"spec-status";specSlug:SpecSlug;view:"counts";status:null;counts:{fr:number;ac:number;scenario:number;task:number};coverage:null}
 | {kind:"spec-status";specSlug:SpecSlug;view:"coverage";status:null;counts:null;coverage:{requirementCount:number;withAcceptanceCount:number;withScenarioCount:number;withTaskCount:number;structuralRatio:number}};
interface QueryErrorV2 {code:QueryErrorCodeV2;message:string;operation:QueryOperationV2|string|null;parameter:string|null;receivedType:string|null;receivedSummary:string|null;expected:string|null;limitName:string|null;limitValue:number|null;observedValue:number|null;specSlug:SpecSlug|null;localId:LocalIdV2|null;canonicalId:CanonicalIdV2|null;path:string|null;anchor:string|null;headingOccurrenceId:OccurrenceId|null;linkOccurrenceId:OccurrenceId|null;rewriteKey:RewriteKey|null;candidates:NodeSummaryV2[];diagnosticIds:string[];retryable:boolean;causeCode:DiagnosticCodeV2|null}
type QueryErrorCodeV2=QueryErrorCode|"SPEC_NOT_FOUND"|"PHASE_NOT_FOUND"|"EMPTY_PHASE"|"INVALID_METADATA"|"ARCHIVE_BLOCKED"|"VALIDATION_FAILED";
type QueryEnvelopeV2=
 | {ok:true;schemaVersion:"spec-kernel@2";requestId:string|null;operation:QueryOperationV2;graph:QueryGraphMetaV2;page:QueryPageV2|null;data:QueryDataV2;error:null;diagnostics:DiagnosticSummaryV2[]}
 | {ok:false;schemaVersion:"spec-kernel@2";requestId:string|null;operation:QueryOperationV2|string|null;graph:QueryGraphMetaV2|null;page:null;data:null;error:QueryErrorV2;diagnostics:DiagnosticSummaryV2[]};
```

Existing operations preserve every SCHEMA-8/9 observable with V2 carriers, so STEP_BINDING/BINDS_STEP/step diagnostics are queryable. Common page limit is 1..200 (default 50); tags 1..20, each 1..200 scalars; specSlugs 0..100; statuses 0..8; phase/input/comment/owner/estimate strings <=200/200/1024/200/200 scalars; doneWhen/comments/findings each <=1,000 rows; archive inbound refs <=5,000; snapshotHashes <=15; response <=1 MiB. V1 error precedence remains. `specStatus.coverage` is structural traceability only; test run/freshness/verified coverage belongs to `spec-evidence` and is absent.

### FR-17 adapter I/O envelope

```ts
type AdapterOperationV2="mcpPreflight"|"listSpecDocs"|"readSpecDoc"|"readAttachment";
type AdapterRequestV2=
 | {schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"mcpPreflight";args:{declaredWorktree:string|null}}
 | {schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"listSpecDocs";args:{specSlug:SpecSlug}}
 | {schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"readSpecDoc";args:{specSlug:SpecSlug;name:string;offsetLine:number;limitLines:number}}
 | {schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"readAttachment";args:{specSlug:SpecSlug;subpath:string;maxBytes:number}};
type AdapterErrorCodeV2="INVALID_PARAMETER"|"ROOT_MISMATCH"|"SPEC_NOT_FOUND"|"DOC_NOT_FOUND"|"ATTACHMENT_NOT_FOUND"|"PATH_ESCAPE"|"SYMLINK_REJECTED"|"NON_REGULAR_FILE"|"MIME_MISMATCH"|"BYTE_LIMIT_EXCEEDED"|"LINE_LIMIT_EXCEEDED"|"IO_READ_FAILED";
interface AdapterErrorV2 {code:AdapterErrorCodeV2;message:string;parameter:string|null;expected:string|null;path:string|null;retryable:boolean;diagnosticIds:string[]}
type AdapterEnvelopeV2=
 | {ok:true;schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"mcpPreflight";data:{resolvedRootFingerprint:GraphFingerprint;declaredWorktreeMatch:boolean|null;lockMode:"exclusive"|"readonly";shortWriteMode:"enabled"|"disabled";pluginVersion:string;mcpVersion:string;dependenciesReady:boolean}}
 | {ok:true;schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"listSpecDocs";data:{specSlug:SpecSlug;documents:{name:string;kind:DocumentKindV2;bytes:number;sha256:GraphFingerprint}[];attachments:{subpath:string;mime:string;bytes:number;sha256:GraphFingerprint}[]}}
 | {ok:true;schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"readSpecDoc";data:{name:string;startLine:number;endLine:number;totalLines:number;text:string;sha256:GraphFingerprint;truncated:boolean;nextOffsetLine:number|null}}
 | {ok:true;schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:"readAttachment";data:{subpath:string;mime:string;bytes:number;sha256:GraphFingerprint;base64:string}}
 | {ok:false;schemaVersion:"kernel-adapter-io@1";requestId:string|null;operation:AdapterOperationV2;error:AdapterErrorV2};
```

Document names come only from listSpecDocs; offsets are >=1, limitLines 1..500, maxBytes 1..8 MiB. Error precedence is invalid args, root, spec, lexical/link containment, existence/regularity, MIME, byte/line limit, read.

### Standalone profile evidence, pre-registration candidate, and eligibility

```ts
type KernelCapabilityCheckId="CHK-FR13-02"|"CHK-FR15-01"|"CHK-FR16-01"|"CHK-FR17-01";
type KernelCapabilityEvidenceRole="DELIVERED_V03_BASELINE"|"CHECK_RECEIPT"|"CANDIDATE_PACKAGE"|"INDEPENDENT_REVIEW";
interface KernelCapabilityEvidenceDocumentV2 {role:KernelCapabilityEvidenceRole;path:string;bytes:Uint8Array;sha256:GraphFingerprint;candidateArtifactSha256:GraphFingerprint|null}
interface DeliveredV03BaselineProjectionV2 {statusProfile:"historical-v0.3.2@1";stage:"V0_3_READONLY_MCP";state:"DELIVERED";productRevision:string;candidateArtifactSha256:GraphFingerprint;publicVisibility:"PUBLIC";installable:true;blockers:[]}
interface KernelCapabilityBaselineV2 {documentPath:string;documentSha256:GraphFingerprint;parsed:DeliveredV03BaselineProjectionV2}
interface KernelCapabilityEvidenceRecordV2 {checkId:KernelCapabilityCheckId;requirementId:"spec-kernel:FR-13"|"spec-kernel:FR-15"|"spec-kernel:FR-16"|"spec-kernel:FR-17";status:EvidenceStatus;evidence:EvidenceReference[];candidateArtifactSha256:GraphFingerprint;corpusFingerprint:GraphFingerprint;details:string[]}
interface KernelCapabilityEvidenceManifestV2 {schemaVersion:"kernel-capability-evidence@2";profile:KernelCapabilityProfile;candidateMode:"pre-registration";targetKernelSchemaVersion:"spec-kernel@2";anchorAlgorithmVersion:"marksman-anchor@2";enabledCapabilities:KernelCapabilityProfile[];baseline:KernelCapabilityBaselineV2;candidateRevision:string;candidateArtifactSha256:GraphFingerprint;records:KernelCapabilityEvidenceRecordV2[]}
interface KernelCapabilityEvaluationInputV2 {schemaVersion:"kernel-capability-evaluation-input@2";manifest:KernelCapabilityEvidenceManifestV2;evidenceDocuments:KernelCapabilityEvidenceDocumentV2[]}
type KernelCapabilityBlockerCode="UNKNOWN_PROFILE"|"PROFILE_CAPABILITY_MISMATCH"|"BASELINE_MISSING"|"BASELINE_UNBOUND"|"BASELINE_INELIGIBLE"|"CHECK_MISSING"|"CHECK_EXTRA"|"CHECK_DUPLICATE"|"CHECK_FAILED"|"CHECK_STALE"|"CHECK_MISMATCH"|"CHECK_UNVERIFIABLE"|"EVIDENCE_EMPTY"|"EVIDENCE_DOCUMENT_MISSING"|"EVIDENCE_HASH_MISMATCH"|"ARTIFACT_BINDING_MISMATCH"|"CORPUS_BINDING_MISMATCH"|"CANDIDATE_MODE_INVALID";
interface KernelCapabilityEligibilityV2 {schemaVersion:"kernel-capability-eligibility@2";profile:KernelCapabilityProfile|null;eligible:boolean;candidateRevision:string;candidateArtifactSha256:GraphFingerprint;baselineArtifactSha256:GraphFingerprint|null;requiredCheckIds:KernelCapabilityCheckId[];passedCheckIds:KernelCapabilityCheckId[];blockers:{checkId:KernelCapabilityCheckId|null;code:KernelCapabilityBlockerCode;evidencePath:string|null}[];evidenceFingerprint:GraphFingerprint}
```

Exact profile membership and enabledCapabilities are:

| Profile | Enabled capabilities exact order | Required checks exact order |
|---|---|---|
| `kernel-anchor-migration@1` | `kernel-anchor-migration@1` | `CHK-FR13-02` |
| `kernel-step-bindings@1` | `kernel-anchor-migration@1`, `kernel-step-bindings@1` | `CHK-FR13-02`, `CHK-FR15-01` |
| `kernel-generator-port-reads@1` | `kernel-anchor-migration@1`, `kernel-generator-port-reads@1` | `CHK-FR13-02`, `CHK-FR16-01` |
| `kernel-adapter-io@1` | `kernel-anchor-migration@1`, `kernel-adapter-io@1` | `CHK-FR13-02`, `CHK-FR17-01` |

The candidate artifact contains dormant profile code and exact MCP mappings before acceptance, but public tools/list excludes them while `candidateMode:"pre-registration"`. Evidence drives the internal candidate dispatcher/installed smoke directly against that same artifact. After eligibility, product capability state activates the already-built registry without rebuilding or changing its SHA-256; no circular post-acceptance build exists.

The evaluator re-hashes role-typed documents, parses the bounded historical ProductStatus baseline bytes, requires profile membership above, exact candidate/corpus/check/evidence bindings, and returns the self-binding result. Evidence fingerprint is SHA-256 over canonical manifest identities plus role/path/document hashes and ordered records, excluding raw bytes/result. No capability check enters historical kernel-v0.2/v0.3 membership.

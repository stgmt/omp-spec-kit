# Design

## Context

The target is a new standalone kernel, not an extraction-by-copy of the upstream server. The migration matrix keeps portable graph ideas and rejects or defers watcher, database, hook, repair, backlog, status, and mutation machinery. The implementation remains inside the single `plugins/omp-spec-kit` child package required by the product architecture.

## Component boundary

```mermaid
flowchart LR
  Root[Explicit repository root] --> FS[Bounded filesystem adapter]
  FS -->|SourceDocument[]| Parse[Pure parsers]
  Parse --> Occ[Definition reference heading and link occurrences]
  Occ --> Build[Pure graph builder and invariants]
  Build --> Snap[Immutable GraphSnapshot]
  Snap --> Query[Pure QueryService]
  Query --> OMP[OMP extension adapter v0.2]
  Query --> MCP[MCP adapter v0.3]
```

### Pure kernel

Planned under `plugins/omp-spec-kit/src/kernel/`:

- `types.ts` — closed schemas and discriminants.
- `identity.ts` — slug/local/canonical ID validation and reference qualification.
- `normalize.ts` — content/path normalization and canonical serialization.
- `parsers/markdown.ts` — canonical definitions/references plus complete GLFM heading, anchor, and semantic link occurrences.
- `parsers/gherkin.ts` — English Gherkin declarations, explicit scenario IDs, tags, steps, and examples.
- `graph/build.ts` — occurrence grouping, unique-node election, edge resolution, indexes, fingerprint.
- `graph/invariants.ts` — endpoint, cardinality, uniqueness, containment, and conservation checks.
- `diagnostics.ts` — stable closed diagnostic construction/sorting.
- `query/service.ts` — eight bounded read operations.
- `query/cursor.ts` — fingerprint-bound opaque cursor encode/decode.

The pure kernel receives data and explicit limits/cancellation only. It has no filesystem imports and no adapter callbacks other than a caller-supplied cancellation predicate.

### Adapters

- `adapters/fs/repository-reader.ts` owns `realpath`/`lstat`, link/reparse rejection, canonical file discovery, byte reading, input budgets, and sanitized repository-relative failures.
- `adapters/omp/register-spec-tools.ts` registers v0.2 read tools and projects canonical envelopes.
- `adapters/mcp/server.ts` is a v0.3 transport adapter over the same service and same graph factory.

Adapters SHALL NOT parse headings, resolve identities/edges, invent diagnostics, filter semantic results, or maintain a second cache/schema.

## Input model

`SourceDocument` contains `path`, `specSlug`, `documentKind`, raw `bytes`, and `sha256`. The filesystem adapter constructs it only after containment and budget checks. A non-filesystem caller may supply it directly, but the pure kernel revalidates public path, slug, document-kind/name agreement, byte hash, encoding, per-file limits, and aggregate limits.

A build never discovers paths on its own. It accepts a complete snapshot marker from the adapter; absent canonical documents are inventory facts, not a request to create scaffolding.

## Parsing grammar

### Markdown

Definition recognition begins with the canonical `documentKind`, not with a corpus-wide ID regex. Outside code, `FR.md` admits only ATX level-2 `FR-N: title` and `FR-N — title`; `ACCEPTANCE_CRITERIA.md` admits ATX level-2/3 `AC-N.M: title`, `AC-N.M — title`, and bare exact `AC-N.M`; and `TASKS.md` admits only ATX level-2 `TASK-N: title` and `TASK-N — title`. Titles after `:` or literal U+2014 `—` are non-empty and separated exactly as defined in schema. A bare AC derives its public title from the ID. Definition bodies extend to the next heading of the same or higher level. Source spans use 1-based line/column and end-exclusive offsets.

References are recognized only from:

1. Markdown links whose label or fragment contains a valid local/qualified ID.
2. Non-fenced structured fields named `Refs`, `Related`, `Covers`, `Implements`, or `Depends On`.
3. Defined table columns in `REQUIREMENTS.md`, `TASKS.md`, and `FILE_CHANGES.md`, where rows are reference projections and never definitions.

Bare narrative tokens and fenced examples do not create edges. Because the parser selects the owning document role first, a same-looking FR, AC, or TASK heading in another document—including product AC-file FR grouping headings and requirement/task matrices—remains ordinary heading/reference prose and never enters definition candidates. Arbitrary separators, suffix prose on a bare AC, wrong levels, and malformed IDs in an owning document are not recovered heuristically; malformed owning-document candidates yield the closed typed diagnostic.

Task status parsing is also lossless at the shared boundary: canonical-corpus `Planned`, `todo`, and `Completed` become `planned`, `todo`, and `done`, while `planned` and `todo` remain distinct values in `TASK.status`. The read-only kernel performs no transition. The later authoring reducer is intentionally narrower—only `todo`, `ready`, `in-progress`, `blocked`, and `done` participate; `planned` remains non-mutable until a future accepted proposal defines an explicit normalization.

### Complete Markdown inventory

Definition parsing and safe-rename inventory are separate projections of the same GLFM parse. Every ATX/Setext heading, including an ordinary heading such as `## Context`, produces a `MarkdownHeadingOccurrence`; only exact supported ID headings can additionally produce a domain definition. `glfm-anchor@1` derives a base anchor from rendered heading text, then processes headings in document order. For each heading it tests the base and then `base-N` candidates in ascending `N` against the complete set of canonical anchors already emitted for that document, emits the first unused candidate, and immediately adds it to the set. The selected `N` is the duplicate ordinal; it is not a same-base occurrence count. This prevents suffix-shaped source headings from colliding with generated suffixes: `Foo`, `Foo`, `Foo-1` emits `foo`, `foo-1`, `foo-1-1`, while `Foo-1`, `Foo`, `Foo` emits `foo-1`, `foo`, `foo-2`.

Every semantic inline, reference-style, or autolink use produces a `MarkdownLinkOccurrence`. Its use span identifies the rendered link; its destination span and `rewriteKey` identify the authored bytes a later proposal would need to change. Separate reference uses remain separate occurrences even when their destination spans and rewrite keys are shared. Internal heading/document, external, and unresolved outcomes are exhaustive. The parser does not follow external links or mutate destinations.

For a focused heading, inbound means `targetHeadingOccurrenceId` equals the focus; outbound means the link use span is contained by the focus heading’s section span, including nested subsections. `sourceHeadingOccurrenceId` still records the innermost containing heading. `markdownInventory` returns the inbound/outbound union without coalescing occurrence IDs. A rename planner must consume the entire fingerprint-bound cursor chain and verify the heading/link conservation totals before it may claim an affected-occurrence set is complete.

### Gherkin

v0.2 accepts UTF-8 English `Feature`, `Background`, `Scenario`, `Scenario Outline`, `Examples`, and step keywords. Every Scenario/Outline requires one `@id:SCEN-<lower-kebab>` tag. `@featureN` references local `FR-N`; `@AC-N.M` references local `AC-N.M`. Qualified cross-spec references must appear in a structured `Refs:` line in the scenario description as `<slug>:<local-id>`. A Scenario Outline is one authored Scenario node; example header/rows remain typed attributes and do not become invented test-result nodes.

## Identity algorithm

1. Validate the immediate `.specs/<slug>` directory name.
2. Validate local ID exactly and case-sensitively; do not correct zero-padding or case.
3. Form `canonicalId = specSlug + ":" + localId`.
4. Store every `DefinitionOccurrence` by canonical ID.
5. Elect a `Node` only when exactly one valid candidate exists.
6. Preserve invalid/rejected occurrences separately.
7. Resolve a bare target using the reference occurrence’s source spec only.
8. Resolve a qualified target exactly; never search other specs for a “likely” match.

Generated IDs `DOC:<filename>` and `FILE:<normalized-path>` use the same qualification step. Percent/URL decoding is not applied to local IDs.

## Duplicate algorithm

Duplicate detection occurs before any object-map insertion. A group of two or more candidates produces:

- no entry in `nodes` for that canonical ID;
- every occurrence in `definitionCandidates`;
- one `DUPLICATE_DEFINITION` diagnostic with the primary stable span and remaining related spans;
- unresolved `AMBIGUOUS_TARGET` for each incoming reference;
- `AMBIGUOUS_ID` from `getNode`, with candidate summaries capped by query limit.

Same local IDs under different spec slugs are distinct groups and therefore not duplicates.

## Edge resolution

Each `ReferenceOccurrence` has its own deterministic occurrence ID derived from source path, start offset, reference ordinal, requested edge type, and raw target. The resolver validates target syntax, qualification, existence/cardinality, and endpoint kind matrix in that order. Exactly one outcome is appended:

- `ResolvedEdge`, retaining the reference occurrence ID and source span; or
- `UnresolvedReference`, retaining the failure reason and candidate IDs/spans when safe.

Edges are not collapsed merely because they share from/to/type; separate source references remain observable. Query clients MAY group identical triples through an explicit aggregate view, which returns `occurrenceCount`.

## Conservation and cardinality

Let:

- $D$ be all parsed definition occurrences;
- $U$ be elected unique nodes originating from definitions;
- $A$ be all valid occurrences in ambiguous identity groups;
- $R_d$ be rejected definition occurrences;
- $R$ be parsed reference occurrences;
- $E$ be resolved edge occurrences;
- $U_r$ be unresolved reference occurrences;
- $F$ be discovered canonical-document candidates;
- $F_a$ and $F_r$ be accepted and rejected documents.
- $H$ be all Markdown heading occurrences;
- $L$ be all semantic Markdown link occurrences;
- $L_h$, $L_d$, $L_e$, and $L_u$ be internal-heading, internal-document, external, and unresolved link outcomes.

The builder SHALL prove:

$$D = U + A + R_d$$

$$R = E + U_r$$

$$F = F_a + F_r$$

$$H = |\texttt{snapshot.markdownHeadingOccurrences}|$$

$$L = L_h + L_d + L_e + L_u = |\texttt{snapshot.markdownLinkOccurrences}|$$

For each canonical identity $k$, exactly one of these is true: `nodes[k]` exists and candidate cardinality is one; or candidate cardinality is at least two and `nodes[k]` is absent; or every candidate was rejected and the identity is absent. Every edge endpoint is present in `nodes` and allowed by the edge matrix. Every accepted GLFM heading and semantic link use contributes exactly one inventory occurrence, and every link has exactly one outcome. Failed equations emit `INVARIANT_VIOLATION` and invalidate the graph.

## Determinism

- Normalize public paths to NFC `/` form and reject ambiguous `.`/`..`/empty segments.
- Strip UTF-8 BOM and normalize CRLF/CR to LF for parsing while hashing original bytes separately.
- Sort input paths, candidates, nodes, edges, unresolved references, and diagnostics by schema-defined keys.
- Use explicit ASCII case rules; never locale collation.
- Exclude wall-clock time, absolute paths, directory enumeration order, object insertion order, and adapter error prose from canonical serialization.
- Compute `fingerprint = sha256(schemaVersion || limitsCanonicalJson || each(path || rawSha256))` in sorted path order.

## Query model

`QueryService.execute(graph, request)` returns one `QueryEnvelope`. Operations are:

- `inventory` — spec/document/node/edge/diagnostic counts and bounded spec summaries.
- `getNode` — exact canonical identity and optional body/excerpt projection.
- `findNodes` — intersection filters for specs/kinds/IDs/text plus page.
- `getEdges` — incident edges by direction/type with optional aggregate view.
- `trace` — bounded breadth-first traversal with deterministic frontier.
- `diagnostics` — severity/code/spec/path filters.
- `overview` — graph validity, fingerprint, totals, limits, and diagnostic summary.
- `markdownInventory` — complete paged heading/link inventory, or exact inbound/outbound occurrences for one `{path, canonicalAnchor}` focus.

The cursor encodes schema version, graph fingerprint, operation, normalized filter digest, and last stable sort key. It is integrity-protected by a checksum, not a secret. A mismatched fingerprint/filter/operation yields `STALE_CURSOR` or `INVALID_CURSOR`; cursors do not authorize additional data. For `markdownInventory`, a completed cursor chain plus matching totals is the only query-level completeness proof; an individual page is never a complete rename plan.

## Release eligibility model

The release evaluator is a pure consumer of `kernel-release-evaluation-input@1`, which contains a `kernel-release-evidence@1` manifest, exact caller-supplied evidence bytes, and for v0.3 a bounded v0.2 baseline input. Release evidence is separate from graph validity and queries. The manifest’s `targetStage` and `evidenceProfile` form a closed discriminant: `v0.2`/`kernel-v0.2` or `v0.3`/`kernel-v0.3`. Unknown, missing, or mismatched values fail closed; the candidate and every record must match the selected `0.2.x` or `0.3.x` release line and stage.

The v0.2 profile derives exactly FR-1 through FR-8 and FR-10 through FR-13 checks. It rejects FR-9 evidence as wrong-profile, so the kernel/OMP artifact can pass without any MCP implementation or evidence. Its `CHK-FR10-01` record is bound to `targetStage=v0.2`, `packageSurface=OMP_EXTENSION_ONLY`, and the exact v0.2 artifact; it proves only that the installed dependency-absent extension package builds a graph and executes a query. FR-11 real-fixture admission and FR-12 v0.2 budget proof remain the other named mandatory records in that conjunction.

The v0.3 profile derives the complete v0.2 check set plus FR-9. Before evaluating those current-stage records, the evaluator re-evaluates the supplied v0.2 input, requires it to be eligible, and requires its artifact SHA-256 to equal the v0.3 manifest’s declared v0.2 parent. FR-9 proves adapter-to-service parity and the exact read-only registry. The fresh `targetStage=v0.3` `CHK-FR10-01` record requires `packageSurface=OMP_EXTENSION_AND_MCP` and proves both extension and server execute the shared kernel from the exact v0.3 artifact; FR-12 proves the MCP-inclusive budgets. A v0.2 record, an extension-only v0.3 record, or a record carrying the wrong profile/stage/artifact binding fails closed rather than being reused.

Eligibility is a conjunction over the selected profile. Records cannot self-declare optionality or required-check membership. Evidence references are immutable path/hash/claim tuples bound to one candidate artifact; the evaluator recomputes hashes from the supplied bytes, and corpus-producing checks bind the same corpus fingerprint. A missing, extra, or duplicate record, non-`PASS` state, empty/bad-hash evidence, wrong stage/profile/release line, invalid v0.2 lineage, or artifact/corpus mismatch produces a stable blocker and `eligible=false`. The result has no publication-authority field and cannot clear pending public-init validation or the fail-closed license policy for future or changed imports.

## Diagnostic policy

Parsing is recovery-oriented only when source occurrence conservation remains possible. Malformed documents yield bounded diagnostics and rejected occurrences; the builder never invents nodes to make a graph look complete. ERROR severity sets `graph.valid=false`. WARNING/INFO do not. Diagnostics are data quality results, not release readiness and not test evidence.

## DEC-1: New standalone schema, no v3/v4 compatibility mode

**Rationale:** `MIGRATION_MATRIX.md` rewrites source FR-3 and explicitly requests a fresh standalone schema. Historical shape heuristics would enlarge the contract and obscure deterministic behavior.

**Trade-off:** Existing corpora may need explicit migration before all entities are recognized.

**Alternatives:** Copy upstream dual-anchor and legacy rules (rejected); silently accept loose headings (rejected).

## DEC-2: Occurrence-first graph construction

**Rationale:** Duplicate and reference conservation must be proven before unique indexes can safely exist.

**Trade-off:** The build temporarily retains occurrence arrays and uses more memory than direct map insertion.

**Alternatives:** Last-writer/first-writer map (rejected: data loss); abort on first duplicate (rejected: incomplete diagnostics).

## DEC-3: Reject every link-like filesystem entry

**Rationale:** Cross-platform containment is auditable when links, junctions, reparse points, and mounts are not followed at all.

**Trade-off:** Repositories intentionally symlinking shared specs are unsupported in v0.2.

**Alternatives:** Resolve links and re-check final path (rejected: segment races and platform variance); allow internal links (deferred pending a separately proven race-safe design).

## DEC-4: One query service, two projections

**Rationale:** The [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) stages v0.2 extension queries and v0.3 MCP without adding a second control plane.

**Trade-off:** Transport-specific conveniences cannot change semantic shapes.

**Alternatives:** Independent MCP handlers (rejected: drift); MCP-only graph (rejected: v0.2 extension dependency).

## DEC-5: Dependency-free or fully bundled runtime

**Rationale:** An installed marketplace child cannot rely on the repository root’s development dependencies.

**Trade-off:** Bundled parser libraries increase artifact size and require license inventory.

**Alternatives:** Runtime install/download (rejected); native parser addon (rejected); root `node_modules` lookup (rejected).

## DEC-6: Occurrence-complete rename planning before mutation

**Rationale:** A heading rename can break links to ordinary headings and shared reference destinations that the domain-ID graph does not represent. A complete versioned occurrence inventory is therefore a read prerequisite, not an optional writer heuristic.

**Trade-off:** The immutable snapshot retains additional heading/link arrays and rewrite spans, increasing memory and response volume.

**Alternatives:** Inventory only ID headings (rejected: ordinary anchors remain unsafe); grep authored fragments (rejected: misses GLFM/reference semantics); let a writer rescan independently (rejected: parser and fingerprint drift).

## DEC-7: Release eligibility is a stage-profiled closed conjunction

**Rationale:** Per-requirement proof is not interchangeable, but v0.2 deliberately precedes MCP. A schema-owned profile lets v0.2 require every kernel, OMP, package, fixture, and budget obligation without depending on FR-9, while v0.3 remains unable to pass without an accepted same-lineage v0.2 baseline and every MCP-inclusive obligation.

**Trade-off:** The evidence schema and evaluator carry explicit stage/profile and one bounded v0.2 baseline input. Adding a future stage or mandatory requirement requires a new closed profile and evidence-schema version.

**Alternatives:** One FR-1..FR-13 set for every stage (rejected: makes v0.2 depend on unreleased MCP); silently ignore FR-9 at v0.2 (rejected: extra evidence must fail closed); threshold/percentage readiness (rejected); any-one evidence token (rejected); manual waiver as pass (rejected).

## No mutation design

There is intentionally no writer interface, repository lock, CAS token, transaction, rollback, status engine, persistence schema, repair action, or audit log in this design. Such surfaces require a separate authoring safety specification and cannot be added as optional methods to the read contract.

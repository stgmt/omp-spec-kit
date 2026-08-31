# Functional Requirements

The core uses `<spec-slug>:<local-id>` identities. The released eight MCP names are compatibility adapters, not additional core primitives.

## FR-1: Pure occurrence-first core

The kernel SHALL consume caller-supplied canonical source documents, parser schema, effective limits, and cancellation. It SHALL emit an immutable graph and query values without filesystem, clock, environment, process, network, OMP, or MCP access. Parsing SHALL retain source occurrences before unique indexes are built. No kernel writer, lifecycle, release, or authoring operation exists.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-occurrence-first-core)

**Scenario:** `@feature1` / `SCEN-pure-occurrence-first-core`

**Check:** CHK-FR1-01

**Task:** [TASK-1](TASKS.md#task-1-define-the-pure-core-boundary)

## FR-2: Canonical documents and qualified IDs

The kernel SHALL recognize exactly these fifteen canonical names inside each spec: `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<spec-slug>.feature`, `FIXTURES.md`, and `<spec-slug>_SCHEMA.md`. Role-aware parsing SHALL define FR only in FR.md, AC only in ACCEPTANCE_CRITERIA.md, and TASK only in TASKS.md; other authored kinds use their owning roles. Every local ID becomes `<spec-slug>:<local-id>`; duplicates remain candidate occurrences and identical IDs in different specs do not collide.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-documents-and-qualified-ids)

**Scenario:** `@feature2` / `SCEN-canonical-documents-and-qualified-ids`

**Check:** CHK-FR2-01

**Task:** [TASK-2](TASKS.md#task-2-implement-canonical-inventory-and-identity)

## FR-3: Typed graph conservation

The parser SHALL emit definition and reference occurrences before map insertion. A canonical ID with one valid definition elects one node; a duplicate ID elects none and retains every candidate. Each reference resolves to one permitted typed edge or one typed unresolved record. Missing, malformed, ambiguous, cross-spec, and forbidden-endpoint targets SHALL never create dangling edges. Document, definition, reference, node, edge, and diagnostic counts SHALL reconcile; any invariant error makes the graph invalid.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-typed-graph-conservation)

**Scenario:** `@feature3` / `SCEN-typed-graph-conservation`

**Check:** CHK-FR3-01

**Task:** [TASK-3](TASKS.md#task-3-build-typed-conserved-graph)

## FR-4: Four bounded core primitives

The internal core SHALL expose exactly four primitives: `inventory` for contained document/spec inventory, `findNodes` for typed/filterable node lookup, `traverse` for bounded directed graph traversal, and `diagnostics` for deterministic diagnostic projections including orphan, status, and structural validation views. All four SHALL use one bounded deterministic cursor envelope with request identity, graph fingerprint, normalized filter digest, stable sort position, totals, truncation, and typed errors. Primitive availability is not part of the graph fingerprint.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-four-bounded-primitives)

**Scenario:** `@feature4` / `SCEN-four-bounded-core-primitives`

**Check:** CHK-FR4-01

**Task:** [TASK-4](TASKS.md#task-4-implement-four-primitives-and-cursors)

## FR-5: Contained inputs and budgets

The read adapter SHALL accept one explicit root and only regular, canonical documents under valid spec slugs. It SHALL reject traversal, external paths, links, junctions, reparse or mount substitutions, and over-budget input before unsafe bytes are admitted. The core and adapter SHALL preserve cancellation, package, memory, latency, corpus, page, traversal, diagnostic, and response limits; hard failures are typed and writes are impossible. The kernel does not own transport preflight or lock/version state.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-contained-bounded-inputs)

**Scenario:** `@feature5` / `SCEN-contained-inputs-and-budgets`

**Check:** CHK-FR5-01

**Task:** [TASK-5](TASKS.md#task-5-enforce-containment-cancellation-and-budgets)

## FR-6: Historical eight-name compatibility

The released v0.3.2 runtime SHALL remain **SHIPPED** through thin adapters with these exact MCP names: `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`. Each adapter SHALL project the shared core result without semantic reinterpretation. Historical decoders, serializers, and immutable fixture replay MAY retain released-format compatibility only. New core behavior is **NEXT**; speculative extensions are **LATER** or omitted.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-historical-eight-name-compatibility)

**Scenario:** `@feature6` / `SCEN-historical-eight-name-compatibility`

**Check:** CHK-FR6-01

**Task:** [TASK-6](TASKS.md#task-6-preserve-eight-compatibility-adapters)

## FR-7: Deterministic diagnostics and fingerprint

The core SHALL normalize UTF-8 BOM and line endings, normalize public paths to NFC slash form, sort source and graph records deterministically, and compute one fingerprint from normalized source bytes, semantic parser schema, and membership-affecting limits. Diagnostics SHALL be bounded, sanitized, typed, and stable. Query names, MCP availability, transport metadata, and host state SHALL be outside the fingerprint.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-deterministic-diagnostics-and-fingerprint)

**Scenario:** `@feature7` / `SCEN-deterministic-diagnostics-and-fingerprint`

**Check:** CHK-FR7-01

**Task:** [TASK-7](TASKS.md#task-7-prove-deterministic-diagnostics-and-fingerprint)

## FR-8: Real fixtures and measurable budgets

Executable fixtures SHALL use identified real source bytes or be explicitly labelled synthetic for bounded implementation cases. Manifests SHALL preserve source identity, capture method/date, license disposition, trimming, stored/source hashes, byte counts, ground-truth oracles, and immutable receipt references. Package, memory, latency, cancellation, corpus, and serialized-response measurements SHALL identify artifact and corpus fingerprints. Graph validity and structural diagnostics SHALL never substitute for product-layer release evidence.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-real-evidence-and-measurable-budgets)

**Scenario:** `@feature8` / `SCEN-real-fixtures-and-measurable-budgets`

**Check:** CHK-FR8-01

**Task:** [TASK-8](TASKS.md#task-8-retain-real-fixture-and-budget-evidence)

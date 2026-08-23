# Design

## Context

This specification extends the spec-kernel typed model with a product-level capability layer. The kernel (`spec-kernel@1`) defines closed node kinds, edge types, and diagnostic codes; this spec introduces `spec-capability@1` as a dependent extension schema. The design preserves the kernel's pure-read-only boundary: capability parsing, edge resolution, conformance findings, and impact queries are all pure functions of supplied source bytes and graph snapshots.

## Component boundary

```mermaid
flowchart LR
  Root[Explicit repository root] --> FS[Bounded filesystem adapter]
  FS -->|SourceDocument[] including CAPABILITIES.md| Parse[Pure parsers + capability parser]
  Parse --> Occ[Definition reference heading link and capability occurrences]
  Occ --> Build[Pure graph builder + capability edges and findings]
  Build --> Snap[Immutable GraphSnapshot with CAPABILITY nodes]
  Snap --> Query[Pure QueryService + capability queries]
  Query --> OMP[OMP extension adapter]
  Query --> MCP[MCP adapter]
```

### Capability parser extension

Planned under `plugins/omp-spec-kit/src/kernel/parsers/capability.ts`:

- Parses `.specs/CAPABILITIES.md` level-2 and level-3 headings into CAPABILITY definition occurrences.
- Validates CAP-N and CAP-N.M ID grammar.
- Extracts nesting relationships (level-3 → enclosing level-2).
- Produces CAPABILITY attributes `{ nestingDepth, parentCapId }`.

### Declaration field parser

Planned as an extension to `plugins/omp-spec-kit/src/kernel/parsers/markdown.ts`:

- Recognizes `**Capability:** [CAP-N.M]` structured fields on FR/NFR headings.
- Recognizes `capabilities: [CAP-N, ...]` in spec README frontmatter.
- Produces DERIVES_FROM reference occurrences resolved through the standard pipeline.

### Impact query engine

Planned under `plugins/omp-spec-kit/src/kernel/query/impact.ts`:

- Consumes the immutable graph snapshot and backlink indexes.
- Computes structural impact via directed traversal: incoming COVERS, TESTED_BY (direct and two-hop via AC), REFS (tasks and dependent FRs), IMPLEMENTS (code files), DERIVES_FROM (parent capabilities).
- Computes semantic-recheck list from impacted scenarios and ACs.
- Computes invalidation set from scenario result identifiers.
- Returns versioned `spec-capability-impact@1` envelope.

### Conformance findings

Planned as an extension to `plugins/omp-spec-kit/src/kernel/graph/invariants.ts`:

- Evaluates CAPABILITY_DANGLING for unresolved DERIVES_FROM targets.
- Evaluates CAPABILITY_ORPHAN for capabilities with zero live derivers.
- Evaluates SPEC_WITHOUT_CAPABILITY for specs with no capability declarations.
- Assigns correct severity (ERROR/WARNING/INFO) per FR-3.

## Data flow

1. Filesystem adapter discovers `.specs/CAPABILITIES.md` alongside canonical spec documents.
2. Capability parser emits CAPABILITY definition occurrences with nesting metadata.
3. Markdown parser emits DERIVES_FROM reference occurrences from `**Capability:**` fields and frontmatter.
4. Graph builder resolves DERIVES_FROM edges against the endpoint matrix, preserving unresolved references.
5. Invariant checker evaluates capability-specific findings.
6. Query service exposes `requirements_of`, `capabilities_of`, and `get_impact` over the immutable snapshot.

## Key decisions

### D-1: Separate schema version rather than kernel modification

The kernel's closed-set discipline is its primary value. Adding CAPABILITY/DERIVES_FROM to `spec-kernel@1` would require re-reviewing the entire kernel contract. A separate `spec-capability@1` schema that depends on `spec-kernel@1` preserves kernel stability while allowing independent versioning and release gating.

### D-2: Repository-level CAPABILITIES.md rather than per-spec files

Capabilities are product-wording anchors that outlive individual specs. A per-spec file would couple capabilities to spec lifecycle, defeating the purpose. One repository-level `.specs/CAPABILITIES.md` ensures capabilities survive spec archival, absorption, and restructuring.

### D-3: Impact invalidation as contract, not implementation

The `get_impact` invalidation set defines WHAT should be invalidated when a node changes, not HOW freshness is computed. The future evidence layer owns freshness semantics; this spec consumes them by reference. This separation prevents premature coupling and keeps the read-only boundary clean.

### D-4: Advisory findings do not invalidate the graph

CAPABILITY_ORPHAN and SPEC_WITHOUT_CAPABILITY are advisory (WARNING/INFO). Making them errors would block valid graphs during incremental authoring. Only CAPABILITY_DANGLING (broken reference) fails closed, matching the kernel's treatment of broken references.

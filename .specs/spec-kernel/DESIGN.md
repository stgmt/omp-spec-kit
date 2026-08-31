# Design

## Boundary

The product is one pure graph/query core with thin host adapters.

flowchart LR
  Sources[Caller-supplied canonical SourceDocument values] --> Core[Occurrence-first graph core]
  Core --> Primitives[Four internal primitives]
  Primitives --> OMP[OMP compatibility adapter]
  Primitives --> MCP[MCP compatibility adapter]
  Fixtures[Real immutable fixtures] --> Core

The core receives source bytes, parser schema, limits, and cancellation. It owns normalization, role-aware parsing, occurrence conservation, identity, typed edges, deterministic diagnostics, graph fingerprinting, and bounded queries. It performs no filesystem, clock, environment, process, network, OMP, or MCP access.

Host adapters own transport and repository reading. They supply already-contained canonical documents and project the core envelope without adding graph semantics. Editor navigation and anchors remain outside the kernel. A producer may supply normalized step-binding records; the kernel does not parse JavaScript or implement a Cucumber matcher.

## Source and graph flow

1. The caller supplies the complete canonical document snapshot from the fifteen-name allowlist.
2. The core normalizes encoding, line endings, paths, parser schema, and effective membership limits.
3. Parsers emit source occurrences before any maps are built.
4. Identity resolution qualifies local IDs with the immediate spec slug.
5. The graph builder elects only one candidate, preserves ambiguous candidates, resolves typed edges, and records every unresolved outcome.
6. Diagnostics and deterministic counts are computed before the snapshot fingerprint.
7. The four primitives read the immutable graph through one cursor/error envelope.

## Compatibility boundary

The released v0.3.2 adapter names are compatibility spellings, not core primitives. They remain thin mappings over the four primitives and preserve their historical result carriers only where a released decoder or serializer requires them. No second graph, runtime, or query service is introduced.

The MCP compatibility mappings are exact and intentionally finite as a first slice:

| MCP name | Core projection |
|---|---|
| `spec_inventory` | `inventory` |
| `spec_get_node` | `findNodes` with an exact identity filter |
| `spec_find_nodes` | `findNodes` |
| `spec_get_edges` | `traverse` with depth one |
| `spec_trace` | `traverse` |
| `spec_diagnostics` | `diagnostics` |
| `spec_overview` | `inventory` summary |
| `spec_markdown_inventory` | `inventory` of producer-supplied normalized document occurrences |

## Invariants

- Every accepted definition occurrence is unique, ambiguous, or rejected.
- Every reference occurrence is exactly one resolved edge or typed unresolved record.
- Every resolved edge has existing permitted endpoints.
- Duplicate occurrences never overwrite one another.
- Counters reconcile with occurrence arrays before the graph is valid.
- Diagnostics are bounded, sanitized, stably ordered, and never release decisions.
- A graph fingerprint covers normalized source bytes, parser schema, and membership-affecting limits only; query availability and transport metadata are outside it.

## Decisions

### DEC-1: One core

Parallel v1/v2 runtimes would duplicate invariants and make compatibility ambiguous. One core with historical adapters keeps released names without preserving obsolete machinery.

### DEC-2: Occurrence first

Arrays are populated before indexes so duplicates, malformed references, and conservation failures remain observable.

### DEC-3: Boundary ownership

Containment, transport, request IDs, locks, versions, and server allowlists belong to host layers. The kernel receives validated source values and owns graph semantics only.

### DEC-4: Historical evidence stays historical

The v0.3.2 runtime contract and real fixture receipts remain immutable compatibility evidence. They do not imply that the simplified core is already implemented.

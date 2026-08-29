# Non-Functional Requirements

Budgets are mandatory release checks for the exact `spec-kernel@2` / `spec-capability@2` candidate profile. Measurements bind artifact/baseline/evidence fingerprints, OMP/runtime, OS/CPU/memory, warm-up, samples and raw observations.

## NFR-PERF-1: Capability build and query latency

On a reference benchmark extending the kernel benchmark (30 specs, 450 canonical documents) with 50 CAPABILITY nodes, 200 DERIVES_FROM edges, and 100 impact-query targets:

- Capability parsing and DERIVES_FROM edge resolution SHALL add at most 200 ms p95 to cold graph build over 20 isolated samples after one discarded warm-up.
- `requirements_of` and `capabilities_of` SHALL complete in at most 25 ms p95 over 100 samples each on an already-built graph.
- `get_impact` at default limits SHALL complete in at most 50 ms p95 over 100 samples.
- A maximum-permitted `get_impact` (maxDepth=8, maxVisited=5,000, limit=200) SHALL complete or return cancellation/limit error within 250 ms p95.
- `invalidate_evidence` SHALL accept at most 64 MiB of evidence bytes, inspect at most 100,000 rows, return at most 200 rows per page, observe cancellation every 1,024 rows or 10 ms, and complete a maximum request within 2,000 ms p95 over 20 isolated samples after one discarded warm-up; hard adapter deadline is 5,000 ms.

## NFR-SIZE-1: Extended bundle size

- Adding the capability extension to the installed runtime JavaScript SHALL increase uncompressed size by at most 200 KiB and gzip size by at most 50 KiB over the base kernel artifact.
- One serialized `get_impact` response SHALL be at most 512 KiB UTF-8. If a valid result would exceed it, the service SHALL reduce at an item boundary, set `truncated=true`, and return `nextCursor`.
- One serialized `invalidate_evidence` response SHALL be at most 1 MiB UTF-8 and page only at complete invalidation-row boundaries; one oversized row returns `RESPONSE_TOO_LARGE`.

## NFR-MEM-1: Extended memory bound

- Peak incremental resident memory above the kernel baseline SHALL be at most 32 MiB additional while building capability nodes, DERIVES_FROM edges, backlink indexes, and one 100,000-row invalidation page evaluation; the overlay SHALL not retain a second evidence snapshot after response.

## NFR-REL-1: Determinism and fail-closed

- Equivalent normalized inputs SHALL produce byte-identical capability nodes, DERIVES_FROM edges, conformance findings, impact responses, recomputed evidence fingerprints, and invalidation pages on every supported platform.
- All capability-related arrays SHALL use schema-defined stable sort orders.
- Unknown capability IDs, malformed CAP IDs, and forbidden DERIVES_FROM endpoints SHALL return typed errors or diagnostics, never guessed compatibility.
- CAPABILITY_DANGLING (ERROR) SHALL set `graph.valid=false`; CAPABILITY_ORPHAN (WARNING) and SPEC_WITHOUT_CAPABILITY (INFO) SHALL NOT.

## NFR-SEC-1: Containment

- Capability document reads SHALL stay within the explicit repository root and apply the same containment, symlink rejection, and budget checks as `spec-kernel:FR-7`.
- Impact query responses SHALL contain only repository-relative paths and canonical IDs; no absolute paths, environment values, or document bodies.

## NFR-USE-1: Actionable bounded diagnostics

- CAPABILITY_DANGLING diagnostics SHALL include the broken declaration span, the unknown target ID, and a remediation hint (`define-capability-or-fix-reference`).
- CAPABILITY_ORPHAN diagnostics SHALL include the orphan capability ID, its last-known deriver count, and a remediation hint (`review-for-archival-or-add-derivers`).
- SPEC_WITHOUT_CAPABILITY hints SHALL name the spec slug and remediation `add-owning-spec-capabilities-document`; root singleton/frontmatter advice is forbidden.

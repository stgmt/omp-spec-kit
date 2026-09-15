# Non-Functional Requirements

Budgets are release gates for the installed child-plugin artifact. Measurements must identify artifact SHA-256, kernel schema version, graph fingerprint, OMP/runtime version, OS, CPU, logical core count, memory, warm-up policy, sample count, and raw observations. A faster developer checkout is not substitute evidence.

## NFR-PERF-1: Build and query latency

On the reference benchmark of 30 specs, 450 canonical documents, 6,000 definitions, 18,000 domain references, 7,500 Markdown headings, 24,000 semantic Markdown link occurrences, and 10 MiB total UTF-8 source bytes:

- A cold read-adapter plus graph build SHALL complete in at most 2,000 ms p95 over 20 isolated samples after one discarded warm-up.
- `inventory`, `getNode`, `getEdges`, `diagnostics`, and `overview` SHALL complete in at most 25 ms p95 over 100 samples each on an already-built graph.
- `findNodes`, `trace`, and `markdownInventory` at their default limits SHALL complete in at most 50 ms p95 over 100 samples each.
- A maximum permitted trace (`maxDepth=8`, `maxVisited=5,000`, `limit=200`) or focused `markdownInventory` page (`limit=200`) SHALL complete or return cancellation/limit error within 250 ms p95.
- The adapter and long traversal loops SHALL observe cancellation at least every 1,024 processed items or 10 ms of monotonic adapter time, whichever occurs first. The pure kernel receives cancellation as an explicit callback/token; it does not read a clock itself.

The historical upstream two-second/30-spec statement in `docs/upstream/dev-pomogator/spec-generator-v4/FR.md` is provenance only; the target benchmark shape above is authoritative.

## NFR-SIZE-1: Bundle and response size

- The complete installed runtime JavaScript for kernel plus OMP adapter SHALL be at most 1.5 MiB uncompressed and 500 KiB gzip.
- Adding the v0.3 MCP adapter SHALL keep total installed runtime JavaScript at most 2.0 MiB uncompressed and 700 KiB gzip.
- Runtime parser data and license notices SHALL be counted in installed artifact size reporting even when not JavaScript.
- One serialized query response SHALL be at most 1 MiB UTF-8. If a valid result would exceed it, the service SHALL reduce the page at an item boundary, set `truncated=true`, and return `nextCursor`; if one item alone cannot fit, it SHALL return `RESPONSE_TOO_LARGE`.
- Error messages SHALL be at most 1,024 Unicode scalar values and each diagnostic message at most 2,048; long received values SHALL be redacted and length-reported.

## NFR-MEM-1: Memory bound

- Peak incremental resident memory above the idle installed plugin baseline SHALL be at most 128 MiB while reading, building complete definition/reference/heading/link occurrence arrays, and querying the reference benchmark.
- A hard-limit corpus SHALL be rejected before resident memory exceeds 192 MiB above baseline.
- Source bytes MAY be released after normalized records and content hashes are produced; retaining two complete byte copies plus full body copies is prohibited unless measured within the bound.

## NFR-SEC-1: Containment and data minimization

- The adapter SHALL accept one explicit root and return only repository-relative `/`-separated paths.
- It SHALL reject symlinks, Windows junctions/reparse points, mount substitutions, non-regular files, path traversal, and paths outside the real root before opening target bytes.
- It SHALL not read `.git`, `.env*`, user home, plugin cache, logs, state databases, or any non-canonical document.
- Diagnostics and query errors SHALL not include absolute paths, environment values, stack traces, arbitrary OS error text, or document bodies by default.
- Text/body search excerpts SHALL be opt-in, at most 240 Unicode scalar values, and drawn only from accepted canonical documents.
- Zero operation writes bytes, creates directories, changes permissions, or spawns a process.

## NFR-REL-1: Determinism and fail-closed results

- Equivalent normalized inputs and limits SHALL produce byte-identical canonical serialization and fingerprint on every supported platform.
- All arrays SHALL use schema-defined stable sort orders; object serialization SHALL use lexicographically ordered keys.
- Unknown schema versions, release stages, evidence profiles, operations, node/edge kinds, cursors, or required fields SHALL return typed errors or ineligible results, never guessed compatibility.
- Any graph ERROR SHALL set `valid=false`; query envelopes SHALL carry the graph validity and diagnostics summary.
- Parser recovery SHALL never manufacture a definition or edge from malformed input.
- A complete Markdown inventory SHALL preserve every heading/link occurrence across a fingerprint-bound cursor chain, allocate each canonical anchor against the complete previously emitted set, keep anchors pairwise unique, and reconcile global/matched totals; response paging SHALL not change membership.
- Kernel release eligibility SHALL be false for any unknown/mismatched stage/profile, wrong release line, invalid v0.2 lineage, wrong-profile or cross-stage record, non-`PASS`, missing, extra, duplicate, bad-hash, or binding-mismatched mandatory record and SHALL use stable blocker order.

## NFR-PORT-1: Portable installed runtime

- The child artifact SHALL run from its installed directory with the repository source tree absent and all ambient/root `node_modules` hidden.
- Non-host runtime dependencies SHALL be absent or bundled, including grammar tables and transitive data files.
- Native addons, platform-specific post-install downloads, and build-host absolute paths are forbidden.
- Path behavior SHALL be defined for Windows and POSIX; both normalize public paths to `/` and enforce the same containment outcome.
- OMP host API usage SHALL stay in the OMP adapter and follow https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md.

## NFR-USE-1: Actionable bounded diagnostics

Every diagnostic SHALL state a closed code, severity, bounded message, source span when safe, canonical/local identity when known, related spans, and remediation identifier. Query errors SHALL additionally identify operation, invalid parameter, expected constraint, retryability, and candidate/diagnostic references plus path/anchor/heading/link/rewrite identity when applicable. Release blockers SHALL identify the mandatory check, closed blocker code, and bounded evidence paths. Codes and fields are exhaustive in `spec-kernel_SCHEMA.md`.

## Hard input and query limits

| Budget | Default | Hard maximum |
|---|---:|---:|
| Specs per repository | all discovered | 100 |
| Canonical documents | all discovered | 2,000 |
| Bytes per document | n/a | 2 MiB |
| Aggregate source bytes | n/a | 50 MiB |
| Normalized repository-relative path | n/a | 512 UTF-8 bytes |
| Lines per document | n/a | 100,000 |
| Definition occurrences | n/a | 100,000 |
| Domain reference occurrences | n/a | 500,000 |
| Markdown heading occurrences | n/a | 250,000 |
| Semantic Markdown link occurrences | n/a | 500,000 |
| Diagnostics returned per build | 1,000 | 10,000 |
| Query page limit | 50 | 200 |
| Trace depth | 2 | 8 |
| Trace visited nodes | 1,000 | 5,000 |
| Search text | n/a | 256 Unicode scalar values |
| Cursor | n/a | 512 ASCII bytes |
| Serialized response | n/a | 1 MiB |

Callers MAY choose stricter limits. They SHALL NOT increase hard maxima without a schema/minor-version change and new benchmark evidence.

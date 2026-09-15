# Research

## Scope and method

This research uses the repository-owned [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), the repository-local migration matrix, the import manifest, the pinned upstream snapshot, and current OMP documentation cited by the decision record. The snapshot supplies provenance and design evidence only. No upstream code is imported, no compatibility mode is promised, and no upstream scenario is treated as passing target evidence.

## RF-1: The upstream graph boundary is mixed with runtime machinery

**Finding:** The upstream design describes an in-memory typed graph but also couples it to file watching, incremental rebuilds, NDJSON runtime state, hooks, persistence options, repair, and a broad MCP registry.

**Evidence:**
- `docs/upstream/dev-pomogator/spec-generator-v4/DESIGN.md`, “Core,” “MCP layer,” and startup-flow sections.
- `docs/upstream/dev-pomogator/spec-generator-v4/FR.md`, source FR-2 and source FR-14.
- `MIGRATION_MATRIX.md` rows FR-2 (`REWRITE`), FR-10 (`DEFER`), FR-14 (`DROP`), FR-39/40 (`DEFER`).

**Decision:** The target defines a pure kernel over supplied bytes and separate read/host adapters. Watchers, persistence, locks, mutation, repair, and harness state are excluded.

## RF-2: Spec-qualified identity prevents corpus collision

**Finding:** The migration matrix adopts composite identity because a corpus can legally contain the same local ID in different specs, while the upstream example keys nodes by bare IDs.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-36 (`ADOPT`) and row FR-67 (`ADOPT`).
- `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md`, “Entity 1: SpecGraph,” whose historical example uses bare `FR-001` map keys.

**Decision:** Runtime identity is `<spec-slug>:<local-id>`. Bare IDs resolve only within the source spec. Duplicate candidates inside the same qualified identity are preserved, never overwritten.

## RF-3: Lossless parsing needs conservation, not only diagnostics

**Finding:** The migration matrix adopts graph-native inventory, controlled evidence, typed endpoints, and real fixture conservation. A duplicate diagnostic alone is insufficient if the underlying map already discarded an occurrence.

**Evidence:**
- `MIGRATION_MATRIX.md` rows FR-31, FR-64, FR-67, and FR-68.
- `docs/upstream/dev-pomogator/spec-generator-v4/FIXTURES.md`, fixture categories and inventory.
- `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md`, general invariants.

**Decision:** Definition and reference occurrences remain first-class records. Snapshot counts must satisfy explicit conservation equations, and ambiguous identities do not produce elected nodes.

## RF-4: A bounded read can still be unsafe without containment

**Finding:** The migration matrix rewrites cross-host root selection into deterministic root containment and adopts bounded artifact parsing. Plugin-cache and source-launcher heuristics are explicitly not portable.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-62 (`REWRITE`), row FR-70 (`ADOPT`), row FR-74 (`ADOPT`).
- `docs/upstream/dev-pomogator/spec-generator-v4/REQUIREMENTS.md`, CHK-FR70-07.

**Decision:** The adapter accepts one explicit root, rejects traversal and every symbolic-link/junction/reparse segment, reads only regular files from the canonical document allowlist, and applies byte/file/spec/query limits before unbounded work.

## RF-5: One shared query service avoids extension/MCP drift

**Finding:** The [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) stages graph/read queries in v0.2 and a single MCP projection in v0.3. OMP documentation distinguishes extension registration from plugin-root MCP configuration.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-82 (`REWRITE`) and staged release boundary.
- [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), exact phase sequence, read-only-first kernel, and allowed staged query surface.
- OMP extension contract: https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md
- OMP MCP configuration: https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md

**Decision:** v0.2 owns one pure query service. The OMP extension and v0.3 MCP server are projections with transport validation only. The MCP adapter remains in the same child plugin and exposes no mutations.

## RF-6: Installed artifacts must not depend on a source checkout

**Finding:** The [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) requires the installed child package to run without a root `node_modules`. The upstream design mentions runtime packages, but its dependency closure is not a target distribution contract.

**Evidence:**
- [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), read-only-first kernel and v0.2 release gate.
- `MIGRATION_MATRIX.md` release boundary v0.2-v0.3.

**Decision:** The kernel is dependency-free at runtime or all non-host dependencies are fully bundled in the child artifact. Dynamic imports outside the installed child package and reliance on root/source dependencies are release blockers.

## RF-7: The source snapshot is provenance, not an automatically admitted fixture

**Finding:** The import manifest pins the snapshot commit and hashes and records the later source-owner MIT attestation for the copied files. License evidence is resolved, but that fact alone does not establish target fixture ground truth, parser compatibility, or executed behavior.

**Evidence:**
- `IMPORT_MANIFEST.yaml`, snapshot commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`, attestation commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a`, and per-file `MIT_ATTESTED_SOURCE_OWNER` status.
- `IMPORT_MANIFEST.yaml` hashes for `FR.md`, `DESIGN.md`, `FIXTURES.md`, `spec-generator-v4.feature`, and `spec-generator-v4_SCHEMA.md`.

**Decision:** Initial research may point to snapshot paths. Target fixture admission still requires exact captured bytes, a complete fixture manifest, and reviewed ground truth; it is never inferred from the license attestation or snapshot presence.

## RF-8: Deterministic parsing requires a narrower format than “all Markdown”

**Finding:** The upstream parser supported historical anchors and broad compatibility. The migration matrix directs a fresh standalone schema instead of v3 compatibility, while the [public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md) requires an occurrence-complete heading/anchor/link inventory before safe rename can be considered.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-3 (`REWRITE`) and source-document disposition for `spec-generator-v4_SCHEMA.md` (`REWRITE`).
- `docs/upstream/dev-pomogator/spec-generator-v4/FR.md`, source FR-3.
- [Public-init decision record](../../docs/decisions/omp-spec-kit-public-init.md), read-only-first kernel safe-rename prerequisite.

**Decision:** v0.2 recognizes exact ATX definition headings, structured reference fields, and English Gherkin with explicit scenario IDs, while a separate `glfm-anchor@1` inventory retains every ATX/Setext heading and every semantic GLFM link occurrence for deterministic rename planning. Tables repeat references but never define an entity. Unknown formats remain visible through diagnostics rather than heuristic recovery.

## RISK-1: Parser-format overreach

**Likelihood:** Medium

**Impact:** High

Supporting historical prose variants without a closed grammar could make host- or library-specific behavior part of the public API.

**Mitigation:** Keep the v0.2 grammar explicit in `spec-kernel_SCHEMA.md`; require a fixture and schema revision for each added construct.

## RISK-2: Duplicate loss hidden by maps

**Likelihood:** Medium

**Impact:** Critical

A node map keyed before duplicate detection could erase last-writer or first-writer occurrences.

**Mitigation:** Accumulate occurrence arrays first, diagnose cardinality, and elect nodes only for keys with exactly one valid definition.

## RISK-3: Read-only path disclosure

**Likelihood:** Medium

**Impact:** Critical

A query could follow a symlink/junction or leak absolute host paths in diagnostics.

**Mitigation:** Reject link-like segments before open, use an explicit root, return repository-relative paths only, and redact OS error details.

## RISK-4: Adapter semantic drift

**Likelihood:** Medium

**Impact:** High

The extension and MCP adapter could develop different filters, error codes, or traversal rules.

**Mitigation:** Adapters call one service and contract fixtures compare canonical envelopes across transports.

## RISK-5: Unbounded corpus denial of service

**Likelihood:** Medium

**Impact:** High

Malformed or huge documents, traversal depth, or result sets could exhaust memory and block a host session.

**Mitigation:** Apply hard input/query/result budgets, stop before over-budget bytes are parsed, and return `LIMIT_EXCEEDED` with bounded diagnostics.

## RISK-6: False parity claim

**Likelihood:** Low

**Impact:** High

Reusing names or snapshot examples could be mistaken for compatibility or executed proof.

**Mitigation:** Target-owned schemas and scenarios are new, snapshot references are labeled provenance-only, and all BDD scenarios remain unexecuted specification text until later evidence exists.

## Open parser-format decisions

These are bounded design choices for implementation, not permission to vary the public contract silently:

1. Select a dependency-free Markdown/Gherkin implementation or bundle reviewed parser libraries; either choice must produce the exact schema outputs and stay within artifact budgets.
2. Decide whether a future schema revision will support non-English Gherkin dialects. v0.2 is English-only and reports `UNSUPPORTED_GHERKIN_DIALECT` otherwise.
3. Decide whether YAML contract cards become a recognized definition source in a later schema. v0.2 treats fenced YAML as body text and takes identity only from canonical headings/tags.
4. Decide whether Scenario Outline example rows become separate evidence-run nodes in a later evidence specification. v0.2 has one authored Scenario node and retains example rows as attributes.

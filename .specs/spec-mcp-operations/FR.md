# Functional Requirements

The operations spec uses one qualified identity space. Read/Core, Read/Evidence, and Write requirements are separate domains over shared adapters.

## Read / Core

The core uses `<spec-slug>:<local-id>` identities. The released eight MCP names are compatibility adapters, not additional core primitives.

## FR-1: Pure occurrence-first core

The kernel SHALL consume caller-supplied canonical source documents, parser schema, effective limits, and cancellation. It SHALL emit an immutable graph and query values without filesystem, clock, environment, process, network, OMP, or MCP access. Parsing SHALL retain source occurrences before unique indexes are built. No kernel writer, lifecycle, release, or authoring operation exists.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-pure-occurrence-first-core)

**Scenario:** `@feature1` / `SCEN-mcp-read-core-pure-occurrence-first-core`

**Check:** CHK-READ-CORE-FR1-01

**Task:** [TASK-1](TASKS.md#task-1-define-the-pure-core-boundary)

## FR-2: Canonical documents and qualified IDs

The kernel SHALL recognize exactly these fifteen canonical names inside each spec: `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<spec-slug>.feature`, `FIXTURES.md`, and `<spec-slug>_SCHEMA.md`. Role-aware parsing SHALL define FR only in FR.md, AC only in ACCEPTANCE_CRITERIA.md, and TASK only in TASKS.md; other authored kinds use their owning roles. Every local ID becomes `<spec-slug>:<local-id>`; duplicates remain candidate occurrences and identical IDs in different specs do not collide.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-canonical-documents-and-qualified-ids)

**Scenario:** `@feature2` / `SCEN-mcp-read-core-canonical-documents-and-qualified-ids`

**Check:** CHK-READ-CORE-FR2-01

**Task:** [TASK-2](TASKS.md#task-2-implement-canonical-inventory-and-identity)

## FR-3: Typed graph conservation

The parser SHALL emit definition and reference occurrences before map insertion. A canonical ID with one valid definition elects one node; a duplicate ID elects none and retains every candidate. Each reference resolves to one permitted typed edge or one typed unresolved record. Missing, malformed, ambiguous, cross-spec, and forbidden-endpoint targets SHALL never create dangling edges. Document, definition, reference, node, edge, and diagnostic counts SHALL reconcile; any invariant error makes the graph invalid.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-typed-graph-conservation)

**Scenario:** `@feature3` / `SCEN-mcp-read-core-typed-graph-conservation`

**Check:** CHK-READ-CORE-FR3-01

**Task:** [TASK-3](TASKS.md#task-3-build-typed-conserved-graph)

## FR-4: Four bounded core primitives

The internal core SHALL expose exactly four primitives: `inventory` for contained document/spec inventory, `findNodes` for typed/filterable node lookup, `traverse` for bounded directed graph traversal, and `diagnostics` for deterministic diagnostic projections including orphan, status, and structural validation views. All four SHALL use one bounded deterministic cursor envelope with request identity, graph fingerprint, normalized filter digest, stable sort position, totals, truncation, and typed errors. Primitive availability is not part of the graph fingerprint.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-four-bounded-primitives)

**Scenario:** `@feature4` / `SCEN-mcp-read-core-four-bounded-core-primitives`

**Check:** CHK-READ-CORE-FR4-01

**Task:** [TASK-4](TASKS.md#task-4-implement-four-primitives-and-cursors)

## FR-5: Contained inputs and budgets

The read adapter SHALL accept one explicit root and only regular, canonical documents under valid spec slugs. It SHALL reject traversal, external paths, links, junctions, reparse or mount substitutions, and over-budget input before unsafe bytes are admitted. The core and adapter SHALL preserve cancellation, package, memory, latency, corpus, page, traversal, diagnostic, and response limits; hard failures are typed and writes are impossible. The kernel does not own transport preflight or lock/version state.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-contained-bounded-inputs)

**Scenario:** `@feature5` / `SCEN-mcp-read-core-contained-inputs-and-budgets`

**Check:** CHK-READ-CORE-FR5-01

**Task:** [TASK-5](TASKS.md#task-5-enforce-containment-cancellation-and-budgets)

## FR-6: Historical eight-name compatibility

The released v0.3.2 runtime SHALL remain immutable in historical package receipts and replay fixtures with its exact eight names (`spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`). These historical names SHALL NOT be required in the active runtime surface. Historical decoders, serializers, and immutable fixture replay MAY retain released-format compatibility only.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-historical-eight-name-compatibility)

**Scenario:** `@feature6` / `SCEN-mcp-read-core-historical-eight-name-compatibility`

**Check:** CHK-READ-CORE-FR6-01

**Task:** [TASK-6](TASKS.md#task-6-preserve-eight-compatibility-adapters)

## FR-7: Deterministic diagnostics and fingerprint

The core SHALL normalize UTF-8 BOM and line endings, normalize public paths to NFC slash form, sort source and graph records deterministically, and compute one fingerprint from normalized source bytes, semantic parser schema, and membership-affecting limits. Diagnostics SHALL be bounded, sanitized, typed, and stable. Query names, MCP availability, transport metadata, and host state SHALL be outside the fingerprint.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-deterministic-diagnostics-and-fingerprint)

**Scenario:** `@feature7` / `SCEN-mcp-read-core-deterministic-diagnostics-and-fingerprint`

**Check:** CHK-READ-CORE-FR7-01

**Task:** [TASK-7](TASKS.md#task-7-prove-deterministic-diagnostics-and-fingerprint)

## FR-8: Real fixtures and measurable budgets

Executable fixtures SHALL use identified real source bytes or be explicitly labelled synthetic for bounded implementation cases. Manifests SHALL preserve source identity, capture method/date, license disposition, trimming, stored/source hashes, byte counts, ground-truth oracles, and immutable receipt references. Package, memory, latency, cancellation, corpus, and serialized-response measurements SHALL identify artifact and corpus fingerprints. Graph validity and structural diagnostics SHALL never substitute for product-layer release evidence.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-real-evidence-and-measurable-budgets)

**Scenario:** `@feature8` / `SCEN-mcp-read-core-real-fixtures-and-measurable-budgets`

**Check:** CHK-READ-CORE-FR8-01

**Task:** [TASK-8](TASKS.md#task-8-retain-real-fixture-and-budget-evidence)

## Read / Evidence

All identities use `spec-mcp-operations:<local-id>`. This is a NEXT contract: it does not claim runtime delivery. The evaluator consumes the kernel graph but never adds execution truth to the kernel.

## FR-9: Pure evaluation boundary

The evaluator SHALL be a pure function of a current kernel snapshot, trusted-capture run envelopes, and limits. Filesystem access, runner execution, containment, and capture belong to adapters; the evaluator SHALL NOT observe the clock, environment, process, network, OMP, or MCP.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-pure-evaluator-has-no-side-effects)

**Scenario:** `@feature9` / `SCEN-mcp-read-evidence-spec-mcp-operations-pure-evaluation-boundary`

## FR-10: Supported execution artifacts

Trusted capture SHALL accept only `cucumber-messages-ndjson@33.0.4` and `pytest-bdd-cucumber-json@1`. It SHALL retain the actual producer bytes, recompute their SHA-256, and return a typed unsupported, malformed, absent, or limit error instead of guessing. There is no overlay or sidecar artifact kind.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-closed-producer-artifact-set)

**Scenario:** `@feature10` / `SCEN-mcp-read-evidence-spec-mcp-operations-supported-artifact-kinds`

## FR-11: Trusted-capture run envelope

One trusted local capture adapter SHALL construct one immutable run envelope from an actual runner invocation. The envelope owns producer/run identity, captured scope, exact artifact bytes and hash, tested implementation identity, and capture-time scenario/step bindings. Caller-supplied hashes SHALL NOT authenticate caller-supplied metadata; adversarial attestation is a separate future concern.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-one-run-has-one-capture-owned-envelope)

**Scenario:** `@feature11` / `SCEN-mcp-read-evidence-spec-mcp-operations-trusted-capture-envelope`

## FR-12: Scenario result join

Every parsed producer result SHALL receive exactly one `JOINED`, `UNMATCHED`, or `AMBIGUOUS` outcome. Authority is an exact qualified scenario ID or a canonical scenario tag verified against the current graph. A name match MAY be reported as a diagnostic candidate but SHALL NOT produce evidence, freshness, or readiness.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-only-stable-identity-can-join)

**Scenario:** `@feature12` / `SCEN-mcp-read-evidence-spec-mcp-operations-stable-scenario-join`

## FR-13: Full-run scope authority

The trusted capture adapter SHALL derive `FULL` or `PARTIAL` from the actual invocation and captured selection. `FULL` SHALL name the expected scenario set and prove that no narrowing selector was used. Partial runs remain queryable but SHALL NOT satisfy task or release readiness and SHALL NOT replace a full-run result.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-only-capture-owned-full-scope-is-authoritative)

**Scenario:** `@feature13` / `SCEN-mcp-read-evidence-spec-mcp-operations-full-run-scope-authority`

## FR-14: Freshness and staleness

Freshness SHALL compare only the joined scenario content hash, the applicable step-binding hash, and the tested implementation identity captured by the run against current values. Any mismatch is `STALE`; any required missing binding is `INDETERMINATE`; all applicable values equal is `FRESH`. A whole-graph fingerprint and timestamps SHALL NOT participate in per-result freshness.

**Acceptance:** [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-current-content-bindings-determine-freshness)

**Scenario:** `@feature14` / `SCEN-mcp-read-evidence-spec-mcp-operations-freshness-staleness`

## FR-15: Fail-closed status truth

Task evidence SHALL be `VERIFIED` only when every currently required scenario has a `PASSED`, `FRESH`, `FULL`-scope `ScenarioEvidence`. Missing, failed, skipped, unknown, stale, indeterminate, ambiguous, unmatched, or partial evidence SHALL produce a concrete blocker. Roll-up is all-not-any.

**Acceptance:** [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-every-required-scenario-needs-fresh-passed-full-evidence)

**Scenario:** `@feature15` / `SCEN-mcp-read-evidence-spec-mcp-operations-fail-closed-status-truth`

## FR-16: Waiver honesty

A waived task SHALL remain `WAIVED_OPEN` and SHALL NOT count as verified regardless of evidence. Non-waived task evidence states are exactly `VERIFIED` or `BLOCKED`.

**Acceptance:** [AC-16.1](ACCEPTANCE_CRITERIA.md#ac-161-waived-tasks-remain-open)

**Scenario:** `@feature16` / `SCEN-mcp-read-evidence-spec-mcp-operations-waiver-honesty`

## FR-17: Internal row accounting

The evaluator SHALL preserve every parsed producer row and assign one join outcome. It SHALL preserve every currently required scenario as either satisfied by one elected evidence reference or blocked by a reason. Counts MAY be derived for display; duplicated public census counters, stored equations, and `equationsValid` state SHALL NOT exist.

**Acceptance:** [AC-17.1](ACCEPTANCE_CRITERIA.md#ac-171-no-row-or-required-scenario-is-silently-lost)

**Scenario:** `@feature17` / `SCEN-mcp-read-evidence-spec-mcp-operations-internal-row-accounting`

## FR-18: Anti-false-green invariants

No status, freshness, or trace claim SHALL exist without a parsed producer row from a trusted-capture envelope whose artifact bytes re-hash correctly. Capture-time bindings SHALL come from the trusted adapter, not an independently supplied sidecar. Structural parsing, labels, self-declared hashes, name-only matches, and partial runs SHALL never establish readiness.

**Acceptance:** [AC-18.1](ACCEPTANCE_CRITERIA.md#ac-181-no-verdict-without-trusted-captured-bytes)

**Scenario:** `@feature18` / `SCEN-mcp-read-evidence-spec-mcp-operations-anti-false-green-invariants`

## FR-19: Real fixtures per read-core discipline

Every executable parser/capture fixture SHALL originate from actual bytes emitted by an identified producer and record fixture ID, capture command or method, producer/version, source, capture date, SHA-256, byte count, license disposition, permitted trimming, and reviewed expected normalized evidence. Synthetic data is allowed only for scale or a minimal one-fault derivative and SHALL be labeled.

**Acceptance:** [AC-19.1](ACCEPTANCE_CRITERIA.md#ac-191-fixtures-are-real-hashed-and-reviewed)

**Scenario:** `@feature19` / `SCEN-mcp-read-evidence-spec-mcp-operations-real-fixture-provenance`

## FR-20: Budgets

The capture adapter and evaluator SHALL enforce artifact count/byte, parsed-row, diagnostic, response, and trace-page limits from `EvidenceLimitsV2`. Hard overflow returns a closed error. Latency is measured externally because the evaluator has no clock.

**Acceptance:** [AC-20.1](ACCEPTANCE_CRITERIA.md#ac-201-budgets-are-enforced)

**Scenario:** `@feature20` / `SCEN-mcp-read-evidence-spec-mcp-operations-budget-enforcement`

## FR-21: Release-eligibility contribution

The product release gate MAY consume ordinary `TaskEvidence` and `ScenarioEvidence` for the tested candidate. It SHALL require every required task to be `VERIFIED` and SHALL retain their evidence references. There is no evidence-specific 14-record manifest, second evidence fingerprint, or custom release evaluator; this contribution never replaces the product gate.

**Acceptance:** [AC-21.1](ACCEPTANCE_CRITERIA.md#ac-211-release-uses-ordinary-fresh-full-evidence)

**Scenario:** `@feature21` / `SCEN-mcp-read-evidence-spec-mcp-operations-release-contribution`

## FR-22: MCP projection of get_test_result and get_scenario_trace

`get_test_result` SHALL return one `ScenarioEvidence` selected by qualified scenario ID, or `null` when no evidence exists. `get_scenario_trace` SHALL accept that evidence reference and return only its bounded trace page and failure detail. Result and trace SHALL NOT define duplicate run, freshness, artifact, trace, or fingerprint identities. These later read-only tools do not alter the eight-tool v0.3.2 first slice.

**Acceptance:** [AC-22.1](ACCEPTANCE_CRITERIA.md#ac-221-result-returns-evidence-and-trace-uses-its-reference)

**Scenario:** `@feature22` / `SCEN-mcp-read-evidence-spec-mcp-operations-mcp-projection-of-run-results`

## Write

Runtime identities are qualified as `spec-mcp-operations:FR-N`. Product state is `NEXT` under `plugin-distribution:FR-17`; no paragraph claims runtime delivery.

## FR-23: Two-tool public boundary

The v0.6.0 MCP authoring surface SHALL expose all 24 authoring operations as public tools: 20 proposal tools returning a deterministic Proposal structure, and 4 transactional apply tools executing with CAS verification and atomic rollback. The current-host `tool_call` policy SHALL verify minted MCP tool names; every other mutating call whose resolved target is under canonical `.specs/**` SHALL be denied before execution. Calls outside that path remain subject to normal host policy.

**Acceptance:** [AC-23.1](ACCEPTANCE_CRITERIA.md#ac-231)

**Scenario:** `@feature23`

## FR-24: Pure deterministic proposal

`propose_patch` SHALL accept canonical operations for exactly one spec, resolve them against one immutable kernel snapshot, apply them only in memory, and return a complete deterministic Proposal containing proposal identity/hash, spec identity, base snapshot hash, normalized operations, per-document before/after hashes, bounded unified diffs, affected node IDs, and ordered findings. Proposal creation SHALL write no repository, journal, review, or transaction state. Incomplete or truncated previews SHALL be invalid and unappliable.

**Contract card:** kind `api`; subject `pure-proposal`; observables: Proposal and unchanged tree hashes; negative cases: mixed specs, duplicate target, invalid operation, exceeded preview bound; verification: deterministic no-write tests, pending.
**Acceptance:** [AC-24.1](ACCEPTANCE_CRITERIA.md#ac-241), [AC-24.2](ACCEPTANCE_CRITERIA.md#ac-242)
**Scenario:** `@feature24`
**Story / use case:** [US-10](USER_STORIES.md#us-10-review-exact-changes-before-mutation), [UC-9](USE_CASES.md#uc-9-propose-one-traced-change)

## FR-25: Containment, anchors, and resulting-spec validation

Both public tools SHALL require one explicit canonical repository root and root-relative targets inside one ordinary `.specs/<slug>/` directory. Before reading or writing target content, the resolver SHALL reject traversal, absolute, drive-relative, UNC/device, alternate-data-stream, NUL, normalization-collision, symlink, junction, mount/reparse, unsupported-document, and cross-spec targets; existing ancestors and the target SHALL be checked with platform filesystem metadata. Proposal and apply SHALL reuse the kernel's parser, canonical IDs, form rules, anchor inventory, inbound-link closure, and FR↔AC↔Scenario↔CHK↔TASK conformance over the complete resulting spec. Anchor-addressed edits SHALL refuse ambiguity, incomplete inventory, cross-spec inbound rewrites, and any target whose resulting graph cannot be fully revalidated.

**Contract card:** kind `filesystem`; subject `contained-valid-result`; observables: canonical targets and ordered findings; negative cases: path escape, linked component, broken anchor, trace loss, unavailable validator; verification: real platform and corpus fixtures, pending.
**Acceptance:** [AC-25.1](ACCEPTANCE_CRITERIA.md#ac-251), [AC-25.2](ACCEPTANCE_CRITERIA.md#ac-252)
**Scenario:** `@feature25`
**Story / use case:** [US-13](USER_STORIES.md#us-13-contain-the-write-boundary), [US-14](USER_STORIES.md#us-14-preserve-anchors-and-bytes), [UC-12](USE_CASES.md#uc-12-reject-an-escaping-or-raw-write), [UC-13](USE_CASES.md#uc-13-rename-a-heading-safely)

## FR-26: Exact-proposal apply with CAS and revalidation

`apply_proposed_patch` SHALL accept only an existing complete Proposal identity/hash, the expected current hash of every changed document, and a non-empty reason. It SHALL accept no raw operations or replacement bytes. Under one spec-scoped exclusive lock it SHALL re-resolve containment, verify the Proposal hash and document set, compare current hashes, rebuild the exact in-memory result, rerun every mandatory validator, compare hashes again immediately before commit, and refuse on any mismatch. It SHALL never auto-rebase. Replaying the same request identity and content SHALL not create a second commit.

**Contract card:** kind `behavior`; subject `cas-apply`; observables: one exact result or structured refusal; negative cases: missing/extra hash, stale base, proposal mismatch, concurrent change, request reuse with different content; verification: two-writer and replay tests, pending.
**Acceptance:** [AC-26.1](ACCEPTANCE_CRITERIA.md#ac-261), [AC-26.2](ACCEPTANCE_CRITERIA.md#ac-262)
**Scenario:** `@feature26`
**Story / use case:** [US-11](USER_STORIES.md#us-11-reject-stale-edits), [UC-10](USE_CASES.md#uc-10-apply-the-exact-proposal), [UC-11](USE_CASES.md#uc-11-resolve-a-concurrent-edit)

## FR-27: Atomic one-spec commit and internal rollback

After successful revalidation, the writer SHALL stage a complete result generation on the same filesystem, synchronize files/directories where supported, and replace the spec generation while the exclusive lock prevents mixed reader observations. Any failure before committed visibility SHALL preserve or restore the complete old generation. If swap completion is uncertain, internal recovery SHALL select only a fully hashed valid old or new generation and converge to one complete state. If neither can be proven complete, the service SHALL stop with `RECOVERY_REQUIRED`, perform no further mutation, preserve bounded diagnostics, and instruct manual restoration of the one spec through ordinary VCS or backup. No public recovery, rebaseline, transaction, or overwrite operation SHALL be exposed as a substitute for the bounded proposal and apply workflow.

**Contract card:** kind `filesystem`; subject `atomic-generation`; atomicity: one spec generation; rollback: internal old/new hash selection; terminal failure: `RECOVERY_REQUIRED` plus manual restore; verification: fault injection and concurrent reader tests, pending.
**Acceptance:** [AC-27.1](ACCEPTANCE_CRITERIA.md#ac-271), [AC-27.2](ACCEPTANCE_CRITERIA.md#ac-272)
**Scenario:** `@feature27`
**Story / use case:** [US-12](USER_STORIES.md#us-12-commit-related-documents-together), [US-16](USER_STORIES.md#us-16-recover-without-another-public-repair-api), [UC-14](USE_CASES.md#uc-14-survive-a-writer-fault), [UC-15](USE_CASES.md#uc-15-stop-at-unrecoverable-storage)

## FR-28: Byte conservation and compact redacted outcomes

Every accepted edit SHALL preserve untouched bytes, source EOL style, encoding, and final-newline state; changed documents SHALL equal the Proposal after-hashes byte-for-byte. Proposal and Apply responses SHALL use the compact schema and seven error families defined in [spec-mcp-operations_SCHEMA.md](spec-mcp-operations_SCHEMA.md). A successful apply SHALL return one redacted MutationReceipt with request/proposal identity, outcome, reason and actor reference when available, changed relative document paths with before/after hashes, and findings. Responses SHALL exclude document bodies, full diffs from apply, credentials, environment values, authorization material, retained bytes, and unrelated paths.

**Contract card:** kind `data`; subject `conservation-and-receipt`; observables: byte hashes, EOL/final-newline state, compact receipt; negative cases: accidental normalization, secret/body leak, stack trace; verification: byte corpus and redaction tests, pending.
**Acceptance:** [AC-28.1](ACCEPTANCE_CRITERIA.md#ac-281), [AC-28.2](ACCEPTANCE_CRITERIA.md#ac-282)
**Scenario:** `@feature28`
**Story / use case:** [US-14](USER_STORIES.md#us-14-preserve-anchors-and-bytes), [US-15](USER_STORIES.md#us-15-receive-a-useful-private-receipt), [UC-10](USE_CASES.md#uc-10-apply-the-exact-proposal)

## FR-29: Real correctness evidence

Implementation SHALL be verified with provenance-recorded real kernel corpus captures, real Windows and POSIX containment observations, real multi-process races, and the real generation writer under deterministic fault injection. Tests SHALL plant omissions in containment, CAS, validation, anchor rewrite, atomic rollback, and redaction and prove each test fails when its protected check is disabled. Fixture and test results SHALL be release evidence owned by normal verification; they SHALL NOT create a separate runtime lifecycle, mutation-quality gate, eligibility tuple, registry manifest, or public API.

**Contract card:** kind `verification`; subject `authoring-correctness`; observables: producer provenance, reconciled hashes, race/fault outcomes; negative cases: synthetic producer shape, source-text assertion, zero-scenario pass, disabled guard surviving; verification: integration and targeted fault/mutation tests, pending.
**Acceptance:** [AC-29.1](ACCEPTANCE_CRITERIA.md#ac-291), [AC-29.2](ACCEPTANCE_CRITERIA.md#ac-292)
**Scenario:** `@feature29`
**Story / use case:** [US-11](USER_STORIES.md#us-11-reject-stale-edits), [US-12](USER_STORIES.md#us-12-commit-related-documents-together), [UC-11](USE_CASES.md#uc-11-resolve-a-concurrent-edit), [UC-14](USE_CASES.md#uc-14-survive-a-writer-fault)


## FR-30: MCP discovery metadata and handshake

The MCP server SHALL expose exactly 11 tools in the fixed contract order: `mcp_preflight`, `spec_catalog`, `spec_entities`, `spec_graph`, `spec_documents`, `spec_inspect`, `spec_tasks`, `spec_evidence`, `spec_markdown`, `spec_propose_patch`, and `apply_proposed_patch`. Each `tools/list` entry SHALL publish a non-empty top-level `title` equal to the contract label, and publish exactly four boolean annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`. The 10 non-mutating tools SHALL use `true, false, true, false` respectively; `apply_proposed_patch` SHALL use `false, true, true, false`. Each first description line SHALL be non-empty and no longer than 200 characters. `initialize` SHALL return one instructions paragraph defining the discovery, query, proposal, review, and approval workflow.

**Contract card:** kind `functional`; subject `mcp-discovery`; observables: 11 ordered tools, titles, four annotations, description cap, initialize instructions; verification: direct JSON-RPC and staged BDD.
**Acceptance:** [AC-30.1](ACCEPTANCE_CRITERIA.md#ac-301-mcp-discovery-metadata-and-handshake)
**Scenario:** `@feature30 @FR-30 @AC-30.1 @id:SCEN-mcp-discovery-metadata`

## FR-31: Declared result envelope and actionable recovery

The MCP server MUST declare one stable output schema for every listed tool, return the same canonical envelope in the structured content and the text content, and expose bounded recovery guidance for stale cursors and optimistic-concurrency conflicts. A `repositoryRootFingerprint` conflict MUST use stable `causeCode` `REPOSITORY_ROOT_FINGERPRINT_MISMATCH`, mention that another project or a stale snapshot may be in use, expose only `activeProjectRootId` and `resolvedRootId` as root identities, and direct the caller to `mcp_preflight`. When those roots do not match, the caller MUST reconnect; otherwise it MUST refresh the `spec_catalog` overview and create a new proposal.


## FR-32: Discriminated branch schemas and strict argument validation

Consolidated MCP tools SHALL define input schemas with top-level discriminator fields and strict `oneOf` branches where `additionalProperties` is false. Each branch in `oneOf` SHALL publish its own title formatted as `<discriminator>: <variant>` and a descriptive description, while the top-level discriminator property description SHALL instruct the client to choose exactly one declared branch. Missing discriminators, unknown discriminators, cross-branch fields, and extraneous properties SHALL be rejected with typed `INVALID_REQUEST` validation errors before dispatch to query or authoring services.

**Acceptance:** [AC-32.1](ACCEPTANCE_CRITERIA.md#ac-321-discriminated-branch-schemas-and-strict-argument-validation)

**Scenario:** `@feature32 @FR-32 @AC-32.1 @id:SCEN-mcp-discriminated-variants`

## FR-33: Domain type dictionary catalog

`spec_catalog` with `view: "types"` SHALL return the authoritative domain type dictionary from the kernel containing exactly 15 entity kind descriptors and 7 edge type descriptors. Each descriptor SHALL include a canonical identifier, a Title Case display label, and a single-sentence description. Kernel enums, schema declarations, documentation, and catalog responses SHALL be derived from this single immutable source.

**Acceptance:** [AC-33.1](ACCEPTANCE_CRITERIA.md#ac-331-domain-type-dictionary-catalog)

**Scenario:** `@feature33 @FR-33 @AC-33.1 @id:SCEN-mcp-types-catalog`

## FR-34: Surface blast limits and fail-closed measurement

The MCP tool surface SHALL be bounded by automated measurement. In release candidates, tool count SHALL equal 11, catalog JSON size SHALL not exceed 25,499 bytes (60% of the 38-tool baseline), total description text SHALL not exceed 2,000 characters, and zero retired tool names SHALL appear. Automated verification SHALL fail closed whenever any bound is violated.

**Acceptance:** [AC-34.1](ACCEPTANCE_CRITERIA.md#ac-341-surface-blast-limits-and-fail-closed-measurement)

**Scenario:** `@feature34 @FR-34 @AC-34.1 @id:SCEN-mcp-surface-blast-limits`

## FR-35: Hard tool retirement without backward-compatibility shims

All 27 superseded tool names from the 38-tool surface SHALL be excised from runtime discovery, query routing, active documentation, and test assertions. Unregistered calls to retired names SHALL return standard JSON-RPC protocol error `-32602` without custom migration hints, aliases, or backward-compatibility fallbacks.

**Acceptance:** [AC-35.1](ACCEPTANCE_CRITERIA.md#ac-351-hard-tool-retirement-without-backward-compatibility-shims)

**Scenario:** `@feature35 @FR-35 @AC-35.1 @id:SCEN-mcp-hard-retirement-no-shims`

## FR-36: Deterministic mutation testing gate

Tool contracts, validation rules, discriminator invariants, and annotation mappings SHALL be guarded by an in-memory deterministic mutation test gate. Mutation runs SHALL evaluate synthetic mutant variants against contract invariants and require zero surviving mutants (`survivors: 0`) before release.

**Acceptance:** [AC-36.1](ACCEPTANCE_CRITERIA.md#ac-361-deterministic-mutation-testing-gate)

**Scenario:** `@feature36 @FR-36 @AC-36.1 @id:SCEN-mcp-mutation-testing-gate`

## FR-37: Unified specification and corpus validation inspection

`spec_inspect` with `check: "validation"` SHALL serve as the single public entry point for structural specification and corpus validation, replacing the deprecated `specValidation` and `diagnostics` branches without backward-compatibility aliases. The operation SHALL accept optional `specSlugs` (empty or omitted means entire corpus; non-empty validates named specifications), `severities`, `codes`, `paths`, `limit`, and `cursor`. Unknown or malformed spec slugs SHALL fail closed with typed errors (`INVALID_PARAMETER` for malformed slug syntax, `NOT_FOUND` when a requested specification is absent from the corpus) before computing validation results. Membership in a specification's validation scope SHALL be determined solely by `diagnostic.specSlug`; diagnostics lacking `specSlug` SHALL be included in corpus validation and excluded from spec-specific scopes, and path prefix matching (`startsWith(".specs/<slug>/")`) SHALL NOT be used. Overall `valid`, `verdict` (`VALID` or `INVALID`), and scope counts (`errors`, `warnings`, `info`, `total`) SHALL be computed across all diagnostics in the selected scope prior to applying severity, code, or path filters. Filters SHALL only constrain the returned `items` array and `counts.matched`. Pagination via `limit` and `cursor` SHALL page `items` deterministically with cursor bound to graph fingerprint, scope, and filters.

**Contract card:** kind `functional`; subject `spec-validation`; observables: unified validation check, scope filtering, pre-filter verdict and totals, matched counts, error on missing/malformed slug, removal of specValidation and diagnostics variants; verification: direct JSON-RPC and staged BDD.
**Acceptance:** [AC-37.1](ACCEPTANCE_CRITERIA.md#ac-371-unified-specification-and-corpus-validation-inspection)
**Scenario:** `@feature37 @FR-37 @AC-37.1 @id:SCEN-mcp-unified-validation`

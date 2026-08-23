# Migration matrix

This matrix classifies the immutable `dev-pomogator` source at commit
`158cd5ccfe4d08625734fc1692d8916cc5838fd6`. The upstream snapshot is a
reference, not the requirements source of truth for `omp-spec-kit`.

The snapshot's historical root-license evidence gap was later resolved by the source-owner MIT attestation merged in dev-pomogator commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` ([PR #232](https://github.com/stgmt/dev-pomogator/pull/232)). This later evidence covers the frozen subtree without changing the snapshot commit, source-document decisions, requirement counts, or implementation status. Public-init source-freeze, specification, anchor, secret/public-tree, and candidate-diff validation are complete; reviewed initial commit `fe70b10caaed888daf7c48dfc8f1bad9caf45598` is public, non-installable, and unreleased.

- **ADOPT** — retain the product-neutral contract, with new wording and tests in the standalone product.
- **REWRITE** — retain the intent, but remove dev-pomogator, Claude Code, mutable-runtime, or monorepo assumptions.
- **DEFER** — useful later, but outside the stated release stage or dependent on a safety gate.
- **DROP** — historical, harness-specific, stateful, or contrary to the standalone OMP boundary.

## Functional requirements

Counts: **ADOPT 27 · REWRITE 11 · DEFER 22 · DROP 26 · total 86**.

| Source | Short subject | Decision | Standalone direction and rationale |
|---|---|---:|---|
| FR-1 | Cucumber-JS migration and canonical NDJSON | REWRITE | Keep portable evidence ingestion; remove dev-pomogator migration paths and test-runner installation side effects. |
| FR-2 | In-memory SpecGraph and watcher | REWRITE | Keep the read-only graph model; exclude watcher startup and mutable runtime from the first kernel. |
| FR-3 | Markdown parser, anchors, compatibility | REWRITE | Keep deterministic heading identity and aliases; define a fresh standalone schema instead of v3 compatibility. |
| FR-4 | MCP `get_trace` surface | DEFER | Revisit as the bounded v0.3 MCP adapter after the shared query contract is stable. |
| FR-5 | Claude PreToolUse hard hooks | DROP | Claude hook lifecycle is outside an OMP-only standalone plugin. |
| FR-6 | Claude PostToolUse push/throttle | DROP | Prompt injection and hook throttling are harness behavior, not kernel behavior. |
| FR-7 | Native Claude Marksman LSP plugin | DROP | Claude plugin/LSP installation and managed binaries are outside the OMP product boundary. |
| FR-8 | LLM semantic-drift judge | DEFER | Requires a separately specified provider, privacy, cost, timeout, and evidence contract. |
| FR-9 | Language-neutral Cucumber Messages input | ADOPT | Canonical multi-runner evidence is product-neutral and belongs in the evidence model. |
| FR-10 | SQLite FTS5 shared index | DEFER | Persistence, locking, recovery, and migrations follow the in-memory kernel, not v0.1.0. |
| FR-11 | dev-pomogator v3→v4 migrator | DROP | The standalone repository has no v3 installed base or dev-pomogator CLI contract. |
| FR-12 | Architecture-research Claude skill | DROP | This is a dev-pomogator authoring skill and recursion contract, not standalone kernel scope. |
| FR-13 | Orphan detection policy | ADOPT | Named, configurable orphan findings are portable conformance behavior. |
| FR-14 | Multi-env paths, watcher, locks, Cursor | DROP | Mixed watcher/lock/Claude/Cursor runtime claims do not transfer; portable root containment is re-specified under FR-62. |
| FR-15 | Persistent conformance JSONL log | DROP | Local state/log creation conflicts with the read-only first release and public-state boundary. |
| FR-16 | Codespaces lifecycle injection | DROP | Installation-time devcontainer mutation is not part of the standalone plugin. |
| FR-17 | Cross-spec reconciliation | DEFER | Valuable later authoring analysis, but not the initial inventory or kernel slice. |
| FR-18 | Cross-spec resolver | DEFER | Resolution writes require proposal, containment, and concurrency contracts first. |
| FR-19 | Two-tier hook failure policy | DROP | Hook-specific backwards compatibility has no OMP-kernel counterpart. |
| FR-20 | Prompt-time conformance summary | DROP | Claude prompt delivery is a harness surface; future OMP UX must use native surfaces. |
| FR-21 | `spec-status.ts` task-table compatibility | DROP | This preserves a dev-pomogator CLI format, not a public standalone API. |
| FR-22 | Conformance-hook version gate | DROP | Hook rollout and legacy-version behavior do not transfer. |
| FR-23 | Two dev-pomogator log files | DROP | Historical log inventory is local harness state. |
| FR-24 | Meta-guard manifest preservation | DROP | Protects the source plugin's hook manifest, which is not imported. |
| FR-25 | Complete Claude `hooks.json` union | DROP | The public init deliberately contains no Claude or OMP plugin payload. |
| FR-26 | LLM judge deny-list and opt-out | DEFER | Retain as research input for a future semantic-judge security specification. |
| FR-27 | Marksman binary supply chain | DROP | The product does not install Marksman or inherit Claude LSP distribution. |
| FR-28 | Hook fixed-window throttle | DROP | Delivery-timing semantics belong to the dropped hook. |
| FR-29 | File nodes and `implements` edges | ADOPT | Source-to-implementation trace edges are core graph semantics when paths are repository-relative. |
| FR-30 | `get_trace.code_impl[]` | DEFER | Preserve the response idea for the v0.3 MCP projection after kernel queries exist. |
| FR-31 | Real multi-language NDJSON fixtures | ADOPT | Real-producer fixture conservation is a portable evidence requirement. |
| FR-32 | Evidence-derived task status | REWRITE | Keep fail-closed status truth; remove source runner paths and define standalone evidence inputs. |
| FR-33 | Workflow orchestrator skill and ledger | DROP | Claude skill orchestration and self-improve ledgers are not part of the single OMP plugin. |
| FR-34 | Anchor integrity and repair | ADOPT | Deterministic link integrity is portable authoring behavior; mutation remains separately gated. |
| FR-35 | Test-quality honesty gate | ADOPT | Passing plumbing alone must not count as requirement evidence. |
| FR-36 | Spec-qualified graph identities | ADOPT | Composite identity is essential to prevent cross-spec collisions. |
| FR-37 | Authoritative verdict and corpus-wide truth | REWRITE | Keep one fail-closed verdict; remove source-specific auditors and status implementations. |
| FR-38 | Full lifecycle status through MCP | DEFER | Implement first in shared kernel/query contracts; expose through MCP only in v0.3. |
| FR-39 | MCP-only spec access and audit log | DEFER | Central access and audit require a later adapter and privacy/state policy. |
| FR-40 | Validated spec mutation through MCP | DEFER | Authoring writes wait for proposal, CAS, atomicity, and containment evidence. |
| FR-41 | Phased creation with headless Claude agents | DROP | Claude subprocess orchestration is a source-harness assumption. |
| FR-42 | Thin skill over thick MCP server | DEFER | Reconsider as an OMP-native UX layering rule after extension and MCP contracts exist. |
| FR-43 | Reality-anchored drift triage | REWRITE | Keep explicit drift states; replace dev-pomogator skills and repository assumptions. |
| FR-44 | Reverse traceability | ADOPT | Requirements must trace both to and from tests, delivery, research, and design. |
| FR-45 | Proof-gated archival | DEFER | Destructive archival and pruning require later authoring safety gates. |
| FR-46 | Task↔scenario↔requirement trace | ADOPT | Completion must be backed by the task's own current scenario evidence. |
| FR-47 | Design, research, and story graph nodes | ADOPT | These are product-neutral traceability inputs to requirement completeness. |
| FR-48 | Central status transitions through a door | DEFER | Mutation/state transitions are later authoring scope, not read-only v0.1.0. |
| FR-49 | Runtime status surfing and cache reconciliation | DROP | Pinator/statusline/cache coupling is mutable dev-pomogator runtime behavior. |
| FR-50 | Refuse fake-close of waived tasks | ADOPT | Waiver cannot silently satisfy required work; retain the fail-closed invariant. |
| FR-51 | Universal BDD migrator | DEFER | Migration automation follows stable schemas and real-runner support. |
| FR-52 | Session dogfood hardening | DROP | The claims describe source-session friction and source MCP/BDD workflow. |
| FR-53 | Deterministic mutation kill verifier | DEFER | Mutation is a later roadmap stage with its own evidence gate. |
| FR-54 | Loose task-list rework helper | DEFER | Add only after the canonical standalone task schema is established. |
| FR-55 | Claude child-skill trigger metadata | DROP | Claude skill frontmatter and auto-trigger behavior do not transfer to OMP. |
| FR-56 | Canonical coverage plus freshness overlay | ADOPT | Preserve current-run provenance and never let stale overlays replace the canonical snapshot. |
| FR-57 | Prose completeness classifier | ADOPT | Placeholders and incomplete required documents must fail readiness explicitly. |
| FR-58 | Inherited v3 scenario ownership | DROP | This is source-corpus migration accounting, not a target product requirement. |
| FR-59 | Bounded Claude hook reminders | DROP | Claude hook messaging and durable source logs are excluded. |
| FR-60 | High-level MCP authoring API | DEFER | Authoring API waits for v0.3 read API and later CAS/mutation work. |
| FR-61 | Unified readiness UX | REWRITE | Define one standalone result contract and make extension/MCP projections consistent by stage. |
| FR-62 | Cross-host target-project identity | REWRITE | Keep deterministic root selection and containment; remove plugin-cache, Claude stdin, and source launcher assumptions. |
| FR-63 | Canonical readiness precheck and verdict | ADOPT | Mandatory lanes use non-empty AND and fail closed on missing, stale, duplicate, or unrecorded evidence. |
| FR-64 | Graph-native inventory and controlled evidence | ADOPT | Complete typed inventory, named outcomes, and conservation are kernel-level contracts. |
| FR-65 | Acceptance-to-delivery coverage | ADOPT | External, paid, authenticated, deployed, and schema claims require explicit delivery evidence. |
| FR-66 | Typed requirement metadata and delivery demands | ADOPT | Versioned metadata, closed demand types, and explicit waivers are product-neutral. |
| FR-67 | Typed edge endpoint schema | ADOPT | One exhaustive edge contract and deterministic endpoint violations belong in the graph kernel. |
| FR-68 | Acceptance criterion owns its proof | ADOPT | Parent or bulk-tagged evidence must not silently satisfy a distinct AC. |
| FR-69 | NFRs participate in completion truth | ADOPT | Required NFRs need their own trace and current evidence. |
| FR-70 | Content-addressed artifact evidence | ADOPT | Contained paths, hashes, producer/run identity, and freshness form a portable proof contract. |
| FR-71 | Independent demonstration judgment | ADOPT | Producer and reviewer separation prevents self-attested operational proof. |
| FR-72 | Canonical versioned typed tasks | ADOPT | Stable typed task records with source-span conservation support deterministic planning. |
| FR-73 | Validated dependency DAG | ADOPT | Named cycle/missing/self-dependency findings and current predecessor evidence are portable. |
| FR-74 | Constrained execution surfaces | ADOPT | Typed read/write claims, normalization, containment, and non-executable locators are safety fundamentals. |
| FR-75 | Derived conflict graph | DEFER | Conflict scheduling is later authoring/planning scope after task and surface contracts. |
| FR-76 | Deterministic execution planner | DEFER | Waves, estimates, and critical path are not required for inventory or the first kernel release. |
| FR-77 | Task-owned evidence and stale invalidation | ADOPT | Current evidence must be owned, fingerprinted, and invalidated by dependency changes. |
| FR-78 | Reviewed discovery expansion | DEFER | Graph-patch mutation requires later budgets, approval, CAS, and atomicity evidence. |
| FR-79 | MCP planning, persistence, and rollout | DEFER | Combines later planner, MCP, SQLite, and installation concerns; split by release stage. |
| FR-80 | Deterministic task synthesis | REWRITE | Preserve acceptance-lane conservation for later authoring; remove source workflow and scheduling coupling. |
| FR-81 | Cursor IDE host adapter | DROP | The standalone target is OMP; other host adapters need an explicit future compatibility decision. |
| FR-82 | Bounded truthful inventory/query | REWRITE | Deliver inventory in v0.1.0, kernel queries in v0.2, and MCP projection in v0.3. |
| FR-83 | Codex Desktop host adapter | DROP | Codex/Claude distribution is outside the first OMP-only product boundary. |
| FR-84 | Multilayer validator and autorepair | DEFER | Validation may follow the kernel; repair waits for safe authoring and atomic mutation. |
| FR-85 | Strict per-requirement contract cards | ADOPT | Typed rationale, risk, verification, demand, AC, scenario, and task links improve standalone traceability. |
| FR-86 | Coherent agent-facing status/action UX | REWRITE | Keep one canonical status/evidence/remediation contract; remove dashboard, Plane, and dev-pomogator surface assumptions. |

## Source documents

All non-state documents are copied byte-for-byte under `docs/upstream/` even when
their product disposition is DEFER or DROP. Copying preserves provenance; it does
not adopt the document as standalone requirements. The three state-like files are
inventoried and hashed but intentionally not copied.

| Source document | Decision | Rationale |
|---|---:|---|
| `.progress.json` | DROP | Mutable workflow state; excluded from the public snapshot. |
| `.test-results.ndjson.tmp.21652` | DROP | Temporary test evidence/state; excluded from the public snapshot. |
| `.test-results.ndjson.tmp.41720` | DROP | Temporary test evidence/state; excluded from the public snapshot. |
| `ACCEPTANCE_CRITERIA.md` | REWRITE | Valuable behaviors, but tied to source FRs, runners, tools, and paths. |
| `BACKLOG_DESIGN.md` | DEFER | Backlog mutation/resolution is later authoring scope. |
| `CHANGELOG.md` | DROP | Historical dev-pomogator release record cannot become this product's changelog. |
| `DECISION_RECOMMENDATION.md` | DEFER | Preserve as research input; re-decide within standalone constraints. |
| `DESIGN.md` | REWRITE | Contains reusable graph ideas mixed with source harness architecture. |
| `FILE_CHANGES.md` | DROP | Records dev-pomogator paths and implementation state that do not exist here. |
| `FIXTURES.md` | REWRITE | Keep real-producer fixture principles; recapture target-owned fixtures later. |
| `FR.md` | REWRITE | Source of this per-FR matrix, not the target product requirements. |
| `MANUAL_AGENT_E2E_WALKTHROUGH.md` | DROP | Exercises source Claude/MCP/runtime surfaces rather than a standalone OMP release. |
| `MISSING_FILE_PATCHES_REVIEW.md` | DROP | Historical repair analysis for source files. |
| `MISSING_FILE_REPORT.md` | DROP | Historical source-corpus report, not a target obligation. |
| `NFR.md` | REWRITE | Re-baseline performance, reliability, security, and portability against OMP releases. |
| `OWNERSHIP_RECOMMENDATION.md` | DEFER | Ownership must be established for the new public repository. |
| `README.md` | REWRITE | Source product identity and install instructions do not transfer. |
| `REQUIREMENTS.md` | REWRITE | Retain typed contract-card patterns, with new product identities and release gates. |
| `RESEARCH.md` | REWRITE | Keep evidence that remains applicable and re-verify mutable runtime claims. |
| `RESUME.md` | DROP | Session handoff state is not public product documentation. |
| `REVIEW_NOTES.md` | DROP | Historical source review state is not target authority. |
| `TASKS.md` | REWRITE | Re-plan work by standalone releases; source completion claims do not transfer. |
| `TASK_PLANNING_PRIOR_ART.md` | DEFER | Useful input for later typed planning, outside current release scope. |
| `USER_STORIES.md` | REWRITE | Reframe users around one public OMP plugin and specification-first delivery. |
| `USE_CASES.md` | REWRITE | Reframe flows around OMP installation and staged read-only capabilities. |
| `spec-generator-v4.feature` | REWRITE | Source scenarios are provenance, not passing target evidence. |
| `spec-generator-v4_SCHEMA.md` | REWRITE | Separate portable graph/query types from source MCP, hooks, and runtime state. |

## Release boundary derived from the matrix

1. **Public init:** provenance snapshot, decisions, policy, and manager-readable roadmap only; no installable plugin.
2. **v0.1.0:** one OMP plugin with one bounded, read-only inventory/diagnostic path.
3. **v0.2:** standalone graph kernel and read queries, starting with ADOPT/REWRITE items above.
4. **v0.3:** one bounded MCP adapter over the same query service.
5. **Later:** authoring, CAS/mutation, planners, semantic judging, backlog, archival, and mutation verification behind separate safety and evidence gates.

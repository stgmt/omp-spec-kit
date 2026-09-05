# Roadmap

This roadmap is organized around what a user can do. A release is shipped only after the installed package is exercised from a fresh OMP session and its behavior is recorded against real repository data.

## Reference Architecture & Audit

All roadmap items are formally grounded in the multi-layered analysis report:
- [`audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md`](audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md) — Comprehensive Agent UX, Specification Quality, and Architectural Evaluation.

---

## Shipped Releases

### v0.3.2 — shipped read-only baseline
Bounded, read-only specification graph with 8 compatibility tools.

### v0.4.1 — shipped proposal-first authoring
Added proposal-first authoring tools (`spec_propose_patch`, `apply_proposed_patch`) with fail-closed .specs containment.

### v0.5.4 — shipped evidence & navigation
Added scenario evidence inspection, runtime traces, and expanded navigation matrix (27 tools).

### v0.6.0 — shipped safe authoring
Single MCP server exposing 49 tools with all-or-nothing transactional guarantees.

### v0.7.0 — hardened safe authoring
Line selector stripping for Windows and execution-payload guards.

### v0.8.0 — consolidated 11-tool surface
Unified task-oriented surface with 10 read-only tools and one transactional apply tool.

### v0.8.2 — shipped unified validation inspection
Unified validation query combining graph closure and filtered diagnostics.

### v1.0.0 — shipped stable release
Consolidated 10-tool MCP surface with 9 read-only query tools and single `spec_patch` authoring tool with atomic commit and rollback protection.

### v1.0.2 — shipped internal URI guard fix
Unblocked all 16 recognized OMP internal URI schemes (`agent`, `artifact`, `conflict`, `history`, `issue`, `local`, `mcp`, `memory`, `omp`, `pr`, `rule`, `security`, `skill`, `ssh`, `vault`, `xd`) through the containment gate. Enforced strict LF line endings across built plugin distribution payloads. Reference: [`audit-reports/internal-uri-guard-regression-2026-09-05.md`](audit-reports/internal-uri-guard-regression-2026-09-05.md).

---

## Planned Releases (v1.1.0 – v1.4.0)

### v1.1.0 — Agent UX Quick Wins & Error Hygiene

Outcome: agents experience zero misleading write errors on read operations, can inspect directory layouts and Git history without lexical blocking, and author specification edits without multi-turn round-trips.

Grounding: addresses Findings 1.1, 1.2, 1.3, and 2.1 in [`audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md`](audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md).

Key changes:
- **Read redirect vs. write block**: direct read attempts under `.specs/**` return `SPEC_READ_REDIRECT` with actionable guidance to `spec_documents(action: "read", spec: "<slug>", doc: "<doc>")` instead of the confusing `RAW_SPEC_WRITE`.
- **Lexical guard refinement**: `hasEmbeddedSpecReference` restricts blocking to filesystem mutating tools (`write`, `edit`) and destructive shell patterns, permitting read-only inspection commands (`git log`, `git diff`, `ls`, non-destructive `eval`).
- **Content delivery on read-for-edit**: `spec_documents(action: "read", readForEdit: true)` returns both structural metadata (`sha256`, `headings`) and full document `content`, eliminating the third preparatory tool turn.
- **Optional fingerprint for single-agent authoring**: `spec_patch(intent: "patch")` makes `repositoryRootFingerprint` optional, automatically binding the live graph snapshot when concurrent CAS contention is not required.

Proof: extended BDD scenarios in `tests/features/safe-authoring.feature`, negative matrix ensuring raw writes remain strictly blocked, unit tests for `SPEC_READ_REDIRECT`, and fresh OMP session authoring smoke.

### v1.2.0 — High-Level Agent Authoring Facade

Outcome: agents can author and amend functional requirements, acceptance criteria, and traceability links through one high-level intent, without constructing low-level AST arrays or computing exact string offsets.

Grounding: addresses Findings 1.4 and 3.2 in [`audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md`](audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md).

Key changes:
- **High-level `upsertRequirement` intent**: `spec_patch(intent: "upsertRequirement")` accepts `spec`, `id`, `title`, `statement`, `acceptanceCriteria`, and `tasks`, automatically updating `FR.md`, `ACCEPTANCE_CRITERIA.md`, and the `REQUIREMENTS.md` traceability table in a single atomic transaction.
- **Fuzzy whitespace matching in replacements**: `replace_in_section` normalizes Markdown table whitespace and newline variances, eliminating brittle `VALIDATION_FAILED: oldText was not found` failures caused by LLM token formatting drift.
- **Automated matrix synchronization**: kernel authoring compiler assumes responsibility for link anchor generation and traceability bookkeeping, removing manual Markdown table editing from the agent loop.

Proof: end-to-end requirement authoring BDD test with single-turn dispatch, whitespace variance resilience test suite, and graph closure verification after facade execution.

### v1.3.0 — LLM Schema Flattening & Prompt-Friendly MCP

Outcome: AI models using standard function-calling protocols (OpenAI, Claude Code, Gemini) observe complete parameter documentation and explicit types without losing details to empty `oneOf` properties.

Grounding: addresses Findings 1.5 and 2.2 in [`audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md`](audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md).

Key changes:
- **Top-level schema flattening**: replace empty `{}` declarations in `properties` with concrete parameter schemas, types, and descriptions tailored for LLM client tool parsers.
- **Contextual instructions**: MCP `initializeResult.instructions` includes compact JSON calling recipes for standard workflows (discovery, reading, amending requirements).
- **Corrective error schemas**: validation failures on malformed arguments return actionable template payloads showing the correct parameter schema for the chosen discriminator.

Proof: MCP client compatibility matrix across Claude Code, Bun MCP runner, and Gemini CLI; tool surface blast verification confirming schema byte budgets remain within bounds.

### v1.4.0 — Tiered Specifications & Lightweight Profiles

Outcome: projects can maintain lightweight specifications without the overhead of 15 mandatory documents for minor features, while mission-critical systems retain full traceability.

Grounding: addresses Findings 3.1 and 3.3 in [`audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md`](audit-reports/agent-ux-and-spec-quality-audit-2026-09-05.md).

Key changes:
- **Declared specification tiers**:
  - `Tier 1 (Light)`: exactly 3 files (`README.md`, `FR.md`, `ACCEPTANCE_CRITERIA.md`) for focused feature additions and small tools.
  - `Tier 2 (Standard)`: 6 files (Tier 1 + `DESIGN.md`, `TASKS.md`, `<slug>.feature`) for medium architectural changes.
  - `Tier 3 (Full)`: complete 15-document structure for mission-critical core protocols.
- **Profile-aware corpus checking**: `check-spec-corpus.mjs` and `buildKernelGraph` validate completeness against the tier declared in `README.md` (`profile: light | standard | full`).
- **Implementation drift inspector**: `spec_inspect(check: "drift")` cross-references file change declarations in specifications against active Git diffs and codebase symbols.

Proof: multi-tier corpus test fixtures, backward compatibility test verifying existing 15-file specifications remain valid, and automated drift detection verification on sample repositories.

---

## Boundaries

The v0.3.2 read-only compatibility baseline remains available for explicit historical selection. The current v1.1.0 candidate exposes the consolidated 10-tool MCP surface. LSP is an editor and internal transport, not a replacement for the agent-facing MCP API. The roadmap does not include external dashboards, telemetry databases, or secondary graph storage engines.

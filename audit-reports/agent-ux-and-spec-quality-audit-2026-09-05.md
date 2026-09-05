# Multi-Layered Analysis: Agent UX, Spec Quality, and Architecture Audit

**Date**: 2026-09-05  
**Target**: `omp-spec-kit` (v1.0.2 shipped baseline)  
**Status**: Authoritative Reference and Evidence Baseline for Roadmap (v1.1.0 – v1.4.0)  
**Authors**: Oh My Pi Engineering Core  

---

## 1. Executive Overview: The Reliability vs. Ergonomics Gap

`omp-spec-kit` was engineered with aerospace-grade rigor (inspired by DO-178C, formal requirements engineering, BDD, and DDD). In terms of **data safety, cryptographic integrity, and state containment**, the system is rock-solid:
- **Transactional guarantees**: Multi-document transactional updates via `spec_patch`, atomic commit via temporary files, rollback on failure, and exclusive file locking (`withWriteLock`).
- **Cryptographic attestations**: Every release is bound to Git tag commits via Sigstore attestations, deterministic tar archives, candidate digest verification, and zero unverified build artifacts.
- **Traceability closure**: The kernel graph analyzer (`buildKernelGraph`) models specifications as a directed graph linking `Functional Requirements` (`FR`) <-> `Acceptance Criteria` (`AC`) <-> `Scenarios` <-> `Tasks` <-> `Evidence`.

However, when evaluated from the perspective of **Agent UX (how easily, reliably, and naturally an AI coding agent can discover, author, and maintain specifications)**, the system exhibits severe **cognitive hostility**:
1. Common LLM intuitions and standard tools (`read`, `edit`, `bash`) fail abruptly with misleading errors (e.g. `read` failing with `RAW_SPEC_WRITE`).
2. Authoring requires constructing deep AST-like JSON operations with fragile string-matching (`oldText`).
3. Specifications suffer from severe **bureaucratic bloat** (enforcing 15 separate files for every small feature), leading to neuro-slop boilerplate instead of crisp technical design.

---

## 2. Dimension 1: Agent Ergonomics & Tooling UX

### Finding 1.1: Direct `read` Denials Misleadingly Report `RAW_SPEC_WRITE`
- **Location**: `src/enforcement/classifier.js:196-203` and `src/enforcement/resolve-targets.js:106-108`.
- **Observed Behavior**: When an agent attempts to inspect a specification file using the standard `read` tool:
  `read({ path: ".specs/spec-mcp-access-gate/FR.md" })`
  The enforcement hook intercepts the call and blocks execution with:
  `RAW_SPEC_WRITE: target=.specs/spec-mcp-access-gate/FR.md use spec_patch with dryRun: true for preview or dryRun: false to apply`
- **Impact on Agents**:
  - **Cognitive dissonance**: The model issued a read-only request and receives an error asserting that a *write* was attempted.
  - **Toxic recovery guidance**: The error instructs the model to use `spec_patch` (a mutating tool) to read a file, leading agents into infinite loops attempting to pass "read" queries to `spec_patch`.
- **Root Cause**: `decidePathPolicy()` returns `decision: "BLOCK", code: "RAW_SPEC_WRITE"` for any path resolved to `SPEC`, without differentiating between mutating tools (`write`, `edit`, `delete`) and read-only tools (`read`, `grep`, `glob`).

### Finding 1.2: The `readForEdit: true` Information Starvation Trap
- **Location**: `src/adapters/document-service.js:58-67`.
- **Observed Behavior**: When calling `spec_documents` with `action: "read", doc: "FR.md", readForEdit: true`:
  The tool returns `{ kind: "document", mode: "read_for_edit", sha256: "...", totalLines: N, headings: [...] }`, but **completely omits the document content (`content`)**.
- **Impact on Agents**:
  - Models set `readForEdit: true` when preparing to author a change, expecting to retrieve the current text so they can extract `oldText` for replacement operations.
  - Receiving no text, the agent is forced to make an extra tool call with `section` or `offset/limit`, and only then make a third call to `spec_patch`. This triples turn latency and consumes precious context window tokens.

### Finding 1.3: The Hidden `repositoryRootFingerprint` Precondition
- **Location**: `src/authoring/proposals.js:145-155` and `src/adapters/tool-contracts.js`.
- **Observed Behavior**: In `spec_patch(intent: "patch")`, the field `repositoryRootFingerprint` is mandatory. If omitted or mismatched, the call fails with `CONFLICT: repositoryRootFingerprint does not match the current graph snapshot`.
- **Impact on Agents**:
  - Unless an agent has been primed with a specialized skill (`SKILL.md`), it cannot infer that `repositoryRootFingerprint` must be harvested from a prior call to `spec_catalog(view: "overview") -> graph.fingerprint`.
  - For non-concurrent single-agent tasks, this requirement adds artificial friction without functional benefit.

### Finding 1.4: Fragile Literal String Matching in `replace_in_section` (`oldText`)
- **Location**: `src/authoring/proposals.js:84-93` (`replaceOnce`).
- **Observed Behavior**: `replace_in_section` executes an exact substring match (`text.split(oldText)`).
- **Impact on Agents**:
  - LLMs frequently experience subtle formatting drifts (e.g., whitespace variations inside Markdown tables, indentation in bullet lists, escaping of `|` or backticks).
  - A single whitespace mismatch triggers `VALIDATION_FAILED: oldText was not found`, causing the entire transaction to abort. Agents struggle to self-correct because they cannot see the raw normalized bytes on disk.

### Finding 1.5: JSON Schema Polymorphism Degradation (`oneOf` Blindness)
- **Location**: `src/adapters/tool-contracts.js:46-88` (`jsonSchemaFor`).
- **Observed Behavior**: All tools use a top-level discriminator with polymorphic `oneOf` branches. At the top level in `properties`:
  `"operations": {}, "specSlugs": {}, "limit": {}`
- **Impact on Agents**:
  - Major LLM provider tool-calling implementations (OpenAI API, Gemini Function Calling, Claude Code client) only inspect top-level properties or flatten schemas poorly.
  - The model observes fields typed as empty untyped objects `{}`, loses parameter descriptions, and hallucinates argument names or nesting shapes.

---

## 3. Dimension 2: Security & Hook-Gate Policy (Over-Blocking & False Positives)

### Finding 2.1: Lexical False-Positive Blocking in `hasEmbeddedSpecReference`
- **Location**: `src/enforcement/classifier.js:60-66`.
- **Observed Behavior**: If an agent executes a read-only or fact-finding command like:
  - `bash(command: "git log -n 5 -- .specs/")`
  - `bash(command: "ls -la .specs/")`
  - `eval(code: "import os; print(os.path.exists('.specs'))")`
  the hook intercepts the call and terminates it with `RAW_SPEC_WRITE`.
- **Impact on Agents**:
  - Harmless observational, fact-finding, and inspection operations are blocked.
  - Agents are prevented from using native Git tools to inspect historical specification diffs or verify directory layouts.

### Finding 2.2: Windows ADS (Alternate Data Stream) Colon Collision
- **Location**: `src/enforcement/resolve-targets.js:WINDOWS_UNSAFE_PATH`.
- **Observed Behavior**: Colons on Windows paths are treated as NTFS ADS vectors and fail closed with `TARGET_INDETERMINATE`.
- **Impact on Agents**: Legitimate tool arguments containing colons (npm script names `npm run test:bdd`, Git commit messages `fix: something`, line selector ranges `file.txt:10-20`) risk false-positive classification as ADS if passed in path-checked slots.

---

## 4. Dimension 3: Specification Architecture & Quality (Bloat vs. Crispness)

### Finding 3.1: The 15-File Mandatory Monolith
- **Location**: `scripts/check-spec-corpus.mjs:18-38` (`FIXED_DOCS`, `EXPECTED_DOCUMENT_COUNT`).
- **Observed Behavior**: The corpus checker enforces that **every single specification directory** must contain exactly 15 files:
  1. `README.md` (context, scope, status)
  2. `USER_STORIES.md` (actor, intent, value)
  3. `USE_CASES.md` (preconditions, flows, postconditions)
  4. `RESEARCH.md` (background, alternatives)
  5. `FR.md` (functional requirements, RFC 2119)
  6. `NFR.md` (non-functional requirements)
  7. `ACCEPTANCE_CRITERIA.md` (EARS statements)
  8. `REQUIREMENTS.md` (traceability matrix table)
  9. `DESIGN.md` (architecture, components, data flow)
  10. `TASKS.md` (delivery tasks, phases, statuses)
  11. `FILE_CHANGES.md` (proposed and observed file changes)
  12. `FIXTURES.md` (test fixtures and mocks)
  13. `CHANGELOG.md` (version history)
  14. `<slug>.feature` (Gherkin scenarios)
  15. `<slug>_SCHEMA.md` (JSON or data schemas)
- **Impact on Quality**:
  - **Massive semantic redundancy**: For 80% of project features, `USER_STORIES` and `USE_CASES` rephrase the same requirements; `REQUIREMENTS.md` is simply a table referencing `FR.md`; `FR.md` rephrases `ACCEPTANCE_CRITERIA.md`.
  - **Neuro-Slop Generation**: Agents forced to populate 15 files for small enhancements generate generic filler text ("As a developer I want X so that Y").
  - **Dilution of Engineering Thought**: Critical architecture decisions are scattered across multiple files, making human and agent review slow and error-prone.

### Finding 3.2: Traceability Matrix Bookkeeping Burden
- **Location**: `REQUIREMENTS.md` (Traceability table) and `TASKS.md`.
- **Observed Behavior**: When an agent adds or amends a functional requirement in `FR.md`, it must manually:
  1. Update `FR.md` (heading, statement, RFC 2119 keywords, acceptance link).
  2. Update `ACCEPTANCE_CRITERIA.md` (EARS statement, requirement link).
  3. Manually edit the Markdown table in `REQUIREMENTS.md` with links and anchors.
  4. Manually update `TASKS.md` entries and status fields.
- **Impact on Quality**: If an agent misses a single link anchor (e.g. `#fr-1-title` vs `#fr-1-updated`), `spec_inspect(check: "anchors")` or `check:spec-corpus` fails. Agents waste 90% of their turns repairing Markdown link tables instead of designing code.

### Finding 3.3: Syntactic Validity vs. Semantic Correctness
- `buildKernelGraph` verifies graph topological closure (references exist, headings match, tags align). It cannot evaluate semantic soundness. A specification can be internally nonsensical or divorced from actual codebase realities, yet pass all kernel invariants with 0 errors.

---

## 5. Dimension 4: Codebase & Architecture Evaluation

- **Kernel Core (`src/kernel/`)**: Zero runtime dependencies; immutable graph model; deterministic node IDs. Weakness: bespoke regex-based parsers without AST libraries result in edge-case hazards.
- **Transactions (`src/authoring/`)**: Exclusive file locking (`withWriteLock`); snapshot isolation via temp files; transactional rollback. Weakness: stringent CAS; absence of fuzzy-patching; deep nesting of operational variants.
- **Gate Enforcement (`src/enforcement/`)**: Clean separation of spec boundaries; fail-closed defaults; zero unverified disk mutations. Weakness: over-broad lexical regex in `hasEmbeddedSpecReference`; conflation of read-denials with `RAW_SPEC_WRITE`.
- **Build & Release (`scripts/build-plugin.mjs`)**: Strict manifest digests; multi-stage verification gates; Sigstore cryptographic attestations. Weakness: CRLF/LF line-ending sensitivity (resolved in v1.0.2).
- **MCP Adapter (`src/mcp/`)**: Clean stdio JSON-RPC 2.0 transport; consolidated 10-tool surface. Weakness: deep `oneOf` polymorphism leading to empty top-level property declarations in MCP tool listings.

---

## 6. Strategic Roadmap Grounding (Releases v1.1.0 – v1.4.0)

This audit establishes the explicit justification, scope, and acceptance obligations for the next four releases in `ROADMAP.md`:

1. **v1.1.0 — Agent UX Quick Wins & Error Hygiene**
   - Findings addressed: 1.1, 1.2, 1.3, 2.1.
   - Split read vs write enforcement: return `SPEC_READ_REDIRECT` on reading specs instead of `RAW_SPEC_WRITE`.
   - Restrict `hasEmbeddedSpecReference` to mutating tools and destructive commands, permitting read-only Bash/eval inspections.
   - Return both metadata and document content in `spec_documents(action: "read", readForEdit: true)`.
   - Make `repositoryRootFingerprint` optional in single-agent flows (auto-resolving from current graph).

2. **v1.2.0 — High-Level Agent Authoring Facade**
   - Findings addressed: 1.4, 3.2.
   - Implement `spec_patch(intent: "upsertRequirement")` to author FR, AC, and update `REQUIREMENTS.md` traceability in one call.
   - Introduce whitespace-tolerant fuzzy matching in `replace_in_section` to eliminate formatting-induced errors.
   - Transfer traceability table synchronization from agent responsibility to server-side automation.

3. **v1.3.0 — LLM Schema Flattening & Prompt-Friendly MCP**
   - Findings addressed: 1.5, 2.2.
   - Flatten tool contracts: replace empty top-level properties with explicit typed fields and descriptive metadata.
   - Provide concrete usage recipes in `initializeResult.instructions`.
   - Enhance argument error feedback: return actionable JSON correction templates when argument validation fails.

4. **v1.4.0 — Tiered Specifications & Lightweight Profiles**
   - Findings addressed: 3.1, 3.3.
   - Establish spec tiers: Tier 1 Light (3 files: README, FR, AC), Tier 2 Standard (6 files), and Tier 3 Full (15 files).
   - Adapt `check-spec-corpus` and `buildKernelGraph` to validate against declared spec profiles.
   - Introduce `spec_inspect(check: "drift")` to detect discrepancies between specifications and real repository implementation.

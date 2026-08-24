# Design

## Implemented Requirements

- FR-1 through FR-6 in [FR.md](FR.md).

## Architecture

```text
.mcp.json command ──> package launcher ──> plugins/omp-spec-kit/dist/mcp/server.js
                         │                        │
                         │ package path only      │ active OMP cwd
                         └────────────────────────┴──> resolveRepositoryRoot
                                                          │
                                                          v
                                             one read-only query service
                                                          │
                                                          v
                                            eight canonical MCP envelopes

package tree ──> deterministic candidate tar + candidate.json
candidate + evidence.json ──> eligibility.json ──> publish verified asset
```

## Components

- `plugins/omp-spec-kit/.mcp.json` declares `./bin/omp-spec-kit-mcp` and omits `cwd`.
- `plugins/omp-spec-kit/bin/omp-spec-kit-mcp` and `.cmd` locate only their package-local built server, preserving inherited cwd and stdio.
- `src/adapters/query-service.js` accepts only an explicit absolute `OMP_SPEC_KIT_ROOT`; otherwise it uses OMP's active project cwd. [VERIFIED: RESEARCH.md]
- `src/mcp/server.js` writes exactly one terminal JSON-RPC response for every request with an id.
- `scripts/release-candidate-utils.mjs` and `scripts/create-release-candidate.mjs` create a lexical mode-preserving tar only from a clean peeled-tag checkout.
- `scripts/verify-public-tree.mjs`, `scripts/create-release-evidence.mjs`, `scripts/verify-release.mjs`, and `scripts/render-release-notes.mjs` bind safety, real Cucumber messages, lifecycle records, eligibility, and public claims fail closed.
- `scripts/docker-bdd.sh` allocates one host-side `.dev-pomogator/bdd-results/run.*.ndjson` file, mounts only that dedicated directory writable into the disposable BDD container, and atomically promotes a successful unfiltered semantic Cucumber Messages stream to `.dev-pomogator/.last-test-run.ndjson`.
- `cucumber.mjs` keeps interactive `progress` output while an explicit `OMP_SPEC_KIT_BDD_MESSAGE_PATH` adds a file message formatter; `OMP_SPEC_KIT_BDD_MESSAGE_STDOUT=1` keeps its release-capture NDJSON stdout and mirrors the same messages to that path.
- `tests/helpers/mcp-world.mjs` and release-candidate BDD helpers drive the real built package and release scripts.

## Algorithm

1. OMP roots the path-like launcher command at the plugin package but chooses active project cwd because `.mcp.json` omits `cwd`.
2. Launcher derives its own directory, `exec`s `plugins/omp-spec-kit/dist/mcp/server.js`, and never changes cwd.
3. Server selects a validated absolute root override or inherited cwd once, then creates one service.
4. Parse errors yield `-32700`; invalid request objects yield `-32600`; valid notifications have no reply; other identified requests have one reply.
5. The host wrapper creates a unique result file under its ignored dedicated results directory, passes only its container-visible path as `OMP_SPEC_KIT_BDD_MESSAGE_PATH`, and bind-mounts no source workspace.
6. Cucumber writes progress plus Messages NDJSON for an ordinary run; release capture mode writes Messages to stdout and the per-run file without mixing progress into stdout.
7. A successful no-argument Docker run must produce nonempty parseable Cucumber envelopes containing the complete feature/pickle/test-run/test-case lifecycle before the host atomically renames that per-run file to `.dev-pomogator/.last-test-run.ndjson`.
8. Any failed, malformed, or argument-scoped run—including `--tags` or `--name`—retains the previous canonical file; a scoped run may leave its unique result artifact for inspection but cannot make `spec-verdict` appear fresh.
9. Verify builds once; candidate assembly checks peeled tag and clean package tree, hashes a lexical mode-preserving tar, copies canonical Cucumber messages plus lifecycle receipts, and publish rechecks the same candidate before asset mutation.

## API

| Input | Valid form | Outcome |
|-------|------------|---------|
| MCP default root | inherited active project cwd | served specification root |
| `OMP_SPEC_KIT_ROOT` | absolute non-placeholder path | explicit served root [VERIFIED: RESEARCH.md] |
| Relative or legacy literal override | rejected as override | inherited cwd remains root |
| JSON-RPC 1.0 object with id | request object | one `-32600` response with same id |
| malformed JSON | raw invalid frame | one `-32700` response with null id |

## Key Decisions

### Decision: Package-relative command, project-relative data

**Rationale:** Pinned OMP roots path-like `command` values at the package while `cwd` defaults to the active project when omitted.
**Требование:** [FR-1](FR.md#fr-1-active-project-mcp-root).

**Trade-off:** The package owns small POSIX and Windows launcher files plus allowlist validation.

**Alternatives considered:**
- `node` plus a relative script argument — rejected because the argument would resolve from the active project and cannot find package `dist/`.
- Package cwd plus environment override — rejected because an unset override silently returns an empty package corpus.

### Decision: Exercise all tools from an isolated copied package

**Rationale:** Direct source execution and descriptor checks cannot prove copied launcher, root selection, handler execution, or exact envelopes.
**Требование:** [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses), [FR-3](FR.md#fr-3-installed-package-all-tool-parity).

**Trade-off:** BDD creates temporary package and corpus trees.

**Alternatives considered:**
- Keep two representative tool calls — rejected because six handlers stay unexecuted.
- Assert only registry descriptors — rejected because descriptors do not execute behavior.

### Decision: Publish a verified candidate rather than rebuild

**Rationale:** One archive digest lets verification, receipts, and publication compare the same delivered bytes.
**Требование:** [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility), [FR-5](FR.md#fr-5-artifact-only-publication), [FR-6](FR.md#fr-6-honest-release-communication).

**Trade-off:** Missing lifecycle evidence blocks publication rather than allowing a convenience release.

**Alternatives considered:**
- Rebuild in publish — rejected because publish may release unverified bytes.
- Use `targetCommitish` as sufficient idempotence — rejected because it does not bind assets or evidence.

### Decision: Keep protocol framing in the stdio transport

**Rationale:** The server owns raw newline-delimited JSON-RPC framing, so invalid requests can receive one exact terminal error without changing kernel semantics.

**Требование:** [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses).

**Trade-off:** Transport tests must assert raw stdout frames in addition to structured tool content.

**Alternatives considered:**
- Let malformed requests time out — rejected because client recovery becomes indistinguishable from transport failure.
- Move JSON-RPC validation into the kernel — rejected because the pure kernel has no stdio/protocol boundary.

### Decision: Project full canonical envelopes through the copied package

**Rationale:** Comparing the server response after JSON serialization to the direct shared service catches undefined fields, missing paths, and unexecuted handlers.

**Требование:** [FR-3](FR.md#fr-3-installed-package-all-tool-parity).

**Trade-off:** The test copies a real corpus and package rather than using a tiny in-memory stub.

**Alternatives considered:**
- Compare only two tool responses — rejected because tool-specific serializers can drift independently.
- Compare only a summary string — rejected because it hides closed-envelope fields.

### Decision: Generate release communication only after eligibility

**Rationale:** Notes receive candidate digests from the evaluator and cannot make a v0.3.1 readiness claim before all evidence exists.

**Требование:** [FR-6](FR.md#fr-6-honest-release-communication).

**Trade-off:** A release remains blocked when external lifecycle receipts have not been captured.

**Alternatives considered:**
- Keep static notes per release workflow — rejected because they had remained on v0.1 wording.
- Delete the faulty v0.3.0 release — rejected because users need durable advisory and provenance history.

### Decision: Recheck asset bytes on idempotent publication

**Rationale:** A release can share a target commit yet contain a missing or different archive, so idempotence must download and hash the named candidate asset.

**Требование:** [FR-5](FR.md#fr-5-artifact-only-publication).

**Trade-off:** The publish job performs one asset download before deciding that an existing release is safe.

**Alternatives considered:**
- Trust `targetCommitish` alone — rejected because it does not bind the archive bytes.
- Overwrite existing assets — rejected because it hides a release provenance violation.

## BDD Test Infrastructure

**Classification:** TEST_DATA_ACTIVE
**Format:** BDD
**Framework:** Cucumber.js
**Install Command:** already installed through `npm ci`
**Evidence:** `package.json` declares `@cucumber/cucumber` and `test:bdd`; `cucumber.mjs` imports `tests/features/**/*.feature`; `tests/support/world.mjs` owns temporary-tree cleanup.
**Verdict:** Existing Cucumber world and tagged Before/After hooks are reused. Each scenario owns one `mkdtemp` tree; source checkout, user state, and public releases are never mutated.

### Existing hooks

| Hook file | Type | Scope | Reuse |
|-----------|------|-------|-------|
| `tests/step-definitions/spec-mcp.steps.mjs` | Before/After | `@spec-mcp` | Extend MCP process cleanup |
| `tests/support/world.mjs` | World cleanup | all | Reuse temporary tree cleanup |

### New hooks

| Hook file | Type | Scope | Purpose |
|-----------|------|-------|---------|
| `tests/step-definitions/release-candidate.steps.mjs` | Before/After | `@release-candidate` | Own and remove candidate/evidence temp directories |

### Cleanup Strategy

The After hook closes its server, then removes only the scenario's `mkdtemp` root. No tracked source, repository corpus, OMP user state, Docker image, tag, or release is deleted.

### Test Data & Fixtures

| Fixture | Path | Lifecycle |
|---------|------|-----------|
| Manifest-pinned real corpus | `tests/fixtures/kernel/real-corpus-manifest.json` | shared/read-only |
| project-a, project-b, package-decoy | generated beneath `mkdtemp` | per scenario |
| candidate/evidence JSON | generated beneath `mkdtemp` | per scenario |

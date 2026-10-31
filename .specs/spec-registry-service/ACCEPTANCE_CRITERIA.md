# Acceptance criteria

Status: DRAFT

### AC-1 — Specs live only on spec branches

**Given** a project repository, **when** a developer pushes `.specs/**` to `main` or any non-`spec-*` branch, **then** the push/PR fails the required check; canonical `.specs/<slug>/**` may exist only on a `spec-<slug>` branch whose `.spec-kit.json` matches the ref and repository, and only the service bot may push canonical branches.

### AC-2 — Write through service only

**Given** two agents hold edits to the same spec document, **when** both submit `spec_patch` with the same `expectedSha`, **then** exactly one commits; the loser receives `CONFLICT` with `retryable: true` and can retry against the new fingerprint.

### AC-3 — Claim discipline

**Given** a spec claimed by user A (lease active), **when** user B submits a write without `force`, **then** the service refuses with a claim-conflict error naming the holder and expiry; **when** the lease expires, **then** B may claim and write.

### AC-4 — Multi-project isolation

**Given** scopes `stgmt/a` and `acme/b`, each backed by its own repository and `spec-*` branches, **when** a request omits `project`, **then** it resolves against the caller's tenant default; **when** it names `project: "acme/b"`, **then** no branch, path, or slug outside `acme/b`'s binding is reachable from that call — and if the caller's tenant lacks `acme/b`, the call is refused outright.

### AC-5 — Remote MCP parity

**Given** an agent connected to the remote endpoint, **when** it invokes each of the nine read ops and `spec_patch`, **then** response schemas, field names, and error codes match the stdio contract exactly (same contract tests, transport swapped). Provenance fields legitimately differ: they disclose the service-side worktree root, not a local path.

### AC-6 — YouTrack proposal flow

**Given** a human edits a requirement in the YouTrack app, **when** the app backend calls `POST /mcp` (`tools/call`) with a proposal intent, **then** the response contains the same `documents` previews and `proposalHash` an agent receives on the same call, and apply without that hash is refused.

### AC-7 — Compose boot

**Given** a host with only specs-repo credentials + project config + service token, **when** `docker compose up` runs, **then** the service clones the specs repo, creates missing `owner/project/.specs` skeletons, rebuilds the index, and reports ready; a read call against each project then succeeds. Boot duration is measured and recorded in the run evidence — the AC is the readiness outcome, not a latency bound.

### AC-8 — Operator fallback survives outage

**Given** the service stopped, **when** the operator clones the specs repo, **then** every `<owner>/<project>/.specs/` tree is complete and self-consistent (kernel validation passes offline). Consumers experience the outage as `UNAVAILABLE` — they hold no credentials that could reach the content directly, by design.

### AC-9 — Versioned read integrity (ledger)

**Given** spec `alpha@1.4.0` is published, **when** a read requests `version: "1.4.0"`, **then** returned content matches the recorded ledger digest for that version; a `version` unknown to the ledger fails closed.

### AC-10 — No silent drift

**Given** an admin break-glass pushes to a `spec-*` branch directly, **when** the service next syncs, **then** the commit appears in `/drift` output and the index is reprojected rather than silently accepted.

## AC-11.1 — Invalid branch metadata is visible

**Given** a repository with several `spec-*` branches, **when** one branch lacks readable `.spec-kit.json` or its metadata disagrees with the ref/repository, **then** discovery reports `SPEC_BINDING_INVALID` for that branch and does not list the spec, while valid branches stay readable.

## AC-12.1 — Work-branch merge is path-limited and audited

**Given** a canonical spec branch and its `spec-<slug>--<topic>` work branch, **when** the work branch changes a path outside `.specs/<slug>/**` or `.spec-kit.json`, **then** `spec_branch merge` returns `PATH_FORBIDDEN` and the canonical branch is unchanged; **when** it changes only allowed paths, **then** the merge lands on the canonical branch, the work branch is deleted, and the audit log carries the caller login.

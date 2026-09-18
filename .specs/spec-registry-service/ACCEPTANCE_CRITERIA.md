# Acceptance criteria

Status: DRAFT

## AC-1.1 — Operator fallback survives outage

**Given** the service stopped, **when** the operator clones the specs repo, **then** every `<owner>/<project>/.specs/` tree is complete and self-consistent (kernel validation passes offline). Consumers experience the outage as `UNAVAILABLE` — they hold no credentials that could reach the content directly, by design.

## AC-2.1 — Specs live only in the specs repo

**Given** a migrated product repository, **when** a developer pushes `.specs/**` on `main` or any code branch, **then** the push/PR fails the required check; and pushes to the specs repo from any identity other than the service bot are rejected.

## AC-3.1 — Multi-project isolation

**Given** scopes `stgmt/a` and `acme/b` mounted, **when** a request omits `project`, **then** it resolves against the caller's tenant default; **when** it names `project: "acme/b"`, **then** no path or slug outside `acme/b` is reachable from that call — and if the caller's tenant lacks `acme/b`, the call is refused outright.

## AC-5.1 — Write through service only

**Given** two agents hold edits to the same spec document, **when** both submit `spec_patch` with the same `expectedSha`, **then** exactly one commits; the loser receives `CONFLICT` with `retryable: true` and can retry against the new fingerprint.

## AC-7.1 — Claim discipline

**Given** a spec claimed by user A (lease active), **when** user B submits a write without `force`, **then** the service refuses with a claim-conflict error naming the holder and expiry; **when** the lease expires, **then** B may claim and write.

## AC-8.1 — Remote MCP parity

**Given** an agent connected to the remote endpoint, **when** it invokes each of the nine read ops and `spec_patch`, **then** response schemas, field names, and error codes match the stdio contract exactly (same contract tests, transport swapped). Provenance fields legitimately differ: they disclose the service-side worktree root, not a local path.

## AC-10.1 — No silent drift

**Given** an admin break-glass pushes to the specs repo directly, **when** the service next syncs, **then** the commit appears in `/drift` output and the index is reprojected rather than silently accepted.

## AC-12.1 — Pin integrity

**Given** `spec-refs.json` pins `plugin-distribution@1.4.0`, **when** the ledger digest for that version differs from the pin, **then** `omp spec verify` fails closed and names the divergent spec.

## AC-13.1 — YouTrack proposal flow

**Given** a human edits a requirement in the YouTrack app, **when** the app calls `POST /rpc` with a proposal intent, **then** the response contains the same `documents` previews and `proposalHash` the MCP path returns, and apply without that hash is refused.

## AC-15.1 — Compose boot

**Given** a host with only specs-repo credentials + project config + service token, **when** `docker compose up` runs, **then** the service clones the specs repo, creates missing `owner/project/.specs` skeletons, rebuilds the index, and reports ready; a read call against each project then succeeds. Boot duration is measured and recorded in the run evidence — the AC is the readiness outcome, not a latency bound.

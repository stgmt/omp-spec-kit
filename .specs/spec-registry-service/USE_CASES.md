# Use cases

Status: DRAFT

## UC-1 — Create a spec

1. Caller (agent via MCP, or human via YT app) submits `createSpec` intent with title.
2. Service allocates the slug within the project (collision → deterministic disambiguation or error naming the existing spec).
3. Kernel compiles skeleton documents; transaction commits on `specs` branch; index updated.
4. Spec is `DRAFT`, unpublished, claimable.

## UC-2 — Patch a spec (happy path)

1. Caller fetches document with `readForEdit` → receives `sha256` + `repositoryRootFingerprint`.
2. Caller submits `spec_patch` with `expectedSha` + `reason`.
3. Service validates (kernel graph must stay valid; secrets check) → commits → pushes → reprojects index.

## UC-3 — Patch with stale base

1. As UC-2 but another writer committed first.
2. Service returns `CONFLICT`/`retryable` + current fingerprint.
3. Caller re-reads, re-bases its intent, retries — no partial state ever exists (transaction journal).

## UC-4 — Claimed work session

1. `spec_claim(slug)` → lease held, visible in `/registry`.
2. Other writers see claim; write attempts without `force` refused with holder+expiry.
3. Lease expires or `spec_release` → normal rules resume.

## UC-5 — Publish a spec version

1. Author sets `Status: ACTIVE` + `Version: X.Y.Z` via normal patch; PR-equivalent review on the service change set.
2. Merge/commit reaches `specs` → publish step packs dir, enforces version-not-seen/digest rules, attests, records ledger.
3. Consumers' `spec verify`/`outdated` resolve against the new record.

## UC-6 — Consumer pins a spec

1. `omp spec install <slug>@<ver>` → pack fetched, digest verified, pin written to `spec-refs.json`.
2. Code PRs cite the pin; spec and code versions link without sharing a branch.

## UC-7 — Drift handling

1. Break-glass admin pushes directly to `specs`.
2. Next sync: drift detected → `/drift` entry (commit, author, divergent paths) → index reprojected → alert surfaced in YouTrack (status sweep).

## UC-8 — Service outage read path

1. Service down → consumers `git clone -b specs` (or read last pushed state).
2. Writes return `UNAVAILABLE` (non-retryable-immediately, retryable later) — nothing is lost or silently queued server-side.

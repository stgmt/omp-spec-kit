# Use cases

Status: DRAFT

## UC-1 — Create a spec

1. Caller (agent via MCP, or human via YT app) submits `createSpec` intent with title.
2. Service allocates the slug within the `owner/project` scope; if it is already taken (locally or on the remote specs repo), the call fails with `CONFLICT` naming the existing spec — no silent disambiguation, the caller picks a distinct slug.
3. Kernel compiles skeleton documents; transaction commits to the specs repo; index updated.
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
3. Versioned reads (UC-6) resolve against the new record; the registry view shows the new published version.

## UC-6 — Versioned read of a published spec

1. Consumer requests `spec_documents`/`spec_inspect` with `version: "1.4.0"` → ledger resolves `version → digest → commit` → immutable content returned, verifiable against the digest.
2. Absent `version` → latest published. Unknown version → refused.

(Consumer-side pin file — a committed `spec-refs.json` + `verify`/`install` commands — is deferred to TASK-15; the service is the only read path, so a local pin has nothing to resolve against.)

## UC-7 — Drift handling

1. Break-glass admin pushes directly to `specs`.
2. Next sync: drift detected → `/drift` entry (commit, author, divergent paths) → index reprojected → alert surfaced in YouTrack (status sweep).

## UC-8 — Service outage

1. Service down → consumers see `UNAVAILABLE` (`retryable: true`) on every call — they hold no repo credentials, so there is no consumer-side fallback; the caller retries when the service is back.
2. The operator clones the specs repo → full corpus readable offline; break-glass admin push possible (drift-reported on recovery — UC-7).

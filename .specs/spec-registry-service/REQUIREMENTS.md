# Requirements

Status: DRAFT

## R-1 — Dedicated specs branch

Every managed project stores its `.specs/` tree on a single dedicated git branch (`specs`) that contains nothing else. No other branch of a managed repository may contain a `.specs/` directory. The branch is the canonical content store — the service never replaces it, only serializes and audits access to it.

## R-2 — Service-only writes

The only path that mutates `.specs/` on the canonical branch is the registry service, committing through a dedicated bot identity. Direct human/agent pushes to the `specs` branch are rejected by repository rules; pushes of `.specs/` content to any other branch are rejected by CI/ruleset. A break-glass admin path exists and is reported as drift.

## R-3 — Multi-user write safety

Concurrent write requests are serialized per project through the existing transaction layer. Every mutation request carries optimistic-concurrency guards (`expectedSha` / `repositoryRootFingerprint`); a stale writer receives `CONFLICT` and retries against fresh state. A spec-level claim (owner lease with TTL) reduces the frequency of conflicts for multi-session work.

## R-4 — Multi-project support

One service instance serves a configured set of projects. Multi-project means the same single-branch model replicated per project: **each project is its own git repository (or remote) whose specs live on that repo's dedicated `specs` branch** — not one shared specs repo and not a monorepo layout in v1. The service clones each configured repo once, checks out its `specs` branch into a per-project worktree, and every read/write operation resolves `project` → that worktree. Spec slugs are unique per project, not globally.

## R-5 — Remote agent surface (MCP)

AI agents reach the registry only through the hosted MCP endpoint in the compose stack, over HTTPS. The locally spawned stdio MCP server is retired for managed projects: the plugin's `.mcp.json` points at the remote endpoint (`type: "http"` — verified against the pinned OMP schema), and product checkouts on non-specs branches contain no `.specs/` to serve locally anyway.

## R-6 — Human/non-dev entry point (YouTrack app)

Humans and non-developer agents read specs and propose changes through the YouTrack app on the **operator's YouTrack instance** (the only human entry point in v1). Binding a consumer's own YouTrack server is post-v1: it happens through the operator's YouTrack too — after login, a guided flow calls the onboarding API, which auto-provisions a tenant + token; nothing is issued manually. Proposal-level edits return the existing proposal preview (diffs + proposalHash) so the UI can show "what will change" before apply.

## R-7 — Minimal viable auth and tenant scoping

Consumers never receive git credentials or filesystem access — the envelope is the whole interface. v1 auth is **per-tenant bearer tokens issued automatically**: the extension calls the service onboarding API after YouTrack login and returns a token bound to the caller's tenant → allowed-projects set (a leaked token compromises only that tenant). Asserted caller identity (`X-Spec-Author`/envelope field) is logged on every write. The seam for full YouTrack Hub authN/Z is specified in DESIGN so it can be added without protocol changes.

## R-8 — Deployment as compose stack

The service, its worktree volume, and its metadata store (SQLite file volume) deploy as one docker-compose stack. A fresh `docker compose up` against configured project repos yields a working registry.

## R-9 — Spec↔code linkage

Because specs no longer travel in code branches, a managed repository records which spec versions its code implements via a committed pin file (`spec-refs.json`). The service maintains `published` records (slug → version → digest → commit) so pins resolve to immutable content.

## R-10 — Availability model

Consumers deliberately have no repository access, so their read availability is the service itself — a service outage is a read outage for them (accepted in v1, recorded as a risk). The **operator** retains the ultimate fallback: `git clone -b specs` always yields the full corpus.

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

AI agents reach the registry only through the hosted MCP endpoint in the compose stack. The locally spawned stdio MCP server is retired for managed projects: the plugin's `.mcp.json` points at the remote endpoint, and product checkouts on non-specs branches contain no `.specs/` to serve locally anyway.

## R-6 — Human/non-dev entry point (YouTrack app)

Humans and non-developer agents read specs and propose changes through the existing YouTrack app surface, which calls the service HTTP API. Proposal-level edits return the existing proposal preview (diffs + proposalHash) so the UI can show "what will change" before apply.

## R-7 — Minimal viable auth

v1 runs on trusted-network assumptions with one shared service token for agent traffic and YouTrack session identity for human traffic. The seam for full YouTrack Hub authN (token verification, per-user roles) is specified in DESIGN so it can be added without protocol changes.

## R-8 — Deployment as compose stack

The service, its worktree volume, and its metadata store (SQLite file volume) deploy as one docker-compose stack. A fresh `docker compose up` against configured project repos yields a working registry.

## R-9 — Spec↔code linkage

Because specs no longer travel in code branches, a managed repository records which spec versions its code implements via a committed pin file (`spec-refs.json`). The service maintains `published` records (slug → version → digest → commit) so pins resolve to immutable content.

## R-10 — Read availability independent of service uptime

Any consumer can still read specs by cloning the `specs` branch. Service outage blocks writes and claim management only.

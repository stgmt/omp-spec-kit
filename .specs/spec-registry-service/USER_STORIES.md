# User stories

Status: DRAFT

## US-1 — Engineering manager

As a manager, I want one catalog where I can see every spec across projects — status, owner, version, freshness — without cloning repos, so that spec state is a management surface, not an excavation.

Acceptance: `GET /registry` and the YouTrack app show the same projected index; entries name owner and last-change author.

## US-2 — Developer with an AI agent

As a developer, I want my agent to read and patch specs through the team endpoint with my identity attached, so that spec edits are attributed, conflict-safe, and visible to the team.

Acceptance: remote MCP works with the plugin's stock config; commits carry `Spec-Author:`; stale edits get a retryable conflict, not corruption.

## US-3 — Non-developer (PM/analyst)

As a PM, I want to read specs and propose edits from YouTrack — where my work already lives — without git knowledge, so that spec authoring isn't gated on developer tooling.

Acceptance: proposal → preview → apply flow works in the YT app (new UI capability built by this feature on top of the existing projection infrastructure); the applied result is a normal service commit.

## US-4 — Tech lead / spec owner

As a spec owner, I want to claim a spec while I restructure it, so that teammates get a clear "held by X until T" signal instead of a merge surprise.

Acceptance: claim visible in index; non-holder writes require explicit `force` and are logged.

## US-5 — Consumer repo maintainer

As a maintainer of a repo that implements specs, I want `spec-refs.json` pins verified against published digests, so that "which spec version does this code implement" is a fact, not a convention.

Acceptance: `omp spec verify` fails closed on digest mismatch; `outdated` lists stale pins.

## US-6 — On-call / ops

As ops, I want the whole registry to come up with `docker compose up` and degrade to read-only-via-git on outage, so that a service restart never blocks the team from reading truth.

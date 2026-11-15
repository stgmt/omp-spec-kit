# Non-functional requirements

Status: DRAFT

## NFR-PERF-1 — Readiness cost

The readiness verdict SHALL be computed in-process from the already built graph, without
additional filesystem reads, and SHALL stay under 150 ms at p95 on the operator corpus
(17 specifications, about 900 nodes) measured on the release machine.

## NFR-COMPAT-1 — No new required arguments

The gate SHALL NOT add a required argument to any existing MCP tool. Corpora that already
satisfy the admission rules SHALL keep working without edits, and a refused write SHALL
carry `retryable: false` plus the fix list instead of a bare error.

## NFR-OBS-1 — Refusals are observable

Every admission refusal SHALL be written to the durable log with the specification slug, the
code, the level and the blocker identities, so an operator can see whether a team is stuck at
a level without reading agent transcripts.

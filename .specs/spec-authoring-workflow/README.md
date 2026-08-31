# Specification authoring workflow

**Product state:** `NEXT`  
**Scope:** proposal-first mutation of one canonical specification through the existing omp-spec-kit MCP server.
**Product owner:** `product:FR-4` (`NEXT` safe authoring and direct-write policy).

The current v0.3.2 product remains the shipped read-only baseline with eight working MCP tools. This specification adds no claim that authoring is shipped. Its future public mutation surface is deliberately limited to:

- `propose_patch` — pure preview and validation;
- `apply_proposed_patch` — CAS-checked, revalidated, atomic commit of that exact preview.

Internal helpers may compile domain intents into the same edit operations, but helpers are not public tools. The host `tool_call` policy checks the exact two-name allowlist first and denies every non-allowlisted direct writer whose resolved target is under canonical `.specs/**`.

## User-visible guarantees

1. Proposal creation does not write repository bytes.
2. Apply accepts no raw edits and never silently rebases.
3. One request targets exactly one ordinary, contained spec directory.
4. Kernel form, trace, anchor, and link validation runs before proposal success and again before commit.
5. Expected document hashes prevent lost updates.
6. Readers observe one complete old or new generation, never a mixture.
7. Internal rollback restores a complete generation; an unrecoverable filesystem state fails closed with bounded manual VCS/backup restore instructions.
8. Untouched bytes, EOL style, and final-newline state are conserved.
9. Results contain compact redacted hashes and findings, not document bodies, secrets, or unrelated paths.

## Documents

- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Schema](spec-authoring-workflow_SCHEMA.md)
- [Design](DESIGN.md)
- [Scenarios](spec-authoring-workflow.feature)
- [Tasks](TASKS.md)
- [Real fixture contract](FIXTURES.md)

Historical v0.3.2 release identities and fixture provenance are retained in [RESEARCH.md](RESEARCH.md) and [FIXTURES.md](FIXTURES.md). Release eligibility, distribution attestations, and product delivery state remain owned by their respective specifications, not by the authoring runtime.

## Current lifecycle contract

The published profile exposes no authoring actions. Future authoring registration requires an accepted host authority and enforcement profile; internal dogfood is not release activation. The 24 facade names remain compiler surfaces, and only the reviewed proposal/apply path may write bytes.

The authoring destination contains proposal-first facades over one central proposal/apply transaction path. A proposal carries exact before/after document hashes; apply requires explicit approval and rechecks the current generation.

# MCP UX deep research: adoption plan for the 38-tool surface (2026-09-04)

Three-track research (protocol spec 2026-07-28 + SEPs; production servers GitHub/Neon/Sentry/reference; clients Claude Platform/Code, Cursor, VS Code, Cline/Roo, OMP itself). All claims grounded in fetched bytes by three research agents; this doc synthesizes and plans.

## Current facts

- 38 tools: 37 reads + 1 mutator (`apply_proposed_patch`). `tools/list` served in fixed contract order; already deterministic (spec 2026-07-28 mandates this; OMP's own manager sorts by name client-side too).
- `readOnlyHint` is already emitted for all 38 tools, with false for the 1 mutator. No `title`, no `destructiveHint`/`idempotentHint`/`openWorldHint`, no `outputSchema`, no `progressToken` handling, no `instructions` field.
- Descriptions total 3812 chars; exactly one (`propose_patch`) exceeds the 200-char OMP catalog cap.

## Adopt-now (server-side, zero client cooperation)

1. **Full four-property annotations on all 38 tools** (spec 2025-03-26+, `schema/2026-07-28/schema.ts:1912-1960`). Reads: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`. Mutator: `readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false`: apply can delete, rename, or archive through a reviewed proposal, and repeated identical requests replay the prior response without a second effect. Client payoff is concrete: **VS Code skips approval modals on every read** (`readOnlyHint: true` bypasses confirmation), Claude Code allowlists key off hints.
2. **`title` per tool** (BaseMetadata, 2025-06-18+). Display precedence `title` > `annotations.title` > `name`. UI gets "Read Spec Document" instead of `read_spec_doc`. Zero routing impact (model still sees `name`/`description`).
3. **Description line-1 ≤ 200 chars** (OMP `XDEV_EXTERNAL_DESCRIPTION_CAP`, `xdev.ts:260-264`). Today 37/38 comply; keep the invariant and add a port-check assert so it cannot regress.
4. **Deterministic order + prompt-cache note**: already satisfied; document it. Do NOT introduce any order-dependent logic.
5. **`instructions` field in server handshake** (GitHub pattern, `pkg/inventory/instructions.go:14-34`): one paragraph of cross-cutting rules — "reads first; propose_patch is the only write; apply only after review; multi-op arrays for compound edits". Removes per-tool prose duplication.
6. **Actionable errors** (Sentry/GitHub pattern): our envelope errors already carry code+message; upgrade the worst opaque ones (`TARGET_INDETERMINATE`, `STALE_CURSOR`, and `CONFLICT`) to include one exact recovery line. `CONFLICT` is not currently uniform across all producers, so the MCP boundary must add the guidance once rather than relying on individual authoring messages.
7. **`outputSchema` + dual emission** where a closed schema exists (2025-06-18+). Kernel envelopes are already uniform: define one reusable envelope schema and declare it per tool; keep text mirror for old clients. Medium effort, do after 1-3.

## Needs-client / opportunistic (emit, do not rely)

8. **`_meta["anthropic/requiresUserInteraction": true]` on `apply_proposed_patch`** (Claude Code doc): forces interactive confirmation even under allowlists — belt-and-braces over our approval gate. Free to emit; only Claude Code honors it.
9. **`_meta["anthropic/maxResultSizeChars"]`** on heavy reads (trace, diagnostics) if truncation is ever observed; default cap 25K tokens is generous for our envelopes. Emit nothing today; revisit on evidence.
10. **`defer_loading` tiers** (Claude Platform GA Feb 2026): client-side; our part is just keeping names/descriptions tier-friendly (done via 1-3). No server field exists in MCP; skip.

## Skip-with-reason

- **Tool search / meta-surface** (Sentry `search_sentry_tools` + `execute_tool`): solves a problem we just deleted (49→38). Revisit only if surface grows past ~60. Cursor's hard 40-tool ceiling still makes 38 painful for multi-server users — but consolidation below 40 is their user-side fix, not ours.
- **Namespace-verb consolidation with method enums** (GitHub `actions_list` style): reverses the direction the owner just chose (we cut facades; this recreates them as one-tool-many-verbs). Skip.
- **Tasks extension, elicitation**: both need client capability negotiation (elicitation → `-32021` without it; tasks is an extension namespace). Our calls are short-lived; progress notifications + sync are enough. Skip.
- **Roots/Sampling**: deprecated in 2026-07-28 (SEP-2577). We never used them. Skip.

## Key research facts (verbatim-anchored)

- Annotations spec: `schema/2026-07-28/schema.ts:1912-1960` — four hints, all advisory; defaults matter (`destructiveHint` default true, `idempotentHint` default false) so READS MUST SET ALL FOUR or clients assume worst case.
- No server-side filtering exists and never will: SEP-1821 closed 2026-06-13, SEP-1300 rejected. "Deterministic ordering enables clients to reliably cache the tool list" — `docs/specification/2026-07-28/server/tools.mdx:72-76`.
- Cursor ceiling: "only the first 40 available tools may be sent to the Agent" — forum.cursor.com/t/67976. Our 38 fits alone, breaks with +3 other-server tools.
- OMP budget: `XDEV_DOCS_TOTAL_BUDGET = 48_000`, `XDEV_EXTERNAL_DESCRIPTION_CAP = 200` — `pi-coding-agent/src/tools/xdev.ts:260-264`.
- Errors belong in `CallToolResult.isError`, never protocol-level, "otherwise the LLM would not be able to see that an error occurred and self-correct" — `schema.ts:1836-1841`.
- GitHub silent-alias table (`pkg/github/deprecated_tool_aliases.go:3-30`): the standard for future renames — but owner explicitly rejected legacy support; not adopted.

## Plan

Phase 1 (hours): annotations × 38 + titles + instructions field + port-check asserts (line-1 ≤ 200, four-hint completeness). Suite + smoke proof.
Phase 2 (day): error-recovery lines for the 3 worst codes; envelope `outputSchema` for the uniform kernel envelope.
Phase 3 (backlog, evidence-driven): elicitation fallback, progress notifications, anthropic `_meta` on apply.

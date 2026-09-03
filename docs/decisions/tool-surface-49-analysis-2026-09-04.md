# Tool surface audit: 49 tools — analysis, variants, recommendation (2026-09-04)

Status: analysis only. No code, contracts, or stages changed.

## 1. Inventory (fact)

49 tools = 8 read (v0.1–v0.3.2) + 15 read-complete + 2 evidence + 24 authoring. Source: `src/adapters/tool-contracts.js:37-614`, verified by `check:spec-port` (`contracts=8/10/23/27/25/49`) and dogfood (`registryCount 49`).

Reads (25, distinct, keep): `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, `spec_markdown_inventory`, `find_by_tags`, `list_tasks`, `list_phase_tasks`, `find_orphans`, `validate_anchor`, `list_specs`, `validate_requirement_metadata`, `policy_query_requirements`, `get_archival_proof`, `validate_spec`, `get_spec_status`, `mcp_preflight`, `list_spec_docs`, `read_spec_doc`, `read_attachment`, `get_test_result`, `get_scenario_trace`.

Authoring engine is ONE function pair (`src/authoring/service.js:394-423`): every proposal path funnels into `proposePatch`, all four apply verbs call `applyProposedPatch` literally (`service.js:397-399`). The 49-name surface is a naming layer over ~2 engines + query service.

## 2. Context cost (measured)

Generated `tools/list` definitions weigh ~23.7 KB (~6–8K tokens) every turn, spread flat — no single offender (top: `spec_diagnostics` 1333 B; bottom: `list_specs` 260 B). Cutting the 11 true duplicates below saves ~5.5 KB (~23%). Token saving is modest; the real prize is selection accuracy: industry guidance (Anthropic advanced tool use; MCP roadmap) puts 30–50 tools in the "filter/route/defer" band and calls near-duplicate tools the worst case — exactly our apply verbs.

Compounding factor: OMP mints TWO families (`mcp__omp_spec_kit_<op>` and `mcp__omp_spec_kit_omp_spec_kit_<op>`, only one active). So 4 apply verbs read as 8 names for 1 function.

## 3. Duplicate matrix (verified in code)

| # | Group | Tools | Verdict |
|---|---|---|---|
| D1 | Apply verbs | `apply_proposed_patch`, `apply_spec_change`, `apply_spec_transaction`, `apply_spec_repairs` | TRUE duplicates. Identical arg shapes (559–578 B), one function. Multi-doc already works in `propose_patch` (BDD multi-document test proves it), so `apply_spec_transaction` adds nothing. Merge into `apply_proposed_patch`. |
| D2 | Positional compilers | `append_to_section`, `insert_after_heading`, `insert_at_eof`, `replace_in_section` | TRUE duplicates. Zero logic beyond `propose_patch` operations array (`service.js:135-148`). Merge into `propose_patch`. |
| D3 | Proposal variants | `propose_spec_change`, `propose_spec_repairs` | TRUE duplicates. Pass-through wrappers over `proposePatch` (`service.js:123-133, 235-238`). Merge into `propose_patch`. |
| D4 | Task listing | `list_phase_tasks` vs `list_tasks` | TRUE duplicate. `list_tasks` already has a `phase` filter field. Merge into `list_tasks`. |
| — | Keep (real logic) | `set_requirement_metadata` (typed `validateMetadata`; `propose_requirement_contract` was identical — cut, see §8), `add_acceptance_criterion` (canonical AC-9000 numbering), `add_phase`, `add_backlog_task`/`register_incident_backlog` (traced format), `create_spec` (15-doc scaffold), `amend_requirement`, `set_entity_status` (validated transitions), `delete_spec_doc`/`rename_spec_doc` (link-break refusal), `archive_spec` (inbound-ref proof) | Pattern-D workflow tools: they encode domain rules the agent would otherwise reimplement badly. Keep. |
| — | Keep (reads) | all 25 incl. `get_spec_status` vs `spec_overview` (partial overlap: counts subset; tolerable, different call shapes) | Keep. |
| — | Keep (service) | `mcp_preflight` | Keep. |

D1–D4 total: 11 tools removed → 49 becomes 38, ~5.5 KB saved, worst overlaps gone.

## 4. UX defects (no breaking change needed)

- U1: 12 descriptions start "Compile ... into a proposal", 4 start "Apply ...". Nothing answers use-when / do-not-use / returns (violates the 4-question rule). A model choosing between `append_to_section` and `propose_patch` gets zero guidance.
- U2: No entry-point routing. `get_spec_status`/`mcp_preflight` are natural "start here" tools but nothing says so.
- U3: BDD proves `propose_patch`/`apply_proposed_patch` + `append_to_section` + `create_spec`/`archive_spec` end to end; the other ~13 compilers have no e2e selection proof. A wrong-tool eval (scripted agent probes, e.g. "append one line" → which tool?) does not exist.

## 5. Pipeline question (user's hypothesis)

`compile → review → apply` can NOT merge: human review between proposal and apply IS the safety invariant. What CAN merge is stage 1 with itself (D2–D4: N compilers → one `propose_patch` call with an operations array — the array already supports multi-op, multi-doc). `apply_spec_transaction` is a misnomer, not a distinct transaction semantic.

## 6. Variants

### A — Keep 49, fix UX writing (no breaking change)
Rewrite all authoring descriptions to use-when/do-not-use/returns form; mark `get_spec_status` as entry point; add a scripted wrong-tool selection eval (10–15 probes) as a regression gate. Hours to 2 days. Keeps the 24 KB/turn cost and the 8-names-1-function trap; reduces misfires only.

### B — Slim stage at 40 tools (RECOMMENDED at analysis time; SUPERSEDED by §8 hard cut)
Freeze the 49-name surface under the `v0.7.0` stage (untouched, backward compatible). Add a new stage (e.g. `v0.8.0`, plumbing pattern already exists in `toolContractsForStage`) exposing 40 tools: apply D1–D4 removals, keep everything else byte-identical (server needs NO logic change — same operations, same writer). Default stage stays `v0.7.0` through v0.8.x; flip default to slim at v1.0 after a deprecation window with migration notes (`append_to_section` → `propose_patch` operations example, etc.). Include: full tool-e2e matrix rerun on the slim stage, updated `check:spec-port` counts, A-lite description rewrite for the remaining 40, and the selection eval from A to prove the win. Effort 3–5 days. Risk low-medium: pure naming-layer change, old stage frozen as fallback.

### C — Router / progressive discovery (~10 visible tools)
Keep 49 server-side, serve a small default list, reveal more per task. Requires per-request `tools/list` filtering in `src/mcp/server.js` (currently static `activeContracts`) PLUS OMP client cooperation (stage is per-launch env today, not per-turn). Weeks, cross-boundary, protocol-adjacent. Directionally right at 100+ tools; premature at 49. Defer.

## 7. Recommendation

Do B, with A-lite folded in (descriptions + selection eval are prerequisites to prove B anyway). Do NOT do C now. Do NOT merge the human review out of the pipeline. Do NOT touch the 13 domain compilers — they are the useful kind of tools (workflow tools with validation), and deleting them pushes complexity back into prompts.

Next action on approval: description rewrite + selection-eval harness first (measures the problem), then slim-stage contracts + e2e + port-check update as v0.8.0 scope (plan gate, issue #28, rides the same release train or follows — separate decision).

## Sources
- `src/adapters/tool-contracts.js`, `src/authoring/service.js:117-241,394-423`, `src/mcp/server.js:194-206`
- Measured `tools/list` bytes via `jsonSchemaFor` over `AUTHORING_TOOL_CONTRACTS`
- `tests/step-definitions/{safe-authoring,staged-mcp}.steps.mjs` usage grep
- Anthropic advanced tool use + writing-tools-for-agents; MCP roadmap (progressive discovery); web search 2026-09-04

## 8. Execution record (v0.8.0): hard cut, not slim stage

Owner rejected stage-preserving variants (no legacy support, ever). Executed instead:

- 11 tools deleted (D1–D4 plus `propose_requirement_contract`, found identical to `set_requirement_metadata` during the cut): 49 becomes 38, ~5.5 KB (~23%) of `tools/list` definitions saved.
- `toolContractsForStage` and all staged contract sets deleted; single `TOOL_CONTRACTS` export. `OMP_SPEC_KIT_STAGE` plumbing removed from server, classifier, services, launchers, and dogfood (dead `OMP_SPEC_KIT_INTERNAL_DOGFOOD` flag removed too).
- Dead facade branches removed from `src/authoring/service.js`; `AUTHORING_OPERATIONS` trimmed to the 14 live operations.
- Authoring descriptions rewritten to use-when form; `get_spec_status` and `mcp_preflight` marked as entry points.
- Test matrices consolidated on the single surface (38-tool inventory, multi-operation proposal coverage, evidence matrices); `v05-tool-e2e.mjs` slimmed to evidence-only as `evidence-e2e.mjs`, `v06-tool-e2e.mjs` reworked as `tool-e2e.mjs`.
- Port census reduced 46 to 35 rows, `check-spec-port` asserts the single 38-tool surface.
- Spec updates via proposal door: FR-8/FR-9 already in; FR-2 and README counts corrected to the 38-tool surface.

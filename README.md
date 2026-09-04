# omp-spec-kit

`omp-spec-kit` gives Oh My Pi (OMP) a bounded view of a repository's specifications: what exists, how requirements connect, and where the graph reports problems.

## Install

Use the project scope so the server reads the project where OMP starts:

```text
omp update
omp plugin marketplace add stgmt/omp-spec-kit
omp plugin install omp-spec-kit@omp-spec-kit --scope project
```

After installing or updating, restart OMP in the target project. A fresh session loads the plugin and its MCP server from that project.

Update an existing project install with:

```text
omp plugin upgrade omp-spec-kit@omp-spec-kit --scope project
```

This v0.10.2 release provides the single spec_patch authoring tool and consolidated 10-tool MCP surface for OMP 18.0.11 and 18.1.6.

## Available today

The v0.10.2 release exposes exactly 10 task-oriented MCP tools: 9 bounded read-only tools and one transactional patch tool.

| Need | Tool | Variant |
|---|---|---|
| Catalog & Corpus | `spec_catalog` | `view: "types" | "specs" | "inventory" | "overview" | "status"` |
| Nodes & Search | `spec_entities` | `mode: "get" | "find"` |
| Graph & Traversal | `spec_graph` | `view: "edges" | "trace"` |
| Documents & Attachments | `spec_documents` | `action: "list" | "read" | "attachment"` |
| Validation & Policy | `spec_inspect` | `check: "scenariosByTags" | "orphans" | "anchor" | "requirementMetadata" | "requirementsPolicy" | "archivalProof" | "specValidation" | "diagnostics"` |
| Tasks | `spec_tasks` | filters: `spec`, `statuses`, `phase`, `requirement` |
| Runtime Evidence | `spec_evidence` | `view: "result" | "trace"` |
| Markdown References | `spec_markdown` | headings & links inventory |
| Preflight | `mcp_preflight` | root provenance & admissions |
| Propose Changes | `spec_propose_patch` | `intent: "patch"` or 12 typed edit intents |
| Apply Verified Changes | `apply_proposed_patch` | atomic CAS commit (`approval: "approve"`) |

The read and evidence tools share one bounded graph and return structured results with current-project provenance. Evidence is content-addressed and stale when its captured graph or scenario binding no longer matches. propose_patch is read-only; only an explicitly approved apply_proposed_patch can change a specification through hash-checked transactions.

## Typical use

Ask the agent to:

- list the specifications in this project;
- find a requirement by ID or text;
- show what covers or depends on a requirement;
- trace a requirement through related nodes;
- list parser, graph, or link diagnostics.

When the answer is in the graph, the agent should use these MCP tools instead of manually scanning `.specs`.

## Roadmap

The next releases add capabilities without removing the eight compatibility tools:

- **v0.3.2 — shipped predecessor:** bounded, read-only graph queries.
- **v0.4.1 — shipped:** eight bounded reads plus proposal-first safe authoring; exactly 10 MCP tools, with the shipped launcher selecting this surface by default.
- **v0.5.4 — shipped predecessor:** additive evidence and navigation surface with 27 direct MCP tools; the exact archive and installed package are verified.
- **v0.6.0 — shipped:** single MCP server exposing all 49 tools with 24 authoring operations and fail-closed OMP enforcement hook.
- **v0.7.0 — shipped:** hardened safe authoring with documented Windows selectors and execution-payload guard; same 49 tools.
- **v0.8.1 — shipped:** single consolidated 11-tool surface; 27 superseded tools and release stages excised without backward-compatibility shims.
- **v0.10.2 — shipped:** unified validation inspection branch in spec_inspect with pre-filter verdicts, scope counts, and self-describing oneOf schemas.
- **v0.10.2 — shipped:** single spec_patch authoring tool with dryRun preview and atomic commit; hard tool cut to 10 tools without backward-compatibility shims.
- **v0.9.0 — automatic plan gate:** validate the exact plan selected by OMP before approval in interactive and ACP sessions.

The v0.10.2 release is tested with accurate release notes, an exact archive smoke from unset environment, independent package/lifecycle/Docker BDD/OMP manager evidence, and commit-bound attestations. See ROADMAP.md for release proof and sequencing.
## Safety and boundaries

The published v0.3.2 predecessor is read-only. The v0.4.1 release is proposal-first: preview and validate a change, then apply the exact reviewed proposal through the trusted host path. Direct untrusted writes to .specs are not an alternative API.

The MCP server reads the active OMP project. It does not use editor LSP as a substitute for the agent-facing MCP API.

## Project documentation

- [`SECURITY.md`](SECURITY.md) — security and disclosure policy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`ROADMAP.md`](ROADMAP.md) — user-visible delivery sequence
- docs/validation/release-status-v0.10.2.json — current release status and verification record

License: MIT.

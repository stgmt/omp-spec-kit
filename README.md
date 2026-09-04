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

This v1.0.0 release provides the single `spec_patch` authoring tool and consolidated 10-tool MCP surface for OMP 18.0.11 and 18.1.6.

## Available today

The v1.0.0 release exposes exactly 10 task-oriented MCP tools: 9 bounded read-only tools and one transactional patch tool.

| Need | Tool | Variant |
|---|---|---|
| Catalog & Corpus | `spec_catalog` | `view: "types" | "specs" | "inventory" | "overview" | "status"` |
| Nodes & Search | `spec_entities` | `mode: "get" | "find"` |
| Graph & Traversal | `spec_graph` | `view: "edges" | "trace"` |
| Documents & Attachments | `spec_documents` | `action: "list" | "read" | "attachment"` |
| Validation & Policy | `spec_inspect` | `check: "scenariosByTags" | "orphans" | "anchor" | "requirementMetadata" | "requirementsPolicy" | "archivalProof" | "validation"` |
| Tasks | `spec_tasks` | filters: `spec`, `statuses`, `phase`, `requirement` |
| Runtime Evidence | `spec_evidence` | `view: "result" | "trace"` |
| Markdown References | `spec_markdown` | headings & links inventory |
| Preflight | `mcp_preflight` | root provenance & admissions |
| Safe Authoring | `spec_patch` | `dryRun` preview or atomic apply with 13 typed intents |

The read and evidence tools share one bounded graph and return structured results with current-project provenance. Evidence is content-addressed and stale when its captured graph or scenario binding no longer matches. `spec_patch` defaults to an in-memory preview; only `dryRun: false` can change a specification through hash-checked atomic transactions.

## Typical use

Ask the agent to:

- list the specifications in this project;
- find a requirement by ID or text;
- show what covers or depends on a requirement;
- trace a requirement through related nodes;
- list parser, graph, or link diagnostics;
- preview or apply a reviewed specification change.

When the answer is in the graph, the agent should use these MCP tools instead of manually scanning `.specs`.

## Release history

- **v0.3.2 — shipped predecessor:** bounded, read-only graph queries.
- **v0.4.1 — shipped:** eight bounded reads plus proposal-first safe authoring; exactly 10 MCP tools.
- **v0.5.4 — shipped predecessor:** additive evidence and navigation surface with 27 direct MCP tools.
- **v0.6.0 — shipped:** single MCP server exposing all 49 tools with fail-closed OMP enforcement.
- **v0.7.0 — shipped:** hardened safe authoring with Windows selectors and execution-payload guard.
- **v0.8.1 — shipped:** consolidated 11-tool surface; superseded tools and release stages removed.
- **v0.10.2 — shipped:** unified validation inspection branch and single `spec_patch` authoring tool with atomic commit.
- **v1.0.0 — shipped:** stable 10-tool MCP surface with bounded reads, transactional authoring, release evidence, and commit-bound attestations.

The v1.0.0 release passed the complete package, staged, safe-authoring, Docker BDD, release-integrity, archive, and OMP manager checks. See ROADMAP.md for release proof and sequencing.

## Safety and boundaries

The MCP server reads the active OMP project. It does not use editor LSP as a substitute for the agent-facing MCP API.

Direct untrusted writes to `.specs` are not an alternative API. Use `spec_patch` to preview and apply changes through hash-checked transactions.

## Project documentation

- [`SECURITY.md`](SECURITY.md) — security and disclosure policy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`ROADMAP.md`](ROADMAP.md) — user-visible delivery sequence
- `docs/validation/release-status-v1.0.0.json` — current release status and verification record

License: MIT.

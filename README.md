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

This v0.5.0 release candidate targets OMP 18.0.11 and provides the additive evidence and navigation surface. The v0.4.1 compatibility profile remains available through explicit stage selection.

## Available today

The v0.5.0 release exposes exactly 27 MCP tools: the eight bounded reads, two safe-authoring tools, 15 navigation and validation tools, and two evidence tools.

| Need | Tools |
|---|---|
| See the corpus | spec_inventory, spec_overview |
| Find a requirement or scenario | spec_find_nodes, spec_get_node |
| Follow relationships | spec_get_edges, spec_trace |
| Find parser and graph problems | spec_diagnostics, spec_markdown_inventory |
| Navigate and validate specifications | find_by_tags, list_tasks, list_phase_tasks, find_orphans, validate_anchor, list_specs, validate_requirement_metadata, policy_query_requirements, get_archival_proof, validate_spec, get_spec_status, mcp_preflight, list_spec_docs, read_spec_doc, read_attachment |
| Read runtime evidence | get_test_result, get_scenario_trace |
| Propose and apply reviewed spec changes | propose_patch, apply_proposed_patch |

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
- **v0.5.0 — candidate:** additive evidence and navigation surface with 27 direct MCP tools; publication follows the release gates.
- **v0.6.0 — planned:** additional authoring helpers remain internal and are not public tools.
- **v0.7.0 — automatic plan gate:** validate the exact plan selected by OMP before approval in interactive and ACP sessions.

The v0.4.1 corrective release is published with an exact archive smoke from unset environment, independent package/lifecycle/Docker BDD/OMP manager evidence, and commit-bound attestations. See ROADMAP.md for release proof and sequencing.

## Safety and boundaries

The published v0.3.2 predecessor is read-only. The v0.4.1 release is proposal-first: preview and validate a change, then apply the exact reviewed proposal through the trusted host path. Direct untrusted writes to .specs are not an alternative API.

The MCP server reads the active OMP project. It does not use editor LSP as a substitute for the agent-facing MCP API.

## Project documentation

- [`SECURITY.md`](SECURITY.md) — security and disclosure policy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`ROADMAP.md`](ROADMAP.md) — user-visible delivery sequence
- docs/validation/release-status-v0.5.0.json — current candidate status and verification record

License: MIT.

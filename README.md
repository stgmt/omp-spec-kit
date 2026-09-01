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

This v0.4.0 candidate targets OMP 18.0.11. The candidate compatibility profile is pinned to immutable OMP 18.0.11.

## Available today

The v0.4.0 candidate exposes exactly ten MCP tools: eight bounded reads plus `propose_patch` and `apply_proposed_patch`. v0.3.2 remains the published predecessor until the candidate's independent release evidence is complete.

| Need | Tools |
|---|---|
| See the corpus | `spec_inventory`, `spec_overview` |
| Find a requirement or scenario | `spec_find_nodes`, `spec_get_node` |
| Follow relationships | `spec_get_edges`, `spec_trace` |
| Find parser and graph problems | `spec_diagnostics` |
| Inspect Markdown headings and links | `spec_markdown_inventory` |
| Propose and apply reviewed spec changes | `propose_patch`, `apply_proposed_patch` |

The read tools share one bounded graph and return structured, paged results. `propose_patch` is read-only; only an explicitly approved `apply_proposed_patch` can change a specification, through hash-checked transactions.

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
- **v0.4.0 — candidate:** eight bounded reads plus proposal-first safe authoring; exactly 10 MCP tools.
- **v0.5.0 — planned:** evidence and navigation after independent producer capture.
- **v0.6.0 — planned:** additional authoring helpers remain internal and are not public tools.
- **v0.7.0 — automatic plan gate:** validate the exact plan selected by OMP before approval in interactive and ACP sessions.

Only v0.3.2 is published in the current package. See [`ROADMAP.md`](ROADMAP.md) for release proof and sequencing.

## Safety and boundaries

The published predecessor is read-only. The v0.4.0 candidate is proposal-first: preview and validate a change, then apply the exact reviewed proposal through the trusted host path. Direct untrusted writes to `.specs` are not an alternative API.

The MCP server reads the active OMP project. It does not use editor LSP as a substitute for the agent-facing MCP API.

## Project documentation

- [`SECURITY.md`](SECURITY.md) — security and disclosure policy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`ROADMAP.md`](ROADMAP.md) — user-visible delivery sequence
- [`docs/validation/release-status-v0.3.2.json`](docs/validation/release-status-v0.3.2.json) — published release evidence

License: MIT.

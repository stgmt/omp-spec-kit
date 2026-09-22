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

## Two surfaces, one product

The plugin install above gives your OMP session the **local kernel**: the 10 MCP tools read the `.specs/` corpus of the project you open OMP in — no services required.

The **hosted path** is the spec-registry service (`spec-registryd`): canonical specifications live in a dedicated Git repository, writes go through the service's MCP endpoint with YouTrack-verified identity, roles, and project scopes. Consumers connect with a `.mcp.json` that carries `Authorization` + `X-Spec-Project` headers.

## Self-hosted demo stack

A complete working contour — YouTrack (identity + app host), `spec-git` (canonical specs repo), and `spec-registryd` — ships in [`skills/spec-stack-setup/`](skills/spec-stack-setup/SKILL.md) and comes up with one command:

```sh
node skills/spec-stack-setup/setup.mjs
```

It brings the Docker Compose stack up, completes the YouTrack wizard, wires the service token and registry config, installs the YouTrack app, seeds template specifications through real MCP calls, and prints a ready Spec Board dashboard link (`http://127.0.0.1:8089/dashboard?id=…`, login `admin` / `SpecDemo!2026`). Idempotent — re-running converges.

### YouTrack app

The YouTrack app (`spec-graph-app`) ships as a ZIP asset on each GitHub release. Install into your YouTrack via **Administration → Apps → Add app → Upload ZIP**, or headlessly:

```sh
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -F "file=@spec-graph-app-1.0.25.zip" \
  https://<youtrack>/api/admin/apps/import
```

After install, open the app's **Spec Service** page (main menu) — it walks through repository binding and produces the `.mcp.json` snippet (minted YouTrack token included) to paste into your agent's MCP config. The Spec Board dashboard widget renders the committed specification graph projected into YouTrack issues.

## Available today

The v2.6.1 release exposes exactly 10 task-oriented MCP tools: 9 bounded read-only tools and one transactional patch tool.

| Need | Tool | Variant |
|---|---|---|
| Catalog & Corpus | `spec_catalog` | `view: "types" | "specs" | "inventory" | "overview" | "status"` |
| Nodes & Search | `spec_entities` | `mode: "get" | "find"` |
| Graph & Traversal | `spec_graph` | `view: "edges" | "trace" | "board"` |
| Documents & Attachments | `spec_documents` | `action: "list" | "read" | "attachment"` |
| Validation & Policy | `spec_inspect` | `check: "scenariosByTags" | "orphans" | "anchor" | "requirementMetadata" | "requirementsPolicy" | "archivalProof" | "validation"` |
| Tasks | `spec_tasks` | filters: `spec`, `statuses`, `phase`, `requirement` |
| Runtime Evidence | `spec_evidence` | `view: "result" | "trace"` |
| Markdown References | `spec_markdown` | headings & links inventory |
| Preflight | `mcp_preflight` | root provenance & admissions |
| Safe Authoring | `spec_patch` | `dryRun` preview or atomic apply with 13 typed intents |

The read and evidence tools share one bounded graph and return structured results with current-project provenance. Evidence is content-addressed and stale when its captured graph or scenario binding no longer matches. `spec_patch` defaults to an in-memory preview; only `dryRun: false` can change a specification through hash-checked atomic transactions.

`spec_evidence` reads cucumber-message NDJSON from fixed locations (`.omp-spec-kit/evidence/last-test-run.ndjson`, `.omp-spec-kit/evidence/bdd-results/run.ndjson`, `tests/fixtures/release-candidate/cucumber-messages.ndjson`) and matches scenarios by their `@id:` tag. With no BDD runner producing that stream, every scenario reports `NOT_RUN` — an expected empty state, not an error.

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
- **v1.0.2 — shipped:** OMP internal URI guard containment regression fix and deterministic LF release distribution.

- **v1.1.0 — shipped:** direct specification reads, exact document receipts, and root-fingerprint binding.
- **v1.2.0 — shipped:** one-time first-write elicitation protection, read-selector symmetry, and real MCP release proof.
- **v1.4.0 — shipped (1.3.x line):** scenario-authoring design-review gate (`DESIGN_REVIEW_REQUIRED`/`DESIGN_REVIEW_INVALID`), host `tool_call` preflight block, and the `engineering-anti-bike` skill.
- **v2.4.0 — shipped:** merges the 1.3.x line into 2.x — design-review gate and anti-bike skill on the consolidated surface.
- **v2.5.0 — shipped:** onboarding moved off issues onto the app's own Spec Service page; YouTrack-app request signing; managed remote plugin mode.
- **v2.6.0 — tagged, superseded before publication:** Spec Board transitive hover lineage, fullscreen `defaultDimensions`, `spec-stack-setup` skill; the app ZIP build was not byte-reproducible across timezones.
- **v2.6.1 — shipped:** deterministic app ZIP across build timezones, plus all of v2.6.0's content.

The v2.6.1 release is shipped and publicly attested. See docs/validation/release-status-v2.6.1.json for the complete release proof.

## Safety and boundaries

The MCP server reads the active OMP project. It does not use editor LSP as a substitute for the agent-facing MCP API.

Direct untrusted writes to `.specs` are not an alternative API. Use `spec_patch` to preview and apply changes through hash-checked transactions.

The canonical corpus lives in the dedicated specs repository and is served by the spec registry over MCP; this repository carries no `.specs/` (see `scripts/check-no-root-specs.mjs`). Code gates run against the frozen fixture under `tests/fixtures/kernel/authoring-real-corpus`; the live corpus is checked through the service with `npm run check:corpus:remote`.

## Project documentation

- [`SECURITY.md`](SECURITY.md) — security and disclosure policy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`ROADMAP.md`](ROADMAP.md) — user-visible delivery sequence
- `docs/validation/release-status-v2.6.1.json` — current release status and verification record

License: MIT.

# Roadmap

This roadmap is organized around what a user can do. A release is shipped only after the installed package is exercised from a fresh OMP session and its behavior is recorded against real repository data.

## v0.3.2 — shipped

The current release provides a bounded, read-only specification graph. Users can:

- inventory specifications;
- find requirements, scenarios, tasks, and other graph nodes;
- inspect incoming and outgoing relationships;
- trace a requirement through related nodes;
- inspect parser and graph diagnostics;
- inspect Markdown headings and links.

The compatibility surface is exactly eight read-only MCP tools. Proof includes package construction, a project-scoped installation, a fresh-session call on a real corpus, and unchanged repository data.

## v0.3.3 — OMP 18 maintenance

Outcome: current OMP users can install the package with the supported OMP 18 runtime, reload it, restart a session, and reach the same eight tools.

Proof: immutable runtime compatibility metadata, project install and cache records, fresh-session discovery, and upgrade/rollback lifecycle observations.

## v0.4.1 — shipped corrective release

Outcome: agents can enumerate specifications and documents, read contained documents and attachments, inspect graph and policy state, and safely propose and apply reviewed specification changes through the trusted host path.

The eight compatibility tools remain. The release adds exactly two proposal-first authoring tools, for a total of ten MCP tools. Direct untrusted writes under `.specs` are refused.

Proof: package construction, public-safety verification, exact archive launch with all stage/root overrides unset, installed OMP 18.0.11 execution, current-corpus manager and lifecycle producer evidence, Docker BDD, nine closed MRI receipts, and digest-bound GitHub release assets plus attestations.

## v0.5.4 — shipped corrective release

Outcome: agents can retrieve the latest result for a scenario and follow its runtime trace, including freshness, failure, and expired-trace states.

The additive v0.5 surface retains the 10-tool compatibility profile and adds 15 navigation/validation tools plus two evidence tools, for 27 direct MCP tools. Result rows remain separate from authored scenario and task nodes.

Proof: repository-owned producer fixtures, content-addressed evidence, stale-result refusal after scenario mutation, happy/fault/incomplete paths for both evidence tools, the complete navigation matrix, exact installed-package dogfood, safe authoring under the additive stage, and successful publication with commit-bound attestations.

## v0.6.0 — shipped safe authoring

Outcome: authors can preview a specification change, review the exact before/after result, and apply only that reviewed proposal atomically.

The complete destination surface contains 49 tools. Every mutation is proposal-first, containment-checked, hash-bound, and rollback-safe. Direct untrusted writes under `.specs` are refused.

Proof: real create/read/review/edit/status/rename/delete flows, concurrent-change refusal, same-name authority refusal, all-or-nothing transaction checks, and fresh installed-package execution.

## v0.7.0 — hardened safe authoring

Outcome: Windows users can read files with OMP line selectors without false blocks, and executable payloads carrying obvious specification references fail closed with a bounded reason.

The 49-tool surface is unchanged. Windows `read` selectors (`:1`, ranges, `+`, `..`, lists, `L`-prefixes, `:raw`, `:conflicts`, combos) strip before path policy; `write` receives no stripping. `code`/`command` values with an obvious `.specs` segment block with `RAW_SPEC_WRITE` (lexical guard, not a shell parser). The `v0.6.0` stage remains accepted for backward compatibility.

Proof: `spec-mcp-access-gate` FR-8/FR-9 with AC-8.1/AC-9.1, extended `read-selectors` / `execution-edges` BDD matrices, full build/verify/dogfood/staged/Docker suite, release preflight, archive smoke, attestation, and installed-package proof.

## v0.8.0 — automatic plan gate

Outcome: the agent's plan is checked after OMP has selected the exact plan bytes and before the interactive or ACP approval UI opens.

Interactive and ACP sessions use one shared gate. A failed, timed-out, or unavailable check keeps plan mode active and shows a bounded reason; no directory scan guesses which plan was selected.

Proof: valid, invalid, changed-content, error, and timeout cases in both approval modes, with the exact selected path, title, content, and digest.

Tracked as backlog: https://github.com/stgmt/omp-spec-kit/issues/28.

## Boundaries

The v0.3.2 read-only compatibility baseline remains available for explicit historical selection. The current v0.4.1 release is proposal-first; LSP is an editor and internal transport, not a replacement for the agent-facing MCP API. The roadmap does not include dashboards, advisors, databases, or a second graph engine.

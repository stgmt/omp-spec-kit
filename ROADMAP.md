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

## v0.4.0 — shipped

Outcome: agents can enumerate specifications and documents, read contained documents and attachments, inspect graph and policy state, and safely propose and apply reviewed specification changes through the trusted host path.

The eight compatibility tools remain. The release adds exactly two proposal-first authoring tools, for a total of ten MCP tools. Direct untrusted writes under `.specs` are refused.

Proof: package construction, public-safety verification, installed OMP 18.0.11 execution, current-corpus manager and lifecycle producer evidence, Docker BDD, nine closed MRI receipts, and digest-bound GitHub release assets.

## v0.5.0 — evidence and navigation

Outcome: agents can retrieve the latest result for a scenario and follow its runtime trace, including freshness, failure, and expired-trace states.

The evidence stage adds two tools and brings the registry to 25. Result rows remain separate from authored scenario and task nodes.

Proof: real producer output, content-addressed evidence, stale-result refusal, one happy path and one fault path per tool, and installed-package dogfood.

## v0.6.0 — safe authoring

Outcome: authors can preview a specification change, review the exact before/after result, and apply only that reviewed proposal atomically.

The complete destination surface contains 49 tools. Every mutation is proposal-first, containment-checked, hash-bound, and rollback-safe. Direct untrusted writes under `.specs` are refused.

Proof: real create/read/review/edit/status/rename/delete flows, concurrent-change refusal, same-name authority refusal, all-or-nothing transaction checks, and fresh installed-package execution.

## v0.7.0 — automatic plan gate

Outcome: the agent's plan is checked after OMP has selected the exact plan bytes and before the interactive or ACP approval UI opens.

Interactive and ACP sessions use one shared gate. A failed, timed-out, or unavailable check keeps plan mode active and shows a bounded reason; no directory scan guesses which plan was selected.

Proof: valid, invalid, changed-content, error, and timeout cases in both approval modes, with the exact selected path, title, content, and digest.

## Boundaries

The current release remains read-only. LSP is an editor and internal transport, not a replacement for the agent-facing MCP API. The roadmap does not include dashboards, advisors, databases, or a second graph engine.

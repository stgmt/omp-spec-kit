# Roadmap

The roadmap delivers one standalone OMP product in verifiable stages. Dates are intentionally absent; each stage advances only when its exit evidence exists.

## Public init — specification and provenance

**Outcome:** manager-readable product boundary, immutable upstream reference, migration decisions, and public policies.

**Included:**

- fresh local Git history;
- pinned source manifest and byte/hash verification;
- ADOPT / REWRITE / DEFER / DROP decisions;
- README, license, security, contribution, and roadmap policy.

**Not included:** marketplace catalog, plugin package, extension, MCP server, install command, runtime artifact, tag, or release.

**Exit evidence:** zero secrets/state imports; every copied byte matches the pinned commit; redistribution rights are established; standalone requirements and anchors are reviewed; the complete candidate tree is scanned; the repository clearly reports NOT INSTALLABLE. The reviewed initial commit `fe70b10caaed888daf7c48dfc8f1bad9caf45598` is published at `https://github.com/stgmt/omp-spec-kit`; `docs/validation/publication-receipt.md` proves public visibility and local/remote/tree identity.

## v0.1.0 — one plugin, first read-only value

**Outcome:** exactly one installable `omp-spec-kit` OMP plugin provides one bounded, read-only specification inventory/diagnostic path.

**Required evidence:** one catalog entry and one extension entry; bundled dependency-safe artifact; candidate version consistency; clean project-scope install; reload and fresh-session activation and inventory invocation; actionable absent/malformed-spec behavior; zero repository writes; project-scope uninstall that preserves user specs and yields fresh-session absence; reinstall of the exact same `v0.1.0` candidate artifact with fresh-session invocation; complete current `plugin-distribution:FR-1` through `plugin-distribution:FR-12` evidence accepted only by `plugin-distribution:FR-13` for that candidate identity.

Prior-version upgrade and rollback are inapplicable to `v0.1.0`. Beginning with the first subsequent release, the distribution gate retains candidate uninstall/reinstall evidence and additionally requires upgrade-from-prior and rollback-to-prior evidence for the same lineage.

Advisor, hooks, dashboards, backlogs, persistence, mutation, and copied dev-pomogator runtime remain excluded.

## v0.2 — standalone specification kernel

**Outcome:** typed, deterministic in-memory graph and bounded read-query service inside the same plugin.

**Initial scope:** qualified identities; selected Markdown, Gherkin, task, and evidence parsers; typed nodes/edges; conformance findings; provenance; fail-closed readiness; real-producer fixtures. Watchers, SQLite, repair, and model judging remain gated.

**Required evidence:** deterministic full and incremental semantics where supported; collision and endpoint refusal; malformed-input diagnostics; conservation counts; stable bounded query contracts; no dependency on dev-pomogator checkout or state.

## v0.3 — one MCP adapter

**Outcome:** a single bundled MCP server projects the same bounded read contracts used by the extension. It does not become a second graph, registry, or source of truth.

**Required evidence:** documented nested MCP configuration; installed-artifact startup; response parity with the shared query service; bounded errors and output; clean activation/restart lifecycle; no writes or hidden state.

For `v0.2`, `v0.3`, and later releases, stage eligibility also requires every earlier aggregate gate to remain accepted for the same lineage. The `v0.2` kernel profile excludes `v0.3`-only MCP-adapter evidence; the `v0.3` profile includes that evidence.

## Later — authoring and mutation

**Possible scope:** authoring guidance, high-level proposals, CAS, atomic mutations, archival, backlog resolution, planners/conflict graphs, semantic judging, and persistence.

**Entry gates:** separately reviewed requirements; path/symlink containment; authorization; dry-run and explicit apply; expected-hash/CAS refusal; atomic rollback; concurrency and stale-write tests; audit/privacy policy; failure recovery; no execution of document text.

## Later — mutation verification and advanced evidence

**Possible scope:** mutation testing, deterministic kill verification, independent operational-proof review, and richer cross-spec reconciliation.

**Entry gates:** real producer fixtures, cost/runtime bounds, provenance and freshness, independent evidence quality review, and an explicit decision that the capability belongs inside the same plugin.

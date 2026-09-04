# Plugin Distribution Specification

**SHIPPED:** v0.3.2 is the current public read-only plugin. Its bounded release record is `docs/validation/release-status-v0.3.2.json`.

This specification owns the practical path from a tagged commit to an installable `omp-spec-kit` archive: select the target catalog entry, build deterministic contained bytes once, exercise those installed bytes, prove lifecycle and public-safety checks, publish the same digest, and create one final GitHub Artifact Attestation for the public asset.

It does not own OMP's marketplace or extension schemas, or the MCP request/result semantics. This merged specification owns product identity/status and release-integrity verification. Historical v0.1 through v0.3.2 receipts remain historical evidence and are never reinterpreted as the forward release API.

## Product identity

- Catalog: `.omp-plugin/marketplace.json`
- Target entry: `omp-spec-kit`
- Contained source: `./plugins/omp-spec-kit`
- Installed identity: `omp-spec-kit@omp-spec-kit`
- Extension entry: `./dist/extension.js`
- MCP configuration: `plugins/omp-spec-kit/.mcp.json`
- Current version: `0.3.2`
- Supported release-smoke pin: OMP v17.3.7, commit `8500092296621a6826b7136e840f8a59ea338958`

Unrelated catalog entries or packages are outside this specification. The selected `omp-spec-kit` name must be unique in its catalog, and its source and entrypoints must remain inside the selected child.

## Public states

- **SHIPPED:** public v0.3.2 and its historical receipts.
- **NEXT:** use the single release path in this specification for the next candidate.
- **LATER:** capabilities owned by other specifications; they do not alter this release path until included in a tagged candidate.

## Documents

[Stories](USER_STORIES.md) · [Use cases](USE_CASES.md) · [Research](RESEARCH.md) · [Requirements](REQUIREMENTS.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](plugin-distribution.feature) · [Fixtures](FIXTURES.md) · [Schemas](plugin-distribution_SCHEMA.md)

Local IDs become qualified outside this directory, for example `plugin-distribution:FR-10`.

## Current lifecycle contract

The current compatibility profile observes OMP 18.0.10 for compatibility only; it is not the release authority and cannot replace the supported OMP v17.3.7 smoke pin. Future package updates require immutable runtime, install, reload, fresh-session, and rollback evidence.

## Merged ownership

This specification is the single owner of package distribution, public product identity and lifecycle status, and MCP release-integrity verification. MCP operation semantics and MCP-only access policy remain owned by `spec-mcp-operations` and `spec-mcp-access-gate`.


---

## Product lifecycle and status (merged)

## Current status

`omp-spec-kit` has one public product identity and one manager-readable roadmap.

| Bucket | Outcome | Evidence or exit condition |
|---|---|---|
| **SHIPPED** | **v0.3.2 read-only MCP baseline** — project-installable `omp-spec-kit@omp-spec-kit`, with the v0.2 graph/query kernel and eight working read-only MCP tools. | [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json) |
| **NEXT** | **Safe spec authoring and MCP-only specification access** — only spec_patch is a public mutation tool. | Ship only after atomic, containment-safe application and an OMP access gate that refuses every other read, search, enumeration, shell, edit, or write targeting canonical .specs/**, with real end-to-end proof. |

## LATER

- expanded read queries;
- editor navigation;
- evidence queries;
- impact reporting;
- manual exact-content plan validation.

These are outcomes, not promises or hidden lifecycle states.

## Product rules

1. One marketplace, one plugin package, and one extension remain the product identity.
2. A row is **SHIPPED** only when current observable proof names the released identity. Specifications, tasks, Gherkin text, and old receipts do not prove a new shipment.
3. **NEXT** names the single active outcome. **LATER** entries stay plain until promoted.
4. Detailed implementation and verification rules stay with the owning specification; this document does not duplicate them.

## Scope

The product owns public identity, status, and roadmap language. Distribution owns packaging and release mechanics. The spec-mcp-operations and spec-mcp-access-gate specifications jointly own the NEXT outcome. Historical public-init, v0.1, v0.2, and v0.3 records remain in [CHANGELOG.md](CHANGELOG.md) and immutable validation receipts.

## Current lifecycle contract

The current lifecycle covers OMP 18 maintenance, read-complete, evidence, safe authoring, and exact selected-plan gating. The published profile remains the read-only baseline until each stage has its own installed runtime proof.

---

## MCP release-integrity contract (merged)

## Product state

- **SHIPPED:** v0.3.2 is public and installable. Its immutable release reader is [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json).
- **NEXT:** use one black-box MRI run for a future candidate, then publish the same verified archive bytes and prove response source identity.
- **LATER:** capabilities outside the historical eight-tool read-only surface are owned by their own specifications, not by MRI.

## Contract

MRI answers five questions:

1. Does the installed package launch from the active project, recover from protocol errors, and execute the historical eight read-only MCP tools without changing the corpus?
2. Does every installed result identify the server, one resolved project root, and whether an explicit override differs from the active project?
3. Did one successful unfiltered real-producer run cover those behaviors and a real upgrade, rollback, and reinstall journey?
4. Are candidate inputs contained, deterministic clean-tag bytes, and are those exact bytes attested, downloaded, re-hashed, and published without rebuild?
5. Do release notes, installation guidance, the v0.3.0 advisory, and the immutable v0.3.2 record agree?

Manager/provider topology remains outside this contract. Server identity and project-root provenance are part of the installed result contract because a result without source identity can be mistaken for data from the active project.

## Documents

- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Design](DESIGN.md)
- [Fixtures](FIXTURES.md)
- [Tasks](TASKS.md)

The feature file is executable specification text. Evidence is a bound real producer run, never scenario prose or `.progress.json`.

## Current lifecycle contract

Current manager discovery has been observed on OMP 18.0.10 and may namespace installed MCP server names. This observation is non-authoritative; the eight published tools remain the compatibility baseline and staged registries are verified separately.
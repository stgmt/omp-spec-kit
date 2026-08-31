# MCP Release Integrity

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

Current manager discovery uses OMP 18.0.10 and may namespace installed MCP server names. The eight published tools remain the compatibility baseline; staged registries are verified separately.

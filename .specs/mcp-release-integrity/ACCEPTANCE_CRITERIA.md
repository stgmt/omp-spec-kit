# Acceptance Criteria (EARS)

## AC-1.1: Active project and contained override

**Requirement:** [FR-1](FR.md#fr-1-active-project-installed-behavior).

WHEN the installed package starts from project-a without an override THEN every result SHALL describe project-a and exclude project-b and package decoys; WHEN a validated absolute override selects project-b THEN only project-b SHALL be served; IF a root is relative, unresolved, package-local, or escaping THEN it SHALL NOT select data; IF startup inherits package cwd THEN startup SHALL refuse before serving.

## AC-2.1: One error and process recovery

**Requirement:** [FR-2](FR.md#fr-2-terminal-protocol-errors-and-recovery).

WHEN invalid JSON-RPC, malformed JSON, an unknown method, or an unknown tool is sent THEN exactly one response SHALL carry `-32600`, `-32700`, `-32601`, or `-32602` with the required id; WHEN a valid request follows THEN it SHALL succeed on the same process and stdout SHALL contain protocol frames only.

## AC-3.1: Eight installed handlers and zero writes

**Requirement:** [FR-3](FR.md#fr-3-historical-eight-tool-installed-surface).

WHEN the isolated v0.3.2 payload runs without source checkout or ambient dependency ancestry THEN `tools/list` SHALL equal the eight named historical tools, each handler SHALL return a complete result for the manifest-verified corpus, at least one serialization boundary SHALL match the direct query service, and corpus bytes SHALL remain unchanged.

## AC-4.1: Unfiltered run and observed lifecycle

**Requirement:** [FR-4](FR.md#fr-4-one-real-candidate-run).

WHEN a future candidate is verified THEN one successful unfiltered real Docker Cucumber Message run SHALL be bound to candidate/archive/feature/step/source digests and SHALL record passing active-project, protocol, eight-tool, safety, upgrade, rollback, uninstall, and reinstall observations with fresh-session versions and unchanged project hashes; IF output is failed, malformed, meta-only, tag-scoped, or name-scoped THEN it SHALL NOT replace trusted run evidence. Scenario or pickle counts and receipt key sets SHALL NOT decide acceptance.

## AC-5.1: Publish only the attested candidate bytes

**Requirement:** [FR-5](FR.md#fr-5-contained-deterministic-candidate-and-same-byte-publication).

WHEN a clean peeled-tag candidate is assembled THEN its contained lexical file manifest, executable mode, package-tree digest, archive digest, and candidate digest SHALL be deterministic; WHEN GitHub Artifact Attestations verifies the exact subject/repository/workflow/ref and publish downloads the archive THEN the downloaded and released SHA-256 SHALL equal the verified candidate archive; IF containment, safety, attestation, or asset identity differs THEN no release mutation SHALL occur.

## AC-6.1: Public history remains honest

**Requirement:** [FR-6](FR.md#fr-6-public-guidance-and-immutable-v032-evidence).

WHEN the bounded v0.3.2 record is read THEN tag, commit, candidate, package-tree, archive, release asset, attestation, captured notes, current guidance, and v0.3.0 advisory SHALL agree; historical evidence@3 fields SHALL remain readable but SHALL NOT be relabeled as a current run or a forward schema.

## AC-7.1: Response source identity and root consistency

**Requirement:** [FR-7](FR.md#fr-7-response-source-identity-and-root-consistency).

WHEN the installed stdio MCP server serves the active project without an override THEN every one of the eight tool results SHALL identify `omp-spec-kit`, carry equal opaque resolved and active-project root identities, and declare `rootMode: active-project`; WHEN an explicit absolute override selects project-b THEN every result SHALL identify one project-b root identity, declare `rootMode: explicit-absolute-override`, and set `matchesActiveProject: false`; WHEN the OMP extension receives the same cwd and override THEN its legacy inventory result and every query-tool result SHALL carry the same provenance; IF any result exposes an absolute root path, environment value, document body, or silently mixes roots THEN the check SHALL fail.

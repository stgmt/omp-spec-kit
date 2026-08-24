# Acceptance Criteria (EARS)

## AC-1 (FR-1): Active project wins over package cwd

**Requirement:** [FR-1](FR.md#fr-1-active-project-mcp-root).

WHEN OMP discovers the installed package launcher from project-a without an override THEN the server SHALL return project-a corpus data and SHALL exclude package-decoy and project-b data; IF `OMP_SPEC_KIT_ROOT` is relative, unresolved, or the bare literal name THEN the server SHALL retain project-a as its root.

## AC-2 (FR-2): Invalid frames are terminal and framed

**Requirement:** [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses).

WHEN a JSON-RPC 1.0 request object with id `7` reaches the server THEN it SHALL emit exactly one JSON-RPC 2.0 error response with id `7` and code `-32600`; WHEN malformed JSON reaches the server THEN it SHALL emit exactly one response with null id and code `-32700`; AND WHEN a valid request follows either frame THEN it SHALL return its canonical envelope.

## AC-3 (FR-3): The packaged MCP surface is complete and immutable

**Requirement:** [FR-3](FR.md#fr-3-installed-package-all-tool-parity).

WHEN an isolated allowlisted package copy is launched without repository source or ambient `node_modules` ancestry THEN tools/list SHALL return exactly the eight SCHEMA-11 names and every valid tool call SHALL deep-equal the direct-service `QueryEnvelope`; IF the served corpus changes after the snapshot THEN the scenario SHALL fail instead of accepting different bytes.

## AC-4 (FR-4): Candidate evidence is complete and bound

**Requirement:** [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility).

WHEN v0.3.1 eligibility is evaluated THEN it SHALL require matching candidate version, peeled tag commit, package-tree digest, archive digest, public-safety result, Docker BDD result, all FR receipts, public v0.3.0 tagged-source proof, upgrade receipt, and rollback receipt; IF any one is absent, stale, foreign, duplicate, failed, or mismatched THEN the evaluator SHALL make the candidate ineligible before publication.

## AC-5 (FR-5): Publish consumes the verified artifact only

**Requirement:** [FR-5](FR.md#fr-5-artifact-only-publication).

WHEN the verification workflow succeeds THEN it SHALL upload one candidate bundle and publish SHALL download and reverify that bundle without rebuilding; IF the downloaded archive digest, peeled tag commit, candidate receipt, or an existing release asset differs THEN publish SHALL stop without creating, replacing, or silently accepting the release.

## AC-6 (FR-6): Public status tells users the truth

**Requirement:** [FR-6](FR.md#fr-6-honest-release-communication).

WHEN the v0.3.1 candidate is eligible THEN generated notes, README, package README, and changelog SHALL report its current version and evidence-backed capabilities; WHEN a user views v0.3.0 information THEN the advisory SHALL identify the MCP root defect and the v0.3.1 path without deleting tag or release history.

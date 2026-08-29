# Acceptance Criteria (EARS)

## AC-1.1: Active project wins over package cwd

**Requirement:** [FR-1](FR.md#fr-1-active-project-mcp-root).

WHEN OMP discovers the installed package launcher from project-a without an override THEN the server SHALL return project-a data and exclude package-decoy/project-b; WHEN `OMP_SPEC_KIT_ROOT` is the validated absolute project-b path THEN only project-b SHALL be served; IF it is relative, unresolved, the bare literal, or the canonical package root THEN project-a SHALL remain; IF inherited cwd equals package root THEN startup SHALL refuse.

## AC-2.1: Invalid frames are terminal and framed

**Requirement:** [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses).

WHEN a JSON-RPC 1.0 request object with id `7` reaches the server THEN it SHALL emit exactly one JSON-RPC 2.0 error response with id `7` and code `-32600`; WHEN malformed JSON reaches the server THEN it SHALL emit exactly one response with null id and code `-32700`; WHEN an unknown method with id `8` or an unknown tool with id `9` is requested THEN it SHALL emit exactly one response with the same id and code `-32601` or `-32602` respectively; AND WHEN a valid request follows an invalid frame THEN it SHALL return its canonical envelope.

## AC-3.1: The packaged MCP surface is complete and immutable

**Requirement:** [FR-3](FR.md#fr-3-installed-package-all-tool-parity).

WHEN an isolated allowlisted v0.3.2 package copy is launched without repository source or ambient `node_modules` ancestry THEN tools/list SHALL return exactly the eight SCHEMA-11 names of the v0.3 first slice and every valid tool call SHALL deep-equal the direct-service `QueryEnvelope`; this release identity SHALL NOT cap later generator-port growth; IF the served corpus changes after the snapshot THEN the scenario SHALL fail instead of accepting different bytes.

## AC-4.1: Candidate evidence is complete and bound

**Requirement:** [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility).

WHEN MRI eligibility is evaluated THEN every one of the 18 scenario IDs and all 40 source-derived pickle expansions SHALL have passing semantic chains plus matching candidate/lifecycle/FR receipts; any missing expansion or identity SHALL block. WHEN a future candidate uses GitHub-attestation trust THEN production SHALL verify the exact subject/repository/workflow/ref and emit separate MRI/distribution/public results. The bounded historical v0.3.2 positive claim SHALL instead reconcile `release-status-v0.3.2.json`, require its distribution subject SHA to equal the evidence distribution receipt digest, and SHALL NOT pretend Docker reran the trusted verifier; self-attested or unverifiable local candidates remain blocked.

## AC-5.1: Publish consumes the verified artifact only

**Requirement:** [FR-5](FR.md#fr-5-artifact-only-publication).

WHEN a future verification workflow succeeds THEN publish SHALL download/re-hash the candidate bundle and SHALL NOT rebuild; mismatch SHALL stop mutation. For already-published v0.3.2, the acceptance readback is limited to one release asset row whose name/size/SHA equal the bounded archive record and whose workflow commit equals the peeled tag; it is evidence of historical identity, not a new execution of download/rebuild steps.

## AC-6.1: Public status tells users the truth

**Requirement:** [FR-6](FR.md#fr-6-honest-release-communication).

WHEN bounded v0.3.2 public communication is reconciled THEN the captured real GitHub release-note body/hash/source, root README, package README, changelog and v0.3.0 advisory SHALL agree on version/archive/current/advisory identity; WHEN a new candidate lacks eligible evidence THEN `renderReleaseNotes` SHALL refuse. The historical readback SHALL not be labeled a fresh trusted-evaluator run.

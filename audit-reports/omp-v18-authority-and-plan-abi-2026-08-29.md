# OMP v18 authority and plan ABI

Status: source-grounded candidate design; not a release receipt for an authority-dependent profile.

## Current baseline

`omp-spec-kit` v0.3.2 runs on OMP `18.0.10` at immutable commit `33cc6b9a043a74e00a157e72ca909272796d8461`. The current profile is read-only and preserves the eight published MCP names.

## Authority envelope

The upstream candidate adds `tool-call-authority-abi@1` to host-generated `tool_call` and `tool_result` events. The envelope is projected from the actual registered tool object and the live session registry, never from a model-visible name:

```json
{
  "abi": "tool-call-authority-abi@1",
  "providerKind": "builtin | extension | mcp | sdk | unknown",
  "registeredName": "<registered tool name>",
  "serverId": "<MCP server name or null>",
  "sourceToolName": "<original MCP name or null>",
  "inputSchemaSha256": "<64 lowercase hex characters>",
  "registrySnapshotSha256": "<64 lowercase hex characters>",
  "sourcePath": "<host-owned source path>"
}
```

Object keys are canonicalized before hashing. Registry entries are sorted by registered name. A schema or registry change therefore changes the relevant digest instead of inheriting an old authorization decision.

## Exact selected-plan event

The upstream candidate adds one blocking `plan_approval_requested` event after native plan resolution and before TUI or ACP approval. It carries the exact selected `planFilePath`, `planContent`, normalized `title`, and SHA-256 of the exact content. Handler error, timeout, cancellation, or an explicit block fails closed; approval UI is not opened.

TUI and ACP call the same `AgentSession.gateResolvedPlan` path. No directory scan or second native plan resolver is permitted.

## Evidence boundary

The files below are independent evidence classes:

- `docs/omp-v18.0.10-contract.md` — immutable read-only compatibility baseline.
- `docs/validation/omp-discovery-v18.0.10.md` — fresh project-session manager handoff.
- The pinned upstream worktree `E:/repos/oh-my-pi-omp18` — candidate source and targeted tests.
- Historical v17 documents and receipts — unchanged historical evidence only.

Authority-dependent package activation remains blocked until the candidate source and behavioral tests are accepted together.

## Candidate source receipt

The pinned upstream worktree contains the candidate ABI at commit `1dc1022d779b68066b3c0ce523e292637aa2d053`. The candidate type check passed. The authority projector tests passed with 5 tests and 14 assertions; the combined authority, plan-gate, ACP, interactive, and runner regression run passed 229 tests with 742 assertions. The candidate is local and not published to the package registry, so the v0.3.2 package remains on the immutable read-only OMP 18.0.10 profile.

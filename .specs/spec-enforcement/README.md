# spec-enforcement

Future OMP-native enforcement for the existing `omp-spec-kit` extension. It classifies every host-visible tool call, resolves raw write targets with filesystem-backed containment, blocks unknown/unsafe `.specs/**` mutation, and permits only the exact accepted proposal-first `omp-spec-kit` authoring MCP authority.

## Status

`DEFERRED_HOST_ABI / NOT_DELIVERED`. Pinned OMP v17.3.7 does not authenticate provider/server/schema identity in `tool_call`; enforcement cannot safely distinguish an authoring MCP call from a same-name spoof until `tool-call-authority-abi@1` exists. The product capability DAG intentionally defers enforcement until accepted AUTHORING_MCP plus enforcement evidence. Every task is Planned and Gherkin is not execution evidence; public v0.3.2 contains no enforcement/mutation claim.

## Boundary

- One existing plugin and one existing extension factory; no standalone enforcement extension/control plane.
- Agent-facing specification mutation remains MCP-only through the accepted `spec-authoring-workflow` authority.
- Raw built-in, MCP, extension, command, and future tools are classified by a closed effect registry. Unknown/incomplete/dynamic targets block conservatively in enforcement mode.
- Filesystem truth is checked by an I/O-capable realpath/reparse/symlink resolver, not a pure matcher.
- Spec-conformance findings come only from `spec-kernel:FR-6`; enforcement-policy diagnostics are distinct and do not claim conformance.
- No daemon, network, subprocess, credential access, private spec validator, alternate query/write tool, or persistent audit log.

`MIGRATION_MATRIX.md` source FR-39 is `DEFER`, not DROP. This spec implements a future access-enforcement slice but does not claim the deferred persistent audit component or full source feature delivery.

## Authority and activation

The only sanctioned mutation authority is MCP server `omp-spec-kit` bound to the accepted `spec-authoring-workflow@1` or separately accepted `@2` manifest, exact tool set/service-schema digest, and same candidate artifact. A tool name or redirect string alone never grants authority.

Enforcement activates only after the product evaluator accepts `SPEC_ENFORCEMENT` for the same candidate. That gate requires:

1. delivered v0.3 baseline;
2. accepted `AUTHORING_MCP` capability, including evidence and `spec-authoring-workflow:FR-13`/`FR-14`;
3. accepted `spec-enforcement:FR-11` eligibility;
4. product acceptance of the `SPEC_ENFORCEMENT` capability.

Before that conjunction and the accepted host-authority ABI receipt, behavior is informational/degraded only. Local configuration cannot promote it. An installed-registry/host-envelope mismatch after acceptance remains visible and makes new/changed tools `UNKNOWN`; enforcement does not downgrade and open a bypass.

## Provenance and evidence

- OMP contract pin: `pi-coding-agent@17.3.7`, commit `8500092296621a6826b7136e840f8a59ea338958`, documented in `docs/omp-v17.3.7-contract.md` and the pinned [extensions guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md).
- Every event/input/tool-registry claim requires TASK-1 source and live receipts before implementation.
- Release evidence is `spec-enforcement-release@2`, candidate-bound and capability-only; it has no public-release authority.
- `plan-gate` is a sibling only for event/fault/distribution lessons. Its approval lifecycle and host ABI are independent.

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | Personas and independent tests |
| [USE_CASES.md](USE_CASES.md) | Interaction flows |
| [RESEARCH.md](RESEARCH.md) | Findings, risks, evidence |
| [FR.md](FR.md) | Functional requirements |
| [NFR.md](NFR.md) | Budgets and non-functional requirements |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Traceability, CHKs, task owners, invariants |
| [DESIGN.md](DESIGN.md) | Registry, resolver, authority and integration design |
| [TASKS.md](TASKS.md) | Future delivery DAG |
| [spec-enforcement.feature](spec-enforcement.feature) | Behavioral specification |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned root-source/build surface |
| [FIXTURES.md](FIXTURES.md) | Fixture admission policy |
| [spec-enforcement_SCHEMA.md](spec-enforcement_SCHEMA.md) | Versioned public schemas |
| [CHANGELOG.md](CHANGELOG.md) | Specification history |

## Release boundary

`spec-enforcement:FR-11` establishes capability eligibility only; product evaluates the complete same-candidate conjunction. Until accepted, authoritative state is `DEFERRED_HOST_ABI / NOT_DELIVERED`. Pinned OMP v17.3.7 does not authenticate provider/server/schema identity in `tool_call`; enforcement cannot safely distinguish an authoring MCP call from a same-name spoof until `tool-call-authority-abi@1` exists.

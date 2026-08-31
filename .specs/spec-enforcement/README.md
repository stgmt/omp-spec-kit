# spec-enforcement

A small OMP path policy for specification writes. The existing `omp-spec-kit` extension registers one current-host `tool_call` handler. The handler allows exactly `propose_patch` and `apply_proposed_patch`; every other direct mutator is decided only from resolved target containment.

## Status

`LATER`. Public v0.3.2 remains the shipped read-only eight-tool baseline. This document defines future implementation work and does not claim runtime delivery.

## Contract

1. Exact tool-name equality with `propose_patch` or `apply_proposed_patch` is checked first and returns ALLOW.
2. Every non-allowlisted direct mutation target is resolved against the canonical project root and canonical `.specs` root.
3. The canonical `.specs` root or a descendant returns BLOCK `RAW_SPEC_WRITE`.
4. Targets proven outside that root return ALLOW `NON_SPEC_ALLOWED`.
5. Missing, ambiguous, or failed containment proof returns BLOCK `TARGET_INDETERMINATE`.
6. A block returns one bounded, deterministic, repository-relative reason directing the caller to `propose_patch` and then `apply_proposed_patch`.

Containment includes separator normalization, dot-segment removal, path-component boundaries, Windows case-insensitive comparison, existing-target `lstat`/`realpath`, POSIX symlink and Windows reparse handling, and nearest-existing-ancestor resolution for a new target.

## Boundary

- One `tool_call` handler in the existing extension factory.
- No second writer, validator, query surface, daemon, network call, subprocess, credential access, or persistent state.
- Proposal review, validation, compare-and-swap, atomic commit, and rollback remain responsibilities of the two authoring MCP operations.

## Documents

| Document | Role |
|---|---|
| [USER_STORIES.md](USER_STORIES.md) | User outcomes |
| [USE_CASES.md](USE_CASES.md) | Runtime flows |
| [RESEARCH.md](RESEARCH.md) | Confirmed host and filesystem findings |
| [FR.md](FR.md) | Functional requirements |
| [NFR.md](NFR.md) | Bounds and containment qualities |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | EARS criteria |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Traceability and decision matrix |
| [DESIGN.md](DESIGN.md) | Minimal implementation design |
| [TASKS.md](TASKS.md) | Delivery work |
| [spec-enforcement.feature](spec-enforcement.feature) | Behavioral contract |
| [FILE_CHANGES.md](FILE_CHANGES.md) | Planned implementation surface |
| [FIXTURES.md](FIXTURES.md) | Real fixture provenance |
| [spec-enforcement_SCHEMA.md](spec-enforcement_SCHEMA.md) | Request, resolution, and decision records |
| [CHANGELOG.md](CHANGELOG.md) | Specification history |

## Current lifecycle contract

The accepted host boundary is tool-call authority ABI tool-call-authority-abi@1: direct writes under .specs are refused, and only the registered omp-spec-kit MCP authority may apply a proposal.

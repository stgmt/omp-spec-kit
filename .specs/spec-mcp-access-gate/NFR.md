# Non-Functional Requirements

## NFR-PERF-1: Handler deadline

Each `tool_call` decision SHALL finish within an internal hard deadline of 20 seconds, below the current host timeout. Reaching the deadline SHALL return BLOCK `TARGET_INDETERMINATE`, never ALLOW.

## NFR-SEC-1: Containment and redaction

Containment SHALL use the canonical project root and canonical `.specs` root, normalized separators and dot segments, exact component boundaries, platform case rules, `lstat`/`realpath`, POSIX symlink handling, Windows reparse handling, and nearest-existing-ancestor resolution for new targets. Block reasons SHALL contain no absolute path, environment value, credential, stack, or raw operating-system error.

## NFR-REL-1: Deterministic closed results

Equal normalized inputs and equal filesystem state SHALL produce byte-identical decisions. Public codes are limited to AUTHORING_TOOL_ALLOWED, MCP_OPERATION_ALLOWED, UNREGISTERED_AUTHORING_CALL, NON_SPEC_ALLOWED, RAW_SPEC_WRITE, and TARGET_INDETERMINATE; missing authority, exceptions, and unresolved metadata SHALL block.

## NFR-USE-1: Actionable bounded reason

A block reason SHALL be at most 512 UTF-8 bytes, identify the repository-relative target when known, name the closed decision code, and say to use `propose_patch` then `apply_proposed_patch`.

## Hard limits

| Item | Limit | Overflow behavior |
|---|---:|---|
| Handler time | 20 seconds | BLOCK `TARGET_INDETERMINATE` |
| Block reason | 512 UTF-8 bytes | Deterministic truncation preserving code and redirect |
| Authoring allowlist | exactly 2 names | Any other name is not allowlisted |
| Resolution classes | exactly 3 | Unknown value becomes `INDETERMINATE` |

## NFR-USE-2: Cross-surface agent denial

The gate SHALL cover every OMP tool-call variant exposed by the pinned runtime that can access filesystem content. Unknown target extraction, handler timeout, handler exception, and unsupported filesystem metadata SHALL block rather than authorize access.

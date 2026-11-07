# Design

## DEC-1: Verification runs outside the authoring surface

Date: 2026-11-08
Scope: spec-verify-runner
Key: verify-surface
Value: read-scoped-tool
Status: decided

Verification is exposed as a read-scoped tool that executes a declared command and records its result; it never writes the corpus. Evidence records are stored under the runtime evidence directory, not as specification documents, so the surface keeps exactly one authoring tool. Rejected alternative: folding execution into the patch intent, which would make a corpus writer execute arbitrary commands.

A command that spends money is not distinguishable from a cheap one by inspection, so the task declares it: `Verify: <command> [spends: true] [timeout: <seconds>]`.

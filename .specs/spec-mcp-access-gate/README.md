# MCP access gate

**Product state:** "NEXT"  
**Scope:** prevent AI-agent access to canonical .specs/** through OMP tools unless the operation is served by the trusted omp-spec-kit MCP surface.  
**Owner:** product safe-authoring outcome.

The gate is an OMP host boundary, not a second MCP server and not an operating-system ACL. It blocks agent-mediated reads, searches, enumeration, edits, writes, shell commands, and unknown tool calls that can reach canonical .specs. It leaves ordinary paths outside .specs under normal OMP policy.

## Contract

1. Exact registered MCP read and write operations are allowed to reach the MCP adapter.
2. Every non-MCP tool call that can touch canonical .specs is blocked before execution.
3. Target resolution normalizes separators and dot segments, anchors relative paths to one canonical project root, respects platform case rules, and resolves existing links/reparse points and nearest existing ancestors.
4. Traversal, absolute escape, UNC/device paths, ADS, NUL, symlink/junction/reparse escape, ambiguous targets, unsupported metadata, and resolver errors fail closed.
5. A target proven outside canonical .specs remains allowed by this gate.
6. Reasons are deterministic, repository-relative, bounded, and direct the caller to the MCP operation surface.

## OMP boundary

The installed OMP contract is grounded in docs/omp-v17.3.7-contract.md and the pinned runtime at commit 8500092296621a6826b7136e840f8a59ea338958. The implementation phase must attach exact source-line evidence for the tool_call event, standard tool variants, namespaced MCP names, timeout behavior, and unknown/custom tools. This gate does not claim to stop an unrelated external process or OS user from reading the disk.

## Documents

- [Requirements](REQUIREMENTS.md)
- [Functional requirements](FR.md)
- [Acceptance criteria](ACCEPTANCE_CRITERIA.md)
- [Schema](spec-mcp-access-gate_SCHEMA.md)
- [Design](DESIGN.md)
- [Scenarios](spec-mcp-access-gate.feature)
- [Tasks](TASKS.md)
- [Real fixture contract](FIXTURES.md)

Historical enforcement wording remains represented by the migrated FR/AC/scenario records; expanded read-side protection is an additional contract, not a replacement of the old write refusal cases.

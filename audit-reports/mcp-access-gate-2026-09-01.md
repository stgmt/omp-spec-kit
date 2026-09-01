# MCP access gate OMP contract audit

## Scope

The proposed gate prevents AI-agent access to canonical .specs/** through non-MCP OMP tools. It does not provide operating-system ACLs and does not claim to stop an unrelated process or user.

## Grounded facts

| Claim | Evidence |
|---|---|
| OMP emits tool_call before tool execution and hooks can block | C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:42-59 |
| Hook errors and timeouts fail closed in the wrapper | C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:42-43, 67-72 |
| A block reason is thrown back as the tool error | C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:57-59 |
| Tool-call events expose tool name, call id, and normalized input | C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:47-52; C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/types.ts:302-314 |
| The pinned product/runtime contract is OMP v17.3.7 at the immutable commit | docs/omp-v17.3.7-contract.md:1-14 |
| The installed payload has one extension entry and one MCP configuration boundary | docs/omp-v17.3.7-contract.md:12-14 |

## Architecture

OMP tool call -> one access-gate tool_call handler -> one of:

- registered omp-spec-kit MCP operation: allow to MCP adapter;
- target proven outside canonical .specs: normal OMP policy;
- target in or possibly reaching canonical .specs: block;
- unknown, unresolved, link/reparse, timeout, exception: block.

The handler is a host boundary only. MCP operation semantics, proposal validation, CAS, atomic commit, and rollback remain in spec-mcp-operations.

## Failure modes

| Condition | Result |
|---|---|
| Exact trusted MCP operation | Allow to MCP adapter |
| Non-MCP target inside .specs/** | Block RAW_SPEC_ACCESS |
| Proven target outside .specs/** | Normal OMP policy |
| Traversal, absolute escape, link, junction, reparse, ADS, NUL | Block TARGET_INDETERMINATE or closed escape code |
| Unknown target extraction | Block TARGET_INDETERMINATE |
| Hook exception or timeout | Block by pinned OMP default |
| External process reads disk | Outside this gate; no claim made |

## Rejected alternatives

- Filesystem ACL as the only control: does not express MCP authority and can break the installed plugin/runtime.
- A second MCP server: violates the one-product/one-extension boundary.
- Blocking only write tools: leaves read, search, enumeration, and shell bypasses.
- Prompt instructions: do not enforce access before tool execution.
- A second path resolver: duplicates the containment contract and permits drift.

## Blocking probes before implementation

- B-1: Capture actual hook-visible names and inputs for read, grep, glob, edit, write, bash, custom, and namespaced MCP calls.
- B-2: Confirm whether every target-bearing tool reaches the hook wrapper and identify any bypass surface.
- B-3: Confirm safe target extraction for shell/custom inputs; choose fail-closed behavior when proof is impossible.
- B-4: Confirm the installed extension registration point and whether one handler can cover the required surfaces.
- B-5: Exercise timeout and exception behavior in a fresh OMP process.

## Non-blocking probes

- Optimize the resolver after correctness proof.
- Tune reason wording below the existing 512-byte bound.
- Measure handler latency on the reference corpus.

## Work order

1. Complete B-1 through B-5 against the pinned runtime.
2. Freeze the access decision matrix and schema.
3. Implement one handler and one shared resolver.
4. Run real Windows/POSIX path fixtures and installed OMP smoke tests.
5. Re-run all non-MCP negative cases and authorized MCP positive cases.

## Acceptance scenarios

The access-gate specification owns the original six direct-write scenarios plus the new non-MCP read/execution scenario SCEN-mcp-access-gate-non-mcp-spec-access. All scenarios remain specification text until bound to current runtime evidence.

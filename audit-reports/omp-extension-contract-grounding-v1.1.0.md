# OMP extension contract grounding for v1.1.0

Pinned runtime: @oh-my-pi/pi-coding-agent@18.0.11, read from the installed fixture before the release implementation.

## Evidence

- C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:42-59 emits tool_call before the wrapped tool executes and throws when the result has block: true; lines 67-73 convert hook failures into blocking errors.
- The same file at :76-79 executes the wrapped tool only after the hook returns without a block.
- C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/types.ts:14-46 imports the concrete tool and shared-event types used by the hook surface.
- C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/mcp/manager.ts and src/mcp/tool-bridge.ts are the pinned manager/bridge sources named by the safe-authoring development contract; the release probe uses the manager path, not a direct stdio-only claim.

## Decision

SPEC_READ_REDIRECT is a fail-closed block with bounded recovery text. It does not rewrite the original read, grep, or glob call. RAW_SPEC_WRITE remains the decision for direct mutators and recursive code/command payloads. Hook errors and unknown authority remain blocked before execution.

The release does not add a shell/eval allowlist: arbitrary execution payloads cannot be proven read-only from a lexical string check, and pager, configuration, or external-diff behavior would make such an allowlist unsound.

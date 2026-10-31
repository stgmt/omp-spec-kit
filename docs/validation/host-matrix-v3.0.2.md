# Host setup matrix — 3.0.2

Release `v3.0.2` (peeled `cfc1edc2b34db49dde607f7927de67d4df38f189`).
This matrix records the host checks that actually ran; it does not claim a live
session for a host whose session hook was exercised through its API contract.

| Host | Setup warning | `.specs` boundary | MCP transport | Verification level |
|---|---|---|---|---|
| Claude Code | `SessionStart` emits one bounded warning; silent for a configured hosted project (project or user scope) | `PreToolUse` blocks raw `.specs` access | `type: "http"` in the packaged `.mcp.json` | real hook process (`tests/claude/hook.test.mjs`), CI `verify` plugin job |
| Codex | `SessionStart` adapter reads `~/.codex/config.toml` + guard; silent when the registry is remote | `PreToolUse` guard | `[mcp_servers.spec_registry]` with `url` | adapter-level (`tests/codex/hook.test.mjs`); no recorded interactive `codex` session |
| OpenCode | `session.created` re-arms, `chat.message` injects the warning part; silent when `opencode.json` has the remote server | `tool.execute.before` guard | `mcp.<server>.type = "remote"` | adapter-level (`tests/opencode/hook.test.mjs`); no recorded interactive `opencode` session |
| OMP 18.0.11 | `session_start` handler calls `pi.sendMessage` with the typed setup message; silent when the project is configured | `tool_call` enforcement handler | packaged `.mcp.json` (hosted) / stdio archive smoke | API-level (`tests/unit/service/setup-warning.test.mjs`) + real extension load in `test:safe-authoring`; no recorded interactive session |

## Scope note

Only the Claude row runs a real host process (the hook binary with a host-shaped
payload). Codex, OpenCode, and OMP rows prove the adapter/API contract and the
extension registration; they do not include a recorded interactive session.
P12-9 is therefore **adapter-level complete**, not a four-host live matrix.
This limitation is explicit: no host session transcript is fabricated.

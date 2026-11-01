# Host setup matrix — 3.0.8

Release `v3.0.8`. This matrix records the host checks that actually ran. It
does not claim a live transcript for a cell that is covered by a plugin-object
or BDD test.

| Host | Setup warning | `.specs` boundary | MCP transport | Verification level |
|---|---|---|---|---|
| Claude Code | `SessionStart` emits one bounded warning; silent for a configured hosted project | `PreToolUse` blocks raw `.specs` access | `type: "http"` in the packaged `.mcp.json` | real hook process (`tests/claude/hook.test.mjs`), CI `verify` plugin job |
| Codex 0.166 | real `SessionStart` hook: `SPEC_SETUP_REQUIRED` for an unconfigured temp home, silent for the configured home | real `PreToolUse` hook: `Bash` reading `.specs/...` denied with `RAW_SPEC_WRITE` | `[mcp_servers.spec_registry]` with `url` | **live** `codex exec` 0.166, `gpt-6.1-terra`: `.specs` read blocked; `spec_catalog` over MCP returned 10 specs. A 0.144 host keeps the legacy exit-2 path, covered by the process test |
| OpenCode 1.19.3 | `session.created` re-arms, `chat.message` injects the warning part once; silent when `opencode.json` has the remote server | `tool.execute.before` guard | `mcp.<server>.type = "remote"` | **live** `opencode run`: direct `.specs` read blocked with `SPEC_READ_REDIRECT`; `spec_catalog` returned 10 specs. The `.js` bridge fix is covered by `tests/unit/service/opencode-loader.test.mjs`; setup warning is plugin-object/BDD-level, not a live transcript |
| OMP 18.14.1 | `session_start` handler calls `pi.sendMessage` with the typed setup message; silent when the project is configured | `tool_call` enforcement handler | packaged `.mcp.json` (hosted) | **live** `omp -p`: direct `read` of `.specs/...` returned `SPEC_READ_REDIRECT`; `spec_catalog` returned 10 specs. Print mode does not surface the setup custom message, so that cell stays plugin-object/BDD-level |

## Scope

- `.specs` boundary + MCP-only access are **live** on Codex 0.166, OpenCode
  1.19.3, and OMP 18.14.1; Claude has the real hook process.
- Setup-required is **live** for Claude and Codex (real hook process). For
  OpenCode and OMP it is verified through the plugin object and the delivery
  Cucumber scenario, not a recorded interactive warning.
- No transcript is fabricated. Codex 0.144 remains supported by the legacy
  exit-2 hook path; the current CLI (0.166) uses the JSON deny shape.

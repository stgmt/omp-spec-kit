# Live host sessions — 3.0.7

Date: 2026-11-01
Hosts: `opencode` 1.19.3, `omp` 18.14.1, `codex-cli` 0.144.6
Registry: `http://127.0.0.1:8650/mcp`, project `stgmt/omp-spec-kit`
Probe project: a temporary directory with
`.specs/p12-live/README.md` containing `P12_LIVE_DIRECT_READ_SHOULD_BE_BLOCKED`.

The command lines below are the real invocations. Secrets were supplied from
the private token file and are not reproduced.

## OpenCode

Initial run (before the fix):

```text
opencode run --dir <probe> --format json "read .specs/... then spec_catalog"
-> read tool completed with the file content; spec_catalog returned 10 specs
```

The read was **not blocked**: OpenCode 1.19.3 scans `.js` plugin files and
ignores the installer's `.mjs` loaders. `scripts/install-opencode-guard.mjs`
now writes ESM `.js` bridges (and keeps the `.mjs` files for older hosts) and
records `opencodeConfigPath` in `spec-kit-guard.json`.

After the fix:

```text
opencode run --dir <probe> --port 4103 --format default "..."
✗ Read .specs/p12-live/README.md failed
Error: SPEC_HOOK_FAILED: SPEC_READ_REDIRECT: target=.specs/p12-live/README.md use spec_documents(...)
⚙ spec-registry_spec_catalog {"view":"specs"}
Read blocked: yes ...
Spec count: 10
```

`tests/unit/service/opencode-loader.test.mjs` installs the guard into a
temporary host, imports the installed `.js` bridge, and asserts the same
`SPEC_READ_REDIRECT` for a `.specs` read.

## OMP

```text
omp -p --cwd <probe> --mode json "... read .specs/... then spec_catalog ..."
```

Key events:

```json
{"type":"tool_execution_end","toolName":"read",
 "result":{"content":[{"type":"text","text":"SPEC_READ_REDIRECT: target=.specs/p12-live/README.md use spec_documents(...)"}]},
 "isError":true}
{"type":"tool_execution_end","toolName":"eval",
 "result":{"content":[{"type":"text","text":"Verified: catalog ok=true; specCount=10; no file mutations performed."}]}}
```

The plugin was linked from `plugins/omp-spec-kit` (3.0.7). Print mode does not
surface the `session_start` setup-required custom message, so that half remains
covered by `tests/unit/service/setup-warning.test.mjs` and the delivery
scenario, not by this transcript.

## Codex

`codex exec` was attempted with `gpt-6.1-terra`, `gpt-5.2`, `gpt-5.1-codex`,
and `gpt-6.1-sol`:

```text
{"type":"error","message":"The '<model>' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}
{"type":"turn.failed", ...}
```

The local account cannot run a Codex model, so no Codex model session is
claimed. The installed Codex **hook process** was exercised directly with
host-shaped payloads (0.144.6):

```text
# PreToolUse: Bash reading .specs/...
exit 2
RAW_SPEC_WRITE: use spec_patch with dryRun: true for preview or dryRun: false to apply

# PreToolUse: mcp__spec_registry__spec_catalog
exit 0

# SessionStart with a temporary unconfigured home
SPEC_SETUP_REQUIRED: ... Missing: no .specs corpus ...; the registry MCP endpoint/token is not configured for this host.
Next: bind the project ... 

# SessionStart with the configured home
(empty)
```

This is a real hook process, not only the adapter unit test; it is still not a
model session, so the Codex row remains short of a live model transcript.

A local OSS attempt (`codex exec --oss --local-provider ollama`, Llama 3.1 8B,
131k context) recorded a live Codex model turn: 81,061 input tokens, output
`OK.`. A second turn asked for a shell command; the OSS bridge did not expose a
`shell` tool to the model, so the turn completed without reaching the guard
(`You have not provided the shell tool`). That is a Codex OSS tool-bridge
limitation, not a host guard result. The guard itself is covered by the real
hook process above. Temporary GGUF/Ollama models were removed after the probe.

## Setup-required warning

The live OpenCode warning was not recorded: a temporary home without a global
registry config failed at provider auth (`Unexpected server error`) before a
turn. OMP print mode delivers the warning as a TUI custom message, which is not
present in the print transcript. Both setup-warning paths remain covered by the
plugin-object/BDD tests; no host transcript is fabricated.

# Archive smoke stage regression proof — 3.7.0

Captured 2026-11-16 on Windows with Node 24.17.0. This is a focused regression/mutation proof, not a replacement for the tagged candidate's archive check or the MCP tool-surface mutation gate.

## Bound inputs

| File | SHA-256 |
| --- | --- |
| `scripts/smoke-release-archive.mjs` | `d942f6112e1681bdc8704502a73584904075e98be35166b2a3e38a3d5d262108` |
| `tests/helpers/tool-e2e.mjs` | `572ae16325de7398aa68ff348ef6c28b75c31cd25da3dd4897d9d39b51db7029` |
| `tests/claude/archive-smoke.test.mjs` | `9f88364f740e7e957f0591ca0a67725ce1cc874c7754851138659a585cccc9da` |

## Baseline

```bash
node --test tests/claude/archive-smoke.test.mjs
```

Four leaf tests passed; zero failures, cancellations or skips. Both positive cases create a tar from the built plugin and execute the actual smoke CLI against its extracted server. They assert completed phases, a successful `v08-apply-valid` / `APPLIED` call, and a refused `v08-secret-proposal` / `VALIDATION_FAILED` call. The default also requires the query phase. Negative cases reject an unknown stage and misspelled matrix phases.

## Deliberate copied-state mutations

A pristine copied-project baseline passed first. Each mutation used its own copied tracked tree and the same four-test selector. Workers shared only the read-only dependency tree. Input digests were unchanged after each run; cleanup used retries. No import, spawn, syntax, timeout or cleanup error counted as a kill. Each result below was an `ERR_ASSERTION` from its expected deciding leaf, with all four leaf tests executed and no cancellations. Receipts were saved after each result.

| Mutation in `scripts/smoke-release-archive.mjs` | Deciding leaf | Result |
| --- | --- | --- |
| Safe-authoring selection: `"proposals"` → `"proposal"` | runs all safe-authoring phases with semantic apply and secret-refusal witnesses | KILLED, exit 1 |
| Default selection: `["all"]` → `["al"]` | runs all default matrix phases against the extracted server | KILLED, exit 1 |
| Remove the allowed-stage guard | refuses an unknown stage instead of falling through to a passing matrix | KILLED, exit 1 |

Summary: baseline PASS; 3/3 mutations killed; 0 survivors; no infrastructure or cleanup failures.

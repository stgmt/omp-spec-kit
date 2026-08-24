# Kernel real-corpus fixture

`real-corpus/` contains 60 document bytes frozen from clean source commit
`1e1475c139406c112dab43dfa689d1140a57ddb3`. Its scope is the path list in the
original selection manifest at `b40db2e57f0b4c093a8a0e96e591d9109e3335be`: only
`plugin-distribution`, `product`, `spec-authoring-workflow`, and `spec-kernel`.
It is not a copy of the repository's mutable `.specs` tree.

Materialize the fixture only with:

```sh
node scripts/refresh-real-corpus-manifest.mjs --source-commit 1e1475c139406c112dab43dfa689d1140a57ddb3
```

The script reads every selected byte using `git show <commit>:<path>`, writes it
verbatim, and derives every file SHA-256/byte length plus the aggregate fixture
SHA-256 (`9265a896a8bfe463d585e2b23e7b44ec5e9f23d50e6b0c9e9cb28ad8519b5ac3`).

`node scripts/refresh-real-corpus-manifest.mjs --check` verifies the frozen
bytes and independently counts visible ATX headings, owning-document FR/AC/TASK
definitions, inline Markdown links/autolinks, declared qualified references, and
`@id`-tagged Gherkin scenarios without importing the kernel. The resulting
counts are recorded in `real-corpus-manifest.json`; kernel and MCP parity then
read only the frozen bytes.

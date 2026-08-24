# Non-Functional Requirements (NFR)

## Performance

- The launcher SHALL add no long-lived service or pre-scan; graph construction remains lazy and bounded by existing kernel limits.
- Candidate digest calculation SHALL visit only the allowlisted package/candidate tree once per verification pass and use deterministic lexical ordering.

## Security

- The package, candidate manifest, receipts, stdout frames, and release notes SHALL not expose credentials, environment values, absolute user paths, source-checkout paths, or secret-like fixture content.
- The release evaluator SHALL fail closed on symlinks, unexpected files, unapproved provenance or license evidence, missing assets, and any identity mismatch.

## Reliability

- Every request object with an id SHALL receive one terminal JSON-RPC response; subsequent valid requests remain processable after a malformed or invalid frame.
- The selected repository root and shared query service SHALL remain immutable for a server process; no MCP query may mutate the served corpus.
- Candidate eligibility and release idempotency SHALL be deterministic for equal archive bytes, receipts, tag commit, and version.

## Usability

- Installation instructions SHALL state that a fresh OMP session is required after plugin install, upgrade, rollback, or reload.
- Public material SHALL distinguish the v0.3.0 advisory from verified v0.3.1 behavior and link them directly.

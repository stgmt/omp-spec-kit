# Spec Review: mcp-release-integrity

**Phase:** post-implementation
**Scope:** requirements, design, file changes, task board, executable BDD, package boundary, candidate evaluator, release workflow, and public guidance.

## Summary

| Severity | Count | Verdict |
|----------|------:|---------|
| P0 | 0 | clear |
| P1 | 0 | clear |
| P2 | 2 | recorded |
| P3 | 0 | none |

**Overall verdict:** READY for the implemented v0.3.1 corrective branch; not a public-release authorization.

## Evidence reviewed

- Full Docker Cucumber run: 38 scenarios / 302 steps passed.
- Mutation gutcheck: changing invalid-request `-32600` to `-32601` made `SCEN-MRI-002` fail; restoring `-32600` returned the full suite to green.
- Candidate determinism smoke: identical tree/tag input produced byte-identical tar and candidate manifest.
- Candidate evidence smoke: real Cucumber Message NDJSON was parsed, copied, hash-bound, and accepted only with matching candidate/lifecycle/FR records.
- `spec-verdict.ts`: GREEN / READY with all structure, contract, traceability, execution, BDD-sync, acceptance, and NFR lanes green.
- `spec-reality-check`: zero errors; one historical pickaxe warning is explained in RESEARCH.md.

## P2 Notes

1. The pickaxe associates historical commit `0eccfb81044827b8f358954801bfc1520a7e8972` with FR-1 because it introduced the original MCP surface. It did not satisfy active-project root behavior; RESEARCH.md records this distinction.
2. Real v0.3.0 → v0.3.1 upgrade/rollback receipts are intentionally absent from this branch. The evaluator and release workflow fail closed until they are captured from an actual tagged release candidate. No release, tag, or GitHub release mutation occurred here.

# Product evidence fixtures

## Current real release fixture

The positive product fixture is the bounded real-producer record at `docs/validation/release-status-v0.3.2.json`.

| Fact | Ground truth |
|---|---|
| Version and tag | `0.3.2`, `v0.3.2` |
| Tag commit | `2938389e34e2d06bdd497291ed01e0a2d89146c9` |
| Candidate SHA-256 | `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4` |
| Package-tree SHA-256 | `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92` |
| Archive SHA-256 | `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9` |
| Installed identity | `omp-spec-kit@omp-spec-kit` |
| Producer provenance | GitHub release workflow and attestation identities recorded in the bounded JSON; release assets are not copied here. |

This fixture proves only the current v0.3.2 read-only baseline. It does not prove a future outcome.

## Capture discipline

1. Capture output from the real release, install, authoring, or policy producer before trimming.
2. Record producer/tool version, invocation, repository revision, product artifact identity, capture time, result, and raw evidence SHA-256.
3. Trim only to a still-valid subset whose ground truth and producer summary reconcile.
4. Never hand-author a passing release, install, mutation, containment, or refusal receipt.
5. Keep secrets inert and unmistakably synthetic in negative safety cases.
6. Keep Gherkin and task state outside the proof count.

## Product-level result space

Only two status cases belong here:

- **positive:** the unchanged v0.3.2 real release record matches the SHIPPED row;
- **negative:** a bounded test input omits or mismatches the current proof reference and the evaluator returns not SHIPPED.

The negative input SHALL name its transformation from the captured positive record and SHALL NOT claim to be producer output. Detailed release failures and authoring-policy matrices stay with their owning specifications.

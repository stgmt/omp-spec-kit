---
name: release-operator
description: Operate omp-spec-kit releases with a fail-closed blocker loop. Trigger for every release, tag, candidate, archive, GitHub Release, attestation, dogfood, Docker BDD, staged authoring failure, drift verdict, or release-preflight request.
---

# Release operator

Use this skill before every omp-spec-kit release operation. A release is not ready while any gate or cross-spec drift blocker remains.

## Required gate order

1. Require a clean worktree and verify that the tag peels to the intended commit.
2. Run the repository blocker gate:

   ```text
   npm run check:release-blockers
   ```

   It reads `.dev-pomodoro/.cross-spec-cache` when present, otherwise `.dev-pomogator/.cross-spec-cache`. It blocks on `DRIFT` records with error severity for `mcp-release-integrity:*` or `plugin-distribution:*`. Missing or malformed cache evidence also blocks.

3. Run the complete local release gate:

   ```text
   npm run release:preflight -- --tag vX.Y.Z
   ```

   This includes repository verification, OMP dogfood, safe-authoring, all staged MCP scenarios, Docker BDD, release-integrity, candidate creation, public-tree safety, and archive smoke.

4. Obtain distribution evidence for the same peeled commit. Verify GitHub attestations and compare candidate, package-tree, and archive digests.
5. Require every release workflow job to pass. Wait for the successful evidence run whose `headSha` equals the tag commit.
6. Verify the GitHub Release, assets, downloaded archive hash, archive attestation, and installed/archive dogfood.

## Mandatory blocker loop

A non-zero blocker gate is active work, not a report. For every blocker:

1. Preserve the exact command, cache file, `fr_id`, `scenario_id`, explanation, and generated timestamp.
2. Map it to the owning functional requirement and scenario.
3. Inspect the current specification, scenario, implementation, and evidence producer. Do not delete cache files or downgrade `DRIFT` to make the count pass.
4. Fix the missing contract coverage or implementation at its owner boundary.
5. Add or update a deterministic regression scenario.
6. Run the focused scenario and regenerate the cross-spec cache through the real evaluator.
7. Re-run `npm run check:release-blockers`.
8. Re-run `npm test` and the complete release preflight.
9. Repeat until the blocker count is zero. Publication is forbidden while one blocker remains.

The full staged suite is mandatory. Old, internal, broad, or inconvenient scenarios are not exempt. Proposal-shape, authority, archive-receipt, digest, Docker, and attestation failures must be repaired, not excluded.

## Published-release boundary

Never force-move a published tag or overwrite a public asset. If a blocker is discovered after publication, repair `main`, run all gates, and create the next patch release with a new commit and complete evidence chain.

Never publish to npm. Never accept a same-tag artifact from another commit. Never call a release green from metadata-only evidence, stale cache entries, skipped jobs, or a partial test suite.

## Failure handling

- Empty lifecycle evidence: wait for the successful distribution-evidence run for the exact commit; never use committed receipts as a substitute.
- Proposal or receipt drift: repair the current public response contract and its scenario coverage, then rebuild and rerun all gates.
- Docker context failure: measure the context, exclude nested dependency directories from `.dockerignore`, rebuild, and rerun Docker BDD.
- Windows/Linux digest difference: compare file modes and the exact package contents; use the tagged Linux candidate as publication authority.
- Attestation, asset, tag, or digest mismatch: stop and preserve the mismatching evidence. Do not retry blindly.

## Required final proof

Report only after all gates pass:

- tag and peeled commit;
- candidate, package-tree, and archive SHA-256 values;
- blocker gate result with zero release-scope `DRIFT` records;
- local test and Docker results;
- workflow run IDs and GitHub Release URL;
- downloaded asset hash and attestation result;
- installed/archive dogfood result.

If any gate is unavailable or any blocker remains, state the exact blocker and continue repairing reachable causes. Do not report the release as ready.

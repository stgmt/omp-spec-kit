---
name: release-operator
description: Operate omp-spec-kit releases with repository-owned evidence and fail-closed verification. Trigger for every release, tag, candidate, archive, GitHub Release, attestation, dogfood, Docker BDD, staged authoring failure, or release-preflight request.
---

# Release operator

Use this skill before every omp-spec-kit release operation. A release is not ready while any repository check or evidence check remains unresolved.

## Required order

1. Require a clean worktree and verify that the tag points to the intended commit.
2. Run `npm run release:preflight -- --tag vX.Y.Z`.
3. Run the complete staged suite, Docker checks, release-integrity scenarios, candidate checks, archive checks, and installed-package checks.
4. Verify that all evidence comes from repository-owned sources:
   - `.omp-spec-kit/evidence/last-test-run.ndjson`;
   - `.omp-spec-kit/evidence/bdd-results/run.ndjson`;
   - `tests/fixtures/release-candidate/cucumber-messages.ndjson`.
5. Verify the candidate, package-tree, archive, tag, workflow, and attestation values against one peeled commit.

## Mandatory blocker loop

A failed check is active work, not a report:

1. Preserve the exact command, scenario, observed error, source file, and reproduction command.
2. Map the failure to the owning specification requirement and implementation boundary.
3. Fix the producer or caller; do not remove evidence, skip a scenario, weaken a requirement, or accept a metadata-only result.
4. Add or update deterministic regression coverage.
5. Run the focused scenario and then the complete suite.
6. Rebuild repository-owned evidence and rerun the complete release preflight.
7. Repeat until every check passes.

The full staged suite is mandatory. Broad, old, internal, inconvenient, proposal, archive, Docker, digest, and attestation scenarios are not exempt.

## Published-release boundary

Never force-move a published tag or overwrite a public asset. A blocker found after publication requires a fix on `main` and a new patch release with a new commit and complete evidence chain. Never publish to npm.

## Required final proof

Report only after all checks pass:

- tag and peeled commit;
- candidate, package-tree, and archive SHA-256 values;
- repository evidence source paths and hashes;
- local, staged, Docker, and installed-package results;
- workflow run IDs, attestation result, and GitHub Release URL;
- zero excluded scenarios and no unresolved blocker.

If a required evidence source is missing, stale, malformed, or unavailable, state that exact fact and keep the release blocked.
# Use cases

## UC-1 — Freeze the upstream source

**Primary actor:** provenance reviewer

**Preconditions:** an immutable upstream commit is selected; no target publication has occurred.

**Main flow:**

1. Read only Git-object bytes from the selected commit and allowlisted subtree.
2. Record repository URL, commit, source path, target path, SHA-256, disposition, import status, and license status for every inventoried path.
3. Copy approved reference bytes under `docs/upstream/` without editing them.
4. Compare copied bytes to the manifest.
5. Mark source-freeze evidence eligible only if every inventory row is accounted for and every copied hash matches.

**Alternatives:** a missing path, dirty-worktree read, unrecorded file, or hash mismatch makes the freeze ineligible and stops publication.

**Trace:** `product:FR-2`, `product:AC-2.1`, `product:AC-2.2`, `@feature2`.

## UC-2 — Decide redistribution eligibility

**Primary actor:** legal reviewer

**Preconditions:** source-freeze evidence exists.

**Main flow:**

1. Review the upstream license evidence and each imported row's status.
2. Record the decision and its evidence without changing the imported bytes.
3. Permit publication only when every copied item has an accepted redistribution basis.

**Hypothetical alternative:** a future or changed import lacks sufficient evidence; status stays `NOT_READY_FOR_PUBLICATION`, and removal/replacement of the affected bytes remains an acceptable remediation.

**Trace:** `product:FR-3`, `product:AC-3.1`, `product:AC-3.2`, `@feature3`.

## UC-3 — Produce a clean public export

**Primary actor:** security reviewer

**Preconditions:** an allowlist and prohibited-path policy exist.

**Main flow:**

1. Build the candidate tree only from approved repository-owned files and manifest-approved imported bytes.
2. Reject credentials, `.env` material, logs, caches, user state, mutable test evidence, inherited Git history, and unapproved binary/generated assets.
3. Run the configured secret scan over the complete candidate history/tree.
4. Record zero unresolved findings and public-diff review.

**Alternatives:** any unknown path or unresolved scan finding blocks publication; a scanner exception requires a recorded reviewer decision tied to the exact finding and bytes.

**Trace:** `product:FR-4`, `product:AC-4.1`, `product:AC-4.2`, `@feature4`.

## UC-4 — Publish specification-first init

**Primary actor:** product manager

**Preconditions:** source freeze, redistribution rights, clean export, specification review, and public documentation gates are eligible.

**Main flow:**

1. Confirm the repository contains product specifications and policies but no marketplace catalog or plugin payload.
2. Confirm the README says no plugin is installable.
3. Confirm the roadmap separates delivered, planned, and deferred stages.
4. Publish from fresh history only after all blockers are zero.

**Alternative:** any blocker keeps the repository local/non-public and status fail-closed.

**Trace:** `product:FR-1`, `product:FR-8`, `product:AC-1.1`, `product:AC-8.1`, `@feature1`, `@feature8`.

## UC-5 — Advance one product through releases

**Primary actor:** release owner

**Preconditions:** the exact product revision, current candidate artifact SHA-256, and artifact lineage to be evaluated are identified; each evidence reference declares a typed current-candidate or v0.2-predecessor binding; a preceding-stage label or historical proof is not itself gate evidence.

**Main flow:**

1. Derive the proposed stage's complete cumulative canonical cross-spec gate set; do not caller-select a subset.
2. Require `plugin-distribution:FR-1` separately for the one marketplace/plugin/extension identity invariant.
3. Require accepted `plugin-distribution:FR-13` bound to the current candidate before claiming v0.1.0.
4. Require accepted current-candidate `plugin-distribution:FR-13` plus accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.2"` before claiming v0.2 graph/query capability.
5. For v0.3, require accepted current-candidate distribution and accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.3"`. Separately identify the required accepted `targetStage: "v0.2"` result as the predecessor; permit its artifact SHA-256 to differ only when the v0.3 result's `v02ParentArtifactSha256` equals it, both kernel results share the status product revision and lineage, their stage/profile pair is ordered v0.2 before v0.3, and neither is stale or revoked.
6. For authoring/mutation, require current-candidate distribution, current-candidate v0.3 kernel, and current-candidate `spec-authoring-workflow:FR-13`, plus the same linked, accepted v0.2 predecessor. Do not collapse the two kernel target-stage results into one unqualified reference.
7. Confirm every cumulative aggregate accepted its complete mandatory member/dependency set. Only then publish `DELIVERED`.

**Alternatives:** any missing or member-subset aggregate, current distribution/current-stage/current-authoring result bound away from the current candidate, historical or different-lineage v0.2 result, missing or mismatched `v02ParentArtifactSha256`, reversed/duplicate/wrong target-stage pair, or stale/revoked result retains the last proven stage. A second product/control plane fails the identity gate.

**Trace:** `product:FR-5`, `product:FR-6`, `product:AC-5.1`, `product:AC-6.1`, `@feature5`, `@feature6`.

## UC-6 — Report honest status

**Primary actor:** public reader

**Preconditions:** stage definitions and evidence records exist.

**Main flow:**

1. Read the current status, evidence timestamp/source, blockers, and next gate.
2. Distinguish `DELIVERED`, `PLANNED`, `DEFERRED`, and `BLOCKED` claims.
3. Treat specification text, imported scenarios, structural validity, and roadmap entries as intent—not executed proof.
4. Present the most conservative status when required evidence is missing, stale, revoked, contradictory, parent-mismatched, or failed.

**Trace:** `product:FR-7`, `product:AC-7.1`, `product:AC-7.2`, `@feature7`.

## UC-7 — Use the MCP spec door

**Primary actor:** agent

**Preconditions:** the canonical census in `docs/decisions/spec-generator-port.md` exists.

**Main flow:**

1. Treat the agent-facing specification API as MCP only.
2. Treat the eight SCHEMA-11 names as the v0.3 first slice, not the destination registry.
3. Resolve later generator-port reads, evidence MCP, sibling LSP, and authoring MCP to their owner specs without unlocking authoring as delivered.
4. Refuse leftover freeze phrases that deny the 46-tool door unless they say first slice or v0.3 candidate.

**Alternatives:** host `lsp` is not a spec tool; MCP MAY consume LSP internally for diagnostics/navigation.

**Trace:** `product:FR-9`, `product:AC-9.1`, `@feature9`.

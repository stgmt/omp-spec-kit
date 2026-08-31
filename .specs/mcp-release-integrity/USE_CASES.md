# Use Cases

## UC-1: Launch from the active project

1. Install the package at project scope.
2. Start a fresh OMP session from project-a.
3. Call the read-only MCP surface.
4. Observe only project-a data; package and project-b decoys are absent.
5. Optionally supply a validated absolute project-b override and observe only project-b.

## UC-2: Recover after an invalid protocol frame

1. Send malformed JSON or an invalid identified request.
2. Receive one JSON-RPC terminal error.
3. Send a valid request on the same process.
4. Receive a normal response with no non-protocol stdout.

## UC-3: Exercise the historical v0.3.2 surface

1. Copy only the allowlisted built payload to an isolated package directory.
2. Verify the pinned corpus manifest before loading it.
3. Launch the installed server with no source checkout or ambient dependency ancestry.
4. Call exactly `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`.
5. Check complete external envelopes, corpus identity, and zero writes.

## UC-4: Run a future candidate journey

1. Build one clean candidate.
2. Run the ordinary unfiltered Docker profile and retain its real Cucumber Message output.
3. Install the prior public version, upgrade to the candidate, roll back, uninstall, and reinstall using fresh sessions for each observation.
4. Compare observed versions and project hashes before accepting the run.
5. Reject failed, malformed, meta-only, tag-scoped, or name-scoped output as trusted-run replacement.

## UC-5: Publish the verified archive

1. Assemble a deterministic archive from the clean peeled tag.
2. Verify contained inputs, package safety, executable mode, and candidate digests.
3. Verify GitHub Artifact Attestations for the exact subject, repository, signer workflow, and tag ref.
4. Publish by downloading and re-hashing the verified archive; never rebuild.
5. Treat an existing release as idempotent only when its required asset name, size, and digest match.

## UC-6: Read immutable v0.3.2 evidence

1. Read `docs/validation/release-status-v0.3.2.json` as a sealed historical record.
2. Reconcile tag, commit, candidate, package-tree, archive, asset, attestation, release-note, and advisory identities.
3. Do not reinterpret old evidence after feature or step files change.

## UC-7: Distinguish the active and overridden project

1. Start the installed package from project-a without an override.
2. Confirm every MCP result carries `serverName: "omp-spec-kit"`, matching opaque resolved/active root identities, and `rootMode: "active-project"`.
3. Start the same package with an explicit absolute project-b override while the cwd remains project-a.
4. Confirm every MCP result carries one project-b resolved identity, `rootMode: "explicit-absolute-override"`, and `matchesActiveProject: false`.
5. Run the OMP extension inventory and query tools with the same cwd/override pair and confirm they report the same provenance instead of splitting between `ctx.cwd` and the override.


# Use Cases

## UC-1 — Validate the target package

1. Read `.omp-plugin/marketplace.json` with OMP's supported parser.
2. Select the unique entry named `omp-spec-kit`.
3. Resolve `./plugins/omp-spec-kit` beneath the repository root.
4. Confirm the child version and declared extension/MCP entrypoints resolve beneath that child.
5. Ignore unrelated entries; reject duplicate target names or containment escape.

## UC-2 — Build and invoke once

1. Build from the immutable tag commit into a clean child payload.
2. Record the package-tree and archive SHA-256 values.
3. Install that archive project-scope in an isolated OMP home/project.
4. End the old session, start a fresh one, and invoke a canonical request.
5. For v0.3.2, observe version `0.3.2` and the historical eight read-only MCP names.
6. Repeat with checkout and ambient dependencies unavailable.

## UC-3 — Exercise lifecycle recovery

1. Install the candidate and observe it fresh.
2. Uninstall and prove fresh-session absence.
3. Reinstall the exact candidate digest and invoke it fresh.
4. For every release after the first, upgrade from a real public predecessor and roll back to those exact predecessor bytes.
5. Verify non-OMP-managed project hashes are unchanged.

## UC-4 — Apply public-safety checks

Before publication, verify provenance/license disposition, secret scanning, absence of user/local state, clean public paths, and the intended payload allowlist. A failure stops the release and leaves diagnostics in CI logs.

## UC-5 — Publish verified bytes

1. Run the named checks: target identity, deterministic build, installed invocation, dependency absence, lifecycle recovery, and public safety.
2. Carry the verified archive SHA-256 to the tag-gated publish job.
3. Refuse an existing release asset with different bytes.
4. Publish without rebuilding.
5. Create one GitHub Artifact Attestation whose subject is the public archive.
6. Write the compact distribution status record. Product status composition remains outside this specification.

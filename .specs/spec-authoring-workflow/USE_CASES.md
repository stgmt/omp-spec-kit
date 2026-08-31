# Use Cases

## UC-1: Propose one traced change

1. Caller selects one repository and one spec slug.
2. Internal helpers compile the requested domain intent into canonical edit operations.
3. `propose_patch` resolves containment, applies edits in memory, validates the resulting spec, and returns a complete deterministic preview.
4. Repository document hashes remain unchanged.

**Failure:** invalid input, path, anchor, trace, or preview bound returns a structured refusal with no write.

## UC-2: Apply the exact proposal

1. Caller submits the proposal identity/hash and expected hashes to `apply_proposed_patch`.
2. The handler acquires the spec lock, re-resolves paths, checks CAS, rebuilds and revalidates the exact result.
3. The writer stages on the same filesystem and installs one complete generation.
4. Caller receives a compact redacted receipt.

**Failure:** any mismatch or validation finding refuses before commit.

## UC-3: Resolve a concurrent edit

Two callers propose from the same base. The first accepted apply commits. The second rechecks hashes under the lock, returns `CONFLICT` with current hashes, and creates a fresh proposal if still desired. No automatic rebase occurs.

## UC-4: Reject an escaping or raw write

The current-host `tool_call` policy first recognizes only the two authoring names. Every other mutating call whose resolved target is under `.specs/**` is denied. The authoring handler independently rejects traversal, absolute, device, linked, reparse, normalization-collision, and cross-spec targets.

## UC-5: Rename a heading safely

The internal compiler resolves one heading from the immutable kernel inventory, computes the canonical anchor, expands same-spec inbound link rewrites, and proposes the byte changes. Ambiguous headings, cross-spec inbound links, stale section hashes, or incomplete inventories refuse.

## UC-6: Survive a writer fault

Faults before the generation swap preserve the old generation. A fault after an uncertain swap triggers internal hash-based old/new selection and rollback while the lock remains held. Readers observe only a complete generation.

## UC-7: Stop at unrecoverable storage

If neither complete old nor complete new generation can be proven, the handler returns `RECOVERY_REQUIRED`, performs no further mutation, preserves diagnostics, and instructs the operator to restore the named spec from normal VCS or backup. There is no public recovery, rebaseline, or overwrite operation.

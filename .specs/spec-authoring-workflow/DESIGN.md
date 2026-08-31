# Design

## Context

The useful product is a small proposal/apply engine, not a second workflow platform. v0.3.2 is already shipped as a read-only MCP baseline. Authoring is a `NEXT` capability inside the same server and kernel.

## Components

1. **Tool-call path policy** — recognizes the exact public authoring names first, then denies any non-allowlisted writer resolved below canonical `.specs/**`.
2. **Operation compiler** — internal helpers normalize domain intents into `EditOperation[]`; it has no public registry.
3. **Proposal engine** — resolves one contained spec, edits an immutable in-memory snapshot, reuses kernel validators, and returns deterministic Proposal bytes/hashes/findings without writes.
4. **Apply engine** — resolves the Proposal, locks the spec, performs CAS and full revalidation, then delegates to the generation writer.
5. **Generation writer** — stages on the same filesystem, synchronizes where supported, swaps one complete generation, performs internal hash-based rollback, and returns a compact receipt.

## Flow

```mermaid
flowchart LR
  H[internal helper or generic request] --> C[operation compiler]
  C --> P[propose_patch]
  P --> V[containment + kernel validation]
  V --> Q[immutable Proposal]
  Q --> A[apply_proposed_patch]
  A --> R[re-resolve + CAS + revalidate]
  R --> W[atomic generation writer]
  W --> M[compact MutationReceipt]
```

## Decisions

### D-1: Two public tools

The only public mutation names are `propose_patch` and `apply_proposed_patch`. Tool discovery is the availability contract. Unsupported or internal helper names are not published in a second manifest.

### D-2: Review is caller behavior

The Proposal contains the exact diff and hashes. A human or agent may inspect it before apply, but the server has no durable `REVIEWED` state. Apply proves identity by Proposal hash and current document hashes.

### D-3: No silent rebase

A mismatch returns `CONFLICT`. The caller must create a fresh Proposal. This keeps preview and committed bytes identical.

### D-4: One-spec atomic scope

A Proposal may edit multiple canonical documents but exactly one spec. Cross-spec atomicity is rejected rather than approximated.

### D-5: Filesystem-backed containment

Lexical checks run first, followed by platform metadata for existing components and a final recheck under the lock. Linked/reparse spec directories are unsupported.

### D-6: Compose kernel validators

The authoring layer does not fork IDs, forms, anchors, trace, or conformance rules. It evaluates the complete resulting generation with the current kernel services.

### D-7: Internal rollback only

The writer may choose between fully hashed old/new generations after a fault. If neither is provable, it stops at `RECOVERY_REQUIRED` and bounded manual VCS/backup guidance. No public repair or replacement-bytes path exists.

### D-8: Receipt, not ledger

The apply result contains enough hashes and findings for the caller/session to persist if desired. The authoring subsystem owns no append-only digest chain, sink transaction, or independent audit state.

### D-9: Tests are evidence

Real fixture, race, fault-injection, and targeted mutation checks defend observable behavior in CI. They do not alter runtime tool availability.

## Atomic commit protocol

1. Acquire the spec-scoped exclusive lock within the configured bound.
2. Re-resolve root, spec, ancestors, and targets using filesystem metadata.
3. Verify Proposal identity/hash and exact changed-document set.
4. Compare expected hashes and base snapshot.
5. Rebuild the exact result and rerun all validators.
6. Create a complete same-filesystem stage and calculate every file hash.
7. Synchronize staged files/directories where supported.
8. Compare paths and expected hashes again.
9. Replace the spec generation and make only the complete result visible.
10. Return the compact receipt; clean transient material without changing committed bytes.

A failure through step 8 preserves the old generation. An uncertain step 9 triggers internal old/new hash selection. No mixed generation is a successful or recoverable outcome.

## Security boundary

The host policy blocks raw `.specs/**` writers. The handler separately enforces containment because an allowlisted name does not make its arguments safe. Diagnostics use relative paths and bounded hashes; document bodies and secrets never enter the Apply result.

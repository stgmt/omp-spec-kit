# Design

## Architecture

```text
active project -> installed package launcher -> stdio MCP server -> one read-only query service
                                                      |
                                                      +-> historical eight tool calls

clean peeled tag -> deterministic candidate archive -> one unfiltered MRI run
                    |                                  +-> real lifecycle journey
                    +-> native artifact attestation -> download + re-hash -> publish same bytes

immutable v0.3.2 status record -> historical evidence reader only
```

## Runtime verification

The launcher finds its package-local server but does not choose the repository. OMP's active-project cwd is the default data root; a validated absolute override may select another contained project. MRI launches the copied installed package, sends raw protocol frames, calls all eight historical MCP handlers, snapshots the served corpus before and after, and checks the response source identity.

The historical eight-tool test checks external package behavior. Full query semantics remain kernel-owned; MRI retains one serialization-boundary comparison to catch packaging drift without becoming a second kernel oracle.

## Response provenance

The adapter layer creates one root context from the canonical physical active-project cwd and the optional absolute override. Every stdio MCP envelope and legacy OMP inventory result carries `provenance` with the fixed server name, opaque SHA-256 identities for the resolved and active roots, `rootMode`, and `matchesActiveProject`. The IDs never contain absolute paths or environment values. The core graph fingerprint remains content/limits identity; it does not replace root provenance.

The explicit override remains available for controlled diagnostics, but it is never silent: summaries and structured results identify `explicit-absolute-override` and `matchesActiveProject: false`. The stdio server and all eight OMP extension tools use the same root context; no tool may read `ctx.cwd` while another honors the override.

## Candidate run

A future candidate run is one compact result bound to candidate/archive/feature/step/source digests. It records named observable groups, source identities for installed results, and the real install/upgrade/rollback/uninstall/reinstall journey. It does not contain manager/provider topology, a per-FR receipt registry, a distribution claim matrix, or fixed scenario/pickle/CHK counts.

The Docker wrapper allocates a unique writable result file. Only a successful unfiltered run may be atomically promoted. Failed, malformed, tag-scoped, and name-scoped runs leave the prior trusted artifact untouched.

## Candidate and publication

Candidate creation resolves the peeled tag, refuses dirty or different checkout state, enumerates the allowlisted regular files lexically, preserves executable mode, and hashes the package tree and archive. One filesystem-backed containment check runs before content use and rejects symlink, junction, reparse, or realpath escape.

Public-tree scanning is an outcome contract: no credentials in published bytes, bounded redacted findings, no secret echo. Detector category names are not public ABI.

The release workflow verifies GitHub Artifact Attestations for the exact subject, repository, signer workflow, and tag ref. Publish downloads and re-hashes the candidate archive and never invokes the build. An existing release is idempotent only when required asset name, size, and digest match.

## Historical reader

`release-status-v0.3.2.json` remains the immutable authority for public v0.3.2 readback. Its evidence@3, lifecycle, manager-discovery, distribution-attestation, and release-result fields may be parsed as historical data. New candidates use the compact forward run contract in [the schema](mcp-release-integrity_SCHEMA.md); historical objects are never migrated in place.

## Key decisions

### Decision: Verify behavior, not OMP topology

**Rationale:** Active-project answers and decoy exclusion are stable user-visible outcomes.
**Trade-off:** A host refactor does not invalidate MRI if installed behavior is unchanged.

**Alternatives considered:**
- Maintain a host-topology receipt as the primary acceptance object.
- Accept installed behavior only and keep host topology out of the contract.

**Требование:** [FR-1](FR.md#fr-1-active-project-installed-behavior)

### Decision: Keep protocol errors terminal and recovery local

**Rationale:** A terminal JSON-RPC error gives clients a bounded result and preserves the next valid call.
**Trade-off:** Invalid input cannot be silently ignored without making the process state ambiguous.

**Alternatives considered:**
- Drop the process on the first malformed frame.
- Return one terminal error and keep the same process available for the next valid request.

**Требование:** [FR-2](FR.md#fr-2-terminal-protocol-errors-and-recovery)

### Decision: Prove installed handlers, not descriptors

**Rationale:** Calling each historical handler from an isolated package catches packaging and transport regressions.
**Trade-off:** A tools/list snapshot alone cannot prove a handler executes.

**Alternatives considered:**
- Trust the manifest and skip handler calls.
- Call every historical handler and compare the bounded result.

**Требование:** [FR-3](FR.md#fr-3-historical-eight-tool-installed-surface)

### Decision: One real run, no receipt lattice

**Rationale:** A successful unfiltered producer run and observed lifecycle journey are stronger than nested self-authored eligibility objects.
**Trade-off:** Lifecycle verification takes longer but has one understandable result.

**Alternatives considered:**
- Keep a nested eligibility and per-FR receipt lattice.
- Require one trusted unfiltered run with named lifecycle observations.

**Требование:** [FR-4](FR.md#fr-4-one-real-candidate-run)

### Decision: Publish the verified archive

**Rationale:** A single archive digest binds verification, attestation, download, and release.
**Trade-off:** Any identity mismatch blocks mutation rather than rebuilding for convenience.

**Alternatives considered:**
- Rebuild during publication and compare only the version.
- Publish the already verified archive and block on any digest mismatch.

**Требование:** [FR-5](FR.md#fr-5-contained-deterministic-candidate-and-same-byte-publication)

### Decision: Preserve immutable history

**Rationale:** Historical receipts explain the shipped baseline without pretending to be a new candidate run.
**Trade-off:** The forward contract carries less historical detail and uses a separate evidence reader.

**Alternatives considered:**
- Rewrite historical receipts into the compact candidate schema.
- Keep historical bytes immutable and read them without reclassifying them.

**Требование:** [FR-6](FR.md#fr-6-public-guidance-and-immutable-v032-evidence)

## Fixture isolation

Each scenario owns one `mkdtemp` tree. Cleanup removes only that tree after closing its server. Tests do not mutate tracked source, user OMP state, tags, releases, or the shared real fixture. The copied payload and corpus are externally hashed before use.

**Alternatives considered:**
- Rebuild during publication and compare only the version.
- Publish the already verified archive and block on any digest mismatch.

**Требование:** [FR-5](FR.md#fr-5-contained-deterministic-candidate-and-same-byte-publication)

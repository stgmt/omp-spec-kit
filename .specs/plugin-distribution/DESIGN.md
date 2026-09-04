# Design

## One practical path

```text
immutable tag commit
  -> select unique omp-spec-kit entry and contained child
  -> clean deterministic build (package tree + archive SHA-256)
  -> installed fresh-session and dependency-absent smoke
  -> uninstall/reinstall + real-predecessor upgrade/rollback
  -> public-safety checks
  -> publish the already verified archive digest
  -> one final GitHub Artifact Attestation over the public archive
  -> compact distribution status record
```

There is no parallel eligibility evaluator or internal attested evidence subject in the forward path.

## Boundaries

| Owner | Responsibility |
|---|---|
| OMP | Parse marketplace, package extension, and MCP configuration; install and load the child. |
| Kernel/runtime | Define the read-only tool request/result/error contracts. |
| Distribution | Select the target, contain/build bytes, run installed/lifecycle/safety checks, publish and attest. |
| MRI | Verify MCP release integrity. |
| Product | Compose baseline/capability/public state. |

Distribution tests compatibility by driving the supported host with real installed bytes. It does not freeze all possible OMP fields or duplicate the runtime schema.

## Target selection

Read `.omp-plugin/marketplace.json` through the supported OMP contract and select the unique entry named `omp-spec-kit`. Its source must be `./plugins/omp-spec-kit`; the child and its declared entrypoints must resolve beneath the repository root/child after link resolution. Unrelated marketplace entries, packages, or servers are permitted and ignored.

## Build boundary

`plugins/omp-spec-kit/` is the complete recursively copied payload. The build starts from empty `dist/`, copies the required root sources into generated output, rejects unexpected/non-regular/linked child files, and records package-tree/archive SHA-256 values. The archive is immutable after checks begin.

The dependency-absent smoke hides the checkout and ambient `node_modules` before loading the extension and MCP launcher. This proves the public payload, not a developer workspace.

## Installed smoke

Each candidate uses disposable project and OMP user roots. The flow records discovery, install, reload, old-session termination, fresh-session start, and canonical invocation separately. The request is intentionally small: verify active-project resolution, candidate version, declared surface, read-only behavior, and session survival. Exhaustive query behavior belongs to the kernel.

Historical v0.3.2 additionally observes the eight shipped read-only MCP tools: `spec_inventory`, `spec_overview`, `spec_find_nodes`, `spec_get_node`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, and `spec_markdown_inventory`. That list describes v0.3.2, not a permanent destination census.

## Lifecycle

Every release proves candidate uninstall/absence and exact-candidate reinstall/fresh invocation. Releases after the first also use a real lower public artifact for upgrade and rollback. Hashes of non-OMP-managed project files are equal before and after every transition.

## Publication

Verification produces one candidate archive plus ordinary CI logs. The tag-gated publish job receives the archive by digest, refuses a different existing asset, and never rebuilds. After upload, GitHub Artifact Attestations signs the public archive once. The public asset, verified archive, and attestation subject digests must match.

Historical v0.3.2 used an internal distribution-evidence subject and separate attestation before its public asset attestation. Those receipts remain valid history; the next release does not repeat the chain.

## Decisions

### D-1 — Target uniqueness, not repository cardinality

Only the `omp-spec-kit` name and its contained child must be unique. This protects installation without banning unrelated future plugins.

### D-2 — Runtime compatibility by real invocation

The supported OMP pin and kernel contract are exercised, not re-authored. A pin change triggers a new installed smoke.

### D-3 — Fresh session is the activation boundary

Install and reload are necessary observations but cannot prove the loaded extension/MCP surface.

### D-4 — Build once and attest the public bytes

The artifact under test is the artifact published. One final attestation gives consumers the relevant trust binding without an internal evidence-subject round trip.

### D-5 — Compact distribution status

Distribution records identity and named outcomes. Product state and capability readiness remain with their owners.

---

## Product lifecycle domain (merged)

## Objective

Expose one truthful current release, one actionable next outcome, and a short later list. Keep release and implementation details in their owning specifications.

## Product boundary

`omp-spec-kit` is one marketplace entry, one plugin package, and one extension installed as `omp-spec-kit@omp-spec-kit`. The product document owns only public identity and roadmap status. It does not create another write surface or restate owner checks.

## Status evaluation

The public buckets are a closed set:

| Bucket | Meaning |
|---|---|
| SHIPPED | Current observable proof names the exact released identity and result. |
| NEXT | The one active product outcome; no shipment claim. |
| LATER | A plain outcome with no hidden substate or shipment claim. |

The evaluator first reads the roadmap rows. A SHIPPED row without readable matching proof is invalid. A specification, task, scenario, historical receipt, or sibling result is not a substitute. The current instance is one SHIPPED v0.3.2 row, one NEXT safe-authoring row, and the LATER list in [README.md](README.md).

## Safe authoring boundary

The NEXT outcome has one boring path:

1. expose only `spec_propose_patch` and `apply_proposed_patch` as public mutation tools;
2. before a `tool_call`, accept the exact allowlist `{spec_propose_patch, apply_proposed_patch}`;
3. for every other write-capable call, canonically resolve targets and refuse those under `.specs/**`;
4. fail closed on link, reparse, containment, or resolution uncertainty that may reach `.specs/**`;
5. apply accepted patches atomically and return bounded reasons;
6. require real end-to-end proof before moving the row to SHIPPED.

This policy does not need caller identity fields beyond the exact tool name and resolved targets.

## Decisions

### D-1 — One current release row

**Decision:** Collapse public-init, v0.1, v0.2, and v0.3 history into one current v0.3.2 SHIPPED row.

**Rationale:** users install one current product.

**Trade-off:** release history moves to the changelog and immutable receipts.

**Alternatives rejected:** four current rows, because they confuse release history with present status.

### D-2 — Three public buckets

**Decision:** Use only SHIPPED, NEXT, and LATER.

**Rationale:** these answer the manager's actual questions.

**Trade-off:** owner specifications carry detailed readiness states.

**Alternatives rejected:** a product-level state machine, because it duplicates owner logic.

### D-3 — Proof before shipped

**Decision:** Current observable proof is mandatory for SHIPPED.

**Rationale:** plans and Gherkin do not run the product.

**Trade-off:** a finished implementation stays NEXT until its proof is captured.

**Alternatives rejected:** task completion or historical evidence as a shortcut.

### D-4 — Safe authoring is one outcome

**Decision:** Atomic authoring and direct-write protection share one NEXT row.

**Rationale:** users receive one inseparable safety outcome.

**Trade-off:** product status does not expose separate implementation states.

**Alternatives rejected:** separate roadmap rows, because either half alone is unsafe.

## Exclusions

The product status does not model release-record internals, owner checks, corpus counters, editor protocols, future impact schemas, or plan-validation internals.

---

## MCP release-integrity domain (merged)

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

`release-status-v0.3.2.json` remains the immutable authority for public v0.3.2 readback. Its evidence@3, lifecycle, manager-discovery, distribution-attestation, and release-result fields may be parsed as historical data. New candidates use the compact forward run contract in [the schema](plugin-distribution_SCHEMA.md); historical objects are never migrated in place.

## Key decisions

### Decision: Verify behavior, not OMP topology

**Rationale:** Active-project answers and decoy exclusion are stable user-visible outcomes.
**Trade-off:** A host refactor does not invalidate MRI if installed behavior is unchanged.

**Alternatives considered:**
- Maintain a host-topology receipt as the primary acceptance object.
- Accept installed behavior only and keep host topology out of the contract.

**Требование:** [FR-19](FR.md#fr-19-active-project-installed-behavior)

### Decision: Keep protocol errors terminal and recovery local

**Rationale:** A terminal JSON-RPC error gives clients a bounded result and preserves the next valid call.
**Trade-off:** Invalid input cannot be silently ignored without making the process state ambiguous.

**Alternatives considered:**
- Drop the process on the first malformed frame.
- Return one terminal error and keep the same process available for the next valid request.

**Требование:** [FR-20](FR.md#fr-20-terminal-protocol-errors-and-recovery)

### Decision: Prove installed handlers, not descriptors

**Rationale:** Calling each historical handler from an isolated package catches packaging and transport regressions.
**Trade-off:** A tools/list snapshot alone cannot prove a handler executes.

**Alternatives considered:**
- Trust the manifest and skip handler calls.
- Call every historical handler and compare the bounded result.

**Требование:** [FR-21](FR.md#fr-21-historical-eight-tool-installed-surface)

### Decision: One real run, no receipt lattice

**Rationale:** A successful unfiltered producer run and observed lifecycle journey are stronger than nested self-authored eligibility objects.
**Trade-off:** Lifecycle verification takes longer but has one understandable result.

**Alternatives considered:**
- Keep a nested eligibility and per-FR receipt lattice.
- Require one trusted unfiltered run with named lifecycle observations.

**Требование:** [FR-22](FR.md#fr-22-one-real-candidate-run)

### Decision: Publish the verified archive

**Rationale:** A single archive digest binds verification, attestation, download, and release.
**Trade-off:** Any identity mismatch blocks mutation rather than rebuilding for convenience.

**Alternatives considered:**
- Rebuild during publication and compare only the version.
- Publish the already verified archive and block on any digest mismatch.

**Требование:** [FR-23](FR.md#fr-23-contained-deterministic-candidate-and-same-byte-publication)

### Decision: Preserve immutable history

**Rationale:** Historical receipts explain the shipped baseline without pretending to be a new candidate run.
**Trade-off:** The forward contract carries less historical detail and uses a separate evidence reader.

**Alternatives considered:**
- Rewrite historical receipts into the compact candidate schema.
- Keep historical bytes immutable and read them without reclassifying them.

**Требование:** [FR-24](FR.md#fr-24-public-guidance-and-immutable-v032-evidence)

## Fixture isolation

Each scenario owns one `mkdtemp` tree. Cleanup removes only that tree after closing its server. Tests do not mutate tracked source, user OMP state, tags, releases, or the shared real fixture. The copied payload and corpus are externally hashed before use.

**Alternatives considered:**
- Rebuild during publication and compare only the version.
- Publish the already verified archive and block on any digest mismatch.

**Требование:** [FR-23](FR.md#fr-23-contained-deterministic-candidate-and-same-byte-publication)
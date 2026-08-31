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

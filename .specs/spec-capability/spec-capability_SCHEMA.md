# Spec Capability Schema

This is the exhaustive public data contract for the capability extension schema `spec-capability@1`. It depends on `spec-kernel@1` and extends its typed model without modifying it. Fields not listed here are forbidden. JSON names are camelCase. Required fields are always present; unavailable values are represented by `null` only where the type explicitly permits it. Public paths are NFC, `/`-separated, repository-relative, and never absolute.

## SCHEMA-CAP-1: Scalar identities

| Type | Grammar / meaning |
|---|---|
| `CapabilityId` | `CAP-[1-9][0-9]*` for top-level; `CAP-[1-9][0-9]*\.[1-9][0-9]*` for nested |
| `CapabilityCanonicalId` | `<SpecSlug>:<CapabilityId>` or the repository-level form `CAP-N` / `CAP-N.M` when declared in `.specs/CAPABILITIES.md` |
| `ImpactSchemaVersion` | literal `spec-capability-impact@1` |
| `CapabilitySchemaVersion` | literal `spec-capability@1` |
| `CapabilityReleaseStage` | closed union determined by ROADMAP decision (initially empty; populated at stage registration) |
| `CapabilityEvidenceProfile` | closed union determined by ROADMAP decision (initially empty; populated at stage registration) |

Capability IDs follow `spec-kernel:FR-3` normalization: NFC Unicode, LF line endings, `/` path separators. IDs are case-sensitive. No trimming, zero-padding, or fuzzy matching occurs.

## SCHEMA-CAP-2: CAPABILITIES.md document role

| Document | Required filename | Definition kinds allowed |
|---|---|---|
| `CAPABILITIES` | `.specs/CAPABILITIES.md` (repository-level) | `CAPABILITY` (`CAP-N`, `CAP-N.M`) |

The CAPABILITIES.md document is discovered at the repository root under `.specs/`, not inside individual spec slug directories. It is a singleton per repository. Level-2 ATX headings `## CAP-N: <title>` define top-level capabilities. Level-3 ATX headings `### CAP-N.M: <title>` define nested capabilities whose parent is the enclosing level-2 CAP-N. The colon separator is followed by one ASCII space. Titles are non-empty product-wording obligations.

Heading recognition follows the same discipline as `spec-kernel_SCHEMA.md` SCHEMA-2: definition recognition is selected by document kind before heading production matching. Malformed candidates yield typed diagnostics; arbitrary prose is never promoted heuristically.

## SCHEMA-CAP-3: CAPABILITY node attributes

### Extended `NodeKind`

The capability extension adds `CAPABILITY` to the node kind union. The kernel's closed set remains unchanged; this extension registers the new kind in its own schema version.

### `CapabilityAttributes`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `nestingDepth` | integer ≥ 0 | yes | 0 for top-level, 1 for first nesting level |
| `parentCapId` | `CapabilityCanonicalId \| null` | yes | Parent capability for nested nodes; null for top-level |

No additional fields are permitted on CAPABILITY node attributes.

## SCHEMA-CAP-4: DERIVES_FROM edge and endpoint matrix

### Extended `EdgeType`

The capability extension adds `DERIVES_FROM` to the edge type union. The kernel's closed set remains unchanged.

### Allowed endpoint kinds for DERIVES_FROM

| Edge | Allowed from | Allowed to |
|---|---|---|
| `DERIVES_FROM` | `FUNCTIONAL_REQUIREMENT`, `NON_FUNCTIONAL_REQUIREMENT`, `CAPABILITY` | `CAPABILITY` |

Specifically:
- `FUNCTIONAL_REQUIREMENT → CAPABILITY`: requirement derives from a product capability.
- `NON_FUNCTIONAL_REQUIREMENT → CAPABILITY`: NFR derives from a product capability.
- `CAPABILITY → CAPABILITY`: nested capability derives from parent capability (child→parent).

An edge outside this table is unresolved as `FORBIDDEN_ENDPOINT`; it never enters `edges`.

### Declaration grammar

DERIVES_FROM references are declared via two mechanisms:

1. **Structured field on FR/NFR headings:** `**Capability:** [CAP-N.M]` in the body of an FR or NFR definition in `FR.md`. The field pattern mirrors the existing `**Requirement:**` structured field recognized by the kernel per `spec-kernel:FR-5`. Multiple capability fields on one heading produce multiple DERIVES_FROM reference occurrences.

2. **Spec README frontmatter:** `capabilities: [CAP-N, CAP-M, ...]` in YAML-like frontmatter of a spec's `README.md`. Each listed capability ID produces one DERIVES_FROM reference occurrence from every FR/NFR in that spec to the listed capability. Frontmatter IDs may be bare (resolved within the repository-level CAPABILITIES.md scope) or qualified.

Both mechanisms produce reference occurrences resolved through the standard edge-resolution pipeline defined in `spec-kernel:FR-5`.

## SCHEMA-CAP-5: Conformance finding codes

### Extended `DiagnosticCode`

The capability extension adds three diagnostic codes:

| Code | Severity | Meaning |
|---|---|---|
| `CAPABILITY_DANGLING` | ERROR | A `**Capability:**` field or frontmatter declaration targets an unknown capability ID |
| `CAPABILITY_ORPHAN` | WARNING | A CAPABILITY node has zero live non-archived deriving requirements |
| `SPEC_WITHOUT_CAPABILITY` | INFO | A spec declares no capabilities in frontmatter or FR/NFR fields |

Severity semantics:
- `CAPABILITY_DANGLING` (ERROR) sets `graph.valid=false`, matching the kernel's treatment of broken references.
- `CAPABILITY_ORPHAN` (WARNING) does NOT set `graph.valid=false`; it is an advisory archival mirror.
- `SPEC_WITHOUT_CAPABILITY` (INFO) does NOT set `graph.valid=false`; it is an authoring hint.

All diagnostics follow `spec-kernel_SCHEMA.md` SCHEMA-6 format with repository-relative paths, bounded messages, and remediation hints:
- `CAPABILITY_DANGLING`: remediation `define-capability-or-fix-reference`
- `CAPABILITY_ORPHAN`: remediation `review-for-archival-or-add-derivers`
- `SPEC_WITHOUT_CAPABILITY`: remediation `add-capabilities-frontmatter`

## SCHEMA-CAP-6: Impact response envelope

### `ImpactResponse`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `schemaVersion` | `ImpactSchemaVersion` | yes | Literal `spec-capability-impact@1` |
| `target` | `CanonicalId` | yes | The queried node |
| `structural` | `StructuralImpact` | yes | Structural dependents |
| `semanticRecheck` | `CanonicalId[]` | yes | Scenario and AC IDs for semantic drift review |
| `invalidates` | `ScenarioResultId[]` | yes | Scenario result identifiers rendered stale |

### `StructuralImpact`

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `acs` | `CanonicalId[]` | yes | AC nodes covering the target via incoming COVERS |
| `stories` | `CanonicalId[]` | yes | User story nodes covering the target via incoming COVERS |
| `decisions` | `CanonicalId[]` | yes | Decision nodes covering the target via incoming COVERS |
| `scenariosDirect` | `CanonicalId[]` | yes | Scenarios testing the target directly via TESTED_BY |
| `scenariosViaAc` | `CanonicalId[]` | yes | Scenarios reachable via two-hop FR→AC→scenario |
| `tasks` | `CanonicalId[]` | yes | Tasks referencing the target via REFS |
| `codeFiles` | `CanonicalId[]` | yes | FILE nodes connected via IMPLEMENTS edges |
| `dependentFrs` | `CanonicalId[]` | yes | FRs referencing the target via REFS |
| `parentCapabilities` | `CanonicalId[]` | yes | Capabilities the target derives from via DERIVES_FROM |

### `ScenarioResultId`

Opaque string identifying a scenario execution result. Format is implementation-defined by the future evidence layer; this spec treats it as an opaque bounded scalar (at most 512 Unicode scalar values). The invalidation set defines the CONTRACT for what should be invalidated; actual freshness computation is consumed by reference from the future evidence layer.

### Ordering and bounds

All arrays in `ImpactResponse` SHALL be sorted by canonical ID ascending (or by `ScenarioResultId` ascending for `invalidates`). Each array SHALL respect default and hard page limits. If a valid result would exceed the response byte budget, the service SHALL reduce at an item boundary, set `truncated=true`, and return `nextCursor`.

## SCHEMA-CAP-7: Query operations

### Extended `QueryOperation`

The capability extension adds three operations:

| Operation | Exact fields (all required unless `?`) |
|---|---|
| `requirements_of` | `{ capabilityId: CapabilityCanonicalId, includeArchived: boolean, limit: integer, cursor: Cursor \| null }` |
| `capabilities_of` | `{ specSlug: SpecSlug, limit: integer, cursor: Cursor \| null }` |
| `get_impact` | `{ nodeId: CanonicalId, maxDepth: integer, maxVisited: integer, limit: integer, cursor: Cursor \| null }` |

`includeArchived` defaults to false. When false, archived/non-live requirements are excluded from `requirements_of` results. `limit` must be 1 through `maxPageLimit`. `maxDepth` and `maxVisited` apply to `get_impact` traversal bounds.

### Result data kinds

| Kind | Exact fields |
|---|---|
| `requirementsOf` | `{ kind: "requirementsOf", capabilityId: CapabilityCanonicalId, requirements: (NodeSummary \| Node)[], totalMatched: integer }` |
| `capabilitiesOf` | `{ kind: "capabilitiesOf", specSlug: SpecSlug, capabilities: (NodeSummary \| Node)[], totalMatched: integer }` |
| `impact` | `{ kind: "impact", response: ImpactResponse }` |

Results follow the same envelope, pagination, error, and diagnostic patterns as `spec-kernel_SCHEMA.md` SCHEMA-8 through SCHEMA-10.

## SCHEMA-CAP-8: Stable ordering

- Capability nodes: `canonicalId` ascending.
- DERIVES_FROM edges: same ordering as kernel edges (`from`, `to`, `type`, `source.path`, `source.startOffset`, `edgeId`).
- `requirements_of` results: `canonicalId` ascending.
- `capabilities_of` results: `canonicalId` ascending.
- Impact structural arrays: `canonicalId` ascending within each section.
- Impact `semanticRecheck`: `canonicalId` ascending.
- Impact `invalidates`: `ScenarioResultId` ascending.
- Conformance diagnostics: same ordering as kernel diagnostics (SCHEMA-6 rule).

Pagination applies after filtering and stable sort. Cursors are bound to graph fingerprint, operation, normalized filters, projection, and the last sort key.

## SCHEMA-CAP-9: Release evidence and eligibility

`CapabilityEvidenceRequirementId` is the closed union `FR-1 | FR-2 | FR-3 | FR-4 | FR-5 | FR-6 | FR-7 | FR-8`.

`MandatoryCapabilityCheckId` is the closed union `CHK-FR1-01 | CHK-FR2-01 | CHK-FR3-01 | CHK-FR4-01 | CHK-FR5-01 | CHK-FR6-01 | CHK-FR7-01 | CHK-FR8-01`.

The release evaluator consumes a versioned mandatory-evidence manifest plus caller-supplied immutable evidence bytes. The manifest declares a closed `targetStage` and matching `evidenceProfile` determined by the ROADMAP-decided kernel-family extension stage. Eligibility requires exactly one passing hash-bound record for every `MandatoryCapabilityCheckId`, plus accepted current-candidate `spec-kernel:FR-14` evidence as a dependency. Missing, extra, duplicate, failed, stale, mismatched, or unbound records fail closed with deterministic blockers.

`CapabilityReleaseEligibility` exact fields: `{ schemaVersion: "spec-capability-release-eligibility@1", targetStage: CapabilityReleaseStage \| null, evidenceProfile: CapabilityEvidenceProfile \| null, eligible: boolean, candidateVersion: ReleaseVersion, artifactSha256: GraphFingerprint, requiredCheckIds: MandatoryCapabilityCheckId[], passedCheckIds: MandatoryCapabilityCheckId[], blocking: { checkId: MandatoryCapabilityCheckId \| null, code: string, evidencePaths: string[] }[], kernelDependencyEligible: boolean, evidenceFingerprint: GraphFingerprint }`.

`kernelDependencyEligible` is true only when the referenced `spec-kernel:FR-14` evaluation for the same candidate lineage is eligible. If the kernel dependency is not eligible, the capability release is not eligible regardless of its own check records.

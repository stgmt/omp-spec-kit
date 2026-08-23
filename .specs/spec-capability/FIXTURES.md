# Fixtures

## Policy

No executable target fixture is claimed present or passing in this specification-only state. All fixtures below are research references and capture candidates, not admitted target test fixtures. Fixture admission requires a complete fixture manifest per `spec-kernel:FR-11` posture.

A real fixture manifest SHALL record all of:

- `fixtureId`
- `fixtureType: real`
- `producerName`
- `producerVersionOrCommit`
- `captureCommandOrMethod`
- `captureDate`
- `sourcePathOrUrl`
- `sourceSha256`
- `storedRelativePath`
- `storedSha256`
- `byteCount`
- `licenseDisposition`
- `trimmed` and exact `trimProcedure`
- `groundTruthReviewer`
- `groundTruth` counts for capability nodes, DERIVES_FROM edges, conformance findings by code/severity, and query result shapes
- `allowedClaims`
- `forbiddenClaims`

A stored fixture is immutable. A byte change requires a new fixture ID or explicit version plus reviewed ground truth. "Copied from a test" without producer/source identity is not provenance.

## FIXTURE-1: Design brief as requirements provenance

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `E:\repos\.dev-pomogator\issue-capability-layer.md`

**Role:** Originating requirements draft for the capability layer concept. Provides motivation (upstream ABSORBED pain), proposed node/edge model, query contracts, and non-goals. Not a test fixture; informs FR drafting.

## FIXTURE-2: Reqvire repository as prior-art reference

**Type:** external repository, research-only; not admitted executable fixture

**Source:** <https://github.com/reqvire-org/reqvire>

**Role:** Prior art for capability anchor concept and typed change impact. Informs RF-1 and non-goal decisions. No bytes imported; no license disposition required for research-only reference.

## FIXTURE-3: Upstream spec-graph types as backlink provenance

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `tools/spec-graph/types.ts` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/` subtree

**Role:** Provenance for backlink index model that `get_impact` extends. The upstream backlinks exist but are not exploited for impact queries; this spec defines the impact contract independently.

## FIXTURE-4: Synthetic CAPABILITIES.md fixture candidates

**Type:** synthetic, planned; not yet created

**Planned variants:**
- Valid nested capabilities (CAP-1, CAP-1.1, CAP-1.2, CAP-2) with correct nesting.
- Dangling declaration (`**Capability:** [CAP-99]`) targeting unknown ID.
- Orphan capability (CAP-3 with zero deriving requirements).
- Spec without any capability declarations.
- Duplicate CAP-1 definitions in same CAPABILITIES.md.
- Malformed heading grammar (wrong level, missing title, invalid ID format).

**Admission criteria:** Each synthetic fixture SHALL be labeled synthetic, record its generation method, and include reviewed ground truth for expected nodes, edges, diagnostics, and query results.

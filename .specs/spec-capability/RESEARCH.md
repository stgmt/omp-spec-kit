# Research

## Scope and method

This research uses the repository-owned design brief (`E:\repos\.dev-pomogator\issue-capability-layer.md`), Reqvire as prior art, the upstream `dev-pomogator` snapshot for dogfood pain evidence, and the current spec-kernel contracts. No upstream code is imported; no compatibility mode is promised.

## RF-1: Reqvire capability anchor is portable; its ontology stack is not

**Finding:** Reqvire organizes intent as ontology→capabilities→requirements→contracts→verification with OWL/SHACL/SKOS semantic infrastructure. The capability anchor concept (stable product-wording nodes above requirements) is portable; the ontology stack is heavyweight and outside this product's scope.

**Evidence:**
- <https://github.com/reqvire-org/reqvire> — project description and architecture.
- Design brief section "Не-цели (из анализа Reqvire)" explicitly excludes ontologies, OWL/SHACL/RDF, SKOS thesauri, semantic contracts, and Explorer UI.

**Decision:** Adopt ONLY the capability anchor node and typed change-impact query. Ontology vocabulary, semantic contracts, capability versioning beyond ID stability, and multi-repo capabilities are explicit non-goals (FR-10).

## RF-2: Upstream ABSORBED state proves the missing-edge pain

**Finding:** Upstream FR-43 defines four drift states including `ABSORBED` ("FR переехали в другую подсистему → redirect/merge"). The absorption target is a human-readable marker, not a graph edge. After six months, no agent can reconstruct that old `FR-3` of an absorbed spec is the ancestor of current `FR-14` in another subsystem.

**Evidence:**
- `MIGRATION_MATRIX.md` row FR-43 (`REWRITE`).
- Design brief section "Проблема 1: нет «продуктовых якорей», переживающих спеки", items 1–4.
- Upstream v3→v4 transition: 28 scenarios marked SUPERSEDED with knowledge of what survived living only in heads and archival reports.

**Decision:** Capability nodes provide stable product anchors. DERIVES_FROM edges make absorption targets first-class graph relationships. CAPABILITY_ORPHAN findings mirror the archival logic of upstream FR-45.

## RF-3: Upstream get_trace is one-hop star; impact needs two-hop and backlinks

**Finding:** Upstream `get_trace` returns a star around one node in one hop: outgoing covers/tested-by, incoming covers/verifies/entitles, tasks by refs, code_impl. It does not traverse FR→AC→scenario two-hop paths, does not use backlink indexes for structural enumeration, and has no invalidation contract.

**Evidence:**
- Upstream `tools/spec-mcp-server/tools.ts` (`get_trace` implementation).
- Upstream `tools/spec-graph/types.ts` (backlinks model exists but get_trace does not exploit it for impact).
- Design brief section "Проблема 2: нет явного change-impact".

**Decision:** `get_impact` provides bounded backlink/two-hop structural and semantic-recheck IDs only. Producer invalidation is a separate evidence-overlay operation requiring the evidence evaluation snapshot and current kernel bindings; freshness is consumed from `spec-evidence@2`, not reimplemented in graph query code.

## RF-4: Capability declaration grammar mirrors existing structured fields

**Finding:** Kernel reference parsing already recognizes structured `Covers` fields. A qualified `**Covers:** [product:CAP-N](...)` on FR/NFR can therefore reuse the same occurrence/resolution pipeline without inventing frontmatter or a second parser.

**Evidence:**
- `spec-kernel:FR-5` — structured fields may create typed references.
- `spec-kernel@2` — CAPABILITY_DOCUMENT/CAP identity and DERIVES_FROM endpoints.

**Decision:** Capability derivation uses qualified Covers only. `**Requirement:**` remains REFS; bare IDs, `**Capability:**`, README frontmatter and repository-root CAPABILITIES are forbidden.

## RF-5: Capabilities belong to a kernel-family extension, not the kernel itself

**Finding:** Adding CAPABILITY nodes, DERIVES_FROM edges, and new diagnostic codes to the kernel schema would break the closed-set discipline of `spec-kernel@1`. The kernel's value is its stable, reviewable boundary. Extensions must version independently.

**Evidence:**
- `spec-kernel:FR-2` — closed document set and entity ID grammars.
- `spec-kernel:FR-5` — closed edge type union.
- `spec-kernel_SCHEMA.md` SCHEMA-4 — closed NodeKind union.
- ROADMAP.md — v0.2 delivers the standalone kernel; extensions follow.

**Decision:** Capability is `spec-capability@2` over separately gated `spec-kernel@2`; historical kernel@1 stays unchanged. Graph and optional evidence-overlay profiles release independently after their exact product gates.

## RISK-1: Premature coupling to evidence freshness model

**Risk:** Callers may confuse graph impact with producer freshness or use an incomplete evidence snapshot.

**Mitigation:** Graph response contains no producer IDs. Overlay requires the exact evidence deterministic fingerprint plus graph/scenario/step/implementation bindings and returns stale/unaffected/indeterminate partitions with proof.

## RISK-2: Capability proliferation masking requirements

**Risk:** Authors may create 50+ "capabilities" that are actually large-grained requirements, defeating the 3–15 per product guideline.

**Mitigation:** Structural check validates ID grammar and endpoint matrix only; semantic quality is out of scope. Advisory documentation and the future capability-authoring skill (out of this spec's scope) address authoring discipline. CAPABILITY_ORPHAN findings surface capabilities that have lost all live requirements.

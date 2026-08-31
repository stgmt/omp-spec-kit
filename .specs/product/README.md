# Product specification

## Current status

`omp-spec-kit` has one public product identity and one manager-readable roadmap.

| Bucket | Outcome | Evidence or exit condition |
|---|---|---|
| **SHIPPED** | **v0.3.2 read-only MCP baseline** — project-installable `omp-spec-kit@omp-spec-kit`, with the v0.2 graph/query kernel and eight working read-only MCP tools. | [`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json) |
| **NEXT** | **Safe spec authoring** — only `propose_patch` and `apply_proposed_patch` are public mutation tools. | Ship only after atomic, containment-safe application and a `tool_call` path policy that checks the exact authoring-name allowlist first, then refuses every other direct write under canonical `.specs/**`, with real end-to-end proof. |

## LATER

- expanded read queries;
- editor navigation;
- evidence queries;
- impact reporting;
- manual exact-content plan validation.

These are outcomes, not promises or hidden lifecycle states.

## Product rules

1. One marketplace, one plugin package, and one extension remain the product identity.
2. A row is **SHIPPED** only when current observable proof names the released identity. Specifications, tasks, Gherkin text, and old receipts do not prove a new shipment.
3. **NEXT** names the single active outcome. **LATER** entries stay plain until promoted.
4. Detailed implementation and verification rules stay with the owning specification; this document does not duplicate them.

## Scope

The product owns public identity, status, and roadmap language. Distribution owns packaging and release mechanics. The authoring and enforcement specifications jointly own the NEXT outcome. Historical public-init, v0.1, v0.2, and v0.3 records remain in [CHANGELOG.md](CHANGELOG.md) and immutable validation receipts.

## Current lifecycle contract

The current lifecycle covers OMP 18 maintenance, read-complete, evidence, safe authoring, and exact selected-plan gating. The published profile remains the read-only baseline until each stage has its own installed runtime proof.

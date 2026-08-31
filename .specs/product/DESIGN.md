# Product status design

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

1. expose only `propose_patch` and `apply_proposed_patch` as public mutation tools;
2. before a `tool_call`, accept the exact allowlist `{propose_patch, apply_proposed_patch}`;
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

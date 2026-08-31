# Fixtures

## Policy

Fixtures are evidence about bytes and graph semantics, not release decisions. Retain real producer provenance, hashes, oracle counts, and immutable receipt references. Synthetic scale or negative inputs may exist only as clearly labelled implementation aids; no evaluator-generator obligation is part of the kernel contract.

## FIXTURE-1: Pinned upstream graph-schema reference

**Type:** real research reference; not an executable target fixture

**Source:** historical `.specs/spec-generator-v4/spec-generator-v4_SCHEMA.md` at commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md`

**SHA-256:** `44d233d6f2db1c36f500f58d16f8b52cab39ec000ffafe4460dc62581183cedb`

**Allowed claims:** historical graph/query shapes only. **Forbidden claims:** target compatibility or passing behavior.

## FIXTURE-2: Pinned upstream feature reference

**Type:** real research reference; not an executable target fixture

**Source:** historical feature capture at commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4.feature`

**SHA-256:** `3d7757d3b9fd179928d43253f7ea69227aaaaafdc7da2dae757d0da8cb775c96`

**Allowed claims:** real historical input shapes only. **Forbidden claims:** target support or execution status.

## FIXTURE-3: Pinned upstream requirements reference

**Type:** real research reference; not an executable target fixture

**Source:** historical `FR.md` at commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/FR.md`

**SHA-256:** `cbcd2a59b1e1aefd121ab61b5590c3c77c29059e8f281607ae89281eb70f6ce2`

**Allowed claims:** provenance and capture-candidate evidence only.

## FIXTURE-4: Pinned upstream fixture reference

**Type:** real research reference; not an executable target fixture

**Source:** historical `FIXTURES.md` at commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/FIXTURES.md`

**SHA-256:** `49bcfaee155fb27ecc62526ee49f62922eb1828e3f8464ed829966f830638007`

**Allowed claims:** historical fixture categories only.

## FIXTURE-5: Target-owned canonical spec capture

**Type:** admitted real fixture

**Stored path:** `tests/fixtures/kernel/real-corpus/` with manifest `tests/fixtures/kernel/real-corpus-manifest.json`

**Provenance:** exact bytes from clean commit `1e1475c139406c112dab43dfa689d1140a57ddb3`, selected by manifest commit `b40db2e57f0b4c093a8a0e96e591d9109e3335be`; the manifest retains the 60-entry content address, every file hash, and byte length.

**Capture scope:** the manifest-selected documents from product, plugin-distribution, spec-kernel, and spec-authoring-workflow only; never a mutable-tree scan.

**Oracle:** `node scripts/refresh-real-corpus-manifest.mjs --check` independently reconciles document, definition, reference, scenario, and diagnostic counts before parity use.

**Allowed claims:** target-owned captured bytes and declared graph-count reconciliation. **Forbidden claims:** blanket upstream compatibility or unexecuted scenario passes.

## Admission

1. Record producer/source, capture method, date, license disposition, and exact bytes.
2. Verify source and stored SHA-256 plus byte count.
3. Have an independent reviewer reconcile definition/reference outcomes and diagnostics.
4. Record immutable public receipt references without converting them into current implementation claims.

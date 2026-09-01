# FIXTURES

## Read / Core

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

**Capture scope:** the manifest-selected documents from product, plugin-distribution, spec-mcp-operations, and the Write domain only; never a mutable-tree scan.

**Oracle:** `node scripts/refresh-real-corpus-manifest.mjs --check` independently reconciles document, definition, reference, scenario, and diagnostic counts before parity use.

**Allowed claims:** target-owned captured bytes and declared graph-count reconciliation. **Forbidden claims:** blanket upstream compatibility or unexecuted scenario passes.

## Admission

1. Record producer/source, capture method, date, license disposition, and exact bytes.
2. Verify source and stored SHA-256 plus byte count.
3. Have an independent reviewer reconcile definition/reference outcomes and diagnostics.
4. Record immutable public receipt references without converting them into current implementation claims.

## Read / Evidence

Executable fixtures follow the repository real-producer policy. No fixture proves delivery until its bytes and manifest are captured and reviewed.

## Required real captures

| Category | Source | Required observable |
|---|---|---|
| Cucumber Messages full run | Actual Cucumber-JS or Reqnroll invocation emitting NDJSON | FULL scope, stable join, passed/failed rows, trace |
| Second producer | Actual supported producer distinct from the first | Same normalized `ScenarioEvidence` shape |
| Filtered run | Actual runner invocation with a tag/name/path selector | Capture-derived PARTIAL; never readiness authority |
| Failed run | Actual producer failure with steps/error | Trace pages resolve the result `EvidenceRef` |
| pytest-bdd cucumber-json | Actual pytest-bdd run when that adapter is implemented | Supported secondary format normalization |

## Manifest fields

Each real fixture record SHALL include:

- fixture ID and category;
- exact capture command or documented capture method;
- producer name and version/commit;
- source path or URL;
- capture date;
- artifact SHA-256 and byte count;
- license disposition;
- permitted trimming and a statement that the trimmed bytes remain valid producer output;
- reviewed expected admission, scope, parsed rows, stable join outcomes, freshness, evidence references, task blockers, and trace outcome.

The manifest hash describes the fixture record for review convenience; it is not runtime authentication and never substitutes for re-hashing producer bytes.

## Derived negative fixtures

A derived negative starts from a named real capture and changes exactly one fact:

- corrupt one frame for malformed input;
- remove the stable ID/tag for unmatched evidence;
- plant two verified tag candidates for ambiguity;
- change scenario, applicable step, or implementation identity for staleness;
- remove one required binding for indeterminate freshness;
- exceed one byte/count limit.

Each derivative records its source fixture, exact mutation, new hash, and expected single blocker. Hand-authored positive producer payloads are forbidden.

## Synthetic fixtures

Synthetic data is allowed only for scale after semantic real fixtures pass. It SHALL be labeled `synthetic`, SHALL NOT establish parser compatibility or provenance, and SHALL state the generator and seed.

## Provenance boundary

Upstream artifacts are capture candidates only. Importing bytes requires the repository's hash, source, license, and review policy. Existing historical v0.3.2 release fixtures/receipts are preserved but do not prove this NEXT evidence capability.

## Write

## Status and provenance rule

Fixtures are planned evidence inputs; none is claimed executed by this specification. Every committed capture SHALL record producer/version, exact command or API invocation, platform/filesystem, capture date, source hash, trimming steps, expected ground truth, and independent reconciliation hashes. External producer shapes SHALL come from the real producer, never hand fabrication. Secrets and user data are replaced only by documented deterministic redaction.

## FX-1: Real canonical spec corpus

**Producer:** shipped/candidate `Read / Core` over an ordinary unlinked repository spec.  
**Capture:** canonical 15 documents, source hashes, parsed nodes, headings, generated anchors, link occurrences, and FR↔AC↔Scenario↔CHK↔TASK edges.  
**Ground truth:** kernel summary and independently hashed source bytes agree.  
**Used by:** AC-24.1, AC-25.2, AC-28.1.

## FX-2: Real Markdown anchor corpus

**Producer:** the exact kernel Markdown slug and link-inventory implementation.  
**Capture:** punctuation, dots, Unicode, repeated headings, same-file links, same-spec cross-file links, ambiguity, and cross-spec inbound links.  
**Ground truth:** accepted links resolve once; unsafe rename cases refuse without bytes changed.  
**Used by:** AC-25.2, AC-28.1.

## FX-3: Windows containment capture

**Producer:** Windows filesystem APIs on a supported OMP host.  
**Capture:** ordinary directory, symlink where permitted, junction, reparse metadata, drive-relative, UNC/device, alternate data stream, case/Unicode collision, and component-switch race.  
**Ground truth:** metadata/final-path evidence and tree hashes prove refusal before target mutation.  
**Used by:** AC-23.2, AC-25.1, AC-26.2.

## FX-4: POSIX containment capture

**Producer:** supported POSIX filesystem APIs.  
**Capture:** ordinary path, symlink chain, mount boundary where reproducible, Unicode collision, traversal, rename/fsync behavior, and component-switch race.  
**Ground truth:** lstat/realpath/device-inode observations and tree hashes prove the contracted result.  
**Used by:** AC-25.1, AC-27.1.

## FX-5: Real multi-process CAS race

**Producer:** at least two real processes using the authoring lock/CAS service plus one coordinated reader.  
**Capture:** request/proposal IDs, lease order, base hashes, commit order, outcomes, and observed generation hashes.  
**Ground truth:** one stale-base writer at most commits; loser returns conflict; replay adds no commit; reader sees no mixed generation.  
**Used by:** AC-26.1, AC-26.2.

## FX-6: Generation writer fault timeline

**Producer:** real generation writer with deterministic faults at prepare, file write, sync, pre-swap check, swap, and cleanup.  
**Capture:** old/new/stage hashes, reader observations, fault point, rollback decision, final tree hash, and no-survivor branch.  
**Ground truth:** final visible state is complete old or complete new; if neither is provable, result is `RECOVERY_REQUIRED`, no further write occurs, and the next action is manual VCS/backup restore.  
**Used by:** AC-27.1, AC-27.2.

## FX-7: Receipt redaction corpus

**Producer:** real Proposal/Error/MutationReceipt serializers.  
**Capture:** success/refusal outcomes with planted body text, credentials, environment values, absolute unrelated paths, and stack-like failures.  
**Ground truth:** compact schema validates; hashes and relative changed-document paths reconcile; planted sensitive values are absent.  
**Used by:** AC-28.2.

## Historical release provenance

v0.3.2 remains the real shipped read-only baseline for compatibility captures: tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5b15c7e3bb363a0cbea9`. Captures may compare against that baseline, but those receipts are not live authoring eligibility inputs.
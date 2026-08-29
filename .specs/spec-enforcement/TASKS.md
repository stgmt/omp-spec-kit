# Tasks

All tasks are future capability work. `Planned` means no runtime evidence exists. Specification prose and Gherkin do not satisfy Done When.

## TASK-1: Capture authenticated tool-call authority ABI and installed registry receipts

**Status:** Blocked

**Estimate:** 2 days

**Owner:** OMP adapter maintainer

**Depends On:** external OMP release implementing `tool-call-authority-abi@1`

**Requirements:** [FR-1](FR.md#fr-1-event-surface-selection-and-pinning), [FR-7](FR.md#fr-7-no-bypass-paths)

**Done When:**
- A future pinned host source/behavior receipt proves non-model-controlled `tool_call` providerKind/serverId/inputSchemaSha256/registrySnapshotSha256 fields; v17.3.7 absence is recorded honestly.
- Candidate build/package verification emits and re-hashes the complete installed built-in/MCP/extension tool-name/provider/server/input-schema snapshot; every name has a reviewed effect decision.
- Receipts record OMP version/commit, candidate hash, command/date, byte/hash identity and are bound to CHK-FR1-01/CHK-FR7-01.

## TASK-2: Implement closed registry and pure effect classifier

**Status:** Planned

**Estimate:** 4 days

**Owner:** Enforcement maintainer

**Depends On:** TASK-1

**Requirements:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [FR-7](FR.md#fr-7-no-bypass-paths)

**Done When:**
- `registry.js` has one unique four-field entry per candidate-bundled installed tool; every extractor embeds the exact input-schema digest and manifest hash is recomputed.
- `classify.js` consumes the hook call plus host-authenticated authority envelope and installed snapshot and maps name/schema/input/provider mismatch to UNKNOWN.
- Writer extractors are non-empty/exhaustive; zero/dynamic/unsupported targets are incomplete, never vacuous allow.
- Authority manifests are exact ordered 17-name V1 and additive seven-name V2 tuples bound to server/profile/candidate/service schema; spoof/subset/mix fails.

## TASK-3: Implement filesystem resolver and conservative decision policy

**Status:** Planned

**Estimate:** 4 days

**Owner:** Security maintainer

**Depends On:** TASK-2

**Requirements:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [FR-4](FR.md#fr-4-fail-honest-policy), [FR-7](FR.md#fr-7-no-bypass-paths)

**Done When:**
- `resolve-targets.js` checks canonical root, outside-root/traversal, every existing ancestor, Windows reparse points, POSIX symlinks, and nearest existing ancestor for new targets.
- `decision.js` implements the complete REQUIREMENTS decision table and emits only repository-relative bounded reasons.
- Any zero-target/incomplete/dynamic/unknown/authority/containment/resolver fault blocks in enforcement mode; informational mode never blocks.
- Windows and POSIX fixtures reconcile byte-identically with independent ground truth.

## TASK-4: Implement same-candidate product and authority binding

**Status:** Planned

**Estimate:** 2 days

**Owner:** Product gate maintainer

**Depends On:** TASK-1, `product:FR-6`, `spec-authoring-workflow:FR-13`, `spec-authoring-workflow:FR-14`

**Requirements:** [FR-8](FR.md#fr-8-degradation-ladder), [FR-9](FR.md#fr-9-stage-gated-activation)

**Done When:**
- `mode.js` consumes the exact product `SPEC_ENFORCEMENT`, baseline, `AUTHORING_MCP`, candidate and authority evidence digests.
- Missing/stale/different-candidate/ambiguous product or authority input refuses activation visibly.
- An installed-registry/host-envelope mismatch remains visible but does not downgrade accepted enforcement; unmatched names classify `UNKNOWN`.
- If accepted enforcement loses the kernel, only findings/census degrade; write enforcement remains active.
- Local config/environment cannot promote mode.

## TASK-5: Implement kernel finding and policy diagnostic projections

**Status:** Planned

**Estimate:** 3 days

**Owner:** Kernel adapter maintainer

**Depends On:** TASK-1, `spec-kernel:FR-14` accepted for the current baseline

**Requirements:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection), [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Done When:**
- Read-result conformance additions are <=2 KiB and each finding traces to an exact runtime `spec-kernel:FR-6` record.
- Registry/authority/containment/mode/handler diagnostics use the separate policy schema and never claim conformance.
- Empty and unavailable kernel states render `no findings` and `unavailable` respectively.
- CHK-FR10-01 origin reconciliation has zero unmatched findings.

## TASK-6: Implement bounded census projection

**Status:** Planned

**Estimate:** 2 days

**Owner:** Kernel adapter maintainer

**Depends On:** TASK-5

**Requirements:** [FR-2](FR.md#fr-2-informational-mode-diagnostic-injection)

**Done When:**
- Session initialization queries the kernel once and renders <=4 KiB.
- The next context event receives at most one message on its deep copy; stored messages/repository bytes remain unchanged.
- Kernel absence produces explicit unavailability without invented counts.

## TASK-7: Integrate handlers into the existing extension factory

**Status:** Planned

**Estimate:** 3 days

**Owner:** Extension maintainer

**Depends On:** TASK-3, TASK-4, TASK-5, TASK-6

**Requirements:** [FR-1](FR.md#fr-1-event-surface-selection-and-pinning), [FR-4](FR.md#fr-4-fail-honest-policy), [FR-5](FR.md#fr-5-no-hidden-state), [FR-6](FR.md#fr-6-dependency-safe-distribution), [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Done When:**
- `registerSpecEnforcement` is imported and invoked from existing `src/v0.1/extension.js`; no standalone factory/second control plane exists.
- The build manifest includes the accepted root sources/resources and no ambient dependency.
- Handler exceptions are caught before the outer wrapper; enforcement-safety faults block visibly.
- Bundle/export audit proves no private spec parser/rule/validator/finding producer or alternate query/write tool (CHK-FR10-02).

## TASK-8: Capture real fixtures and run adversarial no-bypass review

**Status:** Planned

**Estimate:** 4 days

**Owner:** Independent security reviewer

**Depends On:** TASK-7

**Requirements:** [FR-3](FR.md#fr-3-enforcement-mode-write-interception), [FR-4](FR.md#fr-4-fail-honest-policy), [FR-5](FR.md#fr-5-no-hidden-state), [FR-7](FR.md#fr-7-no-bypass-paths), [FR-10](FR.md#fr-10-diagnostics-are-spec-kernel-findings-only)

**Done When:**
- Real tool-call/input and filesystem fixtures carry producer/version/source/date/hash/size/license/trimming/ground-truth provenance.
- Review attempts every supported writer, zero-target extraction, new/renamed/schema-changed tool, dynamic shell target, command substitution, authority subset/mix/name spoof, raw endpoint, outside-root/traversal/symlink/reparse/missing ancestor/config/env/resolver fault.
- Every bypass blocks in enforcement mode; non-spec/read-only/exact authority controls pass.
- Filesystem/network/process/export audit proves no hidden state, network, subprocess, credential access, or private conformance producer.

## TASK-9: Implement capability eligibility evaluator

**Status:** Planned

**Estimate:** 2 days

**Owner:** Release maintainer

**Depends On:** TASK-8

**Requirements:** [FR-11](FR.md#fr-11-release-eligibility-conjunction)

**Done When:**
- `release.js` re-hashes caller evidence, verifies the pinned Sigstore trust root and DSSE/Fulcio/Rekor bundle, exact V1/V2 authority tuples, effect/installed registries and the accepted host authority ABI, baseline/authoring references and the exact 12 candidate checks.
- `CHK-FR11-01` exercises the evaluator one-fault matrix and is excluded from candidate records.
- Missing/extra/duplicate/failed/stale/mismatched/unverifiable/cross-candidate/unbound/structural-only, self-signed, wrong issuer/repo/workflow/ref/subject/predicate, unlogged, expired/rotated-unreviewed trust-root variants return closed blockers; result has no product authority.

## TASK-10: Prove installed candidate and product capability wiring

**Status:** Planned

**Estimate:** 3 days

**Owner:** Release maintainer

**Depends On:** TASK-9

**Requirements:** [FR-6](FR.md#fr-6-dependency-safe-distribution), [FR-9](FR.md#fr-9-stage-gated-activation), [FR-11](FR.md#fr-11-release-eligibility-conjunction)

**Done When:**
- Installed artifact runs with source checkout/root/external `node_modules` absent and exact dist hashes.
- Raw latency/memory/size observations and Windows/POSIX runtime receipts satisfy NFR gates for the same candidate.
- Product evaluator refuses missing/mismatched authoring or enforcement eligibility and accepts `SPEC_ENFORCEMENT` only for the full same-candidate conjunction.
- Public/current product status remains `DEFERRED_HOST_ABI` until that product result exists; FR-39 persistent audit remains DEFER.

## Task summary

| Task | Status | Owner | Primary output |
|---|---|---|---|
| TASK-1 | Blocked | OMP adapter maintainer | Authenticated host authority ABI + installed registry |
| TASK-2 | Planned | Enforcement maintainer | Closed registry/classifier/authority |
| TASK-3 | Planned | Security maintainer | I/O containment and decisions |
| TASK-4 | Planned | Product gate maintainer | Same-candidate activation binding |
| TASK-5 | Planned | Kernel adapter maintainer | Finding/policy projections |
| TASK-6 | Planned | Kernel adapter maintainer | Census projection |
| TASK-7 | Planned | Extension maintainer | Existing-factory integration |
| TASK-8 | Planned | Independent security reviewer | Real fixtures/no-bypass review |
| TASK-9 | Planned | Release maintainer | Capability eligibility evaluator |
| TASK-10 | Planned | Release maintainer | Installed proof/product wiring |

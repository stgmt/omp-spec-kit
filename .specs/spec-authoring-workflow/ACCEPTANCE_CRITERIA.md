# Acceptance Criteria

These are EARS-style specification criteria. They are not executed evidence.

## AC-1.1

**WHEN** either separately required `spec-kernel:FR-14` v0.2 or v0.3 result or current distribution proof is absent, unqualified, duplicate-stage, stale, revoked, red, non-eligible, cross-lineage, parent-mismatched, or identifies another current artifact version **THEN** authoring state SHALL be `DEFERRED`, mutating operations SHALL return `DEFERRED_DEPENDENCY` with the exact qualified requirement/target-stage cause, and repository hashes SHALL remain unchanged.

## AC-1.2

**WHEN** FR-13's all-of evidence separately contains current accepted linked v0.2 and v0.3 kernel results, current distribution, all authoring FR-1..FR-12 evidence, and mutation-policy proof for the exact built release candidate and product lineage **THEN** lifecycle MAY transition `DEFERRED→ELIGIBLE` for registration/release consideration, including when the valid predecessor/current kernel artifact hashes differ; **WHEN** the existing extension registers only that gated shared service **THEN** it MAY transition `ELIGIBLE→IMPLEMENTED`; **WHEN** exact installed-artifact lifecycle evidence is current and green **THEN** it MAY transition `IMPLEMENTED→PROVEN`; no state may skip a transition, and any mandatory evidence regression, predecessor revocation, or lineage break SHALL unregister actions and return to `DEFERRED`.

## AC-1.3

**IF** package inspection finds a second marketplace plugin, extension entry, or authoring authority **THEN** eligibility SHALL fail and no authoring capability SHALL register.

## AC-1.4

**WHILE** lifecycle remains `DEFERRED`, **WHEN** maintainers implement or internally exercise the versioned schema, shared service, real fixtures, recovery authority, or pure FR-13 evaluator against isolated inputs **THEN** candidate-bound evidence MAY be produced, but no authoring action SHALL register or be exposed, no user specification SHALL be mutated, and FR-13 SHALL remain solely the registration/release eligibility gate rather than a prerequisite for implementation work.

## AC-2.1

**WHEN** a valid multi-document request is proposed **THEN** the result SHALL include deterministic bounded diffs, before/result hashes, affected canonical IDs, findings, base snapshot, policy version, proposal ID/hash, and expiry while every target hash remains unchanged.

## AC-2.2

**IF** a proposal is invalid, rejected, expired, cancelled, or preview-truncated/exceeds the complete-preview bound **THEN** it SHALL not enter `REVIEWED`, apply SHALL refuse, no transaction material SHALL exist, and the caller SHALL create a smaller fresh proposal.

## AC-2.3

**WHEN** two callers propose against the same snapshot concurrently **THEN** both read-only proposals MAY validate independently, neither SHALL write, and later apply SHALL be governed solely by FR-3 CAS.

## AC-2.4

**WHEN** `apply_transaction` is requested **THEN** it SHALL consume an explicitly reviewed, unexpired `proposalId`/`proposalHash` and current expected hashes for every and only proposal document plus the base snapshot; **IF** raw edits, an unreviewed or truncated proposal, an omitted/extra/mismatched hash, or an expired proposal is supplied **THEN** it SHALL refuse before staging and SHALL not synthesize and commit a preview in that call.

## AC-3.1

**WHEN** all expected document hashes and base snapshot hash match under the exclusive lease **THEN** CAS SHALL permit staging; **IF** any differs at either comparison point **THEN** the entire operation SHALL return `HASH_MISMATCH` or `PROPOSAL_STALE` with current hashes and zero committed changes.

## AC-3.2

**WHEN** two fresh applies race for the same root **THEN** at most one SHALL commit first; the other SHALL wait within the bound and then re-check CAS or return `TRANSACTION_BUSY`, never overwrite the winner, and never expose a partial generation.

## AC-3.3

**WHEN** an already-terminal `requestId` is replayed **THEN** the prior result SHALL be returned without a second commit or audit event; **IF** the same ID carries different content **THEN** `REQUEST_ID_REUSE` SHALL refuse.

## AC-4.1

**WHEN** proposal or transaction validation finds any error in request, path, parse, identity, form, anchor, trace, status guard, or conformance lanes **THEN** it SHALL return ordered field/location findings before stage creation and leave all document hashes unchanged.

## AC-4.2

**IF** any mandatory validator is unavailable, operates on another snapshot, or returns incomplete output **THEN** validation SHALL fail closed with `VALIDATOR_UNAVAILABLE` or `SNAPSHOT_MISMATCH`; a structural-only pass SHALL not permit write.

## AC-4.3

**WHEN** concurrent change occurs after proposal validation but before swap **THEN** staged validation and second CAS SHALL detect it, rollback staged/transient material, and leave the concurrent committed generation intact.

## AC-5.1

**WHEN** a canonical target below one `.specs/<slug>/` is resolved from an explicit root **THEN** every component and nearest existing ancestor SHALL be confined by canonical/real path and normalization checks before content mutation.

## AC-5.2

**IF** a request uses traversal, dot segments, absolute, drive-relative, UNC, device, alternate-data-stream, NUL, unsupported document, out-of-root, or case/Unicode-colliding target **THEN** it SHALL return the matching containment error and create neither proposal-apply state nor transaction material.

## AC-5.3

**IF** the selected root, spec directory, or any target path component is a symlink, junction, mount point, or reparse point, including one switched concurrently **THEN** kernel reading, proposal construction, validation, and mutation SHALL refuse before document-content read with `SYMLINK_COMPONENT` or `PATH_CHANGED`; any stage SHALL rollback and nothing SHALL commit.

## AC-5.4

**WHEN** multiple containment-invalid requests run concurrently with a valid writer **THEN** invalid requests SHALL neither acquire a mutation-capable target nor disturb the valid writer's committed generation or lease.

## AC-6.1

**WHEN** a validated same-spec transaction commits **THEN** all requested documents SHALL become visible under one committed generation and the result hashes SHALL equal the preview result hashes.

## AC-6.2

**IF** failure is injected during prepare, stage write, stage sync, pre-swap validation, first swap, second swap, audit-before-commit, cleanup, or recovery **THEN** the operation SHALL prove either the complete original or complete result generation; any returned failure SHALL expose originals, and unresolved proof SHALL enter `RECOVERY_REQUIRED`, block access rather than claim rollback, and materialize a hash-bound retained assessment that classifies the state as either at least one complete valid retained generation (AC-6.5 path) or no complete valid retained generation (AC-6.7 path), with no unclassified third case.

## AC-6.3

**WHEN** readers and another writer run during commit **THEN** coordinated readers SHALL see only the old or new complete generation, the second writer SHALL re-check CAS after lease acquisition, and no request SHALL see a mixed document set.

## AC-6.4

**IF** operations target more than one spec, repeat a target, conflict within one target, or recovery is pending **THEN** the transaction SHALL refuse before commit; any created stage SHALL be removed or retained solely for explicit recovery with its hashes reported.

## AC-6.5

**WHEN** an authenticated manual recovery request for a blocked transaction supplies an unexpired bounded authorization and selects exactly one complete retained original or result generation with its complete snapshot/document hashes **THEN** the service SHALL enter `RECOVERING` under the exclusive lease, verify retained bytes, containment, hashes, and all mandatory validators, record a redacted audit event, expose only that complete generation, and transition to `ROLLED_BACK` or `COMMITTED`.

## AC-6.6

**IF** retained-generation recovery lacks valid authorization, exceeds its document/time bounds, supplies replacement bytes, selects unknown/mixed hashes, or fails containment or mandatory validation **THEN** it SHALL fail closed, remain `RECOVERY_REQUIRED`, retain all recovery material, emit a redacted refusal audit envelope, and keep normal reads and writes blocked.

## AC-6.7

**GIVEN** a blocked transaction is `RECOVERY_REQUIRED` and hash/validation proof establishes that neither retained original nor retained result is a complete valid generation, **WHEN** an authorized operator calls `propose_rebaseline_recovery` with an unexpired authorization bound to actor, transaction, canonical root, target spec, candidate source, and at most 15 canonical documents, a root-relative ordinary unlinked candidate locator, its complete candidate hashes, and the expected blocked-current snapshot/document and retained journal hashes **THEN** the service SHALL acquire the exclusive lease, compare every bound hash, validate containment, link closure, and every mandatory lane without writing, and return a complete review-required proposal containing the full pre/post snapshot and document hashes, journal hash, candidate fingerprint, findings, actor, reason, and expiry.

## AC-6.8

**WHEN** `apply_rebaseline_recovery` consumes a separately reviewed, unexpired exact rebaseline proposal and still-matching operator authorization, blocked-current, journal, candidate, audit-chain, and concurrency identities **THEN** it SHALL recheck containment/link/validation under the exclusive lease, atomically install exactly the proposed complete candidate generation, append a redacted history-preserving audit event, and transition `RECOVERY_REQUIRED→REBASELINING→REBASELINED`; **IF** a complete retained generation exists or any authorization, proposal, current/journal/candidate hash, root containment, symlink/reparse, link closure, validator, audit-history, or lease/concurrency check fails **THEN** it SHALL refuse, remain `RECOVERY_REQUIRED`, expose no candidate bytes, erase no history or recovery material, and keep normal reads and writes blocked.

## AC-7.1

**WHEN** a unique heading is edited without changing its slug **THEN** only the selected section SHALL change, untouched bytes/EOL SHALL be conserved, and its section hash SHALL match the proposal.

## AC-7.2

**WHEN** a heading rename changes its slug and every inbound link is complete and same-spec **THEN** all link rewrites SHALL appear in the same preview and atomic transaction; **IF** any rewrite fails during commit **THEN** all documents SHALL rollback.

## AC-7.3

**IF** heading/anchor identity is missing, duplicate, ambiguous, concurrently changed, slug-colliding, externally referenced, or inventory-incomplete **THEN** apply SHALL refuse with a specific anchor error, require a fresh proposal where retryable, and overwrite nothing.

## AC-8.1

**WHEN** every allowed task transition is submitted with current `TASKS.md` hash and satisfied guards **THEN** exactly the canonical status field SHALL change through proposal/transaction and audit SHALL record previous/new state.

## AC-8.2

**IF** a transition is not in the exhaustive table **THEN** `ILLEGAL_TRANSITION` SHALL list legal next states, write nothing, and preserve the old state.

## AC-8.3

**IF** `ready` or `in-progress` lacks its assembled trace or owner, or `done` lacks checked Done When and current task-owned strong evidence **THEN** `STATUS_GUARD_FAILED` SHALL list missing/stale/weak legs and write nothing.

## AC-8.4

**WHEN** concurrent status requests use the same base hash **THEN** at most one SHALL commit; the loser SHALL return stale CAS, never merge status text, and never erase the winner. A fault after stage creation SHALL rollback the entire `TASKS.md` generation.

## AC-8.5

**WHEN** a done task is reopened **THEN** only `done→in-progress` SHALL be accepted, reason SHALL be non-empty, and old completion evidence SHALL remain historical but SHALL not satisfy future done.

## AC-9.1

**WHEN** any proposal, explicit review, refusal, apply, rollback, automatic/manual retained-generation recovery, rebaseline proposal/review/apply/refusal, cancel, or status operation finishes **THEN** it SHALL return a schema-valid redacted audit envelope with identities, complete hashes, outcome, and next action but no raw document/diff body, secret, environment value, recovery authorization material, retained/candidate bytes, candidate path, or unrelated path; rebaseline events SHALL continue the existing digest chain without rewriting failed-transaction history.

## AC-9.2

**WHEN** concurrent events occur on one root **THEN** committed event envelopes SHALL form a deterministic previous-digest chain in commit order; retries SHALL not duplicate an event.

## AC-9.3

**IF** an explicit audit sink fails before commit **THEN** commit SHALL not start; **IF** it fails after a proven commit **THEN** the result SHALL be `COMMITTED_WITH_AUDIT_EXPORT_FAILURE`, include the envelope for retry, and SHALL not roll back already committed user documents or misreport failure as no change.

## AC-10.1

**WHEN** any request or response is serialized **THEN** it SHALL validate against schema version 1 and round-trip without loss; unknown operation, enum, required field, or incompatible version SHALL return a stable typed error.

## AC-10.2

**WHEN** an internal exception occurs **THEN** it SHALL map to `INTERNAL_ERROR` with safe correlation data and next action, preserve/rollback according to transaction state, and disclose neither stack trace nor sensitive path.

## AC-10.3

**WHEN** extension and a later MCP adapter receive equivalent requests **THEN** both SHALL delegate to the same service and produce contract-equivalent results; neither adapter may add a direct mutation path.

## AC-11.1

**WHEN** the release mutation gate runs **THEN** it SHALL reconcile the actual mutant inventory with every safety-critical family in FR-11 and require 100% killed for those families.

## AC-11.2

**IF** any critical mutant survives, lacks coverage, times out, is skipped, disappears unexpectedly, or causes runner error/nondeterminism **THEN** release SHALL fail with its family, location, runner/artifact version, and outcome.

## AC-11.3

**WHEN** each mutant is exercised **THEN** baseline SHALL pass, the mutant SHALL make the covering behavior fail, restoration SHALL be verified by a passing post-restore run, and filesystem hashes SHALL prove restoration even after injected interruption.

## AC-11.4

**IF** MP-1, MP-2, MP-3, or MP-4 remains unresolved **THEN** lifecycle and registration SHALL remain `DEFERRED` and release SHALL be blocked, but schema/service/fixture/evaluator implementation and candidate-bound evidence production MAY continue without exposure or user-spec mutation; no aggregate green test or manually excluded critical mutant may override this gate.

## AC-12.1

**WHEN** runtime/package inventory is inspected **THEN** it SHALL find one existing plugin package, one extension entry, one shared authoring transaction authority, and zero direct/fallback writers.

## AC-12.2

**IF** a dev-pomogator advisor, backlog, dashboard, hook, stop gate, repair loop, SQLite store, watcher, judge, `.progress.json`, or persistent hidden target-repository state is planted **THEN** boundary validation SHALL fail and authoring release SHALL be blocked.

## AC-12.3

**WHEN** authoring remains deferred or is uninstalled **THEN** all user specification hashes SHALL remain unchanged, no hidden workflow state SHALL exist, and read-only kernel/distribution behavior for supported ordinary unlinked roots SHALL remain available according to their own specs.

## AC-13.1

**WHEN** current mandatory evidence exists for every FR-1 through FR-12 and current accepted `plugin-distribution:FR-13`, and mandatory evidence separately contains exactly one accepted `spec-kernel:FR-14` envelope for `targetStage: "v0.2"` / `evidenceProfile: "kernel-v0.2"` with artifact hash `A` and null parent plus exactly one accepted envelope for `targetStage: "v0.3"` / `evidenceProfile: "kernel-v0.3"` with artifact hash `B` and `v02ParentArtifactSha256: A`, all current, non-revoked, and bound to the authoring evaluation's product revision and artifact lineage, with current-stage authoring/distribution evidence bound to the exact built release-candidate artifact, kernel snapshot, policy version, and supported host **THEN** the all-of gate MAY advance authoring from `DEFERRED` to `ELIGIBLE`, even when legitimate linked predecessor/current hashes `A` and `B` differ; it MAY permit registration/release consideration through the existing extension and SHALL enumerate both kernel profile results and every other qualified evidence identity, but SHALL NOT independently authorize publication or override pending public-init validation or fail-closed future-import license policy.

## AC-13.2

**IF** even one mandatory FR-1 through FR-12 or distribution envelope is missing, stale, red, ambiguous, revoked, or version-mismatched, or the kernel set is not exactly one separately qualified accepted v0.2 envelope plus one separately qualified accepted v0.3 envelope **THEN** authoring SHALL remain or return to `DEFERRED`, every authoring action SHALL remain unregistered, and the exact unsatisfied qualified ID and kernel target stage where applicable SHALL be reported; implementation and honest candidate-bound evidence work SHALL remain permitted.

## AC-13.3

**IF** eligibility is derived from an any-of match, aggregate count, inherited green state, source-tree-only result, evidence for another artifact/snapshot/policy/host or artifact lineage, one unqualified kernel envelope, duplicate target stages, a v0.3 result substituted for the required v0.2 result, a stale or revoked v0.2 result, a non-eligible kernel result, or a v0.3 `v02ParentArtifactSha256` unequal to the accepted v0.2 `artifactSha256` **THEN** the aggregate gate SHALL refuse, report the deterministic evidence-set or lineage error, and SHALL not treat partial or cross-lineage proof as authoring eligibility.

## AC-14.1

**WHEN** the generator-port mutation census is projected through this spec **THEN** the eighteen schema-v1 MCP names SHALL map onto proposal-first operations, the six schema-v2 names (`create_spec`, `archive_spec`, `delete_spec_doc`, `rename_spec_doc`, `add_backlog_task`, `register_incident_backlog`) SHALL remain later and not DROP, none of the twenty-four names SHALL appear on the v0.3 first-slice read registry, and the dropped advisor/dashboard/harness backlog UI SHALL NOT be treated as `add_backlog_task`.

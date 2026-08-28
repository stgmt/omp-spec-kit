@spec-authoring-workflow @specification-only @deferred
Feature: Proposal-first safe specification authoring
  The future authoring service protects user specifications with immutable previews,
  compare-and-swap, containment, validation, atomic commit, rollback, and honest evidence.
  These scenarios are specification text and are not claimed to have executed.

  @id:SCEN-authoring-deferred-missing-proof @feature1 @AC-1.1 @feature13 @AC-13.2
  Scenario: SPEC_AUTHORING_001 authoring remains deferred without complete current proof
    Given the authoring lifecycle is DEFERRED
    And one mandatory authoring FR-1 through FR-12 envelope distribution aggregate or separately qualified v0.2 or v0.3 kernel aggregate is missing or stale
    When a caller requests an authoring mutation
    Then the result is DEFERRED_DEPENDENCY with the exact missing qualified evidence and next action
    And no authoring action is registered or repository byte changed

  @id:SCEN-authoring-all-of-eligibility @feature1 @AC-1.2 @feature12 @AC-12.1 @feature13 @AC-13.1
  Scenario: SPEC_AUTHORING_002 exact all-of evidence enables only the existing authoring authority
    Given current mandatory evidence for every authoring FR-1 through FR-12 and current accepted plugin-distribution FR-13 for the built release candidate
    And one accepted spec-kernel FR-14 result is separately identified as targetStage v0.2 evidenceProfile kernel-v0.2 with artifact hash A and no parent
    And one accepted spec-kernel FR-14 result is separately identified as targetStage v0.3 evidenceProfile kernel-v0.3 with artifact hash B and parent hash A
    And both kernel results are current non-revoked and bound to the same product revision and artifact lineage while the current-stage evidence binds to the built release candidate snapshot policy and host
    And the linked predecessor artifact hash A may differ from current artifact hash B
    When the release-candidate inventory is evaluated for registration eligibility
    Then the lifecycle may advance from DEFERRED to ELIGIBLE with both kernel profile results and every other qualified evidence identity
    And only existing-extension registration then exact installed-artifact proof may advance ELIGIBLE to IMPLEMENTED to PROVEN
    And exactly one plugin package one extension entry one shared authoring authority and zero direct writers are present
    And authoring eligibility does not authorize publication or override pending public-init validation or future-import license gates

  @id:SCEN-authoring-second-authority-refused @feature1 @AC-1.3
  Scenario: SPEC_AUTHORING_003 a second authoring authority keeps authoring unregistered
    Given all dependency evidence is current and green
    But package inspection finds a second marketplace plugin extension entry or authoring authority
    When eligibility is evaluated
    Then authoring remains DEFERRED
    And no authoring capability is registered

  @id:SCEN-proposal-preview-no-write @feature2 @AC-2.1
  Scenario: SPEC_AUTHORING_004 proposal previews a valid multi-document change without writing
    Given an immutable kernel snapshot and expected hashes for one specification
    When the caller proposes anchor-addressed edits to FR AC feature and task documents
    Then the result contains complete deterministic bounded diffs before and result hashes findings affected nodes proposal identity policy base snapshot and expiry
    And every repository document hash equals its pre-proposal hash

  @id:SCEN-invalid-proposal-before-stage @feature2 @AC-2.2 @feature4 @AC-4.1
  Scenario: SPEC_AUTHORING_005 invalid proposal is rejected before staging
    Given a proposed generation contains a broken anchor and missing requirement trace
    When the proposal validator evaluates every mandatory lane
    Then the proposal becomes REJECTED with ordered field and location findings
    And apply refuses with no stage transaction journal audit persistence or document change

  @id:SCEN-concurrent-proposals-read-only @feature2 @AC-2.3 @concurrency
  Scenario: SPEC_AUTHORING_006 concurrent proposals remain read-only
    Given two callers use the same immutable snapshot and expected hashes
    When both proposals validate concurrently
    Then both may return independently validated previews
    And neither proposal writes repository or transaction material before a later reviewed apply is governed by CAS

  @id:SCEN-apply-reviewed-proposal @feature2 @AC-2.4 @feature6 @AC-6.1
  Scenario: SPEC_AUTHORING_007 apply transaction consumes a separately reviewed proposal
    Given an authenticated caller reviewed the complete untruncated proposal ID and hash before this call
    And its unexpired proposal and current expected document and base hashes still match
    When apply_transaction is requested without raw edits
    Then the reviewed proposal enters APPLYING and commits one complete result generation
    And the committed hashes equal the separately reviewed proposal hashes

  @id:SCEN-apply-review-bypass-refused @feature2 @AC-2.2 @AC-2.4 @feature6 @AC-6.4
  Scenario Outline: SPEC_AUTHORING_008 proposal review cannot be bypassed
    Given apply_transaction receives <invalid_input>
    When it validates proposal review identity before staging
    Then PROPOSAL_NOT_REVIEWED PROPOSAL_NOT_APPLICABLE PROPOSAL_EXPIRED or HASH_MISMATCH is returned as applicable
    And no preview is created or committed and no transaction material exists

    Examples:
      | invalid_input |
      | raw edit operations |
      | an unreviewed proposal |
      | a cancelled proposal |
      | a truncated proposal |
      | an expired proposal |
      | a mismatched proposal hash |
      | an omitted proposal document hash |
      | an extra non-proposal document hash |

  @id:SCEN-concurrent-fresh-applies @feature3 @AC-3.2 @concurrency
  Scenario: SPEC_AUTHORING_009 concurrent fresh applies cannot lose an update
    Given two reviewed proposals share the same expected document and snapshot hashes
    When their apply_transaction requests race for the same canonical root
    Then at most one transaction commits
    And the other waits within the bound then returns stale CAS or TRANSACTION_BUSY
    And the committed winner is not overwritten or partially exposed

  @id:SCEN-second-cas-detects-change @feature3 @AC-3.1 @feature4 @AC-4.3 @rollback
  Scenario: SPEC_AUTHORING_010 a second CAS detects a change after staging
    Given a reviewed proposal passed its first CAS and created a stage
    And a concurrent committed generation changes one target before swap
    When the writer performs staged validation and pre-swap path and hash checks
    Then the transaction rolls back staged material and returns HASH_MISMATCH with current hashes
    And the concurrent committed generation remains byte-identical

  @id:SCEN-terminal-request-replay @feature3 @AC-3.3
  Scenario: SPEC_AUTHORING_011 terminal request replay is idempotent
    Given an apply request ID already has a terminal result
    When the identical canonical request is replayed
    Then the prior result returns without another commit or audit event
    And reuse of that request ID with different content returns REQUEST_ID_REUSE

  @id:SCEN-validator-unavailable-fails-closed @feature4 @AC-4.2
  Scenario: SPEC_AUTHORING_012 unavailable mandatory validation fails closed
    Given structural validation passes but an anchor conformance or snapshot validator is unavailable incomplete or on another snapshot
    When a proposal or transaction requests write eligibility
    Then VALIDATOR_UNAVAILABLE or SNAPSHOT_MISMATCH is returned and not a green readiness result
    And no document or transaction stage is written

  @id:SCEN-canonical-target-confined @feature5 @AC-5.1
  Scenario: SPEC_AUTHORING_013 a canonical unlinked target is confined before content access
    Given an explicit canonical repository root and an ordinary unlinked spec directory
    When one canonical document target is resolved
    Then every component and nearest existing ancestor passes canonical real-path and normalization confinement
    And content mutation remains unavailable until all later proposal and transaction gates pass

  @id:SCEN-escaping-target-refused @feature5 @AC-5.2
  Scenario Outline: SPEC_AUTHORING_014 escaping and non-canonical targets are refused
    Given a selected canonical repository root
    When a request targets <target_class>
    Then the matching containment error is returned before proposal or mutation state
    And no target stage journal or unrelated filesystem information is created

    Examples:
      | target_class |
      | parent or dot traversal |
      | absolute path |
      | drive-relative path |
      | UNC path |
      | device path |
      | alternate data stream |
      | NUL-containing path |
      | out-of-root path |
      | Unicode-normalized collision |
      | case-folded collision |
      | unsupported document |

  @id:SCEN-linked-spec-directory-unsupported @feature5 @AC-5.3
  Scenario: SPEC_AUTHORING_015 linked spec directories are unsupported for reads and mutation
    Given the selected root spec directory or target chain contains a symlink junction mount point or reparse point
    When kernel reading proposal construction validation or mutation resolves the spec
    Then SYMLINK_COMPONENT is returned before document content is read
    And no allowlist follow mode proposal stage or commit is available

  @id:SCEN-path-component-switch-refused @feature5 @AC-5.3 @AC-5.4 @concurrency
  Scenario: SPEC_AUTHORING_016 a path component switched to a reparse point blocks commit
    Given a valid ordinary target passed initial containment
    And an adversarial process replaces an ancestor with a symlink junction mount or reparse point while a valid writer runs
    When the writer rechecks containment immediately before commit
    Then PATH_CHANGED or SYMLINK_COMPONENT is returned
    And the invalid request cannot acquire a mutation target or disturb the valid writer generation or lease

  @id:SCEN-atomic-visible-generation @feature6 @AC-6.1 @AC-6.3 @concurrency
  Scenario: SPEC_AUTHORING_017 all documents commit as one visible generation
    Given a reviewed same-spec proposal changes multiple canonical documents
    And all expected hashes still match under the exclusive lease
    When the generation transaction commits while coordinated readers and another writer run
    Then coordinated readers observe either every old document or every new document
    And the second writer rechecks CAS and no request sees a mixed document set

  @id:SCEN-transaction-fault-complete-generation @feature6 @AC-6.2 @rollback
  Scenario Outline: SPEC_AUTHORING_018 injected transaction faults preserve a complete generation
    Given a transaction captured proven preimage and result hashes
    When a fault occurs at <boundary>
    Then the service proves and exposes the complete original generation or completes the result generation
    And unresolved proof enters RECOVERY_REQUIRED and blocks subsequent access
    And its hash-bound retained assessment exposes either at least one complete valid retained original or result generation or the bounded rebaseline path where neither is complete and valid with no unclassified third state

    Examples:
      | boundary |
      | prepare |
      | stage write |
      | stage synchronization |
      | pre-swap validation |
      | first generation swap |
      | second generation swap |
      | audit before commit |
      | transient cleanup |
      | recovery |

  @id:SCEN-interrupted-commit-auto-recovery @feature6 @AC-6.2 @AC-6.3 @concurrency
  Scenario: SPEC_AUTHORING_019 interrupted commit recovers before another writer or reader proceeds
    Given a prior process stopped in COMMITTING with a valid transient journal
    When a new read or mutation enters the snapshot coordinator
    Then recovery under the exclusive lease deterministically commits or restores by hashes
    And no reader sees a mixed generation and no writer bypasses recovery

  @id:SCEN-invalid-transaction-shape-refused @feature6 @AC-6.4
  Scenario Outline: SPEC_AUTHORING_020 invalid transaction shape or pending recovery refuses
    Given apply_transaction targets <invalid_shape>
    When transaction preconditions are evaluated
    Then the request refuses before commit
    And any stage is removed or retained only for explicit recovery with its hashes reported

    Examples:
      | invalid_shape |
      | more than one specification |
      | a duplicate target |
      | conflicting operations on one target |
      | a root with recovery pending |

  @id:SCEN-manual-recovery-selects-complete-generation @feature6 @AC-6.5 @recovery
  Scenario Outline: SPEC_AUTHORING_021 authenticated manual recovery exits RECOVERY_REQUIRED with one proven generation
    Given a transaction is RECOVERY_REQUIRED with retained original and result generation hashes
    And an authenticated unexpired host authorization selects the complete <generation> inventory within fifteen documents
    When recover_transaction verifies the retained bytes containment hashes and every mandatory validator under the exclusive lease
    Then the state passes through RECOVERING to <terminal_state>
    And only the selected complete generation is exposed and a redacted recovery audit event is returned

    Examples:
      | generation | terminal_state |
      | original | ROLLED_BACK |
      | result | COMMITTED |

  @id:SCEN-manual-recovery-invalid-selection-refused @feature6 @AC-6.6 @recovery
  Scenario Outline: SPEC_AUTHORING_022 invalid manual recovery remains fail closed
    Given a transaction is RECOVERY_REQUIRED
    When recover_transaction receives <invalid_recovery>
    Then RECOVERY_AUTHORIZATION_INVALID RECOVERY_SELECTION_INVALID or RECOVERY_VALIDATION_FAILED is returned as applicable
    And state remains RECOVERY_REQUIRED recovery material is retained and normal reads and writes stay blocked

    Examples:
      | invalid_recovery |
      | missing expired or mismatched authorization |
      | more than fifteen documents |
      | replacement document bytes |
      | partial mixed or unknown generation hashes |
      | a containment failure |
      | a mandatory validation failure |

  @id:SCEN-section-edit-preserves-bytes @feature7 @AC-7.1
  Scenario: SPEC_AUTHORING_023 unique section edit preserves anchor identity and untouched bytes
    Given spec-kernel FR-13 returns a unique heading anchor and link-occurrence inventory for one immutable snapshot
    When a reviewed section proposal changes content without changing the generated slug
    Then only the selected section changes and its section hash equals the proposal
    And untouched bytes and source EOL style are conserved

  @id:SCEN-heading-rename-rewrites-inbound-links @feature7 @AC-7.2
  Scenario: SPEC_AUTHORING_024 heading rename atomically preserves all same-spec inbound links
    Given spec-kernel FR-13 returns complete heading anchor and link-occurrence inventory for one immutable unlinked repository snapshot
    When a rename_heading proposal changes its generated slug
    Then every same-spec inbound rewrite appears in the same preview and reviewed transaction
    And any rewrite fault rolls back all documents while an accepted commit leaves every link resolved

  @id:SCEN-heading-rename-ambiguity-refused @feature7 @AC-7.3 @rollback @concurrency
  Scenario Outline: SPEC_AUTHORING_025 unsafe heading rename refuses without overwrite
    Given a rename target is <unsafe_target>
    When the rename is proposed or applied
    Then a specific anchor inventory or stale error is returned and a fresh proposal is required where retryable
    And every heading and link document retains the complete original generation

    Examples:
      | unsafe_target |
      | missing |
      | duplicate or ambiguous |
      | concurrently changed |
      | slug-colliding |
      | externally referenced |
      | inventory-incomplete |
      | inside a linked spec directory |

  @id:SCEN-legal-task-status-transitions @feature8 @AC-8.1
  Scenario Outline: SPEC_AUTHORING_026 legal task status transitions honor their guards
    Given a task is in <from_state> with current expected TASKS hash
    And the guard for <to_state> is satisfied
    When the caller proposes reviews and applies the status transition with actor and reason
    Then exactly the canonical status field changes to <to_state> through an atomic transaction
    And audit evidence records the prior and resulting state

    Examples:
      | from_state | to_state |
      | todo | ready |
      | todo | blocked |
      | ready | in-progress |
      | ready | blocked |
      | ready | todo |
      | in-progress | blocked |
      | in-progress | done |
      | in-progress | ready |
      | blocked | todo |
      | blocked | ready |
      | blocked | in-progress |

  @id:SCEN-illegal-status-transition-refused @feature8 @AC-8.2
  Scenario: SPEC_AUTHORING_027 illegal status transition preserves the old status
    Given a requested task transition is absent from the exhaustive transition table
    When the status reducer evaluates it
    Then ILLEGAL_TRANSITION lists the legal next states
    And no proposal eligible for review is created and the old status is preserved

  @id:SCEN-status-guard-failure-refused @feature8 @AC-8.3
  Scenario Outline: SPEC_AUTHORING_028 incomplete status evidence fails closed
    Given a requested transition lacks <required_guard>
    When the status reducer evaluates current evidence
    Then STATUS_GUARD_FAILED lists the missing stale or weak trace leg
    And no task document byte changes

    Examples:
      | required_guard |
      | the assembled trace for ready |
      | the assembled trace or owner for in-progress |
      | checked Done When and current task-owned strong evidence for done |

  @id:SCEN-concurrent-status-change-refused @feature8 @AC-8.4 @rollback @concurrency
  Scenario: SPEC_AUTHORING_029 concurrent or faulted status change preserves a complete winner
    Given two reviewed status proposals use the same TASKS base hash
    When both apply and one faults after staging
    Then at most one commits and the loser returns stale CAS without merging status text
    And the faulted stage rolls back the entire TASKS generation without erasing the winner

  @id:SCEN-done-task-explicit-reopen @feature8 @AC-8.5
  Scenario: SPEC_AUTHORING_030 done task reopens only to in progress
    Given a done task retains its historical completion evidence
    When an authenticated caller with a non-empty reason proposes reviews and applies done to in-progress
    Then the transition is accepted and no other done transition is legal
    And historical evidence remains recorded but cannot satisfy a future done guard

  @id:SCEN-redacted-audit-every-outcome @feature9 @AC-9.1
  Scenario: SPEC_AUTHORING_031 every outcome returns redacted provenance and audit evidence
    Given proposal review refusal commit rollback recovery cancel and status events occur
    When their audit envelopes are inspected
    Then each envelope contains version identities actor reason hashes outcome and next action
    And none contains a document body diff credential environment value recovery authorization retained bytes or unrelated path

  @id:SCEN-audit-digest-chain-order @feature9 @AC-9.2 @concurrency
  Scenario: SPEC_AUTHORING_032 concurrent audit events form one deterministic chain
    Given concurrent events complete on one canonical root
    When committed audit envelopes are ordered by commit
    Then each envelope names the prior event digest deterministically
    And replay returns the existing envelope without a duplicate event

  @id:SCEN-audit-sink-failure-boundary @feature9 @AC-9.3 @rollback
  Scenario: SPEC_AUTHORING_033 audit sink failures distinguish before and after commit
    Given the caller explicitly configured a durable audit sink
    When the sink fails before commit
    Then no generation swap begins
    When the sink fails after a proven commit
    Then COMMITTED_WITH_AUDIT_EXPORT_FAILURE returns the redacted envelope for retry
    And committed user documents are not rolled back or misreported as unchanged

  @id:SCEN-closed-contract-unknown-input @feature10 @AC-10.1
  Scenario: SPEC_AUTHORING_034 closed contract rejects unknown input
    Given a request has an unknown operation field enum required field or schema version
    When the shared authoring service parses it
    Then a stable version-one typed error and safe next action are returned
    And no request or response loses fields during a valid round trip

  @id:SCEN-internal-error-redaction @feature10 @AC-10.2
  Scenario: SPEC_AUTHORING_035 internal exceptions preserve state and redact internals
    Given an internal exception occurs in a known transaction state
    When the shared service maps it to a result
    Then INTERNAL_ERROR contains safe correlation data and the required preserve or rollback outcome
    And it exposes no stack trace sensitive path or secret

  @id:SCEN-adapters-share-authority @feature10 @AC-10.3
  Scenario: SPEC_AUTHORING_036 extension and future adapter share one service contract
    Given the existing extension and a later MCP adapter receive equivalent requests
    When each delegates the request
    Then their results are contract-equivalent
    And neither adapter adds a direct mutation path or adapter-specific mutation semantic

  @id:SCEN-critical-mutants-killed @feature11 @AC-11.1 @AC-11.3 @mutation
  Scenario: SPEC_AUTHORING_037 every safety-critical mutant family is present killed and restored
    Given the built installed artifact and resolved versioned mutation policy
    When the real mutation gate reconciles its inventory and runs covering behavior
    Then every required critical family is present and every mutant is killed after a green baseline
    And each mutant makes behavior fail before hash-proven restoration and a green post-restore run

  @id:SCEN-critical-mutant-or-policy-blocks @feature11 @AC-11.2 @AC-11.4 @mutation
  Scenario: SPEC_AUTHORING_038 survivor missing timeout skip error or policy decision blocks release
    Given one critical mutant survives lacks coverage times out is skipped disappears or errors
    Or one of MP-1 through MP-4 remains unresolved
    When release eligibility is evaluated
    Then lifecycle remains DEFERRED and release fails with exact family location version and outcome evidence
    And no aggregate score manual exclusion or self-waiver overrides the critical gate

  @id:SCEN-excluded-integration-blocks @feature12 @AC-12.2
  Scenario: SPEC_AUTHORING_039 excluded integrations and hidden state fail the boundary gate
    Given a planted advisor backlog dashboard hook stop gate repair loop database watcher judge progress file hidden ledger or direct writer
    When the installed artifact and target repository are inspected
    Then the authoring boundary gate fails
    And no excluded integration or hidden state becomes an authoring authority

  @id:SCEN-deferred-uninstall-preserves-specs @feature12 @AC-12.3
  Scenario Outline: SPEC_AUTHORING_040 deferred or uninstalled authoring preserves user specifications
    Given authoring is <lifecycle_condition> on a supported unlinked repository root
    When package and repository state are inspected
    Then every user specification hash remains unchanged and no hidden workflow state exists
    And read-only kernel and distribution behavior remains available according to their own gates

    Examples:
      | lifecycle_condition |
      | DEFERRED |
      | uninstalled |

  @id:SCEN-aggregate-partial-proof-refused @feature13 @AC-13.3
  Scenario Outline: SPEC_AUTHORING_041 partial mismatched or malformed aggregate proof cannot open eligibility
    Given authoring evidence is represented by <invalid_aggregation>
    When the aggregate eligibility gate evaluates the exact built release-candidate artifact
    Then lifecycle remains DEFERRED and no authoring action is registered
    And the result identifies the exact qualified requirement target stage and evidence-set or lineage error

    Examples:
      | invalid_aggregation |
      | an any-of match |
      | a green aggregate count |
      | an inherited green state |
      | a source-tree-only result |
      | another artifact snapshot policy host or artifact lineage |
      | one unqualified spec-kernel FR-14 envelope |
      | two kernel envelopes both qualified as targetStage v0.3 with no v0.2 result |
      | a v0.3 kernel envelope whose parent hash does not equal the accepted v0.2 artifact hash |
      | a stale or revoked accepted v0.2 kernel envelope |
      | a v0.3 kernel result substituted for the required v0.2 result |

  @id:SCEN-authoring-implementation-while-deferred @feature1 @AC-1.4 @feature13 @AC-13.2
  Scenario: SPEC_AUTHORING_042 deferred lifecycle permits implementation but never exposure
    Given the authoring lifecycle and registration state are DEFERRED and unregistered
    When maintainers implement and internally exercise the versioned schema shared service real fixtures recovery authority and pure eligibility evaluator against isolated inputs
    Then candidate-bound evidence may be created without registering or exposing an authoring action
    And no user specification changes and FR-13 remains the registration and release eligibility gate

  @id:SCEN-rebaseline-recovery-proposal-no-write @feature6 @AC-6.7 @recovery
  Scenario: SPEC_AUTHORING_043 no-survivor rebaseline is proposed and validated before write
    Given a transaction is RECOVERY_REQUIRED and neither retained original nor result is complete and valid
    And corrupt or incomplete retained original and result directories may still exist
    And an authenticated unexpired operator authorization is bound to actor reason transaction canonical root target candidate and at most fifteen canonical documents
    And the request names an ordinary unlinked root-contained candidate with complete candidate hashes and expected blocked-current snapshot document journal and no-survivor assessment hashes
    When propose_rebaseline_recovery runs under the exclusive lease
    Then it writes nothing and returns a complete review-required proposal with full pre and post hashes journal hash candidate fingerprint validation findings actor reason and expiry
    And candidate bytes paths authorization material and unrelated filesystem data are absent from audit output

  @id:SCEN-rebaseline-recovery-atomic-or-refused @feature6 @AC-6.8 @feature9 @AC-9.1 @recovery @rollback @concurrency
  Scenario Outline: SPEC_AUTHORING_044 reviewed no-survivor rebaseline is atomic history preserving and fail closed
    Given apply_rebaseline_recovery consumes a separately reviewed unexpired exact proposal for a RECOVERY_REQUIRED transaction
    When the service encounters <condition> while rechecking authorization proposal current journal candidate containment links validation audit history and lease state
    Then <outcome>
    And the blocked transaction journal recovery material and append-only audit history are never erased

    Examples:
      | condition | outcome |
      | every identity and validation result still matches and neither retained original nor retained result is complete and valid even though corrupt or incomplete retained directories may exist | state passes through REBASELINING to REBASELINED and exactly the proposed complete generation is installed atomically |
      | either retained original or retained result is complete and valid | rebaseline is refused and recover_transaction remains the bounded path |
      | an authorization proposal current journal or candidate hash mismatch | state remains RECOVERY_REQUIRED with no byte exposed or changed |
      | an escaping linked symlink junction mount or reparse candidate | state remains RECOVERY_REQUIRED with no candidate content leak |
      | an anchor link validator audit-chain or lease concurrency failure | state remains RECOVERY_REQUIRED and normal reads and writes remain blocked |

  @id:SCEN-generator-port-mutation-names @feature14 @AC-14.1
  Scenario: SPEC_AUTHORING_045 generator-port mutation names are v1 or later v2 not DROP
    Given the agent-facing authoring API is MCP
    When the generator-port mutation census is mapped onto this spec
    Then the eighteen schema-v1 names map onto proposal-first operations
    And the six schema-v2 names create_spec archive_spec delete_spec_doc rename_spec_doc add_backlog_task and register_incident_backlog remain later and are not DROP
    And none of those twenty-four names appear on the v0.3 first-slice read registry
    And the dropped advisor dashboard and harness backlog UI is not add_backlog_task

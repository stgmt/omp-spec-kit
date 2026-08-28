@spec-kernel @read-only
Feature: Standalone deterministic specification graph kernel
  The v0.2 kernel parses a bounded repository snapshot and serves read queries.
  The v0.3 MCP adapter projects the same service without mutations.
  These scenarios specify required behavior and have no executed status here.

  @feature1 @AC-1.1 @id:SCEN-pure-read-only-boundary
  Scenario: Pure kernel and public registries remain read-only
    Given immutable source documents and kernel limits are supplied as values
    When every v0.2 kernel and query operation is exercised
    Then no filesystem clock environment network process OMP or MCP access occurs in the pure kernel
    And the v0.2 and v0.3 public operation registries contain no mutation or state-transition operation

  @feature2 @AC-2.1 @id:SCEN-supported-documents-and-ids
  Scenario: Document-role grammar recognizes only canonical FR AC and TASK definitions
    Given the current product plugin-distribution spec-kernel and spec-authoring-workflow FR AC and TASK documents
    And their headings include FR colon-title and em-dash-title forms AC colon-title em-dash-title and bare exact-ID forms and TASK colon-title and em-dash-title forms
    And product acceptance documents contain FR grouping headings while requirement and task matrices repeat IDs as reference prose
    When the source set is parsed by canonical document role before heading shape
    Then every authored FR AC and TASK definition is emitted exactly once from its owning document
    And grouping wrong-document arbitrary and malformed headings do not become definitions
    And shared TASK status preserves planned and todo as distinct values while mapping canonical Completed to done

  @feature3 @AC-3.1 @id:SCEN-qualified-deterministic-snapshot
  Scenario: Qualified identities and snapshots are reproducible
    Given two specs each define local ID FR-1
    And local and explicit qualified cross-spec references connect them
    When equivalent UTF-8 inputs with different arrival orders and line endings are parsed
    Then the canonical nodes remain distinct by spec slug
    And both builds have identical fingerprints and canonical serialization

  @feature4 @AC-4.1 @id:SCEN-lossless-duplicates
  Scenario: Duplicate definitions are preserved without winner selection
    Given one spec contains two valid definitions for the same canonical ID
    And another definition references that ID
    When the graph is built and the ID is queried
    Then both definition candidates are preserved and no canonical node is elected
    And the reference is ambiguous and the query returns AMBIGUOUS_ID with both bounded candidates

  @feature5 @AC-5.1 @id:SCEN-edge-resolution-outcomes
  Scenario: Every reference occurrence has exactly one edge outcome
    Given references include valid missing ambiguous malformed forbidden-endpoint and qualified cross-spec targets
    When typed edges are resolved
    Then each reference occurrence is exactly one resolved edge or one typed unresolved reference
    And every resolved edge joins existing endpoint kinds permitted by the schema

  @feature6 @AC-6.1 @id:SCEN-conservation-and-fail-closed-diagnostics
  Scenario: Conservation and cardinality failures invalidate the graph
    Given document definition domain-reference Markdown-heading and Markdown-link occurrence counts are known
    When the graph invariants are evaluated
    Then all conservation and cardinality equations reconcile
    But when an invariant violation is planted
    Then graph validity is false and no readiness or passing-test claim is returned

  @feature7 @AC-7.1 @id:SCEN-contained-reader-rejects-links
  Scenario: Repository reader refuses linked external and over-budget paths
    Given an explicit repository root has contained canonical files
    And variants include traversal an external absolute path a symbolic link a junction or reparse point and an oversized file
    When the filesystem adapter prepares a source snapshot
    Then every unsafe or over-budget variant is refused before target bytes are read
    And diagnostics contain only sanitized repository-relative information and zero files are written

  @feature8 @AC-8.1 @id:SCEN-bounded-query-service
  Scenario: Shared query operations are stable and bounded
    Given an immutable valid graph and its fingerprint
    When inventory getNode findNodes getEdges trace diagnostics overview and markdownInventory receive normal boundary excessive and stale-cursor inputs
    Then each call returns the exhaustive canonical envelope or a closed typed error
    And ordering pagination totals truncation and limits are explicit and graph state is unchanged

  @feature9 @AC-9.1 @id:SCEN-mcp-read-projection-only
  Scenario: MCP adapter adds transport but no semantics
    Given the v0.3 MCP adapter and v0.2 service share one graph and request
    When every registered MCP tool is invoked
    Then each structured canonical result equals the direct service result after transport metadata is removed
    And the MCP registry has exactly eight named read tools and zero mutation-like tools

  @feature10 @AC-10.1 @id:SCEN-self-contained-artifact
  Scenario Outline: Installed package proof is selected by target stage
    Given targetStage <targetStage> and evidenceProfile <evidenceProfile> select CHK-FR10-01
    And the exact candidate artifact is installed outside the source checkout with root and external node_modules unavailable
    When <exercise>
    Then the record has packageSurface <packageSurface> and proves <acceptedProof>
    And a record with the other stage profile package surface release line or artifact binding is rejected

    Examples:
      | targetStage | evidenceProfile | packageSurface          | exercise                                                        | acceptedProof                                                                 |
      | v0.2        | kernel-v0.2     | OMP_EXTENSION_ONLY      | the OMP extension builds a graph and executes one query          | only the dependency-absent extension package with no MCP dependency           |
      | v0.3        | kernel-v0.3     | OMP_EXTENSION_AND_MCP   | the OMP extension and MCP server each execute the shared service | both components came from the exact dependency-absent installed v0.3 artifact |

  @feature11 @AC-11.1 @id:SCEN-real-fixture-provenance
  Scenario: Real fixture bytes reconcile with declared provenance and ground truth
    Given a target-owned fixture manifest records producer capture hash size license trimming and reviewed counts
    When fixture bytes are verified and parsed
    Then their hash and size match and all occurrence and outcome counts reconcile
    And the result makes no upstream parity or executed-scenario claim

  @feature12 @AC-12.1 @id:SCEN-performance-and-size-budgets
  Scenario: Packaged runtime enforces performance size and result budgets
    Given the packaged artifact and pinned benchmark corpus
    When cold builds bounded queries hard-limit variants and cancellation are measured
    Then latency memory bundle response corpus and traversal observations meet every NFR budget
    And any hard excess returns a typed limit error or blocks release without silent data loss

  @feature13 @AC-13.1 @id:SCEN-complete-markdown-rename-inventory
  Scenario: Complete heading and link inventory makes a rename plan conservative
    Given accepted Markdown contains ID and ordinary ATX and Setext headings including Foo Foo Foo-1 and equivalent adversarial orders
    And its links include inline reference and autolink forms with internal external unresolved and shared-definition destinations
    When headings are allocated in document order against the complete set of previously emitted canonical anchors
    And the complete markdownInventory cursor chain is requested unscoped and focused on one ordinary canonical anchor
    Then Foo Foo Foo-1 emits foo foo-1 foo-1-1 and every emitted canonical anchor is pairwise unique
    And Foo-1 Foo Foo emits foo-1 foo foo-2 and Foo Foo-1 Foo emits foo foo-1 foo-2
    And every heading and semantic link occurrence appears exactly once with versioned anchors exact use and rewrite spans stable rewrite keys and outcomes
    And all inbound links to the focus and all outbound links in its section are identified and the heading and link conservation totals reconcile

  @feature14 @AC-14.1 @id:SCEN-kernel-release-gate-is-all-not-any
  Scenario: Kernel release eligibility requires the complete selected stage profile
    Given a v0.2 manifest declares targetStage v0.2 and evidenceProfile kernel-v0.2
    And it has exactly one passing hash-bound record for every mandatory check for FR-1 through FR-8 and FR-10 through FR-13
    And its package fixture and v0.2 budget records agree on the candidate artifact and applicable corpus fingerprint
    When kernel release eligibility is evaluated
    Then v0.2 eligibility is true without FR-9 MCP evidence
    But a v0.2 manifest containing FR-9 evidence or an unknown or mismatched stage profile is ineligible
    And a v0.3 manifest is eligible only with a same-lineage accepted v0.2 input every v0.2-profile check FR-9 adapter parity and read-only registry evidence and MCP-inclusive package and budget evidence
    And removing duplicating failing staling mismatching waiving partializing or making unverifiable any one required record makes that stage ineligible
    And every ineligible result has deterministic blocking details and no publication or readiness side effect

  @feature15 @AC-15.1 @id:SCEN-contained-step-binding-index
  Scenario: Contained step-definition files become kernel bindings without a ninth MCP tool
    Given canonical spec documents and cucumber-js step definitions under tests/step-definitions
    And one Gherkin step has exactly one matching pattern one has none and one has two
    When the kernel builds the graph
    Then each parsed pattern is one STEP_BINDING node
    And the uniquely matched step has one BINDS_STEP edge
    And the unmatched step has WARNING STEP_UNDEFINED and the graph remains valid
    And the doubly matched step has WARNING STEP_AMBIGUOUS and no BINDS_STEP edge
    And a symlink or path outside tests/step-definitions is refused before read
    And findNodes getEdges and diagnostics expose the index
    And the MCP registry is still exactly eight read tools
    And a v0.2 eligibility manifest without FR-15 evidence remains evaluable

  @feature16 @AC-16.1 @id:SCEN-generator-port-read-operations
  Scenario: Generator-port kernel reads grow MCP without a second graph
    Given the v0.2 eight query operations exist
    When FR-16 operations are implemented
    Then listSpecs findByTags listTasks listPhaseTasks findOrphans validateAnchor policyQuery validateRequirementMetadata archivalProof validateSpec and specStatus are read-only query operations
    And MCP projects them so the agent never needs an LSP tool
    And get_test_result and get_scenario_trace remain absent until spec-evidence
    And mutation tools remain absent from the v0.3 read registry
    And a v0.2 eligibility manifest without FR-16 evidence remains evaluable



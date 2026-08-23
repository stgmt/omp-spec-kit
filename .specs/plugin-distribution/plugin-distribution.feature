# Specification text only. No scenario in this file is claimed to have executed or passed.
@plugin-distribution @specification-only
Feature: Distribute omp-spec-kit as one proven OMP plugin
  The first release is published only after one marketplace, one child package,
  one extension entry, one bounded read-only tool, and the complete lifecycle are proven.

  Background:
    Given release evidence applicability is determined from the candidate version
    And the marketplace identity is "omp-spec-kit"
    And the plugin identity is "omp-spec-kit@omp-spec-kit"
    And no lifecycle receipt is assumed to pass

  @id:SCEN-reject-marketplace-topology @feature1 @FR-1 @AC-1.1
  Scenario Outline: Reject marketplace cardinality and containment violations
    Given the complete repository contains topology variant "<variant>"
    When the root marketplace topology is validated
    Then the topology outcome is "<outcome>"
    And no build or release is started for a rejected topology

    Examples:
      | variant                                                   | outcome  |
      | one .omp-plugin catalog with one exact relative child     | accepted |
      | a second marketplace catalog                              | rejected |
      | a second plugin entry                                     | rejected |
      | a nested marketplace                                      | rejected |
      | an external source object                                 | rejected |
      | a relative source escaping the repository root            | rejected |

  @id:SCEN-reject-child-package-topology @feature2 @FR-2 @AC-2.1
  Scenario Outline: Reject child package and extension cardinality violations
    Given the child package variant is "<variant>"
    When the child manifest and resolved extension paths are validated
    Then the package outcome is "<outcome>"

    Examples:
      | variant                                      | outcome  |
      | one package with ./dist/extension.js         | accepted |
      | a second omp.extensions entry                | rejected |
      | a nested plugin package                      | rejected |
      | a legacy pi.extensions entry                 | rejected |
      | an extension path into src                   | rejected |
      | an install lifecycle script                  | rejected |
      | an MCP declaration in v0.1.0                 | rejected |
      | an extension symlink escaping the package    | rejected |

  @id:SCEN-bound-inventory-to-project-root @feature3 @FR-3 @AC-3.1
  Scenario Outline: Bound inventory to the active project root
    Given a fresh installed session whose tool context root is the fixture project
    And the inventory request uses "<request>"
    And the fixture condition is "<condition>"
    When spec_inventory is invoked
    Then only safe direct entries below ".specs" are inspected
    And the result status is "<status>"
    And the result is lexical, bounded, project-relative, and schema version 1
    And repository writes are zero

    Examples:
      | request                         | condition                         | status  |
      | defaults                        | one valid direct spec             | ok      |
      | maxSpecs 2                      | three valid direct specs          | partial |
      | maxSpecs 200                    | more than the hard cap            | partial |
      | defaults                        | package cwd differs from ctx.cwd   | ok      |
      | defaults                        | a child link escapes project root  | partial |

  @id:SCEN-distinguish-reload-from-activation @feature4 @FR-4 @AC-4.1 @AC-4.2
  Scenario: Distinguish reload from fresh-session extension activation
    Given the candidate version is "0.1.0"
    And the marketplace is added and the plugin is discovered
    When the plugin is installed at project scope
    And the installed version is recorded
    And /reload-plugins completes in the pre-install session
    Then reload completion is recorded without an extension activation claim
    When the pre-install session ends
    And a fresh OMP session starts in the fixture project
    And spec_inventory is invoked from the installed extension
    Then fresh-session activation is eligible for a passed receipt
    And the installed tool reports plugin version "0.1.0"

  @id:SCEN-run-clean-payload-without-ambient-dependencies @feature5 @FR-5 @AC-5.1
  Scenario: Execute the clean-built payload without ambient dependencies
    Given previous dist output is absent
    And a clean build assembles the allowlisted child payload
    And the artifact digest is recorded
    And repository-root node_modules and the source checkout are unavailable
    When the exact artifact is installed project-scope
    And a fresh OMP session invokes spec_inventory
    Then no undeclared or ambient dependency is resolved
    And the invoked extension bytes match the recorded artifact digest

  @id:SCEN-contain-read-only-inventory-failures @feature6 @FR-6 @AC-6.1
  Scenario Outline: Contain read-only inventory failures
    Given the fixture condition is "<condition>"
    When spec_inventory is invoked in a fresh installed session
    Then the diagnostic code is "<code>"
    And result and diagnostics remain within hard caps
    And repository writes, network calls, process spawns, model calls, timers, and credential reads are zero
    And the OMP session remains usable

    Examples:
      | condition                          | code                       |
      | .specs is absent                   | SPECS_ABSENT               |
      | .specs is a regular file           | SPECS_NOT_DIRECTORY        |
      | a spec entry is unreadable         | SPEC_UNREADABLE            |
      | a spec is incomplete               | SPEC_INCOMPLETE            |
      | diagnostics exceed the hard cap    | DIAGNOSTIC_LIMIT_REACHED   |
      | the request is aborted             | REQUEST_ABORTED            |
      | an unexpected internal error       | INTERNAL_ERROR_REDACTED    |

  @id:SCEN-enforce-release-version-consistency @feature7 @FR-7 @AC-7.1
  Scenario Outline: Require one exact version across every authority
    Given the candidate version is "<candidate>"
    And catalog, package, runtime, installed tool, artifact, and tag declare "<authorities>"
    When release version consistency is evaluated
    Then the version consistency outcome is "<outcome>"

    Examples:
      | candidate | authorities              | outcome  |
      | 0.1.0     | 0.1.0 and tag v0.1.0     | accepted |
      | 0.1.0     | one authority mismatches | rejected |
      | 0.1.1     | 0.1.1 and tag v0.1.1     | accepted |

  @id:SCEN-upgrade-from-prior-release-after-first-release @feature7 @FR-7 @AC-7.2
  Scenario Outline: Require upgrade from a real prior release only after v0.1.0
    Given candidate version "<candidate>" has release position "<position>"
    And prior-version state is "<prior>"
    When the catalog is updated and the project-scoped plugin upgrade is attempted
    And plugin metadata is reloaded
    And a fresh session observes the installed tool version
    Then the upgrade proof outcome is "<outcome>"

    Examples:
      | candidate | position   | prior                             | outcome       |
      | 0.1.0     | first      | no prior release                  | inapplicable  |
      | 0.1.1     | subsequent | released 0.1.0 installed          | accepted      |
      | 0.1.1     | subsequent | locally relabeled 0.1.0 candidate | rejected      |
      | 0.1.1     | subsequent | released 0.1.1 installed          | rejected      |
      | 0.1.1     | subsequent | stale-session-only observation    | rejected      |

  @id:SCEN-uninstall-and-reinstall-candidate @feature8 @FR-8 @AC-8.1
  Scenario Outline: Prove candidate uninstall and reinstall without a prior-release dependency
    Given project preservation hashes exist before lifecycle mutation
    And the verified candidate artifact version "<candidate>" is installed project-scope
    When the candidate is uninstalled
    And a fresh session checks that the capability is absent
    And the exact same "<candidate>" artifact is reinstalled project-scope
    And plugin metadata is reloaded
    And another fresh session invokes spec_inventory
    Then the installed tool reports plugin version "<candidate>"
    And every non-OMP-managed project hash equals baseline

    Examples:
      | candidate |
      | 0.1.0     |
      | 0.1.1     |

  @id:SCEN-rollback-to-prior-release-after-first-release @feature8 @FR-8 @AC-8.2
  Scenario Outline: Require rollback to a real prior release only after v0.1.0
    Given candidate version "0.1.1" is installed project-scope
    And project preservation hashes exist before lifecycle mutation
    When the operator performs "<operation>"
    And plugin metadata is reloaded
    And a fresh session checks capability and version state
    Then the lifecycle observation is "<observation>"
    And every non-OMP-managed project hash equals baseline

    Examples:
      | operation                                  | observation               |
      | explicit install of released version 0.1.0 | prior version 0.1.0 invoked |
      | marketplace removal only                   | insufficient as rollback  |
      | cache deletion only                        | insufficient as rollback  |

  @id:SCEN-block-unsafe-public-artifacts @feature9 @FR-9 @AC-9.1
  Scenario Outline: Block unsafe public artifacts
    Given public-safety input "<violation>"
    When provenance, license, secret, diff, and package gates run
    Then publication eligibility is "blocked"
    And no public artifact or release is created

    Examples:
      | violation                                      |
      | imported bytes differ from immutable source    |
      | an imported license is unknown                 |
      | a credential-like value is outside canary      |
      | a user OMP state path is packaged               |
      | an evidence or log file is packaged             |
      | the public diff contains an unapproved file     |
      | the package exceeds its positive allowlist      |

  @id:SCEN-enforce-github-release-transaction @feature10 @FR-10 @AC-10.1
  Scenario Outline: Publish only through the GitHub Actions release transaction
    Given the workflow event is "<event>"
    And required verification jobs are "<jobs>"
    And release artifact identity is "<identity>"
    And FR-13 aggregate eligibility is "<eligibility>"
    When the release workflow evaluates publication
    Then the publication outcome is "<outcome>"

    Examples:
      | event          | jobs         | identity                          | eligibility | outcome     |
      | pull_request   | all passed   | matching                          | eligible    | verify-only |
      | push           | all passed   | matching                          | eligible    | verify-only |
      | tag v0.1.0     | one failed   | matching                          | blocked     | blocked     |
      | tag v0.1.0     | all passed   | version mismatch                  | blocked     | blocked     |
      | tag v0.1.0     | all passed   | digest differs from verified      | blocked     | blocked     |
      | tag v0.1.0     | all passed   | existing release different digest | eligible    | blocked     |
      | tag v0.1.0     | all passed   | matching verified digest          | blocked     | blocked     |
      | tag v0.1.0     | all passed   | matching verified digest          | eligible    | eligible    |

  @id:SCEN-refuse-readiness-without-evidence @feature11 @FR-11 @AC-11.1
  Scenario Outline: Refuse readiness claims without current evidence
    Given the proposed public claim is "<claim>"
    And supporting evidence is "<evidence>"
    When claim eligibility is evaluated
    Then public status is "<status>"

    Examples:
      | claim                    | evidence                              | status              |
      | installable              | feature text only                     | SPEC_ONLY/NOT_READY |
      | extension activated      | install and reload only               | SPEC_ONLY/NOT_READY |
      | dependency independent   | receipt from another commit           | SPEC_ONLY/NOT_READY |
      | upgradeable              | first subsequent release lacks prior-upgrade observation | SPEC_ONLY/NOT_READY |
      | releasable               | current eligible FR-13 aggregate     | eligible             |

  @id:SCEN-fail-closed-on-unsafe-contract-data @feature12 @FR-12 @AC-12.1
  Scenario Outline: Fail closed on unsafe request or public result data
    Given the inventory contract condition is "<condition>"
    When the request is validated or the result is serialized
    Then the public outcome is "<outcome>"
    And no absolute path, username, environment value, file content, credential, or stack trace is disclosed

    Examples:
      | condition                         | outcome                    |
      | unknown request property          | INVALID_REQUEST            |
      | maxSpecs above 200                | INVALID_REQUEST            |
      | unsupported schema version        | UNSUPPORTED_SCHEMA_VERSION |
      | duplicate normalized spec slug    | SPEC_DUPLICATE_SLUG        |
      | unsafe project-relative path       | PATH_ESCAPE_BLOCKED        |
      | result exceeds hard byte bounds    | LIMIT_REACHED              |
      | raw exception contains host path   | INTERNAL_ERROR_REDACTED    |

  @id:SCEN-require-complete-release-evidence @feature13 @FR-13 @AC-13.1
  Scenario Outline: Require complete candidate-aware evidence for release eligibility
    Given release candidate "<candidate>" has mandatory evidence "<evidence>"
    When aggregate release eligibility is evaluated
    Then release eligibility is "<outcome>"

    Examples:
      | candidate | evidence                                                                       | outcome  |
      | 0.1.0     | complete FR-1 through FR-12 including install invoke uninstall and reinstall | eligible |
      | 0.1.0     | complete applicable evidence with prior upgrade and rollback inapplicable      | eligible |
      | 0.1.0     | every receipt except FR-5 dependency-absent proof                              | blocked  |
      | 0.1.1     | complete FR-1 through FR-12 including upgrade and rollback                     | eligible |
      | 0.1.1     | every receipt except rollback-to-prior                                         | blocked  |
      | 0.1.1     | passing stage summaries without requirement receipts                           | blocked  |

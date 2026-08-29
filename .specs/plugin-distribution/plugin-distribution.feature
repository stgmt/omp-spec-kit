# Specification text only. No scenario in this file is claimed to have executed or passed.
@plugin-distribution @specification-only
Feature: Distribute omp-spec-kit as one proven OMP plugin
  Historical v0.1 established one marketplace, child package, extension and bounded inventory.
  Delivered v0.3.2 preserves that topology and adds one profile-gated read-only MCP/kernel first slice.

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
  Scenario Outline: Reject child package and candidate-profile violations
    Given candidate profile "<profile>" has child variant "<variant>"
    When the child manifest tree and extension paths are validated
    Then the package outcome is "<outcome>"

    Examples:
      | profile | variant                                                       | outcome  |
      | v0.1.0  | one package one extension and no MCP                           | accepted |
      | v0.3.2  | one package one extension one MCP config and two launchers      | accepted |
      | any     | a second extension package marketplace or MCP server identity   | rejected |
      | any     | nested package legacy entry source test evidence or install script | rejected |
      | v0.1.0  | an MCP declaration                                              | rejected |
      | v0.3.2  | missing MCP launcher or generated kernel adapters mcp tree       | rejected |
      | any     | an extension or launcher link escaping the package              | rejected |

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
  Scenario Outline: Distinguish reload from fresh-session candidate activation
    Given exact candidate version "<candidate>" is discovered and installed project-scope
    When installed version and reload completion are recorded in the pre-install session
    Then no activation claim exists yet
    When the pre-install session ends and a fresh OMP session starts
    And the declared installed surface is invoked
    Then activation is eligible for a receipt bound to "<candidate>"

    Examples:
      | candidate |
      | 0.1.0     |
      | 0.3.2     |

  @id:SCEN-run-clean-payload-without-ambient-dependencies @feature5 @FR-5 @AC-5.1
  Scenario Outline: Execute the clean-built candidate without ambient dependencies
    Given previous dist output is absent and profile "<profile>" is clean-built
    And candidate artifact and dist manifest digests are recorded
    And repository-root and external node_modules plus source checkout are unavailable
    When the exact artifact is installed project-scope
    Then "<surface>" executes without undeclared or ambient dependency
    And invoked bytes match the recorded artifact digest

    Examples:
      | profile | surface                              |
      | v0.1.0  | spec_inventory extension tool        |
      | v0.3.2  | extension and read-only MCP first slice |

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
      | 0.3.2     | 0.3.2 and tag v0.3.2     | accepted |

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
      | 0.3.2     | subsequent | released 0.3.0 installed          | accepted      |

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
      | 0.3.2     |

  @id:SCEN-rollback-to-prior-release-after-first-release @feature8 @FR-8 @AC-8.2
  Scenario Outline: Require rollback to an exact public prior release
    Given candidate "<candidate>" and prior "<prior>" are digest-bound public artifacts
    And project preservation hashes exist before lifecycle mutation
    When the operator performs "<operation>" and starts a fresh session
    Then the lifecycle observation is "<observation>"
    And every non-OMP-managed project hash equals baseline

    Examples:
      | candidate | prior | operation                                  | observation               |
      | 0.1.1     | 0.1.0 | explicit install of bound prior artifact   | prior version 0.1.0 invoked |
      | 0.3.2     | 0.3.0 | explicit install of bound prior artifact   | prior version 0.3.0 invoked |
      | 0.3.2     | 0.3.0 | marketplace removal or cache deletion only | insufficient as rollback  |

  @id:SCEN-block-unsafe-public-artifacts @feature9 @FR-9 @AC-9.1
  Scenario Outline: Block unsafe public artifacts
    Given public-safety input "<violation>"
    When provenance, license, secret, diff, and package gates run
    Then publication eligibility is "blocked"
    And no public artifact or release is created

    Examples:
      | violation                                      |
      | Authorization Bearer synthetic sentinel is packaged |
      | credential=synthetic sentinel is packaged      |
      | Cookie synthetic sentinel is packaged          |
      | PEM private-key synthetic sentinel is packaged |
      | known token-prefix synthetic sentinel is packaged |
      | an imported license is unknown                 |
      | a user OMP state path is packaged              |
      | an evidence or log file is packaged            |
      | the public diff contains an unapproved file    |
      | the package exceeds its positive allowlist     |

  @id:SCEN-enforce-github-release-transaction @feature10 @FR-10 @AC-10.1
  Scenario Outline: Publish only the attested immutable candidate
    Given event "<event>" has verification "<jobs>" and candidate identity "<identity>"
    And distribution trust is "<trust>"
    When the release workflow evaluates publication
    Then the publication outcome is "<outcome>"

    Examples:
      | event      | jobs       | identity                         | trust                                      | outcome     |
      | pull_request | all passed | matching                        | verifier-passing attestation               | verify-only |
      | push       | all passed | matching                          | verifier-passing attestation               | verify-only |
      | tag v0.3.2 | one failed | matching                          | verifier-passing attestation               | blocked     |
      | tag v0.3.2 | all passed | mismatched commit or digest       | verifier-passing attestation               | blocked     |
      | tag v0.3.2 | all passed | matching                          | self-authored matrix only                  | blocked     |
      | tag v0.3.2 | all passed | matching                          | wrong repo workflow ref or subject         | blocked     |
      | tag v0.3.2 | all passed | matching verified digest          | verifier-passing fixed-workflow attestation| published   |

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
      | releasable               | structurally complete self-attested FR-13 aggregate | SPEC_ONLY/NOT_READY |
      | delivered v0.3.2        | release-status receipt plus verified attestation | DELIVERED            |

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
  Scenario Outline: Distribution eligibility uses one current trust-root contract
    Given one candidate has complete FR-1 through FR-12 producer receipts
    And trust condition is "<trust>"
    When distribution-release-eligibility at 2 is evaluated
    Then distribution outcome is "<outcome>"
    And no MRI public or product delivery result is emitted

    Examples:
      | trust                                                     | outcome  |
      | self-authored workflow runId and observations             | blocked  |
      | GitHub attestation from fixed repo workflow ref and subject| eligible |
      | repository trust root is absent or derived from local git | blocked  |
      | signer workflow or source ref differs                     | blocked  |
      | gh verifier is missing times out exits nonzero or cannot spawn | blocked |
      | subject digest differs or a matrix receipt is incomplete  | blocked  |

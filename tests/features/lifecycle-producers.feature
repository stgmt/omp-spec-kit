# Lifecycle producers drive the REAL OMP runtime against a disposable
# isolated HOME/profile, then the evidence builder must ingest their raw
# outputs. No scenario in this file is claimed to have executed here; this
# text is specification only.
@lifecycle-producers @specification-only
Feature: Produce real distribution lifecycle evidence through the pinned OMP runtime
  Every release-blocking lifecycle claim is produced by driving PluginManager
  and the MCP manager from the pinned 17.3.7 runtime inside an isolated HOME,
  and every raw producer output is validated before it may enter the
  attested evidence bundle.

  Background:
    Given the pinned omp-discovery-runtime fixture and its bun-installed dependencies exist

  @id:SCEN-LC-001 @lifecycle-producers
  Scenario: Install, reload, fresh-session activation, and bounded inventory
    Given an isolated temp project containing one valid spec corpus
    And the built candidate package root and expected version 0.3.1
    When the install-reload-fresh-session lifecycle runner completes successfully
    Then the runner wrote passing records for install, reload, fresh-session-activation, and inventory
    And each record binds requirement "plugin-distribution:FR-4" to its own claim
    And the fresh-session record proves a child process observed inventory ok without enrolling
    And the reload and inventory observations report managed inventory counts

  @id:SCEN-LC-002 @lifecycle-producers @slow
  Scenario: Upgrade from the extracted v0.3.0 prior release
    Given an isolated temp project containing one valid spec corpus
    And the candidate package root with expected version 0.3.1
    And the v0.3.0 prior release extracted by build-tagged-candidate
    When the upgrade lifecycle runner completes successfully
    Then the runner wrote a passing upgrade record binding plugin-distribution:FR-7
    And the upgrade details observe version 0.3.0 in one fresh session and 0.3.1 in another

  @id:SCEN-LC-003 @lifecycle-producers
  Scenario: Uninstall preserves the project tree byte-for-byte and reinstall restores service
    Given an isolated temp project containing one valid spec corpus
    And the built candidate package root and expected version 0.3.1
    When the uninstall-reinstall lifecycle runner completes successfully
    Then the runner wrote passing records for uninstall-preservation and reinstall
    And each record binds requirement "plugin-distribution:FR-8" to its own claim
    And the uninstall record proves identical project hashes before and after uninstall
    And the reinstall record proves a fresh session observed inventory ok again

  @id:SCEN-LC-004 @lifecycle-producers @slow
  Scenario: Rollback returns the project to the prior released version
    Given an isolated temp project containing one valid spec corpus
    And the candidate package root with expected version 0.3.1
    And the v0.3.0 prior release extracted by build-tagged-candidate
    When the uninstall-reinstall lifecycle runner completes with rollback enabled
    Then the runner additionally wrote a passing rollback record binding plugin-distribution:FR-8
    And the rollback details observe version 0.3.0 after uninstalling the candidate

  @id:SCEN-LC-005 @lifecycle-producers
  Scenario: The evidence builder ingests lifecycle receipts into the bundle
    Given an isolated temp project containing one valid spec corpus
    And the lifecycle receipts directory produced by the runners above
    When create-distribution-evidence runs with --lifecycle-receipts-dir
    Then the bundle contains FR-4 records for install, reload, fresh-session-activation, and inventory claims
    And the bundle contains FR-8 uninstall-preservation and reinstall records
    And every ingested receipt carries schema omp-spec-kit-distribution-producer-receipt@1 with passed status
    And every ingested observation summary stays within 512 characters and quotes the observed proof

  @id:SCEN-LC-006 @lifecycle-producers
  Scenario: The MRI lifecycle receipt composer produces nine closed receipts
    Given an isolated temp project containing one valid spec corpus
    And the v0.3.0 prior release extracted by build-tagged-candidate
    And the lifecycle receipts directory produced by the runners above
    When the MRI lifecycle receipt composer runs against a synthetic candidate
    Then it wrote exactly the nine closed receipt files
    And each prior, upgrade, and rollback receipt carries its exact contract key set
    And each FR receipt cites its own passing release-evidence scenario id
    And the prior receipt proves the v0.3.0 public-tag source

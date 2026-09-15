@app-install
Feature: YouTrack app package for installation
  The CI-built app package satisfies the JetBrains launch checklist and is the
  single artifact operators install — via ZIP upload today, via the JetBrains
  Marketplace listing later (FR-17, TASK-16).

  Scenario: The package file set derives from the manifest
    Given the spec-graph-app source tree
    When the package file set is derived
    Then the set contains the manifest, the settings file, the http handler, and every widget index
    And the set contains no archives and no prototype files

  Scenario: The built package satisfies the JetBrains launch checklist
    Given the spec-graph-app source tree
    When the package is built into a staging directory and zip archive
    Then the zip contains manifest.json at its root
    And every widget index.html sits in its own widgets subdirectory
    And every zip path uses forward slashes
    And rebuilding produces identical zip bytes

  Scenario: The manifest passes the official JetBrains validator
    Given the spec-graph-app source tree
    When the official youtrack-app validator runs against it
    Then validation passes

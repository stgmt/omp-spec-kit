@plugin-distribution @integration
Feature: Exercise the v0.1.0 marketplace runtime through its public boundaries

  @id:SCEN-bound-inventory-to-project-root @feature3 @FR-3 @AC-3.1
  Scenario: Inventory the real corpus completely and conserve caller bounds without writes
    Given the repository root contains the actual four-spec corpus
    When the production inventory reads the real corpus with default and bounded requests
    Then the default inventory exactly describes all four canonical specifications
    And the bounded inventory returns the lexical prefix and accounts for every observed specification
    And the repository specification tree is byte-for-byte unchanged

  @id:SCEN-contain-read-only-inventory-failures @feature6 @FR-6 @AC-6.1
  Scenario Outline: Contain deterministic filesystem and cancellation failures
    Given a temporary producer for "<condition>"
    When the production inventory reads the temporary producer
    Then the exact failure result has status "<status>" and diagnostic codes "<codes>"
    And the temporary producer tree is byte-for-byte unchanged

    Examples:
      | condition                    | status  | codes                                                      |
      | .specs is absent             | absent  | SPECS_ABSENT                                               |
      | .specs is a regular file     | invalid | SPECS_NOT_DIRECTORY                                        |
      | a spec slug is invalid       | partial | SPEC_SLUG_INVALID                                          |
      | a direct spec entry is a file| partial | SPEC_ENTRY_INVALID                                         |
      | the hard spec cap is exceeded| partial | LIMIT_REACHED,SPEC_INCOMPLETE,DIAGNOSTIC_LIMIT_REACHED     |
      | the signal is pre-aborted    | aborted | REQUEST_ABORTED                                            |
      | a directory link escapes root| partial | SYMLINK_ESCAPE_BLOCKED                                     |
      | the .specs root swaps to a link | invalid | PATH_ESCAPE_BLOCKED                                       |

  @id:SCEN-fail-closed-on-unsafe-contract-data @feature12 @FR-12 @AC-12.1
  Scenario Outline: Reject malformed requests without weakening the public result contract
    Given the repository root contains the actual four-spec corpus
    When the production inventory receives "<request>"
    Then the invalid result exactly reports "<code>" for "<message>"
    And the repository specification tree is byte-for-byte unchanged

    Examples:
      | request                        | code                       | message                                      |
      | null                           | INVALID_REQUEST            | Request must be an object.                   |
      | an unknown property            | INVALID_REQUEST            | Request contains unsupported properties.    |
      | schema version 2               | UNSUPPORTED_SCHEMA_VERSION | Only schema version 1 is supported.          |
      | maxSpecs zero                  | INVALID_REQUEST            | maxSpecs is below its bound.                 |
      | maxSpecs above the hard cap    | INVALID_REQUEST            | maxSpecs is above its bound.                 |
      | maxDiagnostics above hard cap  | INVALID_REQUEST            | maxDiagnostics is above its bound.           |
      | a non-boolean document flag    | INVALID_REQUEST            | includeDocumentCounts has the wrong type.    |

  @id:SCEN-run-clean-payload-without-ambient-dependencies @feature5 @FR-5 @AC-5.1
  Scenario: Register and execute the one read-approved tool from the verified built extension
    Given both real distribution verifiers accept the built package
    And a host implementing the OMP zod chain loads the built extension
    When the registered tool executes against the repository context while process cwd differs
    Then exactly one read-approved inventory tool was registered with the strict public schema
    And its content and structured details exactly describe the real four-spec corpus
    And the repository specification tree is byte-for-byte unchanged

Feature: Bring up a usable local spec stack

  @story:US-1
  Rule: Run the setup skill from a clean host
    Actor: Local stack operator
    Goal: Bring up the registry, app and board with one setup command
    Benefit: Open a usable board without configuring each service manually
    Covers: FR-1, FR-2, FR-3, FR-4, NFR-PORT-1, NFR-IDEM-2
    Outcome: services | The services and registry respond
    ScenarioRef: services | SCEN-bring-up-clean-host
    Outcome: portable-windows | The setup runs on windows
    ScenarioRef: portable-windows | SCEN-setup-platform#windows
    Outcome: portable-macos | The setup runs on macos
    ScenarioRef: portable-macos | SCEN-setup-platform#macos
    Outcome: portable-linux | The setup runs on linux
    ScenarioRef: portable-linux | SCEN-setup-platform#linux
    Outcome: repeatable | Rerunning setup keeps one copy of the demo entities
    ScenarioRef: repeatable | SCEN-setup-repeated

    @feature1 @FR-1 @AC-1.1 @id:SCEN-bring-up-clean-host
    Scenario: Первый запуск на чистой машине
      Given Docker запущен и репозиторий склонирован
      When агент выполняет node skills/spec-stack-setup/setup.mjs
      Then все три контейнера подняты и YouTrack отвечает на :8089
      And реестр отвечает на :8644/mcp

    @id:SCEN-setup-platform
    Scenario Outline: The same setup entry point works on each supported platform
      Given Docker Compose v2 and Node 22 are available on <platform>
      When the operator runs the Node setup entry point
      Then setup reaches the same healthy local service state
      And the operator uses no platform-specific setup script

      Examples:
        | example_id | platform |
        | windows    | Windows  |
        | macos      | macOS    |
        | linux      | Linux    |

    @id:SCEN-setup-repeated
    Scenario: Rerunning setup keeps the demo stack consistent
      Given an operational stack with the demo groups, project and dashboard
      When the operator runs setup again with the same configuration
      Then the project and group identities stay the same
      And exactly one demo dashboard displays the current specification

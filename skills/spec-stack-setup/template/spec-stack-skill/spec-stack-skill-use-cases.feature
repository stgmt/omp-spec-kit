Feature: Provision the demo app, board and specification

  @case:UC-1 @story:US-1
  Rule: Configure the running services and load the demonstration
    Actor: Local stack operator
    Boundary: Setup skill, YouTrack administration API and registry MCP
    Trigger: The service health checks pass
    Precondition: The administrator and registry are configured
    Success: The installed board shows the registry-backed demo specification
    Covers: FR-2, FR-3, FR-4
    Step: install | Install and configure the app for DEMO
    Step: load | Write the template documents through registry MCP
    Step: open | Open the reported dashboard
    Branch: app | install | App installation completes | DEMO is connected to the app | load
    ScenarioRef: app | SCEN-admin-installs-app
    Branch: seed | load | The registry accepts the complete template | The template documents are committed by the registry | open
    ScenarioRef: seed | SCEN-demo-spec-loaded
    Branch: board | open | The administrator opens the reported link | The full-width board shows the seeded spec | end
    ScenarioRef: board | SCEN-dashboard-link-ready

    @feature2 @FR-2 @AC-2.1 @id:SCEN-admin-installs-app
    Scenario: Приложение ставится без участия пользователя
      Given стек поднят и визард пройден
      When фаза установки приложения завершилась
      Then spec-graph-app виден в списке Apps с применёнными настройками
      And приложение привязано к проекту DEMO

    @feature3 @FR-3 @AC-3.1 @id:SCEN-dashboard-link-ready
    Scenario: Ссылка на дашборд с готовой спекой
      Given прогон setup.mjs завершён
      When админ открывает напечатанную ссылку
      Then дашборд Spec Stack показывает Spec Board во всю ширину
      And на доске видна спека spec-stack-skill со всеми итемами

    @feature4 @AC-4.1 @id:SCEN-demo-spec-loaded
    Scenario: Setup seeds the demo through registry MCP
      Given the registry is reachable and the demo project is configured
      When the operator runs the template loader
      Then spec_catalog includes spec-stack-skill
      And the registry commits its user story and use case files with the template documents

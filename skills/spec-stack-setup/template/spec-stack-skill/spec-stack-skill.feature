Feature: spec-stack-setup доводит локальный стек до рабочего состояния
  Скилл поднимает docker-compose контур, настраивает приложение под админом,
  загружает шаблонную спеку через MCP и печатает рабочую ссылку на дашборд.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-bring-up-clean-host
  Scenario: Первый запуск на чистой машине
    Given Docker запущен и репозиторий склонирован
    When агент выполняет node skills/spec-stack-setup/setup.mjs
    Then все три контейнера подняты и YouTrack отвечает на :8089
    And реестр отвечает на :8644/mcp

  @feature2 @FR-2 @AC-1.2 @id:SCEN-admin-installs-app
  Scenario: Приложение ставится без участия пользователя
    Given стек поднят и визард пройден
    When фаза установки приложения завершилась
    Then spec-graph-app виден в списке Apps с применёнными настройками
    And приложение привязано к проекту DEMO

  @feature3 @FR-3 @FR-4 @AC-1.3 @id:SCEN-dashboard-link-ready
  Scenario: Ссылка на дашборд с готовой спекой
    Given прогон setup.mjs завершён
    When админ открывает напечатанную ссылку
    Then дашборд Spec Stack показывает Spec Board во всю ширину
    And на доске видна спека spec-stack-skill со всеми итемами

# Superseded forensic note

Этот файл **не является надежным отчетом** и заменен файлом:

- [`legacy-dev-pomogator-cutover-2026-08-30.md`](legacy-dev-pomogator-cutover-2026-08-30.md)

В старой версии были неподтвержденные или неверные утверждения о `target-specs-maintenance`, `E:/repos/omp-spec-kit/.omp/mcp.json`, `SPECS_GENERATOR_ROOT` и identity hash. В текущей проверке подтверждены другие реальные поверхности:

- native MCP: `E:/repos/omp-spec-kit/plugins/omp-spec-kit/.mcp.json`, server `omp-spec-kit`;
- legacy OMP plugin: `C:/Users/stigm/.omp/plugins/node_modules/dev-pomogator` и user OMP lock;
- legacy Claude-compatible registration: `C:/Users/stigm/.claude/plugins/installed_plugins.json`, id `dev-pomogator@stgmt`.

Временные snapshot-файлы прежнего аудита больше не существуют, поэтому их hash-связки не используются как evidence.

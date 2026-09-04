import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TOOL_CONTRACTS,
  KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  MCP_SERVER_INSTRUCTIONS,
  annotationsFor,
  jsonSchemaFor,
} from "../src/adapters/tool-contracts.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repositoryRoot, "docs", "mcp-tools.html");

if (TOOL_CONTRACTS.length !== 10) {
  throw new Error(`Expected 10 MCP contracts, received ${TOOL_CONTRACTS.length}`);
}

const catalog = {
  generatedFrom: "src/adapters/tool-contracts.js",
  toolCount: TOOL_CONTRACTS.length,
  instructions: MCP_SERVER_INSTRUCTIONS,
  outputSchema: KERNEL_ENVELOPE_OUTPUT_SCHEMA,
  tools: TOOL_CONTRACTS.map((contract) => ({
    tool: contract.tool,
    label: contract.label,
    operation: contract.operation,
    description: contract.description,
    discriminator: contract.discriminator ?? null,
    commonFields: contract.commonFields ?? null,
    variants: contract.variants ?? null,
    fields: contract.fields ?? null,
    inputSchema: jsonSchemaFor(contract),
    annotations: annotationsFor(contract),
  })),
};

const embeddedCatalog = JSON.stringify(catalog)
  .replaceAll("<", "\\u003c")
  .replaceAll(">", "\\u003e")
  .replaceAll("&", "\\u0026");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OMP Spec Kit · MCP Tool Contracts</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111827;
      --panel: #172033;
      --panel-2: #1d2940;
      --line: #34435e;
      --text: #e8eef8;
      --muted: #a7b4c9;
      --blue: #67b7ff;
      --blue-2: #173c60;
      --green: #60d394;
      --amber: #f6c85f;
      --red: #ff8a8a;
      --shadow: 0 18px 45px rgba(0, 0, 0, .22);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: linear-gradient(135deg, #0f1726 0%, var(--bg) 48%, #101827 100%);
      color: var(--text);
      font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    code, pre, .tool-name, .operation, .schema-type { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; }
    a { color: var(--blue); }
    button, input, select { font: inherit; }
    button, select, input {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #101827;
      color: var(--text);
    }
    button { cursor: pointer; padding: 8px 11px; }
    button:hover { border-color: var(--blue); color: #fff; }
    .hero {
      padding: 42px max(24px, calc((100vw - 1420px) / 2));
      border-bottom: 1px solid var(--line);
      background: radial-gradient(circle at 15% 0%, #1c4d78 0, transparent 42%), linear-gradient(115deg, #16273e, #111827 65%);
    }
    .eyebrow { color: var(--blue); font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 10px 0 8px; font-size: clamp(32px, 5vw, 58px); line-height: 1.04; letter-spacing: -.04em; }
    .hero p { max-width: 830px; margin: 0; color: var(--muted); font-size: 16px; }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px; }
    .stat { padding: 9px 13px; border: 1px solid var(--line); border-radius: 9px; background: rgba(9, 16, 29, .4); color: var(--muted); }
    .stat strong { color: var(--text); font-size: 17px; }
    .layout { display: grid; grid-template-columns: 285px minmax(0, 1fr); gap: 28px; max-width: 1420px; margin: 0 auto; padding: 28px 24px 70px; }
    .sidebar { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; }
    .sidebar h2 { margin: 0 0 10px; font-size: 14px; }
    .controls { display: grid; gap: 9px; margin-bottom: 14px; }
    .controls input, .controls select { width: 100%; padding: 9px 10px; }
    .nav-list { display: grid; gap: 3px; }
    .nav-item { display: flex; align-items: baseline; gap: 7px; width: 100%; padding: 6px 8px; border: 0; border-left: 2px solid transparent; border-radius: 4px; background: transparent; color: var(--muted); text-align: left; }
    .nav-item:hover, .nav-item.active { border-left-color: var(--blue); background: var(--blue-2); color: var(--text); }
    .nav-item small { overflow: hidden; color: #7890ac; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .content { min-width: 0; }
    .notice, .envelope, .tool-card { border: 1px solid var(--line); border-radius: 13px; background: linear-gradient(145deg, rgba(29, 41, 64, .95), rgba(22, 32, 51, .95)); box-shadow: var(--shadow); }
    .notice, .envelope { margin-bottom: 22px; padding: 20px 22px; }
    .notice h2, .envelope h2 { margin: 0 0 8px; font-size: 17px; }
    .notice p { margin: 7px 0; color: var(--muted); }
    .instructions { margin: 12px 0 0; padding: 13px 15px; border-left: 3px solid var(--blue); background: rgba(10, 19, 34, .75); color: #d8e7f8; }
    .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 15px; margin: 30px 0 12px; }
    .section-heading h2 { margin: 0; font-size: 23px; }
    .section-heading span { color: var(--muted); }
    .tool-card { margin: 0 0 14px; overflow: hidden; scroll-margin-top: 18px; }
    .tool-card[hidden] { display: none; }
    .tool-summary { display: flex; align-items: center; gap: 13px; padding: 17px 19px; cursor: pointer; list-style: none; }
    .tool-summary::-webkit-details-marker { display: none; }
    .tool-summary::before { content: "›"; width: 18px; color: var(--blue); font-size: 24px; line-height: 1; transition: transform .15s ease; }
    details[open] > .tool-summary::before { transform: rotate(90deg); }
    .tool-title { min-width: 0; flex: 1; }
    .tool-title strong { display: block; font-size: 16px; }
    .tool-name { color: var(--blue); font-size: 12px; }
    .operation { color: var(--muted); font-size: 12px; }
    .badges { display: flex; flex-wrap: wrap; justify-content: end; gap: 5px; }
    .badge { padding: 3px 7px; border-radius: 999px; background: #263750; color: var(--muted); font-size: 11px; white-space: nowrap; }
    .badge.safe { background: rgba(32, 103, 74, .35); color: var(--green); }
    .badge.warn { background: rgba(115, 82, 26, .38); color: var(--amber); }
    .badge.danger { background: rgba(120, 38, 46, .4); color: var(--red); }
    .tool-body { padding: 0 21px 22px 50px; }
    .purpose { margin: 0 0 17px; color: #d8e1ee; font-size: 15px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(310px, .85fr); gap: 18px; }
    .subsection h3 { margin: 0 0 8px; color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    .variant-card { margin-bottom: 14px; padding: 12px 14px; border: 1px solid #2b3953; border-radius: 8px; background: rgba(13, 21, 35, .6); }
    .variant-card h4 { margin: 0 0 6px; font-size: 14px; color: var(--blue); display: flex; justify-content: space-between; }
    .variant-card p { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #2b3953; vertical-align: top; text-align: left; }
    th { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
    td code { color: #d5e8ff; }
    .schema-type { color: var(--blue); font-size: 12px; }
    .enum { margin-top: 3px; color: #9fb4cc; font-size: 11px; word-break: break-word; }
    pre { max-height: 410px; overflow: auto; margin: 0; padding: 11px; border: 1px solid #2b3953; border-radius: 8px; background: #0d1523; color: #cfe3fa; font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
    .code-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
    .copy { padding: 4px 7px; color: var(--muted); font-size: 11px; }
    .annotation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; padding: 0; list-style: none; }
    .annotation-list li { padding: 7px 9px; border: 1px solid #2b3953; border-radius: 7px; color: var(--muted); font-size: 12px; }
    .annotation-list b { color: var(--text); }
    .empty { padding: 28px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); text-align: center; }
    .footer { margin-top: 26px; color: #8191a8; font-size: 12px; }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; max-height: none; }
      .nav-list { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
    }
    @media (max-width: 700px) {
      .hero { padding: 30px 18px; }
      .layout { padding: 20px 14px 50px; }
      .tool-summary { align-items: start; flex-wrap: wrap; }
      .badges { justify-content: start; width: 100%; padding-left: 31px; }
      .tool-body { padding-left: 20px; }
      .grid { grid-template-columns: 1fr; }
      .annotation-list { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="eyebrow">OMP Spec Kit · MCP reference</div>
    <h1>10 MCP tool contracts</h1>
    <p>Человекочитаемый каталог ровно тех 10 инструментов, которые публикуются сервером v0.10.1. Откройте карточку, чтобы увидеть назначение, варианты ветвления, параметры, машинные метки, примеры аргументов и точную JSON-схему.</p>
    <div class="stats">
      <div class="stat"><strong id="tool-count">10</strong><br>инструментов</div>
      <div class="stat"><strong id="read-count">9</strong><br>без записи</div>
      <div class="stat"><strong id="mutating-count">1</strong><br>изменяющий</div>
      <div class="stat"><strong>200</strong><br>максимум первой строки описания</div>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar" aria-label="Навигация по инструментам">
      <h2>Инструменты</h2>
      <div class="controls">
        <input id="search" type="search" placeholder="Поиск по имени и описанию…" aria-label="Поиск инструментов">
        <select id="kind" aria-label="Фильтр по типу">
          <option value="all">Все инструменты</option>
          <option value="read">Только чтение</option>
          <option value="mutating">Изменяющий</option>
        </select>
        <div>
          <button id="expand" type="button">Раскрыть все</button>
          <button id="collapse" type="button">Свернуть все</button>
        </div>
      </div>
      <nav id="tool-nav" class="nav-list"></nav>
    </aside>

    <main class="content">
      <section class="notice">
        <h2>Как читать каталог</h2>
        <p><b>Назначение</b> — краткое объяснение задачи инструмента. <b>Дискриминатор ветки</b> — параметр выбора варианта запроса (<code>view</code>, <code>mode</code>, <code>action</code>, <code>check</code>, <code>intent</code>). <b>Варианты</b> — обязательные и опциональные аргументы конкретной ветки с минимальным JSON-примером.</p>
        <p><b>Машинные метки</b>: ровно 9 инструментов безопасны для чтения; единственная операция изменения состояния — <code>spec_patch</code>.</p>
        <div class="instructions"><b>Инструкция сервера MCP</b><br><span id="instructions"></span></div>
      </section>

      <section class="envelope">
        <h2>Общий ответ MCP</h2>
        <p>Каждый вызов возвращает канонический конверт ядра. Текстовый блок и <code>structuredContent</code> содержат байт-идентичный JSON.</p>
        <div class="code-head"><span class="schema-type">outputSchema · kernel envelope</span><button class="copy" type="button" data-copy="output-schema">Копировать JSON</button></div>
        <pre id="output-schema"></pre>
      </section>

      <div class="section-heading">
        <h2>Tool reference</h2>
        <span id="visible-count"></span>
      </div>
      <section id="tool-list" aria-label="Список контрактов"></section>
      <div id="empty" class="empty" hidden>Ничего не найдено. Измените поиск или фильтр.</div>
      <div class="footer">Источник данных: <code>src/adapters/tool-contracts.js</code>. Страница создаётся командой <code>npm run docs:mcp</code>; внешние библиотеки и сеть не нужны.</div>
    </main>
  </div>

  <script>
    window.__MCP_CATALOG__ = ${embeddedCatalog};
    (() => {
      const catalog = window.__MCP_CATALOG__;
      const toolList = document.getElementById('tool-list');
      const toolNav = document.getElementById('tool-nav');
      const search = document.getElementById('search');
      const kind = document.getElementById('kind');
      const visibleCount = document.getElementById('visible-count');
      const empty = document.getElementById('empty');
      const outputSchema = document.getElementById('output-schema');
      const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      const pretty = (value) => JSON.stringify(value, null, 2);
      const isMutating = (tool) => tool.annotations.destructiveHint;
      const schemaType = (schema) => Array.isArray(schema?.type) ? schema.type.join(' | ') : (schema?.type || 'any');

      const fieldExampleValue = (f) => {
        if (f.name === 'spec' || f.name === 'specSlug') return 'plugin-distribution';
        if (f.name === 'specSlugs') return ['plugin-distribution'];
        if (f.name === 'canonicalId') return 'plugin-distribution:FR-1';
        if (f.name === 'canonicalIds') return ['plugin-distribution:FR-1'];
        if (f.name === 'scenarioId') return 'SCEN-mri-active-project-root';
        if (f.name === 'doc') return 'FR.md';
        if (f.name === 'newDoc') return 'NEW.md';
        if (f.name === 'path') return 'FR.md';
        if (f.name === 'paths') return ['FR.md'];
        if (f.name === 'anchor') return 'plugin-distribution:FR-1';
        if (f.name === 'requirement') return 'FR-1';
        if (f.name === 'entity') return 'TASK-1';
        if (f.name === 'reason') return 'reviewed change';
        if (f.name === 'requestId') return 'req-001';
        if (f.name === 'proposalId') return '0'.repeat(64);
        if (f.name === 'proposalSha256') return '0'.repeat(64);
        if (f.name === 'repositoryRootFingerprint') return '0'.repeat(64);
        if (f.name === 'approval') return 'approve';
        if (f.name === 'expectedDocuments') return [{ path: '.specs/plugin-distribution/FR.md', beforeSha256: '0'.repeat(64) }];
        if (f.name === 'operations') return [{ kind: 'insert_at_eof', document: 'FR.md', text: 'note' }];
        if (f.name === 'tags') return ['@feature1'];
        if (f.name === 'kinds') return ['FUNCTIONAL_REQUIREMENT'];
        if (f.name === 'types') return ['REFS'];
        if (f.name === 'statuses') return ['todo'];
        if (f.name === 'status') return 'todo';
        if (f.name === 'statusView') return 'summary';
        if (f.name === 'metadata' || f.name === 'requirements') return {};
        if (f.name === 'title' || f.name === 'summary' || f.name === 'text' || f.name === 'body' || f.name === 'criterion') return 'sample text';
        if (f.kind === 'boolean') return false;
        if (f.kind === 'integer') return f.name === 'maxDepth' ? 2 : 10;
        if (f.kind === 'enum' && f.values?.length) return f.values[0];
        if (f.kind === 'enumArray') return [];
        if (f.kind === 'stringArray') return [];
        return 'example';
      };

      const annotationText = {
        readOnlyHint: ['readOnlyHint', 'не меняет корпус'],
        destructiveHint: ['destructiveHint', 'может изменить файлы спецификаций'],
        idempotentHint: ['idempotentHint', 'повторный вызов безопасен'],
        openWorldHint: ['openWorldHint', 'работает локально в репозитории']
      };

      const renderTool = (tool) => {
        let bodyContent = '';
        if (tool.discriminator && tool.variants) {
          const disc = tool.discriminator;
          const variantKeys = Object.keys(tool.variants);
          const variantCards = variantKeys.map((vName) => {
            const v = tool.variants[vName];
            const allFields = [...(tool.commonFields ?? []), ...(v.fields ?? [])];
            const reqFields = allFields.filter((f) => !f.optional);
            const optFields = allFields.filter((f) => f.optional);

            const example = { [disc]: vName };
            allFields.forEach((f) => {
              if (!f.optional || f.name === 'spec') example[f.name] = fieldExampleValue(f);
            });

            const rows = allFields.map((f) => {
              const opt = f.optional ? 'нет' : '<b>да</b>';
              const typeDesc = f.values?.length ? f.kind + ' (' + f.values.join(', ') + ')' : f.kind;
              return '<tr><td><code>' + esc(f.name) + '</code></td><td>' + opt + '</td><td><span class="schema-type">' + esc(typeDesc) + '</span></td></tr>';
            }).join('');

            return '<div class="variant-card">' +
              '<h4><span>' + esc(disc) + ' = "' + esc(vName) + '"</span><span class="schema-type">' + (reqFields.length + 1) + ' обяз.</span></h4>' +
              '<p>' + esc(v.description) + '</p>' +
              '<table><thead><tr><th>Поле</th><th>Обяз.</th><th>Тип</th></tr></thead><tbody>' +
              '<tr><td><code>' + esc(disc) + '</code></td><td><b>да</b></td><td><code>"' + esc(vName) + '"</code></td></tr>' +
              (rows || '') +
              '</tbody></table>' +
              '<div class="code-head" style="margin-top:6px"><span>Пример ветки</span><button class="copy" type="button" data-copy="ex-' + esc(tool.tool) + '-' + esc(vName) + '">Копировать</button></div>' +
              '<pre id="ex-' + esc(tool.tool) + '-' + esc(vName) + '">' + esc(pretty(example)) + '</pre>' +
              '</div>';
          }).join('');

          bodyContent = '<div class="subsection"><h3>Дискриминатор ветки: <code>' + esc(disc) + '</code> (' + variantKeys.length + ' вариантов)</h3>' + variantCards + '</div>';
        } else {
          const fields = (tool.fields ?? []).map((f) => {
            const opt = f.optional ? 'нет' : '<b>да</b>';
            const typeDesc = f.values?.length ? f.kind + ' (' + f.values.join(', ') + ')' : f.kind;
            return '<tr><td><code>' + esc(f.name) + '</code></td><td>' + opt + '</td><td><span class="schema-type">' + esc(typeDesc) + '</span></td></tr>';
          }).join('');

          const example = {};
          (tool.fields ?? []).forEach((f) => {
            if (!f.optional) example[f.name] = fieldExampleValue(f);
          });

          bodyContent = '<div class="grid"><div class="subsection"><h3>Параметры запроса</h3><table><thead><tr><th>Имя</th><th>Обяз.</th><th>Тип</th></tr></thead><tbody>' +
            (fields || '<tr><td colspan="3"><span class="schema-type">Нет параметров.</span></td></tr>') +
            '</tbody></table></div>' +
            '<div class="subsection"><div class="code-head"><h3>Минимальный пример</h3><button class="copy" type="button" data-copy="ex-' + esc(tool.tool) + '">Копировать</button></div><pre id="ex-' + esc(tool.tool) + '">' + esc(pretty(example)) + '</pre></div></div>';
        }

        const annotationItems = Object.keys(annotationText).map((key) => '<li><b>' + esc(annotationText[key][0]) + '</b><br>' + esc(annotationText[key][1]) + '</li>').join('');
        const badgeCount = tool.discriminator ? Object.keys(tool.variants).length + ' веток' : (tool.fields?.length ?? 0) + ' параметров';
        const badges = [
          '<span class="badge ' + (isMutating(tool) ? 'danger' : 'safe') + '">' + (isMutating(tool) ? 'изменяет' : 'только чтение') + '</span>',
          '<span class="badge">' + (tool.annotations.idempotentHint ? 'идемпотентный' : 'неидемпотентный') + '</span>',
          '<span class="badge">' + badgeCount + '</span>'
        ].join('');

        const searchIndex = [tool.tool, tool.label, tool.operation, tool.description, tool.discriminator ?? '', Object.keys(tool.variants ?? {}).join(' ')].join(' ');

        return '<details class="tool-card" id="tool-' + esc(tool.tool) + '" data-search="' + esc(searchIndex) + '" data-kind="' + (isMutating(tool) ? 'mutating' : 'read') + '">' +
          '<summary class="tool-summary"><div class="tool-title"><strong>' + esc(tool.label) + '</strong><span class="tool-name">' + esc(tool.tool) + '</span> · <span class="operation">' + esc(tool.operation) + '</span></div><div class="badges">' + badges + '</div></summary>' +
          '<div class="tool-body"><p class="purpose">' + esc(tool.description) + '</p>' +
          '<div class="subsection"><h3>Машинные метки</h3><ul class="annotation-list">' + annotationItems + '</ul></div>' +
          '<div style="margin-top:16px">' + bodyContent + '</div>' +
          '<div class="subsection" style="margin-top:16px"><div class="code-head"><h3>Полная JSON-схема запроса</h3><button class="copy" type="button" data-copy="schema-' + esc(tool.tool) + '">Копировать</button></div><pre id="schema-' + esc(tool.tool) + '">' + esc(pretty(tool.inputSchema)) + '</pre></div>' +
          '</div></details>';
      };

      catalog.tools.forEach((tool) => {
        toolList.insertAdjacentHTML('beforeend', renderTool(tool));
        toolNav.insertAdjacentHTML('beforeend', '<button class="nav-item" type="button" data-target="tool-' + esc(tool.tool) + '"><span>' + esc(tool.tool) + '</span><small>' + esc(tool.operation) + '</small></button>');
      });

      outputSchema.textContent = pretty(catalog.outputSchema);
      document.getElementById('instructions').textContent = catalog.instructions;
      document.getElementById('tool-count').textContent = catalog.tools.length;
      document.getElementById('read-count').textContent = catalog.tools.filter((tool) => !isMutating(tool)).length;
      document.getElementById('mutating-count').textContent = catalog.tools.filter(isMutating).length;

      const cards = [...document.querySelectorAll('.tool-card')];
      const filter = () => {
        const query = search.value.trim().toLowerCase();
        const selected = kind.value;
        let count = 0;
        cards.forEach((card) => {
          const matches = (!query || card.dataset.search.toLowerCase().includes(query)) && (selected === 'all' || card.dataset.kind === selected);
          card.hidden = !matches;
          if (matches) count += 1;
        });
        visibleCount.textContent = count + ' из ' + cards.length;
        empty.hidden = count !== 0;
        document.querySelectorAll('.nav-item').forEach((item) => { item.hidden = !document.getElementById(item.dataset.target) || document.getElementById(item.dataset.target).hidden; });
      };

      search.addEventListener('input', filter);
      kind.addEventListener('change', filter);
      document.getElementById('expand').addEventListener('click', () => cards.filter((card) => !card.hidden).forEach((card) => { card.open = true; }));
      document.getElementById('collapse').addEventListener('click', () => cards.forEach((card) => { card.open = false; }));
      document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => document.getElementById(item.dataset.target).scrollIntoView({ block: 'start' })));
      document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
        const target = document.getElementById(button.dataset.copy);
        await navigator.clipboard.writeText(target.textContent);
        const original = button.textContent;
        button.textContent = 'Скопировано';
        setTimeout(() => { button.textContent = original; }, 1100);
      }));
      filter();
    })();
  </script>
</body>
</html>
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Generated ${path.relative(repositoryRoot, outputPath)} from ${TOOL_CONTRACTS.length} MCP contracts.`);

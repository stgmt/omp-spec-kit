# Structured task comments

Status: DRAFT

## FR-1 — spec_tasks отдаёт комментарии массивом

При `includeComments: true` выдача `spec_tasks` содержит для каждой задачи поле `comments` — массив объектов `{actor, text, at}`, а не только текст в `body`. Порядок — по времени создания, пустой массив при отсутствии комментариев.

# File Changes

## FC-1: Guard internal URI allowlist

Action: edit
Planned: yes
Paths: src/enforcement/resolve-targets.js

Add the remaining OMP internal URI schemes, at least `proc` and `out`, to `OMP_INTERNAL_URI_SCHEMES`, so an internal URI is never resolved as a filesystem target.

## FC-2: Local preflight report

Action: edit
Planned: yes
Paths: src/adapters/document-service.js

Extend the preflight payload with transport, project source, resolvable root, registry reachability, guard mode, writability and one next action.

## FC-3: Root context and project source

Action: edit
Planned: yes
Paths: src/adapters/query-service.js

Report the resolved root and its mode, including the local mode, and carry the project source into every response envelope.

## FC-4: Hosted preflight probe

Action: edit
Planned: yes
Paths: src/service/index.js

Attach the registry probe result to the hosted preflight payload without failing the call when the registry does not answer.

## FC-5: Project resolution outcomes

Action: edit
Planned: yes
Paths: src/service/scope.js

Introduce the local outcome and make every refusal list the offending project, the available projects and one next action.

## FC-6: Local mode BDD and unit surface

Action: create
Planned: yes
Paths: tests/local-mode.test.mjs

Unit and step coverage for local resolution, the preflight fields, the probe bound and the internal URI allowlist.

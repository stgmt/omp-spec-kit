# Contributing

`omp-spec-kit` is currently a specification-only repository. There is no installable plugin yet.

## Before proposing a change

1. Identify the user-visible contract and the roadmap stage it belongs to.
2. Check `MIGRATION_MATRIX.md`; do not silently promote DEFER or DROP material.
3. Separate standalone OMP behavior from dev-pomogator, Claude Code, advisor, hook, backlog, dashboard, release, and local-state assumptions.
4. Update provenance whenever imported bytes or source decisions change.
5. Follow `SECURITY.md`; never include secrets, state, logs, caches, test evidence, or unclear-license material.

## Specification-first change shape

A contribution should explain:

- the problem and user;
- the bounded behavior and failure behavior;
- acceptance evidence that would distinguish implemented from merely documented;
- affected release stage;
- security, persistence, and compatibility impact;
- why the change belongs inside the single `omp-spec-kit` plugin boundary.

Do not create a marketplace catalog or plugin payload before the v0.1.0 gate is intentionally started. Do not add a second plugin, extension control plane, or copied dev-pomogator runtime.

## Local verification

```bash
npm ci
npm run build          # regenerates plugins/omp-spec-kit/dist (verify-package fails when it is stale)
npm run verify         # hermetic: code gates only, no corpus and no network
npm test               # build + verify + dogfood + BDD suites + unit
```

Two prerequisites are not covered by `npm ci`:

- **OMP runtime fixture** — `test:safe-authoring` (and therefore `npm test`) drives a real OMP
  manager against `tests/fixtures/omp-discovery-runtime`, which needs its own dependencies:
  `cd tests/fixtures/omp-discovery-runtime && bun install --frozen-lockfile --ignore-scripts --no-progress`.
  The suite fails fast with that instruction when the fixture is missing.
- **Registry endpoint** — `npm run check:corpus:remote` verifies the live corpus through the spec
  registry and needs a running stack plus a token (`OMP_SPEC_REGISTRY_URL`,
  `OMP_SPEC_REGISTRY_TOKEN` or `OMP_SPEC_REGISTRY_TOKEN_FILE`). It is not part of `npm run verify`:
  the canonical corpus is served by the registry, never read from a checkout.

## Imported snapshot

Files under `docs/upstream/dev-pomogator/spec-generator-v4/` are immutable provenance references. Do not edit them in place. A source update requires a new immutable commit decision, regenerated per-file hashes, byte comparison against Git object data, a reviewed migration-matrix delta, and resolved redistribution rights.

New repository-owned contributions are accepted under the root MIT license. Imported material retains the license status recorded in `IMPORT_MANIFEST.yaml`; the root license does not override an upstream evidence gap.

## Review expectations

Reviews should reject claims of readiness without behavioral evidence, mutable documentation references used as release authority, hidden writes or state, unbounded query output, and changes that mix later authoring/mutation into the read-only early stages.

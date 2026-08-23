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

## Imported snapshot

Files under `docs/upstream/dev-pomogator/spec-generator-v4/` are immutable provenance references. Do not edit them in place. A source update requires a new immutable commit decision, regenerated per-file hashes, byte comparison against Git object data, a reviewed migration-matrix delta, and resolved redistribution rights.

New repository-owned contributions are accepted under the root MIT license. Imported material retains the license status recorded in `IMPORT_MANIFEST.yaml`; the root license does not override an upstream evidence gap.

## Review expectations

Reviews should reject claims of readiness without behavioral evidence, mutable documentation references used as release authority, hidden writes or state, unbounded query output, and changes that mix later authoring/mutation into the read-only early stages.

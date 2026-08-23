# Fixture Contract

Fixtures described here are planned inputs, not present execution evidence.

## Provenance requirements

Every fixture SHALL record producer/source, immutable version or commit, capture command/process, retained bytes, trimming rationale, expected ground truth, SHA-256, license disposition, and safety review. Real OMP output is captured from the pinned release; it is not hand-invented to fit a parser. Secret-scanner canaries are synthetic, clearly designated, never packaged, and cannot whitelist arbitrary matching files.

## Fixture matrix

| Fixture | Planned path | Ground truth |
|---|---|---|
| Valid minimal project | `tests/fixtures/distribution/valid-project/` | One safe `.specs/sample` directory; lexical result; no semantic-ready claim. |
| No specs | `tests/fixtures/distribution/absent-project/` | `.specs` absent; `status=absent`, `SPECS_ABSENT`, zero writes. |
| Non-directory specs | `tests/fixtures/distribution/not-directory-project/.specs` | Regular file; `status=invalid`, `SPECS_NOT_DIRECTORY`. |
| Malformed spec | `tests/fixtures/distribution/malformed-project/` | Direct spec directory with malformed/incomplete canonical documents; bounded invalid/incomplete result. |
| Excess corpus | `tests/fixtures/distribution/excess-project/` | More than 200 eligible entries and 100 diagnostics; deterministic truncation. |
| Unsafe link | `tests/fixtures/distribution/link-escape-project/` | Link from `.specs` to outside fixture root; no traversal, `SYMLINK_ESCAPE_BLOCKED`. |
| Unreadable entry | `tests/fixtures/distribution/unreadable-project/` | Platform-supported access denial; typed permission/unreadable diagnostic and session continuity. |
| Preservation sentinel | `tests/fixtures/distribution/preservation-project/` | Recorded hashes for all non-OMP-managed project files before/after every lifecycle step. |
| Prior release | CI-downloaded immutable public `v<previous>` asset | Required only beginning with the first subsequent release; actual lower release, not a locally relabeled candidate; upgrade/rollback authority. |
| OMP lifecycle output | CI evidence workspace | Real add/discover/install/list/reload/fresh-session/invoke/uninstall/reinstall outputs for `0.1.0`; subsequent releases also capture upgrade/rollback; all redacted and bound to OMP pin. |
| Secret canary | `tests/fixtures/distribution/secret-scan-canary.txt` | Designated fake token trips the scanner while remaining excluded from artifact. |
| Duplicate topology variants | Generated in isolated copy | Second catalog/plugin/extension/nested package variants each fail the intended gate. |

## Isolation contract

The distribution fixture SHALL:

- pin the exact OMP version plus image/commit digest;
- create disposable project and OMP user data roots;
- start without user plugins, credentials, profiles, caches, or host marketplace state;
- deny or observe network/process/model/write behavior for inventory execution;
- make repository-root `node_modules` and source checkout unavailable for dependency proof;
- install the exact assembled artifact by digest;
- capture separate session identifiers for pre-install/reload and every fresh-session observation;
- hash non-OMP-managed project files before install and after invoke, uninstall, reinstall, and each applicable upgrade/rollback;
- for `0.1.0`, require uninstall plus exact-artifact reinstall without a prior-release fixture; beginning with the first subsequent release, download and use a real immutable prior release for upgrade/rollback;
- clean only disposable roots it created.

## Evidence distinction

The source `plugin-distribution.feature` specifies behavior. Future `tests/features/plugin-distribution.feature` plus real step definitions may execute it. Neither file, a skipped/pending scenario, nor a structural parser report is a passing receipt. Only `distribution-evidence-receipt@1` bound to real producer output can support a claim.

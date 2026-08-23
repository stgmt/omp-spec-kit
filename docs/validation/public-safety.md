# Public-Init Candidate Safety Review

- **Date:** 2026-08-23
- **Candidate state reviewed:** `SPEC_ONLY / LICENSE_RESOLVED / PUBLIC_INIT_VALIDATED / NON_PUBLIC`
- **Verdict:** PASS for a specification-only initial commit; no plugin, package, runtime, release, or remote is authorized by this report.

## Candidate boundary

The candidate is a fresh local Git repository with an unborn `main` branch and no remote. It contains repository-owned policies/specifications, the manifest-approved upstream reference snapshot, and provenance evidence. It does not inherit dev-pomogator Git history.

## Direct checks

A Node 22 built-in scan walked every candidate file except `.git`, read the complete bytes, and applied the following fail-closed checks:

- prohibited path classes: `.env*`, `.progress.json`, mutable `.test-results*`, logs, caches, `node_modules`, `dist`, and platform temp metadata;
- premature runtime surfaces: `.omp-plugin/marketplace.json`, `plugins/**`, `dist/**`, and root package payload;
- high-confidence credential patterns: private-key headers, AWS access keys, GitHub tokens, OpenAI-style secret keys, Slack tokens, and Google API keys;
- private workstation paths under Windows user profiles or Unix home directories;
- required status tokens: `SPEC_ONLY`, `LICENSE_RESOLVED`, `PUBLIC_INIT_VALIDATED`, and `NON_PUBLIC`.

Final full-tree rescan after writing all three validation reports and transitioning the status surfaces:

```text
files scanned: 100
secret findings: 0
prohibited paths: 0
private user-home paths: 0
repository-owned absolute paths: 0
premature payload paths: 0
status findings: 0
Git remotes: 0
HEAD commit exists: false
PASS
```

## Initial commit diff review

An isolated temporary Git index staged the eleven explicit candidate roots, including `.gitattributes`, without touching the repository's normal index. The proposed unborn-HEAD diff contained 100 added files and zero deleted files. `git diff --cached --check` over every repository-owned path returned zero findings.

`.gitattributes` pins LF for repository-owned text and disables text conversion for the byte-preserved upstream snapshot and copied source license evidence, so a checkout cannot silently change manifest-verified bytes.

The whole-tree check reported nine whitespace findings in five byte-preserved upstream reference files. They are recorded exceptions, not normalized target content: `DECISION_RECOMMENDATION.md` (four trailing-space lines), `DESIGN.md` (one trailing-space line), `MISSING_FILE_PATCHES_REVIEW.md` and `MISSING_FILE_REPORT.md` (one source EOF blank each), and `TASK_PLANNING_PRIOR_ART.md` (two trailing-space lines). Changing them would violate the 24/24 immutable byte/hash match. No repository-owned file had a whitespace finding.

The temporary index was removed after review.

## Snapshot and attestation integrity

| Check | Result |
|---|---|
| Manifest inventory | 27 rows |
| Copied reference files | 24 |
| Excluded mutable state/temp files | 3 |
| Copied reference target hashes | 24 / 24 match |
| Source/target `LICENSE` hash | match: `8bcaa5a789720e50c513acb976965141ffee19fdcf2eaf6778c5c2d4537a4551` |
| Source/target attestation hash | match: `0f431d35a2e1182f7360b1b596758f18e536f2c3103e0e6f38c34427f6a97062` |
| Historical unresolved-gap tokens in current state | 0 |

## Deliberately absent from public init

- OMP marketplace catalog;
- plugin package or extension entry;
- `dist/` runtime artifact;
- install or upgrade instructions claiming current availability;
- Git tag or GitHub release;
- runtime/BBD pass receipts;
- inherited source repository history;
- credentials, user state, logs, caches, mutable test evidence, or local environment files.

## Publication conditions

The final full-tree rescan and initial-diff review are clean under the documented byte-preservation exception. The candidate may receive its first local commit. Public creation/push must then prove:

1. the remote is a newly created `stgmt/omp-spec-kit` public repository;
2. the pushed commit equals the locally reviewed initial commit;
3. the public tree contains exactly the reviewed paths;
4. README continues to state that the initial commit is non-installable/specification-only;
5. no release or plugin availability is claimed.

The later v0.1.0 plugin and every release require their own separate distribution, clean-install, fresh-session, uninstall/reinstall, evidence, and release gates.

# Fixtures

Executable fixtures follow the repository real-producer policy. A synthetic negative is admitted only as a labeled one-fault mutation of a real capture.

## Categories

| Category | Real producer | Purpose | Required variants |
|---|---|---|---|
| Tool calls | Current OMP `tool_call` event capture | Exact two-name comparison and near misses | Both exact names; case, prefix, suffix, qualified, and embedded variants |
| Direct mutator targets | Current OMP direct-mutator inputs | Spec, non-spec, and multi-target decisions | Root, descendant, outside, spec plus outside, indeterminate plus spec |
| POSIX containment tree | Real temporary POSIX filesystem | Component, dot-segment, realpath, symlink, and new-target resolution | `.specs`, `.specs2`, external target, link into/out of spec, missing leaf |
| Windows containment tree | Real NTFS temporary filesystem | Case, mixed separator, reparse, junction, and new-target resolution | Root, descendant, sibling, reparse into/out of spec, unreadable ancestor |
| Resolver faults | Fault injection at a real resolver boundary | Fail-closed behavior and redacted reason | `lstat`, `realpath`, reparse inspection, deadline, unstable ancestor |
| Installed artifact | Built plugin loaded outside source checkout | One factory and dependency-absent behavior | Exact allowlist plus one row per decision code |

## Manifest fields

Each fixture record carries:

- fixture ID and category;
- capture command or method;
- producer name and version/commit;
- source path or URL;
- capture date;
- SHA-256 and byte count;
- license disposition;
- permitted trimming note;
- reviewed ground truth.

Ground truth is exactly:

```text
{toolName, rawPath, normalizedPath, resolutionCode, decision, decisionCode}
```

`normalizedPath` is repository-relative when representable and absent otherwise. Reconciliation is element-for-element in handler order.

## Provenance boundary

Real spec documents from this repository may be targets because their license disposition is established. Upstream bytes remain capture candidates only; importing them requires the repository provenance, hash, and license decision. Fixture manifests preserve the real producer identity even after bounded trimming. Historical v0.3.2 release evidence is not modified or reinterpreted by these future fixtures.

## Cross-surface fixtures

Fixtures SHALL identify the real OMP tool variant, normalized target, filesystem state, expected gate class, and redacted reason. Shell and unknown-tool cases must record why target proof is or is not possible.

# Independent Source-Freeze Verification

- **Date:** 2026-08-23
- **Snapshot repository:** `https://github.com/stgmt/dev-pomogator.git`
- **Snapshot commit:** `158cd5ccfe4d08625734fc1692d8916cc5838fd6`
- **Verdict:** PASS

## Method

For every `IMPORT_MANIFEST.yaml` row, the verifier read immutable Git-object bytes with the equivalent of:

```text
git show 158cd5ccfe4d08625734fc1692d8916cc5838fd6:<source_path>
```

It computed SHA-256 over those bytes and compared the result with the manifest. For each copied row it also compared the immutable source bytes byte-for-byte with the target under `docs/upstream/dev-pomogator/spec-generator-v4/`. It did not read snapshot content from the mutable dev-pomogator working tree.

## Results

| Check | Result |
|---|---:|
| Inventoried source paths | 27 |
| Source-object hashes matching manifest | 27 / 27 |
| Copied reference paths | 24 |
| Copied target byte comparisons | 24 / 24 match |
| Copied target SHA-256 comparisons | 24 / 24 match |
| Intentionally excluded paths | 3 |
| Actual mismatches | 0 |

Excluded paths:

- `.specs/spec-generator-v4/.progress.json` — mutable engine state;
- `.specs/spec-generator-v4/.test-results.ndjson.tmp.21652` — temporary test state;
- `.specs/spec-generator-v4/.test-results.ndjson.tmp.41720` — temporary test state.

The later source-owner MIT attestation at commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` changes license evidence only; it does not change the frozen snapshot bytes or this comparison result.

## Boundary

This proves provenance and byte identity for the reference snapshot. It does not make the imported documents target requirements, executed scenarios, runtime evidence, or release evidence.

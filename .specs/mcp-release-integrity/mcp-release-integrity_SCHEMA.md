# MCP Release Integrity Schema

```text
package tree --hash--> candidate tar --hash--> candidate.json
Cucumber messages + public safety + lifecycle --hash/bind--> evidence.json
candidate.json + evidence.json + peeled tag commit --> eligibility.json
```

## Candidate Manifest

```json
{
  "schema": "omp-spec-kit-release-candidate@1",
  "version": "0.3.1",
  "tag": "v0.3.1",
  "commit": "40 lowercase hexadecimal characters",
  "packageTreeDigest": "64 lowercase hexadecimal characters",
  "archive": { "file": "omp-spec-kit-v0.3.1.tar", "sha256": "64 lowercase hexadecimal characters", "bytes": 0 },
  "files": [{ "path": "relative package path", "mode": 493, "bytes": 0, "sha256": "64 lowercase hexadecimal characters" }],
  "candidateDigest": "64 lowercase hexadecimal characters"
}
```

`files` is lexical, unique, relative, regular, and records POSIX mode. The launcher row must remain executable (`0755` / decimal `493`) when unpacked. `candidateDigest` hashes canonical JSON before this field is added.

## Evidence Manifest

```json
{
  "schema": "omp-spec-kit-release-evidence@2",
  "version": "0.3.1",
  "tag": "v0.3.1",
  "commit": "40 lowercase hexadecimal characters",
  "candidateDigest": "64 lowercase hexadecimal characters",
  "packageTreeDigest": "64 lowercase hexadecimal characters",
  "archiveSha256": "64 lowercase hexadecimal characters",
  "checks": {
    "publicSafety": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" },
    "dockerBdd": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" },
    "priorV030": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" },
    "upgradeFromV030": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" },
    "rollbackToV030": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" }
  },
  "frReceipts": { "FR-1": { "status": "passed", "path": "relative receipt path", "digest": "64 lowercase hexadecimal characters" } }
}
```

The copied `dockerBdd` receipt contains a regular relative `messagePath`, the SHA-256 of that copied Cucumber Message NDJSON artifact, and exactly the source feature's tagged scenario IDs. The evaluator recomputes the message hash, resolves every scenario id to its `@FR-N` tag, and rejects a foreign FR receipt.

Lifecycle receipts are closed `omp-spec-kit-lifecycle-receipt@1` records. Upgrade must prove `0.3.0 → 0.3.1`, fresh-session observation of `0.3.1`, and project hash preservation. Rollback must prove the inverse direction and fresh-session observation of `0.3.0`. Prior proof must name `v0.3.0`, its peeled commit, and source `public-tag`.

## Eligibility Result

```json
{
  "schema": "distribution-release-eligibility@2",
  "eligible": true,
  "tag": "v0.3.1",
  "commit": "40 lowercase hexadecimal characters",
  "candidateDigest": "64 lowercase hexadecimal characters",
  "archiveSha256": "64 lowercase hexadecimal characters",
  "blocking": []
}
```

## Validation Rules

1. Candidate creation resolves `git rev-parse <tag>^{}` itself and rejects a dirty package or a checkout whose `HEAD` differs from that commit.
2. Tags match `vMAJOR.MINOR.PATCH`; versions match `MAJOR.MINOR.PATCH`; SHA fields are exact lowercase hexadecimal values.
3. Archive, candidate, public-safety, Cucumber message, lifecycle, and FR receipt bytes are regular, contained, and hash-matched.
4. Every required remediation scenario has a completed Cucumber message execution; every FR receipt cites one of those scenario IDs with the matching feature tag.
5. No stage name, arbitrary environment SHA, static release note, job summary, or target commit alone makes a candidate eligible.

# MCP Release Integrity Schema

## Shared scalars

`Sha256` is 64 lowercase hexadecimal characters. `Commit` is 40 lowercase hexadecimal characters. Paths are unique repository-relative POSIX paths to regular files beneath the declared root. Content is digested before parsing. Symlink, junction, reparse, or realpath escape is invalid.

## Runtime result provenance

```ts
type RootMode = "active-project" | "explicit-absolute-override";

interface ResponseProvenance {
  serverName: "omp-spec-kit";
  resolvedRootId: Sha256;
  activeProjectRootId: Sha256;
  rootMode: RootMode;
  matchesActiveProject: boolean;
}
```

`ResponseProvenance` is adapter metadata, not kernel graph content. `resolvedRootId` and `activeProjectRootId` are domain-separated SHA-256 identities of canonical physical roots. They are opaque, stable for one physical root, and contain no absolute path, environment value, credential, or document bytes. Every stdio `QueryEnvelope` and legacy OMP `spec_inventory` result SHALL carry one `provenance: ResponseProvenance`. A missing override produces equal IDs, `active-project`, and `true`; an accepted absolute override produces `explicit-absolute-override` and `false` when it differs from the active cwd. Human summaries SHALL expose the mode and mismatch without exposing the IDs' source paths.


## Candidate manifest

```ts
interface ReleaseCandidateV1 {
  schema: "omp-spec-kit-release-candidate@1";
  version: string;                 // MAJOR.MINOR.PATCH
  tag: string;                     // exact v<version>
  commit: Commit;                  // peeled tag commit
  packageTreeDigest: Sha256;
  archive: { file: string; bytes: number; sha256: Sha256 };
  files: { path: string; mode: number; bytes: number; sha256: Sha256 }[];
  candidateDigest: Sha256;
}
```

`files` is lexical and unique. The POSIX launcher retains executable mode. Candidate creation refuses dirty package bytes or `HEAD` different from the peeled tag commit. `candidateDigest` hashes canonical manifest JSON before that field is added.

## Forward MRI run

```ts
type MriCheck =
  | "active-project"
  | "protocol-recovery"
  | "historical-eight-tools"
  | "public-tree-safety"
  | "lifecycle";

interface LifecycleObservation {
  action: "install" | "upgrade" | "rollback" | "uninstall" | "reinstall";
  fromVersion: string | null;
  toVersion: string | null;
  observedFreshSessionVersion: string | null;
  projectHashBefore: Sha256;
  projectHashAfter: Sha256;
  passed: boolean;
}

interface MriRunV1 {
  schema: "omp-spec-kit-mri-run@1";
  candidateDigest: Sha256;
  archiveSha256: Sha256;
  featureDigest: Sha256;
  stepDefinitionsDigest: Sha256;
  sourceInputManifestDigest: Sha256;
  messageDigest: Sha256;
  producer: { name: "Cucumber"; version: string; imageDigest: Sha256 };
  unfiltered: true;
  checks: { name: MriCheck; passed: boolean; evidenceRef: string }[];
  lifecycle: LifecycleObservation[];
  outcome: "passed" | "blocked";
  reasons: string[];
}
```

A passed run has one passed entry for every `MriCheck`, includes install, upgrade, rollback, uninstall, and reinstall observations, reports equal project hashes for each action, and contains no reason. `checks` names observable groups, not scenario counts. `reasons` are bounded redacted explanations, not a closed public error taxonomy.

A trusted current-run pointer may advance only after a successful unfiltered producer run. A failed, malformed, meta-only, tag-scoped, or name-scoped run is retained only as diagnostic output and cannot replace it.

## Publication input

The release workflow consumes:

- one `ReleaseCandidateV1`;
- one passed `MriRunV1` with matching `candidateDigest` and `archiveSha256`;
- native `gh attestation verify` success for the exact archive subject, repository, signer workflow, and `refs/tags/<candidate.tag>`;
- a freshly downloaded archive whose SHA-256 equals `candidate.archive.sha256`.

No MRI-defined distribution or public eligibility object exists. Before release mutation, every required identity must match. Existing release idempotence additionally requires the expected asset name, byte size, and SHA-256.

## Historical v0.3.2 reader

The file `docs/validation/release-status-v0.3.2.json` is accepted only as immutable historical readback with these fixed identities:

| Field | Value |
|---|---|
| version/tag | `0.3.2` / `v0.3.2` |
| tag commit | `2938389e34e2d06bdd497291ed01e0a2d89146c9` |
| candidate digest | `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4` |
| package-tree digest | `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92` |
| archive | `omp-spec-kit-0.3.2.tar` |
| archive SHA-256 | `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9` |

Historical evidence@3, manager-discovery, lifecycle, distribution-attestation, and eligibility shapes remain readable exactly as recorded. They are sealed and SHALL NOT be accepted as the forward `MriRunV1` schema or regenerated after feature/step changes.

## Current OMP 18 profile

The current manager handoff is OMP 18.0.10 and may expose the project plugin server as omp-spec-kit:omp-spec-kit. The eight v0.3.2 MCP names remain the compatibility set; later stage counts are additive and separately dogfooded.

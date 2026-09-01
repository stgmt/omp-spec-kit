# Plugin Distribution Schemas

This document defines only distribution-owned data. OMP owns marketplace, package-extension, and MCP configuration parsing. The kernel owns query requests, results, errors, paging, and diagnostics.

All SHA-256 values are 64 lowercase hexadecimal characters and commits are 40 lowercase hexadecimal characters. Paths below are repository-relative and must remain contained after realpath/link resolution.

## 1. TargetPluginIdentity

```ts
type TargetPluginIdentity = {
  catalogPath: ".omp-plugin/marketplace.json";
  pluginName: "omp-spec-kit";
  childSource: "./plugins/omp-spec-kit";
  version: string;
  extensionEntry: "./dist/extension.js";
  mcpConfigPath: "plugins/omp-spec-kit/.mcp.json";
};
```

Distribution asks OMP's supported parser to read the catalog and manifest, then selects the unique target name and verifies path containment. Other accepted host fields and unrelated entries are not copied into this schema.

## 2. CandidateIdentity

```ts
type CandidateIdentity = {
  version: string;
  tag: `v${string}`;
  commit: string;
  candidateSha256: string;
  packageTreeSha256: string;
  archive: { name: string; bytes: number; sha256: string };
  supportedOmp: { version: string; commit: string };
  platform: { os: string; architecture: string; fixtureSha256: string };
};
```

The tag, catalog, child, embedded version, archive metadata, and fresh installed observation must agree with `version` and `commit`.

## 3. NamedReleaseChecks

```ts
type CheckName =
  | "target"
  | "build"
  | "install"
  | "invoke"
  | "dependencyAbsent"
  | "lifecycle"
  | "publicSafety";

type NamedReleaseChecks = Record<CheckName, {
  status: "PASS" | "FAIL";
  artifactSha256: string;
  logArtifact: string; // contained CI artifact reference
}>;
```

Every key is required once. Detailed logs remain CI artifacts; this is a compact outcome map.

## 4. LifecycleObservation

```ts
type LifecycleObservation = {
  candidateSha256: string;
  installedVersion: string;
  freshInvocation: "PASS";
  uninstallAbsence: "PASS";
  reinstallSha256: string;
  predecessor: null | {
    version: string;
    publicArtifactSha256: string;
    upgradeObservedVersion: string;
    rollbackObservedVersion: string;
  };
  projectPreservationSha256Before: string;
  projectPreservationSha256After: string;
};
```

`predecessor` is `null` only for the first release. Later releases use real public bytes. `reinstallSha256` equals `candidateSha256`; preservation hashes match.

## 5. PublicSafetyResult

```ts
type PublicSafetyResult = {
  status: "PASS" | "FAIL";
  checks: {
    provenance: "PASS" | "FAIL";
    license: "PASS" | "FAIL";
    secrets: "PASS" | "FAIL";
    localState: "PASS" | "FAIL";
    publicDiff: "PASS" | "FAIL";
    payloadAllowlist: "PASS" | "FAIL";
  };
  logArtifact: string;
};
```

A failed member prevents publication. The result never contains the protected secret, absolute host path, environment value, or file content.

## 6. DistributionReleaseStatus

```ts
type DistributionReleaseStatus = {
  schema: "omp-spec-kit-distribution-status@1";
  state: "SHIPPED";
  candidate: CandidateIdentity;
  target: TargetPluginIdentity;
  checks: NamedReleaseChecks;
  lifecycle: LifecycleObservation;
  publicAsset: {
    releaseUrl: string;
    name: string;
    sha256: string;
  };
  finalAttestation: {
    subjectName: string;
    subjectSha256: string;
    repository: "stgmt/omp-spec-kit";
    workflow: string;
    sourceRef: `refs/tags/${string}`;
    runUrl: string;
  };
};
```

`publicAsset.sha256`, `candidate.archive.sha256`, every check's `artifactSha256`, and `finalAttestation.subjectSha256` are equal. Distribution emits no product capability state.

## 7. Release decision

The release job publishes only if every named check is `PASS`, identity fields agree, lifecycle invariants hold, and the asset digest is unchanged. Failures name the failed check in CI logs. There is no forward eligibility evaluator or intermediate trust layer. Release decisions use only the named checks and exact artifact identity.

## 8. Historical profiles

The following remain readable, immutable evidence for their releases only:

- v0.1/v0.2/v0.3 lifecycle and package receipts;
- `omp-spec-kit-release-evidence@3`;
- historical `distribution-release-eligibility@1` and `public-release-eligibility@1`;
- the v0.3.2 `distribution-evidence.json` subject and its attestation;
- `docs/validation/release-status-v0.3.2.json`.

Historical receipts are not rewritten into `DistributionReleaseStatus` and are not required to publish the next candidate.

## OMP 18.0.10 compatibility observation

The package has a compatibility observation against OMP 18.0.10 at immutable commit 33cc6b9a043a74e00a157e72ca909272796d8461. This observation is non-authoritative and does not replace the supported release-smoke authority: OMP v17.3.7 at commit 8500092296621a6826b7136e840f8a59ea338958. Historical runtime receipts remain historical; current discovery uses the versioned OMP 18 probe and accepts the namespaced plugin/server handoff.

---

## Product status schema (merged)

## Scope

This schema defines the small public roadmap record. Detailed release, authoring, and enforcement records belong to their owning specifications.

## Canonical identifiers

A cross-spec identifier is `<spec-slug>:<local-id>`. Product requirements use `plugin-distribution:FR-N`, acceptance criteria use `plugin-distribution:AC-N.M`, tasks use `plugin-distribution:TASK-N`, and checks use `plugin-distribution:CHK-FRN-NN`. Bare IDs are local prose only.

## RoadmapRow

| Field | Type | Required | Rule |
|---|---|---|---|
| `bucket` | `SHIPPED | NEXT | LATER` | yes | The only public status vocabulary. |
| `label` | non-empty string | yes | Manager-readable outcome. |
| `proof` | repository-relative path or null | yes | Required only for SHIPPED. |
| `observedRelease` | `{version, installedIdentity}` or null | yes | Required only for SHIPPED. |
| `whyNotShipped` | non-empty string or null | yes | Required for NEXT, optional for LATER, null for SHIPPED. |

## Roadmap

A roadmap is an ordered array of `RoadmapRow` with these invariants:

1. exactly one SHIPPED row;
2. exactly one NEXT row;
3. zero or more LATER rows;
4. the SHIPPED row has readable current proof whose released identity equals `observedRelease`;
5. NEXT and LATER rows do not claim shipment;
6. no additional public state field is permitted.


## Current instance

| bucket | label | proof | observedRelease | whyNotShipped |
|---|---|---|---|---|
| SHIPPED | v0.3.2 read-only MCP baseline: v0.2 graph/query kernel plus eight working read-only MCP tools | `docs/validation/release-status-v0.3.2.json` | `{version: "0.3.2", installedIdentity: "omp-spec-kit@omp-spec-kit"}` | null |
| NEXT | Safe spec authoring | null | null | Only `propose_patch` and `apply_proposed_patch` may be public; atomic contained application and the exact-name-first `.specs/**` direct-write policy still require real end-to-end proof. |
| LATER | Expanded read queries | null | null | null |
| LATER | Editor navigation | null | null | null |
| LATER | Evidence queries | null | null | null |
| LATER | Impact reporting | null | null | null |
| LATER | Manual exact-content plan validation | null | null | null |

## Shipment proof rule

For SHIPPED, the proof file is consumed as an opaque bounded release receipt. Product status reads only the released version and installed identity needed to match the row. It does not copy artifact ancestry or owner-specific verification fields. Without readable matching proof, the row is invalid and SHALL NOT be SHIPPED; tasks, scenarios, specifications, and older receipts do not substitute.

## Safe authoring exit condition

The NEXT row may move to SHIPPED only when one current end-to-end proof shows all of the following for the same product build:

- public mutation names are exactly `propose_patch` and `apply_proposed_patch`;
- an allowlisted MCP authoring call applies atomically inside repository containment;
- a non-MCP read, search, enumeration, shell, edit, or write targeting canonical .specs/** is refused;
- a link or reparse escape is refused;
- each refusal has a bounded reason.

## OMP 18 staged lifecycle

The current v0.3.2 profile is read-only. The planned releases are OMP 18 maintenance, read complete (23 MCP tools), evidence/navigation (25), safe authoring (49), and automatic exact-plan gating. Each stage requires its own installed runtime and behavioral receipt.

---

## MCP release-integrity schema (merged)

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

The current manager handoff was observed on OMP 18.0.10 and may expose the project plugin server as omp-spec-kit:omp-spec-kit. This is a non-authoritative compatibility observation. The eight v0.3.2 MCP names remain the compatibility set; later stage counts are additive and separately dogfooded.
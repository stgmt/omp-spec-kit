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

## OMP 18.0.10 compatibility

The current package profile requires OMP 18.0.10 at immutable commit 33cc6b9a043a74e00a157e72ca909272796d8461. Historical runtime receipts remain historical; current discovery uses the versioned OMP 18 probe and accepts the namespaced plugin/server handoff.

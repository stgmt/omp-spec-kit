# MCP Release Integrity Schema

This document mirrors the delivered v0.3.2 producer/evaluator contract. It does not redefine the forward `distribution-release-eligibility@2` aggregate owned by `plugin-distribution:FR-13`.

All objects are closed: unknown or missing keys, duplicate set members, unsafe paths and unknown enum members are invalid. `Sha256` is exactly 64 lowercase hexadecimal characters; `Commit` is exactly 40 lowercase hexadecimal characters. Receipt paths are unique, relative, regular files contained beneath the evidence directory with no symlink/junction/reparse escape.

```text
package tree -> candidate.json + omp-spec-kit-<version>.tar
candidate + semantic Cucumber Messages + MRI receipts + distribution subject -> evidence.json@3
candidate + evidence@3 -> mri-release-eligibility@1
                       -> distribution-release-eligibility@1
                       -> public-release-eligibility@1
```

## Candidate manifest

```ts
interface ReleaseCandidateV1 {
  schema: "omp-spec-kit-release-candidate@1";
  version: string;                 // MAJOR.MINOR.PATCH
  tag: string;                     // exact v<version>
  commit: Commit;                  // peeled tag commit
  packageTreeDigest: Sha256;
  archive: { file:string; sha256:Sha256; bytes:number };
  files: { path:string; mode:number; bytes:number; sha256:Sha256 }[];
  candidateDigest: Sha256;
}
```

The bounded current identity includes `"version": "0.3.2"` and `"tag": "v0.3.2"`. For v0.3.2 the archive file is exactly `omp-spec-kit-0.3.2.tar`. `files` is lexical, unique and contains every regular packaged path with POSIX mode; the POSIX launcher is mode 493 (`0755`). `candidateDigest` hashes canonical JSON before that field is added. Candidate creation resolves `git rev-parse <tag>^{}` itself and refuses a dirty package tree or `HEAD` different from the peeled tag commit.

## Receipt reference and shared identity

```ts
type ReceiptRef =
  | { status:"present"; path:string; digest:Sha256 }
  | { status:"missing" };

interface CandidateIdentityV1 {
  version: string;
  tag: string;
  commit: Commit;
  candidateDigest: Sha256;
  packageTreeDigest: Sha256;
  archiveSha256: Sha256;
  catalogDigest: Sha256;
}
```

A `present` digest is recomputed over the exact copied bytes before JSON parsing. A `missing` reference has no path/digest keys. Every MRI/distribution receipt that carries identity must equal all seven candidate identity fields.

## Evidence manifest v3

```ts
interface ReleaseEvidenceV3 extends CandidateIdentityV1 {
  schema: "omp-spec-kit-release-evidence@3";
  mri: {
    schema: "omp-spec-kit-mri-evidence@1";
    checks: {
      publicSafety: ReceiptRef;
      dockerBdd: ReceiptRef;
      priorV030: ReceiptRef;
      upgradeFromV030: ReceiptRef;
      rollbackToV030: ReceiptRef;
    };
    frReceipts: {
      "mcp-release-integrity:FR-1": ReceiptRef;
      "mcp-release-integrity:FR-2": ReceiptRef;
      "mcp-release-integrity:FR-3": ReceiptRef;
      "mcp-release-integrity:FR-4": ReceiptRef;
      "mcp-release-integrity:FR-5": ReceiptRef;
      "mcp-release-integrity:FR-6": ReceiptRef;
    };
    discovery: ReceiptRef;
  };
  distribution: {
    schema: "omp-spec-kit-distribution-evidence-input@1";
    trust: "untrusted-self-attested" | "github-artifact-attestation";
    receipt: ReceiptRef;
  };
}
```

The current release evidence file has exactly the top-level keys `schema`, seven identity keys, `mri`, and `distribution`. MRI, distribution and public results are distinct; evidence@3 never embeds a single conflated eligibility boolean.

## MRI semantic execution set

Every scenario heading in `mcp-release-integrity.feature` carries `@release-evidence`. The exact v0.3.2 mandatory scenario-ID set is:

```text
SCEN-mri-active-project-root
SCEN-mri-terminal-json-rpc
SCEN-mri-malformed-json-recovery
SCEN-mri-all-tool-parity
SCEN-mri-public-eligibility-separation
SCEN-mri-meta-only-evidence-refusal
SCEN-mri-semantic-cucumber-mutations
SCEN-mri-artifact-mismatch-refusal
SCEN-mri-public-communication-proof
SCEN-mri-credential-mutation-refusal
SCEN-mri-executable-launcher-archive
SCEN-mri-synthetic-distribution-refusal
SCEN-mri-self-attested-distribution-refusal
SCEN-mri-unverified-attestation-refusal
SCEN-mri-symlinked-evidence-refusal
SCEN-mri-active-project-manager-receipt
SCEN-mri-missing-payload-refusal
SCEN-mri-lifecycle-receipt-refusal
```

`omp-spec-kit-bdd-receipt@1` contains the shared candidate identity plus `status:"passed"`, a contained regular `messagePath`, its `messageDigest`, and exactly that sorted scenario-ID set. The evaluator recomputes the message digest and derives expected pickle multiplicity from the exact source feature: one per ordinary scenario and one per Scenario Outline Examples row. The current set is 18 IDs / 40 pickle executions (outline counts 12 semantic mutations, 9 credential mutations, 2 symlink variants, 3 lifecycle variants). It requires exactly that many distinct pickles/test cases and a passing completed non-retried terminal chain for every pickle, plus one final successful `testRunFinished` at stream end. Missing/extra outline expansions, malformed/meta-only frames, duplicate terminal attempts, retry-only and non-passing chains fail closed with named codes; an ID-level first-pickle match is insufficient.

Each `omp-spec-kit-fr-receipt@1` contains `status:"passed"`, shared identity, one exact qualified `requirement`, and one `scenarioId` in the mandatory set whose `@FR-N` tag equals that requirement. The six-key receipt map is exact; one receipt per FR does not replace the independent obligation to execute all eighteen scenarios.

## Lifecycle and discovery receipts

- `publicSafety` is `omp-spec-kit-public-safety@1`, status passed, candidate/package digests matched, with redacted findings.
- `priorV030` is `omp-spec-kit-tagged-source-proof@1`, status passed, exact tag `v0.3.0`, source `public-tag`, and the freshly peeled public tag commit.
- `upgradeFromV030` is `omp-spec-kit-lifecycle-receipt@1` proving `0.3.0 -> 0.3.2`, fresh-session observed `0.3.2`, and project-hash preservation.
- `rollbackToV030` is the inverse `0.3.2 -> 0.3.0` receipt with fresh-session observation and hash preservation.
- `discovery` contains the bounded `omp-manager-handoff-probe@2` receipt for `@oh-my-pi/pi-coding-agent` 17.3.7, exactly one connected `omp-spec-kit` server, eight v0.3 first-slice tools, no manager error, and target-only active-project execution.

No stage name, arbitrary SHA, target commit, static note or job summary substitutes for these receipt bytes.

## Distribution input and trust root

The distribution receipt is `omp-spec-kit-distribution-evidence@1` with the shared candidate identity, non-empty `ompRevision`, exact `{os,architecture,fixtureDigest}` platform, exact subsequent-release applicability (`upgrade`, `rollback`, and `reinstall` mandatory), matching MRI discovery digest, and a closed claim matrix for qualified `plugin-distribution:FR-1` through `FR-12`. Every `{requirement,claim,receipt}` row has one digest-verified `omp-spec-kit-distribution-producer-receipt@1`, exact candidate/platform/applicability/lifecycle identity, producer `{workflow:"distribution-lifecycle",runId:<positive decimal>}`, and a nonempty unique passed observation set bound to the platform fixture digest.

`untrusted-self-attested` always adds `distribution-producer-provenance-untrusted:no-independent-trust-root`.

`github-artifact-attestation` succeeds only when all of these are true:

1. the exact copied `distribution-evidence.json` subject is contained and its declared digest matches;
2. environment may confirm only exact repository `stgmt/omp-spec-kit` (`GITHUB_REPOSITORY` or `OMP_SPEC_KIT_ATTESTATION_REPO`); arbitrary owner/repository input is invalid;
3. signer workflow is exact `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`;
4. source ref is exact `refs/tags/<candidate.tag>`;
5. `gh attestation verify <subject> --repo stgmt/omp-spec-kit --signer-workflow stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml --source-ref refs/tags/<candidate.tag>` exits zero within 120 seconds.

Missing `gh`, spawn/timeout/nonzero exit, wrong repository/workflow/ref, uncontained subject or digest mismatch blocks distribution and public eligibility.

## Eligibility results

```ts
interface MriReleaseEligibilityV1 extends CandidateIdentityV1 {
  schema: "mri-release-eligibility@1";
  eligible: boolean;
  mandatoryRequirements: [
    "mcp-release-integrity:FR-1", "mcp-release-integrity:FR-2",
    "mcp-release-integrity:FR-3", "mcp-release-integrity:FR-4",
    "mcp-release-integrity:FR-5", "mcp-release-integrity:FR-6"
  ];
  discoveryReceiptDigest: Sha256 | null;
  blocking: string[];
}

interface DistributionReleaseEligibilityV1 {
  schema: "distribution-release-eligibility@1";
  outcome: "eligible" | "blocked";
  candidateVersion: string;
  commit: Commit;
  ompRevision: string | null;
  platform: {os:string; architecture:string; fixtureDigest:Sha256} | null;
  catalogDigest: Sha256;
  artifactDigest: Sha256;
  mandatoryRequirements: string[]; // exact qualified plugin-distribution:FR-1..FR-12 tuple
  evidenceByRequirement: Record<string, Sha256[]>; // exact twelve keys and required claim order
  applicability: {releasePosition:"first"|"subsequent"; upgrade:"mandatory"|"inapplicable"; rollback:"mandatory"|"inapplicable"; reinstall:"mandatory"};
  blockingReasons: string[];
}

interface PublicReleaseEligibilityV1 extends CandidateIdentityV1 {
  schema: "public-release-eligibility@1";
  eligible: boolean;
  mri: MriReleaseEligibilityV1;
  distribution: DistributionReleaseEligibilityV1;
  blocking: string[];
}
```

MRI is eligible exactly when `mri.blocking` is empty. Distribution outcome is eligible exactly when `blockingReasons` is empty. Public eligibility is true exactly when preflight, MRI and distribution blockers are all empty and every nested identity matches the same candidate. Blockers are unique and lexically sorted. Supported blocker families are candidate/evidence shape or identity mismatch; unsafe/missing/digest-mismatched receipts; semantic Cucumber failure; discovery/lifecycle/FR-receipt failure; missing/duplicate/unexpected distribution claims; distribution identity/lifecycle/observation failure; untrusted provenance; and attestation verification failure.

## Publication identity

Publish downloads the verified candidate bundle, recomputes candidate/archive/tag/receipt identities, and attaches the exact `candidate.json`, `evidence.json`, and `omp-spec-kit-<version>.tar` bytes. It never rebuilds. An existing release is idempotent only when every required asset name, size and digest matches. The bounded current v0.3.2 instance is `docs/validation/release-status-v0.3.2.json`; that record is evidence for the published release, not a substitute for evaluating a future candidate.

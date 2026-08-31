# Research

## Verified runtime boundary

OMP v17.3.7 resolves a path-like MCP command relative to the installed package and uses the active project when `cwd` is omitted:

- [`omp-plugins.ts`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/discovery/omp-plugins.ts#L274-L344)
- [`stdio.ts`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/mcp/transports/stdio.ts#L578-L609)
- [`mcp-config.md`](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/mcp-config.md#L377-L425)

The observable contract is active-project behavior. OMP manager classes, provider names, server-registration cardinality, and private launcher environment variables are implementation details.

## Verified shipped behavior

The installed v0.3.2 package launches from the active project, returns terminal JSON-RPC errors, recovers on the same process, and exposes the eight read-only SCHEMA-11 names. MRI checks the installed boundary. Full graph/query semantics remain kernel-owned.

## Real producer evidence

`tests/fixtures/release-candidate/cucumber-messages.ndjson` came from the real Docker Cucumber 13.2.1 producer. Its stream hash, image digest, command, capture date, and source-input manifest are closed provenance. Historical scenario and step counts are descriptive only. A source change requires a newly captured successful unfiltered run; the old stream must never be relabeled.

The forward MRI contract checks parseability, a successful unfiltered terminal run, source/feature/step binding, and one bounded negative showing that meta-only or failed output cannot become trusted. Detailed Cucumber envelope error codes belong to the producer adapter, not release policy.

## Root provenance and cross-surface consistency

The repository runtime audit found two distinct risks. The stdio query envelope and legacy inventory result expose content and graph identity but no physical project identity; the same server name can therefore serve two roots without a client-visible source marker. Separately, the OMP extension inventory used `ctx.cwd` while the seven query tools honored `OMP_SPEC_KIT_ROOT`, so a cwd plus absolute override could split one extension across two projects.

The bounded fix is adapter-owned rather than kernel-owned: the pure kernel continues to exclude transport and host state from its content fingerprint, while the shared adapter root context adds `serverName`, opaque canonical-root IDs, `rootMode`, and `matchesActiveProject` to every result. The explicit absolute override remains a diagnostic capability, but its mismatch is visible in both structured output and one-line text. No absolute path or environment value is returned.

Evidence inputs are the current source/test inspection, the built-artifact two-root smoke, and the installed extension mixed-cwd/override smoke. The required regression scenarios are `SCEN-mri-response-provenance` and `SCEN-mri-extension-root-consistency`; a changed source input requires a fresh unfiltered Cucumber capture before a run can become trusted evidence.

## Candidate and publication facts

Candidate bytes are assembled once from a clean peeled tag in lexical order with regular contained paths and preserved executable mode. Publication downloads and re-hashes the same archive. Native GitHub Artifact Attestation verification binds the exact subject to repository, signer workflow, and tag ref. MRI does not revalidate a distribution producer's internal claim matrix.

## Historical v0.3.2 evidence

[`release-status-v0.3.2.json`](../../docs/validation/release-status-v0.3.2.json) is immutable readback evidence for tag `v0.3.2`, commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, and archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`. Its evidence@3 and attestation fields remain readable historical bytes; they are not the schema for future candidates.

## Decision

Future MRI produces one compact candidate run result. The release workflow may compose that result with native artifact-attestation output, but MRI defines no nested MRI/distribution/public eligibility lattice and no custom blocker taxonomy.

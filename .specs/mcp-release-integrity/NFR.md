# Non-Functional Requirements (NFR)

## Performance

- Root selection adds no watcher, background service, or eager corpus scan.
- Candidate hashing visits only the allowlisted candidate tree in deterministic lexical order.

## Security

- Candidate and evidence paths are relative, regular, realpath-contained files; symlink, junction, reparse, and parent-component escape fail before content use.
- Credential checks emit redacted bounded findings and never echo matched values, environment contents, or absolute user paths.
- Attestation verification fixes the exact subject, repository, signer workflow, and tag ref.


- Response provenance uses opaque canonical-root identities and never returns absolute paths, environment values, credentials, or document bodies.

## Reliability

- Each identified invalid request has one terminal response and the process accepts a later valid request.
- Equal clean input bytes produce equal package-tree, archive, and candidate digests.
- Only a successful unfiltered real-producer run may replace trusted current-run evidence.
- Publication mutates nothing when candidate, attestation, downloaded archive, or existing asset identity differs.

- The stdio server and every OMP extension tool resolve one root context per execution; a foreign absolute override is visible as `matchesActiveProject: false` rather than silently presented as active-project data.

## Usability

- Install, upgrade, rollback, and reinstall guidance requires a fresh OMP session.
- Public material distinguishes immutable v0.3.2 history from a future candidate run.
- Failure output names the affected file or check in bounded language without exposing secrets or private paths.

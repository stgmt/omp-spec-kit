# User Stories

## US-1 — Install the intended plugin

**As a** user, **I want** the `omp-spec-kit` catalog entry to install from its contained child, **so that** unrelated repository packages cannot change what I receive.

**Independent test:** install the tagged candidate in a disposable project and inspect the installed identity and entrypoints.

## US-2 — Invoke installed bytes

**As a** user, **I want** a fresh session to invoke the installed candidate without the checkout or ambient dependencies, **so that** a green build is not mistaken for a usable release.

**Independent test:** hide the checkout and external `node_modules`, start a fresh session, and invoke the declared read-only surface.

## US-3 — Recover safely

**As a** user, **I want** uninstall/reinstall plus upgrade/rollback to preserve my project, **so that** a bad release is reversible.

**Independent test:** hash non-OMP-managed project files across every transition and observe versions only from fresh sessions.

## US-4 — Trust the published archive

**As a** release consumer, **I want** the public archive to be the exact verified build with a GitHub Artifact Attestation, **so that** publication cannot substitute new bytes.

**Independent test:** compare the build, release asset, and attestation subject SHA-256 values.

## US-5 — Understand status

**As a** maintainer, **I want** one compact distribution record, **so that** I can distinguish SHIPPED release evidence from NEXT design without reading per-requirement receipts.

**Independent test:** the record names the candidate identity, named check outcomes, lifecycle observations, public asset, and final attestation.

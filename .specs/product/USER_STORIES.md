# User stories

## US-1 — Product manager: promises before code

**Priority:** Must

**As a** product manager, **I want** the public repository to start from reviewed specifications and an explicit non-installable status, **so that** early readers do not mistake plans or imported scenarios for delivered software.

**Why:** A public name, README, or scenario can otherwise become an accidental product promise.

**Independent test:** Inspect the public-init tree and status summary without relying on runtime files.

**Acceptance scenarios:** `@feature1`, `@feature7`.

## US-2 — Provenance reviewer: reproducible source freeze

**Priority:** Must

**As a** provenance reviewer, **I want** every imported byte tied to one immutable commit, path, hash, and disposition, **so that** the clean export can be reproduced without reading a dirty working tree.

**Why:** The source repository had concurrent local changes and state-like files that are unsafe to inherit.

**Independent test:** Reconstruct the allowlisted export from the recorded Git object and compare hashes.

**Acceptance scenarios:** `@feature2`.

## US-3 — Legal reviewer: redistribution gate

**Priority:** Must

**As a** legal reviewer, **I want** ambiguous imported-material rights to block publication, **so that** a new root license does not silently relabel upstream content.

**Why:** The pinned source lacked a root license file at the frozen commit; a later source-owner attestation now covers those exact bytes, while the gate must still reject hypothetical future or changed imports with insufficient evidence.

**Independent test:** Evaluate the current MIT-attested manifest and a bounded hypothetical manifest with unresolved redistribution evidence.

**Acceptance scenarios:** `@feature3`.

## US-4 — Security reviewer: clean public tree

**Priority:** Must

**As a** security reviewer, **I want** an allowlisted export and a zero-finding secret/state scan, **so that** credentials, local state, logs, caches, and mutable evidence cannot enter public history.

**Why:** Public history is durable and deleting a later commit does not reliably erase disclosure.

**Independent test:** Plant a prohibited file or scanner finding and observe fail-closed publication eligibility.

**Acceptance scenarios:** `@feature4`.

## US-5 — OMP user: one recognizable product

**Priority:** Must

**As an** OMP user, **I want** one product and one future installed identity, **so that** I never have to choose among competing marketplace entries, plugin packages, or extension control planes.

**Why:** Product evolution should add capabilities without splitting identity.

**Independent test:** Compare repository identity and future distribution evidence against the single-product invariant.

**Acceptance scenarios:** `@feature5`.

## US-6 — Release owner: evidence-gated roadmap

**Priority:** Must

**As a** release owner, **I want** stage claims derived from current exit evidence, **so that** public init, v0.1.0, kernel, MCP, and authoring stages cannot be skipped or conflated.

**Why:** A release tag, completed document, or green subset of an owning specification is not proof that the complete stage contract is eligible.

**Independent test:** Withhold one mandatory result from any aggregate in the proposed stage's complete cumulative gate set and confirm that the roadmap/status remains at the last proven stage and cannot become `DELIVERED`.

**Acceptance scenarios:** `@feature6`, `@feature7`.

## US-7 — Contributor: clear boundary and next work

**Priority:** Should

**As a** contributor, **I want** a manager-readable roadmap with owned cross-spec boundaries, **so that** I can work on the next gate without copying plugin, kernel, or authoring internals into the product spec.

**Why:** Non-overlapping specifications reduce contradiction and scope creep.

**Independent test:** Follow every stage link to its canonical requirement owner and identify what remains non-public.

**Acceptance scenarios:** `@feature8`.

## US-8 — Agent: MCP spec door

**Priority:** Must

**As an** agent, **I want** to use the MCP spec door, **so that** I never treat host LSP as a spec tool or freeze the eight SCHEMA-11 names as the destination.

**Why:** The v0.3 eight-tool registry is the first slice of the generator-port door; silent DROP of a census row would hide a ported capability.

**Independent test:** Inspect `docs/decisions/spec-generator-port.md`, ROADMAP, and the agent-facing inventory; leftover phrases that deny the 46-tool door fail unless they say first slice or v0.3 candidate.

**Acceptance scenarios:** `@feature9`.

# Research

Status: DRAFT

Condensed findings from the 2026-09-13 deep-research session on spec-collision UX and registry models in comparable tools.

## Collision handling in the wild

- **spec-kit**: sequential `NNN-slug` numbering races across clones/branches (issues #975, #1066, #1744). Fixes shipped: `--number` validated against spec dirs + git branches after fetch with auto-bump (PR #2036); `--timestamp`/`--branch-numbering timestamp` mode for distributed teams (PR #1911). Takeaway: sequential counters need a central allocator or they race.
- **OpenSpec**: named change dirs never collide; the real hole is two changes `MODIFY`ing the same canonical requirement — second archive silently overwrites (issue #1246). Their `openspec-parallel-merge-plan.md` roadmap: base fingerprints in `meta.json` (phase 0), 3-way `change sync` with conflict markers (phase 1), scenario-level deltas + stable IDs (phase 2), AST/CRDT (phase 3). We already implement phase-0-style guards (`expectedSha`, `repositoryRootFingerprint`) at document/repo granularity.
- **beads**: abandoned sequential IDs for content-hash IDs (`bd-a3f8`) — collision resistance by construction; progressive hash-length scaling; `bd update --claim` work claiming. Takeaway: identity without coordination beats coordinated identity.
- **task-master**: single `tasks.json` = worst case; shipped file locking + per-branch "tags" namespaces + `move` renumbering; exploring remote "multiplayer" backend. Takeaway: shared single-file state does not scale; namespace isolation does.
- **towncrier/changesets**: fragment-per-PR files compiled at release — "two PRs adding different files never conflict".
- **ADR practice**: all four strategies observed — PR-number naming + `merge=theirs` (gh-aw), merge-time renumber skill (fullsend), CI uniqueness gate + registry.json projection (port-daddy), merge-base allocation + never-renumber (whychose).
- **OpenSpec `store` command**: named spec stores registered in a local registry file with git remote awareness — direct precedent for our multi-project mounts.

## Registry models

- **Tessl**: hosted registry, semver'd spec packs, workspace roles, lint+evals at publish, archive-not-delete, install with version pins. Governance enforced server-side.
- **Confluent Schema Registry**: subject = evolution scope; compatibility modes (BACKWARD/FORWARD/FULL + transitive) enforced at registration; same-schema re-registration is a no-op (dedup). Our spec `Status:` maps to a compatibility mode.
- **Buf BSR**: registry-side breaking-change checks override local config ("consistent governance without consistent discipline"); violating push → stored but PENDING until owner review. Maps to our service gate + owner approval.
- **MCP Registry**: metadata-only; artifacts stay in npm/GitHub; namespace = proof of GitHub/DNS ownership. Takeaway: registry = pointer + verification, not storage.
- **git-as-registry precedents**: Helm `index.yaml`, Go modules (VCS+tags), Cargo index, Claude plugin `marketplace.json` (we already ship one), Backstage catalog-info aggregation, beads/Dolt state in git refs.

## Decisions this spec takes from the research

1. **Dedicated specs repo** — cleanest write boundary: one canonical store the stack owns; nothing to police on product code branches after migration; service-only pushes; offline read fallback is a plain clone of the specs repo. Layout `<owner>/<project>/.specs/<slug>/` preserves the kernel's `<root>/.specs` convention with `<root> = <repo>/<owner>/<project>`. (Revised 2026-09-13: originally spec'd as per-repo `specs` branches — superseded by the dedicated-repo model.)
2. **D1+D3 authority split** — content in git (D1 facade), claims/ledger/allocation in the service (D3). Rejected D2 (service-owns-content): it would kill PR review and git audit.
3. **Claims + expectedSha** instead of sequential numbers — beads/OpenSpec showed coordination-free identity wins; our existing optimistic concurrency already carries the conflict semantics.
4. **Publish = attested artifact** reusing the release.yml pattern — Buf/Confluent-style gate without a bespoke service.
5. **Deferred auth via seam** — v1 trusted-network + service token; Hub auth is an isolated verifier swap, per R-7.

## Open questions

- ~~Whether `specs` should become a separate repo instead of a branch~~ — **resolved 2026-09-13**: canonical store is a dedicated specs repo from day one (`owner/project/.specs` layout).
- ~~Whether claim enforcement should hard-deny non-holder writes once full auth lands (v1 logs `force` writes instead).~~ — **resolved 2026-09-14 (TASK-12)**: non-holder writes are hard-denied without `force`; `force` itself is owner-only (non-owner hard-denied, owner `force` logged). Identity is the verified YouTrack login.
- Cross-project spec references — deferred.

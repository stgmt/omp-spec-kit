# Security policy

## Current support status

This repository is specification-only. It has no installable plugin or runtime release, so there are no supported runtime versions yet. Security reports about repository content, provenance, publication safety, or future design are still welcome.

## Reporting a vulnerability

When the repository is public, use GitHub's private vulnerability reporting / Security Advisories for this repository. Do not disclose a suspected credential, private path, personal data, or exploitable design in a public issue. Before publication, report privately to the repository owner through an already established private channel.

Include the affected path or planned capability, impact, reproduction or evidence, and any known containment. Do not include real secrets; redact them and provide only the minimum proof needed.

## Import boundary

Imports must come from a named immutable Git commit and an explicit allowlist. Every imported file must have a source path, target path (or explicit exclusion), SHA-256, disposition, and license status in `IMPORT_MANIFEST.yaml`.

The repository must never import or publish:

- `.env` files, API keys, tokens, cookies, credentials, or authentication material;
- logs, caches, coverage output, build output, temporary files, or test-run evidence;
- user or session state, local databases, lock/heartbeat files, editor state, or machine-specific configuration;
- absolute local paths, private endpoints, personal data, or unreviewed generated artifacts;
- files with unresolved redistribution rights.

Discovery of any such content is a publication blocker. Remove it from the candidate history, rotate any exposed credential, re-run provenance review, and document the incident privately before publication.

## Imported-source license gate

The frozen dev-pomogator snapshot remains pinned to commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`. A later merged source-owner attestation at commit `a21d27ba08919cb5340493adac8dbbf2f8fec72a` ([PR #232](https://github.com/stgmt/dev-pomogator/pull/232)) expressly licenses the included `.specs/spec-generator-v4/**` bytes under MIT; exact copies and hashes are recorded under `docs/upstream/dev-pomogator/` and in `IMPORT_MANIFEST.yaml`. This resolves the historical license-evidence gap without changing byte provenance, admitting the three excluded state/temp files, or authorizing publication. Every future or changed import still fails closed until its exact bytes have sufficient recorded redistribution evidence.

## Future runtime boundary

The first plugin release is planned as read-only. It must not write to user repositories, create hidden state, make model/network calls, or execute document content merely by loading the extension. Later authoring or mutation requires separate containment, authorization, CAS, atomicity, audit, and concurrency evidence before release.

# YouTrack Visualization Schema

## Identities

SpecId is <specSlug>:<localId>. Board kinds are FUNCTIONAL_REQUIREMENT, NON_FUNCTIONAL_REQUIREMENT, ACCEPTANCE_CRITERION, TASK, SCENARIO, and ROADMAP. The sync-state issue is metadata and is excluded from corpus counts.

## Card projection

A card contains SpecKind, SpecId, ContentHash, Evidence, native Type, human title, full bounded body, source path and line, and grouped relations. Type values are Feature, Constraint, Criterion, Task, Scenario, and Roadmap.

## Tracker links

The complete allowed set is exactly: satisfies, satisfied-by, verifies, covers, implements, implemented-by, depends-on, constrains, contains. Link direction is meaningful; reverse labels are not aliases.

## BoardProjectionV1

The MCP read model is a complete object with schemaVersion, fingerprint, scope, complete=true, page=null, nodes, edges, and counts. Each node contains canonicalId, specSlug, localId, kind, title, body, contentHash, source, evidence, and taskStatus when applicable. Each edge contains from, to, raw kernel type, and occurrenceCount. Edges whose endpoints are outside the selected board kinds are omitted.

The board branch accepts only view=board and optional specSlugs. Omitted or empty specSlugs means the whole corpus. It has no limit or cursor. A size violation is a typed error, never a partial response.

## BoardSnapshotV1

The committed tracker payload stores BoardProjectionV1 plus snapshotHash and projectionDigest. The pointer stores schemaVersion, source fingerprint, snapshotHash, projectionDigest, scope, nodeCount, edgeCount, and commit marker. Readers accept only a complete hash-matching snapshot.

## Status

TASK status is the only field that may travel back to .specs, through spec_patch. All other card fields and all graph relations are source projections.

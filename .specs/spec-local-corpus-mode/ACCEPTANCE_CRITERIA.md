# Acceptance Criteria

## AC-1.1: Local corpus resolution without a registry

**GIVEN** a working tree whose corpus is present and whose project the registry does not know
**WHEN** the stdio transport serves a catalog request for that root
**THEN** the request SHALL succeed and the envelope SHALL report the local transport, the resolved root and no project source

## AC-2.1: Preflight reports the resolution state

**GIVEN** any resolvable or unresolvable root
**WHEN** the preflight report is requested
**THEN** it SHALL contain transport, project source, resolvable root, registry reachability, guard mode, writability and one next action

## AC-2.2: Refusal carries the report

**GIVEN** a root that cannot be served
**WHEN** any tool call is refused for that reason
**THEN** the refusal SHALL carry the same report object and SHALL NOT carry a credential

## AC-3.1: Registry reachability probe

**GIVEN** a hosted transport and a registry that does not answer within its timeout
**WHEN** the preflight report is requested
**THEN** it SHALL report `registryReachable: false` with `probeTimedOut: true` and the enclosing call SHALL still return its own result

## AC-4.1: Internal URI schemes are not filesystem targets

**GIVEN** a read whose target is `proc://` or an `out://` path
**WHEN** the guard classifies the call
**THEN** it SHALL continue the call and SHALL NOT resolve the value as a path

## AC-4.2: Corpus paths stay contained

**GIVEN** a direct read or write targeting a corpus document by path
**WHEN** the guard classifies the call
**THEN** it SHALL still refuse with the corpus containment code and SHALL name the corpus access tool instead

## AC-5.1: Refusals explain and offer one next action

**GIVEN** a call whose project is outside the caller's allowed set
**WHEN** the refusal is produced
**THEN** it SHALL name the offending project, the allowed projects, and exactly one next action

## AC-6.1: Local writes are transactional and unauthenticated

**GIVEN** a local transport and a patch that touches several documents
**WHEN** the patch is applied
**THEN** the result SHALL be an applied receipt naming every changed document, with no credential read and no partial write on failure

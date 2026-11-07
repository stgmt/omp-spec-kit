# Acceptance Criteria

## AC-1.1: An unknown project is diagnosed

**GIVEN** a call targeting a project the registry does not know
**WHEN** the refusal is produced
**THEN** it SHALL name the project, state that it is not registered, list the projects the caller may use, and give exactly one next action

## AC-2.1: Registration by an authorized principal

**GIVEN** an owner or writer principal and a repository URL
**WHEN** registration is requested
**THEN** the role SHALL be checked before any remote access, the binding SHALL be created, and the response SHALL report the binding
**AND** a principal without the role SHALL be refused before any remote access

## AC-2.2: Registration is idempotent

**GIVEN** a project already bound to the same repository and branch
**WHEN** registration is requested again
**THEN** the result SHALL report unchanged and nothing SHALL be re-migrated

## AC-3.1: First specification bootstrap

**GIVEN** a freshly registered project
**WHEN** the first specification is created through the tool
**THEN** the branch SHALL be created, the scaffold written, and the branch named in the response with no operator step

## AC-4.1: Credential diagnosis

**GIVEN** a credential the service does not accept for the project
**WHEN** registration or preflight is read
**THEN** the response SHALL name the repair to run and SHALL NOT contain the credential value in any field, log or audit record

## AC-5.1: No registry-less fallback

**GIVEN** an unregistered project with a corpus present on disk
**WHEN** any specification tool is called for it
**THEN** the call SHALL be refused with a registration requirement and the action from FR-2
**AND** no tool SHALL serve that corpus locally

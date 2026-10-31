# Acceptance Criteria

Every criterion verifies one functional requirement with one scenario.

## AC-1.1: Memo exists and owns the body

Given the built plugin, when its skills are listed, then exactly one elicitation memo exists and no second file repeats its question steps.

Scenario: SCEN-skill-canonical

## AC-2.1: Hint is single-sourced

Given the contract module, when its exports are read, then one short hint constant exists and server instructions plus the stop error use it with no full-text copy. The raw-write enforcement hook does not carry elicitation text.

Scenario: SCEN-hint-constant

## AC-3.1: Missing canonical Markdown creation is refused once

Given a canonical Markdown document missing on disk, when a real apply is executed, then the result is REFUSED with ELICITATION_REQUIRED and the file bytes are unchanged. A preview returns PREVIEW and does not record a ticket. A multi-document request receives one refusal listing all missing Markdown targets; existing documents and canonical feature files are exempt.

Scenario: SCEN-first-write-nudge

## AC-4.1: Error carries memo and retry rule

Given the refused write, when the error is read, then it names the memo path skill://spec-elicitation and the target documents and states that a retry passes.

Scenario: SCEN-nudge-error-content

## AC-5.1: Retry and later edits pass

Given the recorded ticket, when the operation is repeated, then it commits. A changed retry is also allowed. When any further edit to the same document arrives, then it commits with no second check.

Scenario: SCEN-no-second-nudge

## AC-6.1: Old documents and corpus stay green

Given a document that already exists on disk before the operation, a canonical feature file, and a validated corpus, when edits and corpus checks run, then no stop occurs for the existing or feature document. When the corpus gate runs, then the new specification is listed and the check passes.

Scenario: SCEN-backwards-compat

## AC-7.1: Verification is observable

Given the finished change, when spec inspection, link sweep, corpus check, package verification, live-loader smoke, mutation checks, and the affected replay scenarios run, then each reports success. Qualitative question quality remains outside automated assertions.

Scenario: SCEN-verification

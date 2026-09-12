# Functional Requirements

The guard stops the first real apply for each missing canonical Markdown document and points at one memo. Later edits are untouched.

## FR-1: Elicitation memo is canonical

The project SHALL ship one canonical elicitation memo at plugins slash omp-spec-kit slash skills slash spec-elicitation slash SKILL dot md. It SHALL define the trigger, the source plus gap plus question steps, the dumb-question ban, and the do-it-now mode. No other file SHALL duplicate its body.

## FR-2: Short shared hint is single-sourced

The module src slash adapters slash tool-contracts dot js SHALL export one short hint constant naming the memo path and the one-time stop rule. Server instructions and the stop error SHALL reference that constant and SHALL NOT embed a second full copy. The raw-write enforcement hook does not carry elicitation text.

## FR-3: First missing canonical Markdown creation is refused once

When spec_patch intent patch with dryRun false carries a write operation creating a canonical Markdown document that does not yet exist on disk, the authoring path SHALL refuse the operation once with ELICITATION_REQUIRED, change zero bytes, and record a one-time ticket for that spec plus document. The guard applies to every canonical .md document accepted by isCanonicalDocument and does not apply to canonical .feature files or preview calls with dryRun true. When a multi-document request creates multiple missing markdown documents, the authoring path SHALL issue one refusal for the entire request, listing all created Markdown targets.

## FR-4: Stop error carries memo and retry guidance

The ELICITATION_REQUIRED error SHALL carry the memo path skill://spec-elicitation, the target spec plus document list, and the retry rule: read the memo, assess gaps, ask the user when needed, then retry the operation; later edits are allowed. It SHALL be non-retryable by schema but pass on any later authorized retry after the ticket is recorded; retry payload equality is irrelevant.

## FR-5: Later writes are never stopped

Any write to a document that already exists on disk SHALL be processed with no elicitation check. Once a ticket is recorded for a spec plus document during the cached authoring-service lifetime, subsequent writes to that target SHALL proceed without a second refusal.

## FR-6: Existing corpus is never stopped

Documents that already exist on disk before the operation SHALL never meet the stop. The corpus gate script SHALL list the new specification so the corpus check stays green.

## FR-7: Guard is observably verified

Verification SHALL assert the refused first creation with zero bytes changed, preview exemption, one refusal for multi-document creation, successful retries, the absence of a second stop, package discovery, live OMP execution, and green kernel plus corpus checks. Question quality remains a manual qualitative review and SHALL NOT be machine-asserted.

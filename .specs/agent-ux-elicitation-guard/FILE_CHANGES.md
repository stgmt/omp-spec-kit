# File Changes

## Implemented state

The standalone specification, canonical memo, MCP-side guard, public error contract, package/corpus admission, generated distribution, and public behavior scenarios are implemented. The guard is owned by the authoring path; the raw-write enforcement hook remains unchanged.

## Target files

| File or area | Change |
|---|---|
| plugins/omp-spec-kit/skills/spec-elicitation/SKILL.md | create the canonical elicitation memo |
| src/adapters/tool-contracts.js | add one hint constant plus reference it from server instructions |
| src/authoring/proposals.js, src/authoring/service.js, src/authoring/transactions.js, src/authoring/elicitation-guard.js | preserve missing-target identity, ticket each spec/document pair, and return the refusal error |
| src/enforcement/classifier.js | no change; the raw-write block reason carries no elicitation text |
| scripts/check-spec-corpus.mjs | list the new specification in the expected set |
| scripts/build-plugin.mjs and plugins/omp-spec-kit/dist/ | regenerate distribution with the memo included |
| tests/authoring-elicitation-edges.test.mjs plus safe-authoring/staged fixtures | cover refusal with zero bytes, retry success, restart reissue, no second stop, exemptions, and headless retry |

No second memo copy, no content truth judge, no permanent block, and no hand edit to generated output are in scope. Existing source files change in place.

## Removal proof

Verification checks that full-text memo copies outside the canonical file are zero, refused writes leave zero changed bytes, and ticket state is keyed by spec plus document only.

## Verification files

The behavior is covered by safe-authoring and staged MCP scenarios, focused edge tests, the live OMP manager probe, the Docker discovery selector, package verification, corpus validation, and mutation checks. Generated distribution output is rebuilt from source and is never hand-edited.

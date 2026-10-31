# Schema

## Install mode

`fresh` or `upgrade`. Fresh never seeds specs. Upgrade preserves corpus, cards, dashboard, share, and marker.

## Dashboard contract

- Name: `Spec Stack`
- Widget: `spec-board`, full width/height
- Sharing: `readSharingSettings.permittedGroups` includes `All Users`

## Demo marker

`.spec-kit.json` and/or README carries `demo: true`; the demo is not created by a fresh production install.

## Delete contract

- Whole spec: dedicated audited operation; source and projection removed; canonical branch guard unchanged for ordinary branch delete.
- Entity: `deleteEntity` with `entity`, optional `force`, optional `designReview` for scenario documents.
- Refusal codes: `ENTITY_NOT_FOUND`, `ENTITY_HAS_DEPENDENTS`, `DELETE_FORBIDDEN`, `DESIGN_REVIEW_REQUIRED`.

## Warning contract

One bounded message per session; no secrets; non-blocking; fields include the missing prerequisite and the next action.

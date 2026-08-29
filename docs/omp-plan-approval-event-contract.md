# OMP selected-plan approval event contract

## Status

Required future host ABI for automatic `plan-gate`; absent from pinned OMP v17.3.7 commit `8500092296621a6826b7136e840f8a59ea338958`. This document is a target contract, not evidence of host support.

## Event

The host emits `plan_approval_requested` only after native `resolveApprovedPlan` has selected and read the exact plan. The event is delivered before approval UI acceptance or execution.

```ts
interface PlanApprovalRequestedEvent {
  type: "plan_approval_requested";
  requestId: string;
  selectionSessionId: string;
  approvalSessionId: string;
  transitionKind: "SAME_SESSION" | "HOST_APPROVAL_FORK";
  transitionPlanSha256: string;
  planMode: true;
  planFileUrl: string;       // canonical local:// or supported host URL selected by native resolver
  planContent: string;
  planSha256: string;        // lowercase SHA-256 of exact UTF-8 planContent
  suppliedTitle: string;
  normalizedSlug: string;
}

interface PlanApprovalRequestedResult {
  block: boolean;
  reason?: string;           // required/bounded when block=true
  diagnostics?: {code:string;severity:"ERROR"|"WARNING"|"INFO";phase:string;message:string;line:number|null;hint:string|null}[];
}
```

## Invariants

- Host, not the extension, owns plan fallback resolution and session-transition copying.
- `planFileUrl`, content and hash name one selected plan; the extension performs no directory scan or fallback search.
- `SAME_SESSION` requires equal selection/approval IDs; `HOST_APPROVAL_FORK` requires distinct IDs and a host-minted `transitionPlanSha256` equal to `planSha256`.
- The event is never emitted for nested device dispatch, non-plan writes or non-plan mode.
- All handlers run under the existing `tool_call`-class outer timeout. The gate's internal deadline is at most 20 seconds so it returns before the default 30-second host fail-closed boundary.
- Handler exception/internal deadline returns `block:false` plus one bounded diagnostic. Outer host timeout/error remains fail-closed and is an implementation defect, not ordinary fail-open behavior.
- Multiple handlers compose deterministically; any `block:true` blocks approval.
- Event/result contain no credentials, environment, arbitrary filesystem paths or unrelated messages.

## Required host proof

A future OMP pin must provide source and behavioral receipts proving:

1. exact emission after `resolveApprovedPlan` and before approval;
2. title/state/newest-plan fallback already resolved by the host;
3. local artifact root and session-transition behavior, including selection/approval IDs, transition kind and copied-plan hash;
4. hash equality to exact selected content;
5. block/allow propagation;
6. handler timeout ordering;
7. no emission for nested/non-plan calls.

Until that pin is adopted, automatic plan gate state is `DEFERRED_HOST_ABI`. Manual/advisory validation of an explicitly supplied plan remains implementable and must not be described as automatic interception.

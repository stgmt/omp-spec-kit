import { validateExactPlan } from "./validator.js";

/** Register the exact selected-plan gate when the OMP ABI exposes its event. */
export function registerAutomaticPlanGate(pi, options = {}) {
  if (typeof pi?.on !== "function") return false;
  const validate = options.validate ?? validateExactPlan;
  pi.on("plan_approval_requested", (event) => {
    const result = validate(event);
    if (result.status !== "VALID") {
      return {
        block: true,
        reason: `selected plan gate ${result.status.toLowerCase()}: ${result.findings.map((item) => item.code).join(", ")}`,
      };
    }
    return undefined;
  });
  return true;
}

export { validateExactPlan } from "./validator.js";

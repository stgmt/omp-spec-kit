/** One owner for the acceptable projection outcomes and their error message. */
export function projectionOutcome(result) {
  if (["SYNCED", "SKIPPED", "PARTIAL"].includes(result?.outcome)) return result;
  throw new Error(`projection sync did not reach a committed outcome: ${JSON.stringify(result)}`);
}

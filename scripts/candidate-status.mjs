/**
 * CANDIDATE-arm surface gate for release-status receipts.
 *
 * The whitelist pins every version that ever shipped the consolidated tool
 * surface; each arm asserts the receipt claims the exact surface that version
 * published. Throws on identity drift instead of exiting so test fixtures can
 * drive the rejection paths.
 */
export function assertCandidateSurface(version, releaseStatus) {
  const status = releaseStatus?.status;
  if (
    version === "2.8.0" ||
    version === "2.7.0" ||
    version === "2.6.2" ||
    version === "2.6.1" ||
    version === "2.6.0" ||
    version === "2.5.0" ||
    version === "2.4.0" ||
    version === "2.3.0" ||
    version === "2.2.1" ||
    version === "2.2.0" ||
    version === "2.1.0" ||
    version === "2.0.0" ||
    version === "1.4.0" ||
    version === "1.3.2" ||
    version === "1.3.1" ||
    version === "1.3.0" ||
    version === "1.1.0" ||
    version === "1.0.2" ||
    version === "1.0.1" ||
    version === "1.0.0" ||
    version === "0.10.2"
  ) {
    if (
      status?.public !== false ||
      status?.installable !== false ||
      status?.surface !== "SAFE_AUTHORING" ||
      status?.toolCount !== 10
    ) {
      throw new Error("candidate status is not the 10-tool consolidated surface");
    }
    return;
  }
  if (version === "0.10.1") {
    if (
      status?.public !== false ||
      status?.installable !== false ||
      status?.surface !== "SAFE_AUTHORING" ||
      status?.toolCount !== 10
    ) {
      throw new Error("candidate status is not the 10-tool consolidated surface");
    }
    return;
  }
  if (version === "0.8.1" || version === "0.8.2") {
    if (
      status?.public !== false ||
      status?.installable !== false ||
      status?.surface !== "SAFE_AUTHORING" ||
      status?.toolCount !== 11
    ) {
      throw new Error("candidate status is not the 11-tool consolidated surface");
    }
    return;
  }
  if (version === "0.6.0" || version === "0.7.0") {
    if (
      status?.public !== false ||
      status?.installable !== false ||
      status?.surface !== "SAFE_AUTHORING" ||
      status?.toolCount !== 49
    ) {
      throw new Error("candidate status is not the 49-tool safe authoring surface");
    }
    return;
  }
  if (
    status?.public !== false ||
    status?.installable !== false ||
    status?.surface !== "EVIDENCE_NAVIGATION" ||
    status?.toolCount !== 27
  ) {
    throw new Error("v0.5 candidate status is not the additive evidence/navigation surface");
  }
}

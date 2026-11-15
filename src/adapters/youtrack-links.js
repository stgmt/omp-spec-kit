/**
 * Direction labels must be unique across ALL tracker link types: a label
 * another type already owns makes the workflow scripting accessor
 * (issue.links['...']) a duplicate property and every on-change rule touching
 * links throws TypeError. "depends on" is the stock Depend type's target
 * label, so ours stay namespaced.
 */
export const LINK_TYPE_LABELS = Object.freeze({
  satisfies: ["satisfies", "satisfied by"],
  verifies: ["verifies", "verified by"],
  covers: ["covers", "covered by"],
  implements: ["implements", "implemented by"],
  "depends-on": ["depends-on", "required-by"],
  constrains: ["constrains", "constrained by"],
  contains: ["contains", "contained by"],
});

/**
 * Mirrored inverse types (satisfied-by, implemented-by) predate the
 * canonical+flip emission: each one re-declares a direction label its
 * canonical sibling already owns, which is exactly the duplicate-accessor
 * crash above. They are deleted under `migrate: true`; the next sync recreates
 * the links under the canonical type.
 */
export const LEGACY_INVERSE_LINK_TYPES = Object.freeze(["satisfied-by", "implemented-by"]);

/** Report what the spec projection needs but the tracker does not have yet. */
export async function inspectLinkTypes(client) {
  const rows = await client.get("/api/issueLinkTypes?fields=id,name,directed,sourceToTarget,targetToSource");
  const byName = new Map((rows ?? []).map((row) => [row.name, row]));
  const missing = [];
  const conflicts = [];
  for (const name of Object.keys(LINK_TYPE_LABELS)) {
    const existing = byName.get(name);
    if (!existing) {
      missing.push(name);
      continue;
    }
    if (existing.directed !== true) conflicts.push({ linkType: name, reason: "undirected" });
  }
  for (const legacy of LEGACY_INVERSE_LINK_TYPES) {
    if (byName.has(legacy)) conflicts.push({ linkType: legacy, reason: "legacy-inverse" });
  }
  return { missing, conflicts };
}

/**
 * Ensures the spec link types exist as directed link types with unique
 * direction labels. An existing undirected type is only replaced under
 * `migrate`: deleting a type drops its links, and the next sync recreates them
 * from the spec projection. Directed types whose labels drifted are updated in
 * place — links survive.
 *
 * Unsafe states throw before any write so a refusal never leaves the tracker
 * half provisioned.
 */
export async function provisionLinkTypes(client, { migrate = false, log = () => {} } = {}) {
  const { missing, conflicts } = await inspectLinkTypes(client);
  for (const conflict of conflicts) {
    if (conflict.linkType !== undefined && LEGACY_INVERSE_LINK_TYPES.includes(conflict.linkType) && migrate) continue;
    if (conflict.reason === "undirected" && migrate) continue;
    if (conflict.reason === "legacy-inverse") {
      throw new Error(
        "link type " +
          conflict.linkType +
          " is a legacy inverse type whose direction labels collide with its canonical sibling; rerun with --migrate to delete it (its links are dropped, sync recreates them canonically)"
      );
    }
    throw new Error(
      "link type " +
        conflict.linkType +
        " exists but is undirected; rerun with --migrate to recreate it directed (its links are dropped, sync recreates them)"
    );
  }
  const created = [];
  const relabelled = [];
  const rows = await client.get("/api/issueLinkTypes?fields=id,name,directed,sourceToTarget,targetToSource");
  const byName = new Map((rows ?? []).map((row) => [row.name, row]));
  for (const legacy of LEGACY_INVERSE_LINK_TYPES) {
    const existing = byName.get(legacy);
    if (!existing) continue;
    await client.delete("/api/issueLinkTypes/" + existing.id);
    log(JSON.stringify({ op: "delete-legacy-link-type", name: legacy }));
  }
  for (const name of Object.keys(LINK_TYPE_LABELS)) {
    const [sourceToTarget, targetToSource] = LINK_TYPE_LABELS[name];
    const existing = byName.get(name);
    if (existing && existing.directed === true) {
      if (existing.sourceToTarget !== sourceToTarget || existing.targetToSource !== targetToSource) {
        await client.post("/api/issueLinkTypes/" + existing.id + "?fields=id,name", { sourceToTarget, targetToSource });
        relabelled.push(name);
        log(JSON.stringify({ op: "relabel-link-type", name, sourceToTarget, targetToSource }));
      }
      continue;
    }
    if (existing) await client.delete("/api/issueLinkTypes/" + existing.id);
    await client.post("/api/issueLinkTypes?fields=id,name", {
      name,
      directed: true,
      sourceToTarget,
      targetToSource,
    });
    created.push(name);
    log(JSON.stringify({ op: "provision-link-type", name, directed: true }));
  }
  return { created, relabelled, missing };
}

import { KIND_LABELS, TYPE_PER_KIND } from "./youtrack-projection.js";

/**
 * The tracker schema the projection writes. These fields are prerequisites of a
 * card, not optional decoration: without them every card create fails with
 * "incompatible-issue-custom-field-name", the board marker is never published,
 * and the widget stays empty with no reason attached.
 *
 * SpecKind and Type are single enums (written as SingleEnumIssueCustomField),
 * the rest are text — see src/adapters/youtrack-store.js.
 */
export const TRACKER_TEXT_FIELDS = Object.freeze(["SpecId", "ContentHash", "Evidence"]);

export const TRACKER_ENUM_FIELDS = Object.freeze({
  SpecKind: Object.freeze({ bundle: "SpecKind values", values: Object.freeze([...new Set(Object.values(KIND_LABELS))]) }),
  Type: Object.freeze({ bundle: "Type values", values: Object.freeze([...new Set(Object.values(TYPE_PER_KIND))]) }),
});

export const TRACKER_FIELDS = Object.freeze([...TRACKER_TEXT_FIELDS, ...Object.keys(TRACKER_ENUM_FIELDS)]);

export function desiredFieldType(name) {
  return name in TRACKER_ENUM_FIELDS ? "enum[1]" : "text";
}

export async function resolveTrackerProject(client, projectShortName) {
  const rows = await client.get("/api/admin/projects?fields=id,shortName");
  const row = (Array.isArray(rows) ? rows : []).find((project) => project.shortName === projectShortName);
  if (!row) throw Object.assign(new Error(`GET /api/admin/projects => 404 no project ${projectShortName}`), { code: "PROJECT_MISSING" });
  return row;
}

async function readGlobalFields(client) {
  const rows = await client.get("/api/admin/customFieldSettings/customFields?fields=id,name,fieldType(id)");
  const byName = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.name === "string") byName.set(row.name, row);
  }
  return byName;
}

/**
 * The attached project fields carry the bundle that actually receives values.
 * Reading it here is what keeps a repair from creating a second bundle beside
 * an existing one under a different name.
 */
export async function readProjectFields(client, projectId) {
  const rows = await client.get(
    `/api/admin/projects/${projectId}/customFields?fields=id,$type,field(id,name,fieldType(id)),bundle(id,name,values(name))`
  );
  const byName = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = row?.field?.name;
    if (typeof name === "string") byName.set(name, row);
  }
  return byName;
}

/** Read-only: what the projection needs and what the tracker is missing. */
export async function inspectProjectSchema({ client, projectShortName }) {
  const project = await resolveTrackerProject(client, projectShortName);
  const global = await readGlobalFields(client);
  const attached = await readProjectFields(client, project.id);
  const missing = [];
  const conflicts = [];
  const enumValuesMissing = [];
  for (const name of TRACKER_FIELDS) {
    const expected = desiredFieldType(name);
    const field = global.get(name);
    if (!field) {
      missing.push(name);
      continue;
    }
    if (field.fieldType?.id !== expected) {
      conflicts.push({ field: name, expected, actual: field.fieldType?.id ?? null });
      continue;
    }
    const attachment = attached.get(name);
    if (!attachment) {
      missing.push(name);
      continue;
    }
    if (name in TRACKER_ENUM_FIELDS) {
      if (!attachment.bundle?.id) {
        conflicts.push({ field: name, reason: "attached-without-bundle" });
        continue;
      }
      const present = new Set((attachment.bundle.values ?? []).map((value) => value?.name));
      for (const value of TRACKER_ENUM_FIELDS[name].values) {
        if (!present.has(value)) enumValuesMissing.push(`${attachment.bundle.name}:${value}`);
      }
    }
  }
  return { project, global, attached, missing, conflicts, enumValuesMissing };
}

/**
 * Idempotent repair of the tracker schema. Writes only what is missing; an
 * existing field is never retyped or deleted, and enum values go into the
 * bundle the project field is already attached to.
 */
export async function provisionProjectSchema({ client, projectShortName, log = () => {} }) {
  const state = await inspectProjectSchema({ client, projectShortName });
  const { project, global, attached, conflicts } = state;
  const created = [];
  const attachedNow = [];
  const enumValuesAdded = [];
  // A conflict is the operator's call: report it and leave the field alone.
  const blocked = new Set(conflicts.map((row) => row.field));

  for (const name of TRACKER_FIELDS) {
    if (blocked.has(name)) continue;
    const expected = desiredFieldType(name);
    let field = global.get(name);
    if (!field) {
      field = await client.post("/api/admin/customFieldSettings/customFields?fields=id,name,fieldType(id)", {
        name,
        fieldType: { id: expected },
      });
      global.set(name, field);
      created.push(name);
      log(JSON.stringify({ op: "tracker-field-created", project: projectShortName, field: name, type: expected }));
    }
    const attachment = attached.get(name);
    if (name in TRACKER_ENUM_FIELDS) {
      const spec = TRACKER_ENUM_FIELDS[name];
      let bundle = attachment?.bundle?.id ? { id: attachment.bundle.id, name: attachment.bundle.name, values: attachment.bundle.values ?? [] } : null;
      if (attachment && !bundle) continue; // reported as a conflict by the inspection
      if (!bundle) {
        const existing = await client.get(
          `/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)&query=${encodeURIComponent(spec.bundle)}`
        );
        bundle = (Array.isArray(existing) ? existing : []).find((row) => row?.name === spec.bundle) ?? null;
      }
      if (!bundle) {
        bundle = await client.post("/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)", {
          name: spec.bundle,
          values: spec.values.map((value) => ({ name: value })),
        });
        for (const value of spec.values) enumValuesAdded.push(`${spec.bundle}:${value}`);
      } else {
        const present = new Set((bundle.values ?? []).map((value) => value?.name));
        for (const value of spec.values) {
          if (present.has(value)) continue;
          await client.post(`/api/admin/customFieldSettings/bundles/enum/${bundle.id}/values?fields=id,name`, {
            name: value,
            $type: "EnumBundleElement",
          });
          enumValuesAdded.push(`${bundle.name}:${value}`);
        }
      }
      if (!attachment) {
        await client.post(`/api/admin/projects/${project.id}/customFields?fields=id`, {
          $type: "EnumProjectCustomField",
          field: { id: field.id, $type: "CustomField" },
          bundle: { id: bundle.id, $type: "EnumBundle" },
          canBeEmpty: true,
          emptyFieldText: `No ${name}`,
        });
        attachedNow.push(name);
        log(JSON.stringify({ op: "tracker-field-attached", project: projectShortName, field: name }));
      }
      continue;
    }
    if (attachment) continue;
    await client.post(`/api/admin/projects/${project.id}/customFields?fields=id`, {
      $type: "TextProjectCustomField",
      field: { id: field.id },
      canBeEmpty: true,
    });
    attachedNow.push(name);
    log(JSON.stringify({ op: "tracker-field-attached", project: projectShortName, field: name }));
  }
  return { created, attached: attachedNow, enumValuesAdded, conflicts };
}

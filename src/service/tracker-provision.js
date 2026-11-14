import { KIND_LABELS, TYPE_PER_KIND } from "../adapters/youtrack-projection.js";
import { YouTrackClient } from "../adapters/youtrack-store.js";
import { inspectLinkTypes, provisionLinkTypes } from "../adapters/youtrack-links.js";

/**
 * The tracker schema the projection writes. These fields are prerequisites of a
 * card, not optional decoration: without them every card create fails with
 * "incompatible-issue-custom-field-name", the board marker is never published,
 * and the widget stays empty with no reason attached.
 *
 * The list mirrors src/adapters/youtrack-store.js: SpecKind and Type are single
 * enums (written as SingleEnumIssueCustomField), the rest are text.
 */
export const TRACKER_TEXT_FIELDS = Object.freeze(["SpecId", "ContentHash", "Evidence"]);

export const TRACKER_ENUM_FIELDS = Object.freeze({
  SpecKind: Object.freeze({ bundle: "SpecKind values", values: Object.freeze([...new Set(Object.values(KIND_LABELS))]) }),
  Type: Object.freeze({ bundle: "Type values", values: Object.freeze([...new Set(Object.values(TYPE_PER_KIND))]) }),
});

const AUTHORIZATION_PATTERN = /=>\s*(401|403)\b/u;

/** A refusal that is about rights is not a bug: it must be reported, not thrown. */
function classify(error) {
  const message = String(error?.message ?? error);
  if (/rerun with --migrate/u.test(message)) return "TRACKER_FIELD_CONFLICT";
  if (AUTHORIZATION_PATTERN.test(message)) return "TRACKER_NOT_AUTHORIZED";
  if (/=>\s*404\b/u.test(message)) return "TRACKER_PROJECT_MISSING";
  return "TRACKER_UNAVAILABLE";
}

function fieldTypeMatches(actual, expected) {
  return actual === expected;
}

function desiredType(name) {
  return name in TRACKER_ENUM_FIELDS ? "enum[1]" : "text";
}

async function resolveProject(client, projectShortName) {
  const rows = await client.get("/api/admin/projects?fields=id,shortName");
  const row = (Array.isArray(rows) ? rows : []).find((project) => project.shortName === projectShortName);
  if (!row) {
    const error = new Error(`GET /api/admin/projects => 404 no project ${projectShortName}`);
    throw error;
  }
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

async function readProjectFields(client, projectId) {
  const rows = await client.get(
    `/api/admin/projects/${projectId}/customFields?fields=id,$type,field(id,name),bundle(id,values(name))`
  );
  const byName = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = row?.field?.name;
    if (typeof name === "string") byName.set(name, row);
  }
  return byName;
}

async function findEnumBundle(client, name) {
  const rows = await client.get(
    `/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)&query=${encodeURIComponent(name)}`
  );
  return (Array.isArray(rows) ? rows : []).find((bundle) => bundle?.name === name) ?? null;
}

/**
 * Read-only: report what the projection needs and what is missing.
 * Never writes, never deletes, never retypes an existing field.
 */
export async function checkTrackerSchema({ client, projectShortName }) {
  try {
    const project = await resolveProject(client, projectShortName);
    const global = await readGlobalFields(client);
    const attached = await readProjectFields(client, project.id);
    const links = await inspectLinkTypes(client);
    const missing = [];
    const conflicts = [];
    for (const name of [...TRACKER_TEXT_FIELDS, ...Object.keys(TRACKER_ENUM_FIELDS)]) {
      const expected = desiredType(name);
      const field = global.get(name);
      if (!field) {
        missing.push(name);
        continue;
      }
      if (!fieldTypeMatches(field.fieldType?.id, expected)) {
        conflicts.push({ field: name, expected, actual: field.fieldType?.id ?? null });
        continue;
      }
      const attachment = attached.get(name);
      if (!attachment) missing.push(name);
    }
    const linkMissing = links.missing;
    const linkConflicts = links.conflicts;
    const code =
      conflicts.length > 0 || linkConflicts.length > 0
        ? "TRACKER_FIELD_CONFLICT"
        : missing.length > 0 || linkMissing.length > 0
          ? "TRACKER_FIELDS_MISSING"
          : "TRACKER_READY";
    return {
      code,
      project: projectShortName,
      projectId: project.id,
      missing,
      missingLinkTypes: linkMissing,
      conflicts: [...conflicts, ...linkConflicts],
      created: [],
      attached: [],
      enumValuesAdded: [],
      linkTypesCreated: [],
    };
  } catch (error) {
    return {
      code: classify(error),
      project: projectShortName,
      projectId: null,
      missing: [],
      conflicts: [],
      created: [],
      attached: [],
      enumValuesAdded: [],
      message: String(error?.message ?? error).slice(0, 300),
    };
  }
}

/**
 * Idempotent repair: create the fields that do not exist, attach them to the
 * tracker project, and top up enum values. A field that already exists with a
 * different type is a conflict — the operator must decide, so it is reported and
 * left untouched. Workflows, other projects and any existing value are never
 * touched.
 */
export async function repairTrackerSchema({ client, projectShortName, log = () => {} }) {
  const created = [];
  const attached = [];
  const enumValuesAdded = [];
  const conflicts = [];
  let linkTypesCreated = [];
  try {
    const project = await resolveProject(client, projectShortName);
    // Link types are as much a prerequisite as the fields: an edge the tracker
    // has no type for fails the whole projection with "cannot materialize link".
    // A refusal here must not stop the fields from being created — the final
    // verification reports the link conflict and the operator decides.
    let linkError = null;
    try {
      linkTypesCreated = (await provisionLinkTypes(client, { log })).created;
    } catch (error) {
      linkError = error;
    }
    const global = await readGlobalFields(client);
    const alreadyAttached = await readProjectFields(client, project.id);

    for (const name of [...TRACKER_TEXT_FIELDS, ...Object.keys(TRACKER_ENUM_FIELDS)]) {
      const expected = desiredType(name);
      let field = global.get(name);
      if (field && !fieldTypeMatches(field.fieldType?.id, expected)) {
        conflicts.push({ field: name, expected, actual: field.fieldType?.id ?? null });
        continue;
      }
      if (!field) {
        field = await client.post("/api/admin/customFieldSettings/customFields?fields=id,name,fieldType(id)", {
          name,
          fieldType: { id: expected },
        });
        global.set(name, field);
        created.push(name);
        log({ op: "tracker-field-created", project: projectShortName, field: name, type: expected });
      }
      if (alreadyAttached.has(name)) continue;

      if (name in TRACKER_ENUM_FIELDS) {
        const spec = TRACKER_ENUM_FIELDS[name];
        let bundle = await findEnumBundle(client, spec.bundle);
        if (!bundle) {
          bundle = await client.post("/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)", {
            name: spec.bundle,
            values: spec.values.map((value) => ({ name: value })),
          });
          enumValuesAdded.push(...spec.values.map((value) => `${spec.bundle}:${value}`));
        } else {
          const present = new Set((bundle.values ?? []).map((value) => value?.name));
          for (const value of spec.values) {
            if (present.has(value)) continue;
            await client.post(`/api/admin/customFieldSettings/bundles/enum/${bundle.id}/values?fields=id,name`, {
              name: value,
              $type: "EnumBundleElement",
            });
            enumValuesAdded.push(`${spec.bundle}:${value}`);
          }
        }
        await client.post(`/api/admin/projects/${project.id}/customFields?fields=id`, {
          $type: "EnumProjectCustomField",
          field: { id: field.id, $type: "CustomField" },
          bundle: { id: bundle.id, $type: "EnumBundle" },
          canBeEmpty: true,
          emptyFieldText: `No ${name}`,
        });
      } else {
        await client.post(`/api/admin/projects/${project.id}/customFields?fields=id`, {
          $type: "TextProjectCustomField",
          field: { id: field.id },
          canBeEmpty: true,
        });
      }
      attached.push(name);
      log({ op: "tracker-field-attached", project: projectShortName, field: name });
    }
  } catch (error) {
    return {
      code: classify(error),
      project: projectShortName,
      projectId: null,
      missing: [],
      conflicts,
      created,
      attached,
      enumValuesAdded,
      linkTypesCreated,
      message: String(error?.message ?? error).slice(0, 300),
    };
  }
  const verified = await checkTrackerSchema({ client, projectShortName });
  const merged = new Map();
  for (const conflict of [...conflicts, ...verified.conflicts]) merged.set(conflict.field, conflict);
  return {
    ...verified,
    conflicts: [...merged.values()],
    created,
    attached,
    enumValuesAdded,
    linkTypesCreated,
    message: typeof linkError !== "undefined" && linkError ? String(linkError.message ?? linkError).slice(0, 300) : null,
  };
}

/**
 * One provisioner per service: keeps the last known state so a preflight read
 * does not hammer the tracker, and repairs lazily when asked to ensure.
 */
export function createTrackerProvisioner({ baseUrl, token, projectShortName, enabled = true, log = () => {} }) {
  let client = enabled && baseUrl && token ? new YouTrackClient({ host: baseUrl, token }) : null;
  let state = null;
  return {
    /** Replace the transport (tests inject a fake; the service passes the real client). */
    useClient(next) {
      client = next;
      return this;
    },
    lastState() {
      return state;
    },
    async check() {
      const transport = client;
      if (!transport?.get) {
        state = {
          code: "TRACKER_UNAVAILABLE",
          project: projectShortName,
          projectId: null,
          missing: [],
          conflicts: [],
          created: [],
          attached: [],
          enumValuesAdded: [],
          message: "no tracker credentials configured",
        };
        return state;
      }
      state = await checkTrackerSchema({ client: transport, projectShortName });
      return state;
    },
    async ensure() {
      const transport = client;
      if (!transport?.get) return this.check();
      state = await repairTrackerSchema({ client: transport, projectShortName, log });
      log({ op: "tracker-provision", project: projectShortName, code: state.code, created: state.created.length, attached: state.attached.length, conflicts: state.conflicts.length });
      return state;
    },
  };
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TRACKER_ENUM_FIELDS,
  TRACKER_TEXT_FIELDS,
  checkTrackerSchema,
  createTrackerProvisioner,
  repairTrackerSchema,
} from "../../../src/service/tracker-provision.js";

const ALL_FIELDS = [...TRACKER_TEXT_FIELDS, ...Object.keys(TRACKER_ENUM_FIELDS)];

/**
 * Minimal YouTrack double: keeps global fields, project attachments and enum
 * bundles, and records every call so the tests can prove what was (not) touched.
 */
function trackerDouble({
  project = { id: "0-1", shortName: "SPEC" },
  fields = [],
  attached = [],
  bundles = [],
  linkTypes = [],
} = {}) {
  const state = {
    fields: new Map(fields.map((row) => [row.name, row])),
    attached: new Map(attached.map((row) => [row.name, row])),
    bundles: new Map(bundles.map((row) => [row.name, row])),
    linkTypes: new Map(linkTypes.map((row) => [row.name, row])),
  };
  const calls = [];
  let nextId = 100;
  const client = {
    calls,
    state,
    async delete(path) {
      calls.push(["DELETE", path]);
      const id = path.split("/").pop();
      for (const [name, row] of state.linkTypes) if (row.id === id) state.linkTypes.delete(name);
    },
    async get(path) {
      calls.push(["GET", path]);
      if (path.startsWith("/api/admin/projects?")) return project ? [project] : [];
      if (path === "/api/issueLinkTypes?fields=id,name,directed,sourceToTarget,targetToSource") {
        return [...state.linkTypes.values()];
      }
      if (path.startsWith("/api/admin/customFieldSettings/customFields")) {
        return [...state.fields.values()].map((row) => ({ id: row.id, name: row.name, fieldType: { id: row.type } }));
      }
      if (/^\/api\/admin\/projects\/[^/]+\/customFields/u.test(path)) {
        return [...state.attached.values()].map((row) => ({
          id: row.id,
          $type: row.$type,
          field: { id: state.fields.get(row.name)?.id, name: row.name },
          bundle: row.bundleId ? { id: row.bundleId, values: state.bundles.get(row.bundleName)?.values } : null,
        }));
      }
      if (path.startsWith("/api/admin/customFieldSettings/bundles/enum")) {
        return [...state.bundles.values()].map((row) => ({ id: row.id, name: row.name, values: row.values }));
      }
      throw new Error(`unexpected GET ${path}`);
    },
    async post(path, body) {
      calls.push(["POST", path, body]);
      if (path.startsWith("/api/issueLinkTypes?")) {
        const row = { id: `lt-${nextId++}`, name: body.name, directed: body.directed, sourceToTarget: body.sourceToTarget, targetToSource: body.targetToSource };
        state.linkTypes.set(row.name, row);
        return row;
      }
      if (path.startsWith("/api/admin/customFieldSettings/customFields")) {
        const row = { id: `cf-${nextId++}`, name: body.name, type: body.fieldType?.id };
        state.fields.set(body.name, row);
        return { id: row.id, name: row.name, fieldType: { id: row.type } };
      }
      if (/^\/api\/admin\/projects\/[^/]+\/customFields/u.test(path)) {
        const name = [...state.fields.values()].find((row) => row.id === body.field?.id)?.name;
        state.attached.set(name, { id: `pc-${nextId++}`, name, $type: body.$type, bundleId: body.bundle?.id ?? null });
        return { id: `pc-${nextId}` };
      }
      if (path.startsWith("/api/admin/customFieldSettings/bundles/enum/") && path.endsWith("/values")) {
        const id = path.split("/")[5];
        const bundle = [...state.bundles.values()].find((row) => row.id === id);
        bundle.values.push({ name: body.name });
        return { id: `v-${nextId++}`, name: body.name };
      }
      if (path.startsWith("/api/admin/customFieldSettings/bundles/enum")) {
        const row = { id: `b-${nextId++}`, name: body.name, values: (body.values ?? []).map((value) => ({ name: value.name })) };
        state.bundles.set(row.name, row);
        return { id: row.id, name: row.name, values: row.values };
      }
      throw new Error(`unexpected POST ${path}`);
    },
  };
  return client;
}

describe("tracker schema provisioning", () => {
  it("reports every field as missing on a tracker that has none", async () => {
    const client = trackerDouble();
    const state = await checkTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_FIELDS_MISSING");
    assert.deepEqual(state.missing.sort(), [...ALL_FIELDS].sort());
    assert.equal(client.calls.filter(([method]) => method === "POST").length, 0, "check must not write");
  });

  it("creates and attaches the fields once", async () => {
    const client = trackerDouble();
    const first = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(first.code, "TRACKER_READY");
    assert.deepEqual(first.created.sort(), [...ALL_FIELDS].sort());
    assert.deepEqual(first.attached.sort(), [...ALL_FIELDS].sort());
    assert.equal(client.state.attached.size, ALL_FIELDS.length);
    // Enum fields must carry a bundle, text fields must not.
    assert.equal(client.state.attached.get("SpecKind").$type, "EnumProjectCustomField");
    assert.equal(client.state.attached.get("SpecId").$type, "TextProjectCustomField");
    assert.deepEqual(
      client.state.bundles.get("SpecKind values").values.map((value) => value.name).sort(),
      [...TRACKER_ENUM_FIELDS.SpecKind.values].sort()
    );
  });

  it("changes nothing on a second run", async () => {
    const client = trackerDouble();
    await repairTrackerSchema({ client, projectShortName: "SPEC" });
    const writesBefore = client.calls.filter(([method]) => method === "POST").length;
    const second = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    const writesAfter = client.calls.filter(([method]) => method === "POST").length;
    assert.equal(second.code, "TRACKER_READY");
    assert.deepEqual(second.created, []);
    assert.deepEqual(second.attached, []);
    assert.equal(writesAfter, writesBefore, "an idempotent repair must not write");
  });

  it("refuses to retype an existing field and reports the conflict", async () => {
    const client = trackerDouble({ fields: [{ id: "cf-1", name: "SpecKind", type: "text" }] });
    const state = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_FIELD_CONFLICT");
    assert.deepEqual(state.conflicts, [{ field: "SpecKind", expected: "enum[1]", actual: "text" }]);
    assert.equal(client.state.fields.get("SpecKind").type, "text", "the existing field must stay untouched");
    assert.equal(
      client.calls.some(([method, path]) => method === "POST" && path.includes("customFieldSettings/customFields") && path === "" ),
      false
    );
  });

  it("tops up missing enum values without recreating the bundle", async () => {
    const client = trackerDouble({
      bundles: [{ id: "b-1", name: "SpecKind values", values: [{ name: "TASK" }] }],
    });
    const state = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_READY");
    assert.equal(state.enumValuesAdded.includes("SpecKind values:TASK"), false);
    assert.equal(
      state.enumValuesAdded.filter((entry) => entry.startsWith("SpecKind values:")).length,
      TRACKER_ENUM_FIELDS.SpecKind.values.length - 1
    );
  });

  it("creates the directed link types the projection needs", async () => {
    const client = trackerDouble();
    const state = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_READY");
    assert.deepEqual(state.linkTypesCreated.sort(), ["constrains", "contains", "covers", "depends-on", "implements", "satisfies", "verifies"]);
    for (const row of client.state.linkTypes.values()) assert.equal(row.directed, true);
  });

  it("reports an undirected link type as a conflict and writes nothing", async () => {
    const client = trackerDouble({
      linkTypes: [{ id: "lt-1", name: "implements", directed: false, sourceToTarget: "implements", targetToSource: "implemented by" }],
    });
    const state = await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_FIELD_CONFLICT");
    assert.equal(state.conflicts.some((row) => row.linkType === "implements"), true);
    assert.equal(client.state.linkTypes.get("implements").directed, false);
  });

  it("reports a missing admin right instead of throwing", async () => {
    const client = {
      async get() {
        throw new Error("GET /api/admin/projects?fields=id,shortName => 403 forbidden");
      },
      async post() {
        throw new Error("must not write");
      },
    };
    const state = await checkTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(state.code, "TRACKER_NOT_AUTHORIZED");
  });

  it("never touches workflows or other projects", async () => {
    const client = trackerDouble();
    await repairTrackerSchema({ client, projectShortName: "SPEC" });
    assert.equal(
      client.calls.some(([, path]) => /workflows|projects\/(?!0-1)/u.test(path)),
      false,
      "provisioning must stay inside the tracker project's field settings"
    );
  });

  it("keeps the last state so a preflight read needs no tracker call", async () => {
    const client = trackerDouble();
    const provisioner = createTrackerProvisioner({ baseUrl: "http://tracker", token: "t", projectShortName: "SPEC" }).useClient(client);
    await provisioner.ensure();
    const readsBefore = client.calls.length;
    const cached = provisioner.lastState();
    assert.equal(cached.code, "TRACKER_READY");
    assert.equal(client.calls.length, readsBefore);
  });
});

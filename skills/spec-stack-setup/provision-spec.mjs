/**
 * YouTrack-side prerequisites for the committed Spec Board projection.
 *
 * The service projection writes cards into a project that must already carry
 * the SpecId/SpecKind/Type fields and the link types. The local demo stack and
 * the live E2E contour both need the same one-time admin work, so it lives
 * here instead of inside setup.mjs.
 */

export async function provisionSpecProjection(admin, { shortName = "SPEC" } = {}) {
  const projects = (await admin.call("GET", "/api/admin/projects?fields=id,shortName")) ?? [];
  let spec = projects.find((p) => p.shortName === shortName);
  if (!spec) spec = await admin.createProject({ name: "Spec", shortName, leaderId: (await admin.meNative()).id });

  const fields = await admin.call("GET", "/api/admin/customFieldSettings/customFields?fields=id,name");
  const ids = new Map((fields ?? []).map((f) => [f.name, f.id]));
  for (const [name, fieldType] of Object.entries({ SpecId: "text", ContentHash: "text", Evidence: "text", SpecKind: "enum[1]" })) {
    if (ids.has(name)) continue;
    const created = await admin.call("POST", "/api/admin/customFieldSettings/customFields?fields=id,name", { body: { fieldType: { id: fieldType }, name } });
    ids.set(name, created.id);
  }

  // The SpecKind bundle must be found by EXACT name: a `query=` filter is not
  // applied to bundles, so taking the first row attaches the Priority bundle
  // and every card then fails with "entity with the specified name not found".
  const kindNames = [
    "DOCUMENT", "ROADMAP", "USER_STORY", "USE_CASE", "RESEARCH_FINDING", "RISK",
    "FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT", "ACCEPTANCE_CRITERION",
    "DECISION", "TASK", "FILE_CHANGE", "FILE", "SCENARIO", "FIXTURE", "SCHEMA_ENTITY",
    // The projection writes KIND_LABELS into SpecKind: short labels are what
    // the cards carry (FR/NFR/AC), so the bundle needs both spellings.
    "FR", "NFR", "AC",
  ];
  const bundles = (await admin.call("GET", "/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)&$top=200")) ?? [];
  let specKindBundle = bundles.find((b) => b.name === "SpecKind values");
  if (!specKindBundle) {
    specKindBundle = await admin.call("POST", "/api/admin/customFieldSettings/bundles/enum?fields=id,name,values(name)", {
      body: { name: "SpecKind values", values: kindNames.map((name) => ({ name })) },
    });
  }
  const haveKind = new Set((specKindBundle.values ?? []).map((v) => v.name));
  for (const name of kindNames) {
    if (haveKind.has(name)) continue;
    await admin.call("POST", `/api/admin/customFieldSettings/bundles/enum/${specKindBundle.id}/values?fields=id,name`, { body: { name } });
  }

  const attached = (await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id)`)) ?? [];
  const attachedByName = new Map(attached.map((row) => [row.field?.name, row]));
  for (const name of ["SpecId", "ContentHash", "Evidence"]) {
    if (attachedByName.has(name)) continue;
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: { $type: "TextProjectCustomField", field: { id: ids.get(name) }, canBeEmpty: true },
    });
  }
  const kindEntry = attachedByName.get("SpecKind");
  if (!kindEntry) {
    // Typed entity refs are mandatory here — bare ids return 500.
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields?fields=id`, {
      body: {
        $type: "EnumProjectCustomField",
        field: { id: ids.get("SpecKind"), $type: "CustomField" },
        bundle: { id: specKindBundle.id, $type: "EnumBundle" },
        canBeEmpty: true,
        emptyFieldText: "No SpecKind",
      },
    });
  } else if (kindEntry.bundle?.id !== specKindBundle.id) {
    // Repair a project provisioned before the exact-name lookup existed.
    await admin.call("POST", `/api/admin/projects/${spec.id}/customFields/${kindEntry.id}`, {
      body: { $type: "EnumProjectCustomField", bundle: { id: specKindBundle.id, $type: "EnumBundle" } },
    });
  }

  // The projection writes node kinds into the stock Type field; its default
  // bundle has no Constraint/Criterion/Roadmap/Scenario values and YouTrack
  // rejects an issue without a Type, pointer included.
  const typeEntry = ((await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id,values(id,name))`)) ?? []).find(
    (row) => row.field?.name === "Type",
  );
  if (typeEntry?.bundle?.id) {
    const typeValues = new Set((typeEntry.bundle.values ?? []).map((v) => v.name));
    for (const name of ["Constraint", "Criterion", "Roadmap", "Scenario", "Requirement", "Spec Node"]) {
      if (typeValues.has(name)) continue;
      await admin.call("POST", `/api/admin/customFieldSettings/bundles/enum/${typeEntry.bundle.id}/values?fields=id,name`, { body: { name } });
      typeValues.add(name);
    }
    const taskValue = ((await admin.call("GET", `/api/admin/projects/${spec.id}/customFields?fields=id,field(name),bundle(id,values(id,name))`)) ?? [])
      .find((row) => row.field?.name === "Type")
      ?.bundle?.values?.find((v) => v.name === "Task");
    if (taskValue) {
      await admin.call("POST", `/api/admin/projects/${spec.id}/customFields/${typeEntry.id}`, {
        body: { $type: "EnumProjectCustomField", canBeEmpty: true, defaultValues: [{ id: taskValue.id, $type: "EnumBundleElement" }] },
      });
    }
  }

  // The stock duplicates workflow can wedge issue creation on a fixture
  // instance — detach it everywhere (same workaround as the e2e contour).
  for (const p of (await admin.call("GET", "/api/admin/projects?fields=id,shortName")) ?? []) {
    for (const w of (await admin.call("GET", `/api/admin/projects/${p.id}/workflows?fields=id,workflow(name)`)) ?? []) {
      if (w.workflow?.name?.includes("duplicates")) {
        await admin.call("DELETE", `/api/admin/projects/${p.id}/workflows/${w.id}`).catch(() => {});
      }
    }
  }
  return spec;
}

/**
 * Wait until the signed pointer and at least one card exist. A fresh
 * --no-demo install has only the pointer card; that is a valid empty
 * projection, not a failed one.
 */
export async function verifyProjection(admin, { shortName = "SPEC", timeoutMs = 300_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let cards = 0;
  let pointer = null;
  while (Date.now() < deadline) {
    const rows =
      (await admin.call(
        "GET",
        `/api/issues?query=project:${shortName}&fields=idReadable,summary,customFields(name,value(name,text))&$top=1000`,
      )) ?? [];
    cards = rows.length;
    for (const row of rows) {
      const specId = (row.customFields ?? []).find((f) => f.name === "SpecId")?.value?.text;
      if (specId === "SPEC:SYNC-STATE") pointer = row.idReadable;
    }
    if (pointer && cards >= 1) return { cards, pointer };
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`SPEC projection did not converge: ${cards} card(s), pointer ${pointer ?? "missing"}`);
}

/**
 * The management page belongs to the administration menu. A package built
 * before the move still declares MAIN_MENU_ITEM and would silently put the
 * entry back into the left navigation, so a stale package fails the install
 * instead of being accepted as a fallback.
 */
export async function verifyAppPlacement(admin, { appName = "spec-graph-app" } = {}) {
  const app = await admin.appByName(appName);
  const full = await admin.call("GET", `/api/admin/apps/${app.id}?fields=version,widgets(key,extensionPoint(id))`);
  const widgets = full.widgets ?? [];
  const legacy = widgets.filter((widget) => widget.extensionPoint?.id === "MAIN_MENU_ITEM");
  if (legacy.length > 0) {
    throw new Error(`app package is stale: ${legacy.map((widget) => widget.key).join(", ")} still target MAIN_MENU_ITEM`);
  }
  const page = widgets.find((widget) => widget.key === "spec-app");
  if (page?.extensionPoint?.id !== "ADMINISTRATION_MENU_ITEM") {
    throw new Error(`app package is stale: spec-app targets ${page?.extensionPoint?.id ?? "nothing"}, expected ADMINISTRATION_MENU_ITEM`);
  }
  // One setup surface only. The removed issue card linked back into the page
  // from every task and was a second "Open Spec Service" gate.
  if (widgets.some((widget) => widget.key === "spec-service-panel")) {
    throw new Error("app package is stale: spec-service-panel must not exist; setup lives only in Administration → Integrations");
  }
  return full.version;
}

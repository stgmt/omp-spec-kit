const HOST = 'http://127.0.0.1:8081';
const AUTH = 'Basic ' + Buffer.from('admin:SpecE2eAdmin!2026').toString('base64');
async function rest(method, path, body) {
  const r = await fetch(HOST + path, { method, headers: { authorization: AUTH, accept: 'application/json', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json ?? text };
}
const me = (await rest('GET', '/api/users/me?fields=id')).body;
const projects = (await rest('GET', '/api/admin/projects?fields=id,shortName')).body ?? [];
const spec = projects.find((p) => p.shortName === 'SPEC');
console.log('project', spec && spec.id);
if (!spec) process.exit(1);
const globals = { SpecId: 'text', ContentHash: 'text', Evidence: 'text', SpecKind: 'enum[1]' };
const existing = (await rest('GET', '/api/admin/customFieldSettings/customFields?fields=id,name')).body ?? [];
const ids = new Map(existing.map((f) => [f.name, f.id]));
for (const [name, fieldType] of Object.entries(globals)) {
  if (ids.has(name)) continue;
  const res = await rest('POST', '/api/admin/customFieldSettings/customFields?fields=id,name', { fieldType: { id: fieldType }, name });
  console.log('create field', name, res.status);
  if (res.body?.id) ids.set(name, res.body.id);
}
const attached = new Set(((await rest('GET', `/api/admin/projects/${spec.id}/customFields?fields=field(name)`)).body ?? []).map((r) => r.field?.name));
for (const name of ['SpecId', 'ContentHash', 'Evidence']) {
  if (attached.has(name)) continue;
  const res = await rest('POST', `/api/admin/projects/${spec.id}/customFields?fields=id`, { $type: 'TextProjectCustomField', field: { id: ids.get(name) }, canBeEmpty: true });
  console.log('attach', name, res.status, res.status === 200 ? '' : JSON.stringify(res.body).slice(0,120));
}
if (!attached.has('SpecKind')) {
  let bundle = (await rest('GET', '/api/admin/customFieldSettings/bundles/enum?fields=id,name&query=SpecKind')).body?.[0];
  if (!bundle) {
    const res = await rest('POST', '/api/admin/customFieldSettings/bundles/enum?fields=id', { name: 'SpecKind values', values: [{ name: 'ROADMAP' }, { name: 'FUNCTIONAL_REQUIREMENT' }, { name: 'TASK' }] });
    console.log('bundle', res.status);
    bundle = res.body;
  }
  if (bundle?.id) {
    const res = await rest('POST', `/api/admin/projects/${spec.id}/customFields?fields=id`, { $type: 'EnumProjectCustomField', field: { id: ids.get('SpecKind'), $type: 'CustomField' }, bundle: { id: bundle.id, $type: 'EnumBundle' }, canBeEmpty: true, emptyFieldText: 'No SpecKind' });
    console.log('attach SpecKind', res.status, res.status === 200 ? '' : JSON.stringify(res.body).slice(0,120));
  }
}
const allProjects = (await rest('GET', '/api/admin/projects?fields=id,shortName')).body ?? [];
for (const p of allProjects) {
  const workflows = (await rest('GET', `/api/admin/projects/${p.id}/workflows?fields=id,workflow(name)`)).body ?? [];
  for (const w of workflows) {
    if (w.workflow?.name?.includes('duplicates')) {
      const res = await rest('DELETE', `/api/admin/projects/${p.id}/workflows/${w.id}`);
      console.log('detach workflow', w.workflow.name, res.status);
    }
  }
}

import { createSpecService } from '../../src/adapters/query-service.js';
const svc = createSpecService('E:/repos/omp-spec-kit');
const res = await svc.runQuery('graph', { view: 'board' });
if (!res.ok) { console.log('ERR', JSON.stringify(res.error)); process.exit(0); }
const tasks = res.data.nodes.filter(n => n.kind === 'TASK');
const byStatus = {};
for (const t of tasks) byStatus[t.taskStatus] = (byStatus[t.taskStatus] ?? 0) + 1;
console.log('taskStatus histogram:', JSON.stringify(byStatus));
console.log('total tasks:', tasks.length);
console.log('sample unknown:', tasks.filter(t => t.taskStatus === 'unknown' || t.taskStatus === null).map(t => t.canonicalId).slice(0, 15));
const roadmaps = res.data.nodes.filter(n => n.kind === 'ROADMAP');
console.log('roadmap nodes:', roadmaps.map(r => r.canonicalId));
const contains = res.data.edges.filter(e => e.type === 'CONTAINS');
console.log('contains edges:', contains.length);
console.log('counts:', JSON.stringify(res.data.counts.byKind));

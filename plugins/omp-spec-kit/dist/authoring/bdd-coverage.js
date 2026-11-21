import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scanBlocks } from "../kernel/parsers/md-blocks.js";
import { extractReferenceTarget, isValidSpecSlug } from "../kernel/identity.js";
import { canonicalJson, sha256 } from "./transactions.js";

const git = promisify(execFile);
const schema = "omp-spec-kit/bdd-coverage@1";
const key = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const requirement = /^(?:FR-[1-9]\d*|NFR-[A-Z][A-Z0-9-]*-[1-9]\d*)$/u;
const criterion = /^AC-[1-9]\d*\.[1-9]\d*$/u;
const ref = /^(SCEN-[a-z0-9]+(?:-[a-z0-9]+)*)(?:#([a-z0-9]+(?:-[a-z0-9]+)*))?$/u;
const ruleId = /^(?:US|UC)-[1-9]\d*$/u;
const digest = /^[a-f0-9]{64}$/u;
const fence = "```";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function matches(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function idList(value, pattern, empty = false) {
  return Array.isArray(value) && (empty || value.length > 0) && new Set(value).size === value.length &&
    value.every((item) => matches(item, pattern));
}

function sameIds(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export function coverageRegion(text) {
  const { headings } = scanBlocks(text);
  const matches = headings.filter((heading) => heading.level === 2 && heading.rawText.trim() === "BDD coverage");
  if (matches.length === 0) return { start: null, material: null, map: null };
  const start = matches[0].blockLineStart;
  const material = text.slice(start).trimEnd();
  const lines = material.split(/\r?\n/u).map((line) => line.trimEnd());
  const following = lines.slice(1).filter((line) => line.trim() !== "");
  let map = null;
  if (matches.length === 1 && following[0] === `${fence}json` && following.at(-1) === fence) {
    try { map = JSON.parse(following.slice(1, -1).join("\n")); } catch { /* malformed section remains protected */ }
  }
  return { start, material, map };
}

export function replaceCoverageRegion(text, map) {
  const { start } = coverageRegion(text);
  const before = text.slice(0, start ?? text.length).trimEnd();
  return `${before}\n\n## BDD coverage\n\n${fence}json\n${JSON.stringify(map, null, 2)}\n${fence}\n`;
}

function validateMap(map, stored) {
  if (!isRecord(map) || map.schema !== schema || !isRecord(map.outcomes) || !isRecord(map.scopes)) {
    return "BDD coverage requires the versioned outcomes and scopes objects";
  }
  if (Object.keys(map).some((name) => !["schema", "outcomes", "scopes"].includes(name))) return "unknown BDD coverage field";
  const names = Object.keys(map.outcomes);
  if (!names.length || names.length > 1000 || Object.keys(map.scopes).length > 1000) return "invalid number of coverage entries";
  for (const [id, item] of Object.entries(map.outcomes)) {
    if (!matches(id, key) || !isRecord(item) || !idList(item.requirements, requirement) || !idList(item.criteria, criterion, true)) {
      return `invalid coverage outcome ${id}`;
    }
    const direct = item.scenario !== undefined;
    const fields = ["requirements", "criteria", ...(direct ? ["scenario"] : ["rule", "outcome"])];
    if (stored) fields.push("approvedSourceSha256", "approvedExamples");
    if (Object.keys(item).some((name) => !fields.includes(name))) return `unknown field on outcome ${id}`;
    if (direct ? !matches(item.scenario, ref) : !matches(item.rule, ruleId) || !matches(item.outcome, key)) return `invalid scenario or Rule on outcome ${id}`;
    if (stored && (!matches(item.approvedSourceSha256, digest) || !Array.isArray(item.approvedExamples) ||
      item.approvedExamples.length > 1 || item.approvedExamples.some((example) =>
        !isRecord(example) || !matches(example.ref, ref) || !matches(example.sha256, digest)))) {
      return `missing approval material on outcome ${id}`;
    }
  }
  for (const [id, scope] of Object.entries(map.scopes)) {
    if (!matches(id, key) || !isRecord(scope) || Object.keys(scope).some((name) => !["requirements", "outcomes"].includes(name)) ||
      !idList(scope.requirements, requirement) || !idList(scope.outcomes, key)) return `invalid coverage scope ${id}`;
    if (scope.outcomes.some((name) => !Object.hasOwn(map.outcomes, name))) return `unknown outcome in coverage scope ${id}`;
    const requirements = [...new Set(scope.outcomes.flatMap((name) => map.outcomes[name].requirements))];
    if (!sameIds(requirements, scope.requirements)) return `scope ${id} and its outcomes disagree on requirements`;
  }
  return null;
}

function context(graph, spec) {
  return new Map(graph.nodes.filter((node) => node.specSlug === spec).map((node) => [node.localId, node]));
}

function outcomeMaterial(item, nodes) {
  const requirements = item.requirements.map((id) => nodes.get(id));
  const criteria = item.criteria.map((id) => nodes.get(id));
  if (requirements.some((node) => !node || !["FUNCTIONAL_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"].includes(node.kind)) ||
      criteria.some((node) => node?.kind !== "ACCEPTANCE_CRITERION" ||
        !item.requirements.includes(node.attributes.parentLocalId ?? node.localId.split(".")[0].replace("AC-", "FR-")))) {
    return { problem: "the linked FR/NFR or its acceptance criterion is missing" };
  }
  const subject = item.rule === undefined ? null : nodes.get(item.rule);
  const attrs = subject?.attributes;
  const declaration = attrs?.outcomes && Object.hasOwn(attrs.outcomes, item.outcome) ? attrs.outcomes[item.outcome] : null;
  if (item.rule !== undefined && !declaration) return { problem: `missing outcome ${item.rule}#${item.outcome}` };
  const source = [...requirements, ...criteria].map(({ localId, title, body }) => ({ localId, title, body }));
  const rule = attrs && {
    id: item.rule, title: subject.title, storyId: attrs.storyId, actor: attrs.actor,
    goal: attrs.goal, benefit: attrs.benefit, boundary: attrs.boundary, trigger: attrs.trigger,
    precondition: attrs.precondition, success: attrs.success, declaration,
    decision: attrs.steps?.[declaration[0]], exit: attrs.steps?.[declaration[3]],
  };
  const sourceHash = sha256(canonicalJson({ source, rule, scenario: item.scenario ?? null }));
  const reference = item.scenario ?? (attrs?.refs && Object.hasOwn(attrs.refs, item.outcome) ? attrs.refs[item.outcome] : null);
  if (reference === null) return { sourceHash, examples: [] };
  const parsed = ref.exec(reference);
  const scenario = parsed && nodes.get(parsed[1]);
  if (scenario?.kind !== "SCENARIO") return { problem: `unresolved example ${reference}` };
  const scenarioAttrs = scenario.attributes;
  const eligible = subject
    ? scenarioAttrs.storyId === attrs.storyId && (subject.kind !== "USE_CASE" || scenarioAttrs.caseId === null || scenarioAttrs.caseId === item.rule)
    : scenarioAttrs.contract === true;
  if (!eligible) return { problem: `out-of-scope example ${reference}` };
  if (!subject && !scenarioAttrs.tags.some((tag) => item.criteria.some((id) => tag === `@${id}`) ||
      item.requirements.some((id) => id.startsWith("FR-") && tag === `@feature${id.slice(3)}`))) {
    return { problem: `contract example ${reference} requires a declared trace to the approved FR or AC` };
  }
  const pickle = scenarioAttrs.pickles?.find(({ rowId }) => rowId === (parsed[2] ?? null));
  if (!pickle) return { problem: `unresolved example row ${reference}` };
  return { sourceHash, examples: [{ ref: reference, sha256: pickle.sha256 }] };
}

export function approvedCoverageMap(map, graph, spec) {
  const problem = validateMap(map, false);
  if (problem) return { problem };
  const nodes = context(graph, spec);
  const entries = [];
  for (const [id, item] of Object.entries(map.outcomes)) {
    const material = outcomeMaterial(item, nodes);
    if (material.problem) return { problem: `${id}: ${material.problem}` };
    entries.push([id, { ...item, approvedSourceSha256: material.sourceHash, approvedExamples: material.examples }]);
  }
  return { map: { schema, outcomes: Object.fromEntries(entries), scopes: map.scopes } };
}

export async function localApprovedCoverage(root, spec) {
  if (!isValidSpecSlug(spec)) return null;
  try {
    const bindings = JSON.parse(process.env.OMP_SPEC_KIT_APPROVED_COVERAGE_REFS ?? "{}");
    const commit = Object.hasOwn(bindings, spec) ? bindings[spec] : null;
    if (!matches(commit, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u)) return null;
    const { stdout } = await git("git", ["show", `${commit}:.specs/${spec}/ACCEPTANCE_CRITERIA.md`], {
      cwd: root, timeout: 5_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
    });
    return coverageRegion(stdout).map;
  } catch {
    return null;
  }
}

export function taskCoverageFindings({ graph, spec, requirements, scope, proposed, approved }) {
  const problem = validateMap(approved, true);
  if (problem || !isRecord(proposed?.outcomes) || !isRecord(proposed?.scopes)) return [{ message: "No approved BDD coverage map for this specification" }];
  const normalized = [...new Set(requirements.map((id) => id.startsWith(`${spec}:`) ? id.slice(spec.length + 1) : id))];
  if (!normalized.length || normalized.some((id) => !matches(id, requirement))) {
    return [{ message: "Specify the in-scope requirements for the task", requirements }];
  }
  let ids;
  if (scope !== null && scope !== undefined) {
    const approvedScope = Object.hasOwn(approved.scopes, scope) ? approved.scopes[scope] : null;
    if (!approvedScope || !sameIds(normalized, approvedScope.requirements) ||
        canonicalJson(approvedScope) !== canonicalJson(proposed.scopes[scope])) {
      return [{ message: "Use an approved coverage scope with exactly the task requirements", scope, requirements: normalized }];
    }
    ids = approvedScope.outcomes;
  } else {
    const counts = new Set(Object.values(approved.outcomes).flatMap((item) => item.requirements));
    const uncovered = normalized.filter((id) => !counts.has(id));
    if (uncovered.length) return uncovered.map((id) => ({ message: "Requirement has no approved BDD outcomes", requirements: [id] }));
    ids = Object.keys(approved.outcomes).filter((id) => approved.outcomes[id].requirements.some((req) => normalized.includes(req)));
  }
  const nodes = context(graph, spec);
  const findings = [];
  for (const id of ids) {
    const outcome = approved.outcomes[id];
    const material = outcomeMaterial(outcome, nodes);
    const details = { outcome: id, requirements: outcome.requirements, criteria: outcome.criteria, rule: outcome.rule ?? null };
    if (canonicalJson(outcome) !== canonicalJson(proposed.outcomes[id]) || material.problem ||
        material.sourceHash !== outcome.approvedSourceSha256 || material.examples.length !== 1 ||
        canonicalJson(material.examples) !== canonicalJson(outcome.approvedExamples)) {
      const message = material.problem ?? (material.examples?.length
        ? "Request approval for the current outcome and exact scenario steps"
        : "Write a complete BDD example for the outcome and request approval");
      findings.push({ ...details, message, scenario: material.examples?.[0]?.ref ?? null });
    }
  }
  return findings;
}

export function changedTaskCoverageFindings({ baseline, graph, spec, proposed, approved }) {
  const tasks = (state) => state.nodes.filter((node) => node.specSlug === spec && node.kind === "TASK");
  const previous = new Map(tasks(baseline).map((node) => [node.localId, node]));
  const scopeOf = (state, node) => {
    const normalize = (target) => target.startsWith(`${spec}:`) ? target.slice(spec.length + 1) : target;
    const declared = (node?.attributes.requirements ?? []).map((item) => extractReferenceTarget(item)?.target ?? item);
    const linked = (state.referenceOccurrences ?? []).filter((entry) =>
      entry.sourceCanonicalId === node?.canonicalId && ["REFS", "IMPLEMENTS"].includes(entry.requestedEdgeType))
      .map(({ rawTarget, requestedEdgeType }) => {
        const normalized = normalize(rawTarget);
        if (requestedEdgeType === "IMPLEMENTS" && criterion.test(normalized)) {
          return normalized.split(".")[0].replace("AC-", "FR-");
        }
        return requirement.test(normalized.split(":").at(-1)) ? normalized : null;
      }).filter(Boolean);
    return { requirements: [...new Set([...declared, ...linked].map(normalize))].sort(), scope: node?.attributes.coverageScope ?? null };
  };
  return tasks(graph).flatMap((task) => {
    const scope = scopeOf(graph, task);
    if (previous.has(task.localId) && canonicalJson(scopeOf(baseline, previous.get(task.localId))) === canonicalJson(scope)) return [];
    return taskCoverageFindings({ graph, spec, ...scope, proposed, approved })
      .map((finding) => ({ task: task.localId, ...finding }));
  });
}

export function changedReadyCoverageFindings({ baseline, graph, spec, proposed, approved }) {
  const ready = (state) => state.nodes.filter((node) => node.specSlug === spec &&
    node.kind === "SCENARIO" && node.attributes.ready);
  const shape = (node) => canonicalJson({
    path: node.span.path, tags: node.attributes.tags, pickles: node.attributes.pickles,
  });
  const previous = new Map(ready(baseline).map((node) => [node.localId, shape(node)]));
  const selected = ready(graph).filter((node) => previous.get(node.localId) !== shape(node));
  if (!selected.length) return [];
  if (validateMap(approved, true)) return [{ message: "Approve the executable examples before promoting them to @spec-ready" }];
  const nodes = context(graph, spec);
  const complete = new Set();
  for (const [id, item] of Object.entries(approved.outcomes)) {
    if (canonicalJson(item) !== canonicalJson(proposed?.outcomes?.[id])) continue;
    const material = outcomeMaterial(item, nodes);
    if (!material.problem && material.sourceHash === item.approvedSourceSha256 &&
        canonicalJson(material.examples) === canonicalJson(item.approvedExamples)) {
      for (const { ref } of item.approvedExamples) complete.add(ref);
    }
  }
  return selected.flatMap((node) => node.attributes.pickles.map(({ rowId }) =>
    rowId === null ? node.localId : `${node.localId}#${rowId}`).filter((reference) => !complete.has(reference))
    .map((reference) => ({ scenario: reference, message: "Approve the exact example before promoting it to @spec-ready" })));
}

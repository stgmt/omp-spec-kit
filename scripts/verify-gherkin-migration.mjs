import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { gherkinPairFindings, missingScenarioSteps, parseFeature, parseGherkinDocument } from "../src/kernel/parsers/gherkin.js";
import { canonicalDocumentFilename } from "../src/kernel/types.js";
import { isValidSpecSlug } from "../src/kernel/identity.js";
import { compile } from "../src/kernel/vendor/gherkin.js";
import { canonicalJson } from "../src/kernel/normalize.js";

const hash = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

export function inspectGherkinMigration(text, uri = "") {
  const { ast, ids } = parseFeature(text, uri);
  if (!ast.feature) throw new Error("expected a Feature");
  const definitions = new Map();
  const byAstId = new Map();
  const nodes = ast.feature.children.flatMap((child) => child.rule ? child.rule.children : [child]);
  for (const { scenario } of nodes) {
    if (!scenario) continue;
    const tags = scenario.tags.map(({ name }) => name);
    const identifiers = tags.filter((name) => name.startsWith("@id:")).map((name) => name.slice(4));
    const id = identifiers[0];
    if (identifiers.length !== 1 || !/^SCEN-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) || definitions.has(id)) {
      throw new Error(`scenario at line ${scenario.location.line} needs a unique @id:SCEN-* tag`);
    }
    const definition = {
      id, line: scenario.location.line, name: scenario.name, missing: missingScenarioSteps(scenario), examples: [],
    };
    byAstId.set(scenario.id, definition);
    definitions.set(id, definition);
  }
  for (const pickle of compile(ast, uri, ids)) {
    const example = {
      steps: pickle.steps.map(({ type, text, argument }) => ({ type, text, argument: argument ?? null })),
      tags: pickle.tags.map(({ name }) => name).filter((name) => !/^@(?:story:|case:|contract$|spec-ready$)/u.test(name)).sort(),
    };
    byAstId.get(pickle.astNodeIds[0]).examples.push(example);
  }
  return new Map([...definitions].map(([id, definition]) => [id, {
    ...definition, sha256: hash({ name: definition.name, examples: definition.examples }),
  }]));
}

export function compareGherkinMigration(legacy, migrated, repairs = {}) {
  const findings = [];
  for (const [id, before] of legacy) {
    const after = migrated.get(id);
    if (!after) {
      findings.push({ id, line: before.line, message: "missing migrated scenario" });
      continue;
    }
    if (after.missing.length) {
      findings.push({ id, line: after.line, message: `migrated definition is missing ${after.missing.join("/")}` });
      continue;
    }
    if (before.missing.length === 0 && before.sha256 === after.sha256) continue;
    const repair = Object.hasOwn(repairs, id) ? repairs[id] : null;
    if (repair?.beforeSha256 !== before.sha256 || repair?.afterSha256 !== after.sha256 ||
        typeof repair.reason !== "string" || !repair.reason.trim()) {
      findings.push({
        id, line: before.line, missing: before.missing, beforeSha256: before.sha256, afterSha256: after.sha256,
        message: "migration changes this scenario or repairs its form; record an explicit reviewed before/after pair",
      });
    }
  }
  for (const [id, after] of migrated) {
    if (!legacy.has(id)) findings.push({ id, line: after.line, message: "added scenario requires separate migration review" });
  }
  return findings;
}

export function inspectMigratedPair({ storyPath, storyText, casePath, caseText }) {
  const storyFile = basename(storyPath);
  const caseFile = basename(casePath);
  const specSlug = storyFile.replace(/-user-stories\.feature$/u, "");
  if (!isValidSpecSlug(specSlug) || storyFile !== canonicalDocumentFilename("USER_STORIES", specSlug) ||
      caseFile !== canonicalDocumentFilename("USE_CASES", specSlug)) {
    throw new Error("migration target must be the canonical user-stories and use-cases feature pair for one spec");
  }
  const stories = parseGherkinDocument({ specSlug, path: storyFile, text: storyText });
  const cases = parseGherkinDocument({ specSlug, path: caseFile, text: caseText });
  const findings = [
    ...stories.diagnostics.map((item) => ({ ...item, path: storyPath })),
    ...cases.diagnostics.map((item) => ({ ...item, path: casePath })),
    ...gherkinPairFindings(stories, cases).map(({ document, ...item }) => ({ ...item, path: document === stories ? storyPath : casePath })),
  ];
  if (findings.length) return { findings, definitions: new Map() };
  return {
    findings,
    definitions: new Map([...inspectGherkinMigration(storyText, storyPath), ...inspectGherkinMigration(caseText, casePath)]),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, story, useCase, repairPath] = process.argv.slice(2);
  if (!source || Boolean(story) !== Boolean(useCase)) {
    throw new Error("Usage: verify-gherkin-migration.mjs <legacy.feature> [<user-stories.feature> <use-cases.feature> [reviewed-repairs.json]]");
  }
  try {
    const read = async (filename) => inspectGherkinMigration(await readFile(filename, "utf8"), filename);
    const legacy = await read(source);
    let findings = [...legacy.values()].filter((entry) => entry.missing.length).map(({ id, line, missing, sha256 }) => ({ id, line, missing, beforeSha256: sha256 }));
    if (story && useCase) {
      const [storyText, caseText] = await Promise.all([readFile(story, "utf8"), readFile(useCase, "utf8")]);
      const migrated = inspectMigratedPair({ storyPath: story, storyText, casePath: useCase, caseText });
      findings = migrated.findings;
      if (findings.length === 0) {
        const repairs = repairPath ? JSON.parse(await readFile(repairPath, "utf8")) : {};
        findings = compareGherkinMigration(legacy, migrated.definitions, repairs);
      }
    }
    console.log(JSON.stringify({ source, definitions: legacy.size, findings }, null, 2));
    process.exitCode = findings.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

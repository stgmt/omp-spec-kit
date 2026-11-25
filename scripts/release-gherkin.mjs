import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseFeature } from "../src/kernel/parsers/gherkin.js";
import { compile } from "../src/kernel/vendor/gherkin.js";

const spec = "plugin-distribution";
const releaseFeature = fileURLToPath(new URL("../tests/features/release-contract.feature", import.meta.url));

function releaseScenarios(sources) {
  const rows = new Map();
  for (const { text, filepath } of sources) {
    const { ast, ids } = parseFeature(text, filepath);
    const pickles = compile(ast, filepath, ids);
    for (const pickle of pickles) {
      const tags = pickle.tags.map((tag) => tag.name);
      if (!tags.includes("@release-evidence")) continue;
      const scenarioIds = tags.filter((tag) => /^@id:SCEN-[a-z0-9-]+$/u.test(tag));
      const requirements = tags.filter((tag) => /^@FR-\d+$/u.test(tag));
      if (scenarioIds.length !== 1 || requirements.length !== 1) {
        throw new Error(`invalid release-evidence scenario tags in ${filepath}: ${pickle.name}`);
      }
      const id = scenarioIds[0].slice(4);
      const astId = pickle.astNodeIds[0];
      const previous = rows.get(id);
      if (previous && (previous.filepath !== filepath || previous.astId !== astId
        || previous.requirement !== requirements[0])) {
        throw new Error(`duplicate release-evidence scenario id ${id}`);
      }
      rows.set(id, { filepath, astId, requirement: requirements[0], count: (previous?.count ?? 0) + 1 });
    }
  }
  if (!rows.size) throw new Error("release BDD feature must contain release-evidence scenarios");
  const sorted = [...rows.entries()].sort(([left], [right]) => left.localeCompare(right, "en"));
  return {
    multiplicities: new Map(sorted.map(([id, { count }]) => [id, count])),
    requirements: new Map(sorted.map(([id, { requirement }]) => [id, `${spec}:${requirement.slice(1)}`])),
  };
}

export async function readReleaseScenarios({ featurePath = releaseFeature } = {}) {
  const text = await readFile(featurePath, "utf8");
  return releaseScenarios([{ filepath: featurePath, text }]);
}

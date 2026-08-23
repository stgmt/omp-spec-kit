import { pathToFileURL } from "node:url";

function schemaNode(kind, properties = {}) {
  const state = { kind, ...properties };
  return {
    state,
    optional() {
      state.optional = true;
      return this;
    },
    int() {
      state.int = true;
      return this;
    },
    min(value) {
      state.min = value;
      return this;
    },
    max(value) {
      state.max = value;
      return this;
    },
    strict() {
      state.strict = true;
      return this;
    },
  };
}

function schemaSnapshot(schema) {
  const snapshot = { ...schema.state };
  if (snapshot.shape) {
    snapshot.shape = Object.fromEntries(
      Object.entries(snapshot.shape).map(([name, child]) => [name, schemaSnapshot(child)]),
    );
  }
  return snapshot;
}

function makeHost() {
  const registration = { labels: [], tools: [] };
  return {
    registration,
    pi: {
      zod: {
        literal: (value) => schemaNode("literal", { value }),
        number: () => schemaNode("number"),
        string: () => schemaNode("string"),
        boolean: () => schemaNode("boolean"),
        array: (item) => schemaNode("array", { item }),
        enum: (values) => schemaNode("enum", { values }),
        union: (options) => schemaNode("union", { options }),
        null: () => schemaNode("null"),
        object: (shape) => schemaNode("object", { shape }),
      },
      setLabel: (label) => registration.labels.push(label),
      registerTool: (tool) => registration.tools.push(tool),
    },
  };
}

const [extensionPath, repositoryRoot] = process.argv.slice(2);
if (!extensionPath || !repositoryRoot) {
  throw new Error("usage: extension-probe.mjs <extension-path> <repository-root>");
}

const extensionModule = await import(pathToFileURL(extensionPath).href);
const { pi, registration } = makeHost();
extensionModule.default(pi);
if (registration.tools.length < 1) {
  throw new Error("expected at least one registered tool");
}
const tool = registration.tools.find((candidate) => candidate.name === "spec_inventory");
if (!tool) {
  throw new Error("spec_inventory is not among the registered tools");
}
let updates = 0;
const execution = await tool.execute(
  "bdd-tool-call-1",
  {},
  new AbortController().signal,
  () => {
    updates += 1;
  },
  { cwd: repositoryRoot },
);

process.stdout.write(
  `${JSON.stringify({
    processCwd: process.cwd(),
    exports: {
      pluginVersion: extensionModule.PLUGIN_VERSION,
      schemaVersion: extensionModule.SCHEMA_VERSION,
      defaultType: typeof extensionModule.default,
    },
    labels: registration.labels,
    toolCount: registration.tools.length,
    tool: {
      keys: Object.keys(tool).sort(),
      name: tool.name,
      label: tool.label,
      description: tool.description,
      approval: tool.approval,
      strict: tool.strict,
      executeType: typeof tool.execute,
      parameters: schemaSnapshot(tool.parameters),
    },
    updates,
    execution,
  })}\n`,
);

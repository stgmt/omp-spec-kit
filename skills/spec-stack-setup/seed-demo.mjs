import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { coverageRegion } from "../../src/authoring/bdd-coverage.js";

function templateTasks(content) {
  return [...content.matchAll(/^## (TASK-\d+)\s*(?:—|:)\s*([^\n]+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gmu)]
    .map(([, entity, subject, body]) => {
      const trace = [...body.matchAll(/^(?:- )?\*\*(?:Requirements|Implements|Refs):\*\*(.*)$/gmu)];
      const requirements = [...new Set(trace.flatMap(([, field]) =>
        field.match(/\b(?:FR-\d+|NFR-[A-Z][A-Z0-9-]*-\d+)\b/gu) ?? []))];
      const status = body.match(/^(?:- )?\*\*Status:\*\* (\S+)/mu)?.[1];
      return { entity, subject, requirements, status };
    });
}

export async function seedDemo({ mcp, project, templateDir, log = () => {} }) {
  const call = async (name, args, allowed = []) => {
    const result = await mcp.callTool({ name, arguments: { project, ...args } });
    const reply = JSON.parse(result.content[0].text);
    const failure = reply.error ?? (reply.data?.outcome === "REFUSED" ? reply.data.error : null);
    if (failure && !allowed.includes(failure.code)) {
      throw new Error(`${name} ${args.spec ?? project}: ${failure.code} ${failure.message ?? ""}`);
    }
    return failure ? null : reply.data;
  };
  const names = await readdir(templateDir, { withFileTypes: true });
  const templates = [];
  for (const entry of names.filter((item) => item.isDirectory())) {
    const dir = path.join(templateDir, entry.name);
    const meta = JSON.parse(await readFile(path.join(dir, "spec.json"), "utf8"));
    templates.push({ ...meta, dir });
  }
  // The aggregate roadmap references the seeded specification and its tasks.
  templates.sort((left, right) => Number(!!right.bddCoverage) - Number(!!left.bddCoverage));
  const { specs } = await call("spec_catalog", { view: "specs" });
  for (const { slug: spec, dir, demo, bddCoverage } of templates) {
    const patch = async (intent, args) => {
      const request = { intent, spec, reason: "Seed checked-in demo specification", dryRun: false, ...args };
      const result = await call("spec_patch", { ...request, requestId: randomUUID() }, ["ELICITATION_REQUIRED"]);
      // The checked-in template supplies the content and coverage decisions.
      return result ?? call("spec_patch", { ...request, requestId: randomUUID() });
    };
    // A newly created branch is only a README scaffold. The layout gate lets
    // a scaffold be written only through `createSpec`, which lays down the
    // canonical Gherkin pair before ordinary patches are allowed. On an
    // already seeded spec the same call is a permitted no-op (CONFLICT), so
    // reruns stay byte-for-byte idempotent.
    const initialize = async () => {
      const request = { intent: "createSpec", spec, reason: "Seed checked-in demo specification", dryRun: false };
      const permitted = ["ELICITATION_REQUIRED", "CONFLICT"];
      const first = await call("spec_patch", { ...request, requestId: randomUUID() }, permitted);
      // First creation of the canonical documents is stopped for elicitation.
      if (first === null) await call("spec_patch", { ...request, requestId: randomUUID() }, permitted);
    };
    const read = (doc) => call("spec_documents", { action: "read", spec, doc, readForEdit: true }, ["DOC_NOT_FOUND"]);
    const replace = (document, content, current) => ({
      kind: "replace_document", document, content, ...(current ? { expectedSha: current.sha256 } : {}),
    });
    await call("spec_claim", { spec });
    try {
      if (!specs.includes(spec)) {
        await call("spec_branch", { action: "create", spec, demo: demo === true }, ["SPEC_EXISTS"]);
      }
      await initialize();
      const operations = [];
      const docs = (await readdir(dir)).filter((name) => /\.(?:md|feature)$/u.test(name));
      for (const document of docs.filter((name) => name !== "TASKS.md")) {
        let content = (await readFile(path.join(dir, document), "utf8")).replace(/\r\n/gu, "\n");
        const current = await read(document);
        if (document === "ACCEPTANCE_CRITERIA.md" && current) {
          const { material } = coverageRegion(current.content);
          if (material) content = `${content.trimEnd()}\n\n${material}\n`;
        }
        if (content !== current?.content) operations.push(replace(document, content, current));
      }
      if (docs.includes("TASKS.md") && !(await read("TASKS.md"))) {
        operations.push(replace("TASKS.md", "# Tasks\n", null));
      }
      if (operations.length) await patch("patch", { operations });
      if (bddCoverage) {
        const preview = await patch("approveBddCoverage", { map: bddCoverage, dryRun: true });
        if (preview.operations.some(({ beforeSha256, afterSha256 }) => beforeSha256 !== afterSha256)) {
          await patch("approveBddCoverage", {
            map: bddCoverage, repositoryRootFingerprint: preview.baseGenerationSha256,
          });
        }
      }
      if (docs.includes("TASKS.md")) {
        const content = (await readFile(path.join(dir, "TASKS.md"), "utf8")).replace(/\r\n/gu, "\n");
        let current = await read("TASKS.md");
        const existing = new Set(templateTasks(current?.content ?? "").map(({ entity }) => entity));
        for (const task of templateTasks(content)) {
          if (!existing.has(task.entity)) await patch("confirmTaskCreation", task);
        }
        current = await read("TASKS.md");
        if (content !== current?.content) await patch("patch", { operations: [replace("TASKS.md", content, current)] });
      }
      log(`seeded ${spec}`);
    } finally {
      await call("spec_release", { spec });
    }
  }
  return templates.map(({ slug, title }) => `${slug} — ${title}`).join(", ");
}

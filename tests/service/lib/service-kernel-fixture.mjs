import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalDocumentKind } from "../../../src/kernel/types.js";

const original = fileURLToPath(new URL("../../fixtures/kernel/real-corpus/.specs/spec-kernel/", import.meta.url));
const gherkin = fileURLToPath(new URL("../../fixtures/kernel/service-spec-kernel/", import.meta.url));

export async function serviceKernelFixture(spec = "spec-kernel") {
  const documents = (await readdir(original)).filter((name) => canonicalDocumentKind(name, "spec-kernel"));
  const markdown = await Promise.all(documents.map(async (name) => {
    const text = await readFile(path.join(original, name), "utf8");
    return [name === "spec-kernel_SCHEMA.md" ? `${spec}_SCHEMA.md` : name, text
      .replace(/\[((?:US|UC)-\d+)\]\([^\n)]*(?:USER_STORIES|USE_CASES)\.md#[^\n)]*\)/gu, "`$1`")
      .replaceAll("USER_STORIES.md", `${spec}-user-stories.feature`)
      .replaceAll("USE_CASES.md", `${spec}-use-cases.feature`)
      .replaceAll("spec-kernel_SCHEMA.md", `${spec}_SCHEMA.md`)
      .replaceAll("spec-kernel.feature", `${spec}-user-stories.feature`)];
  }));
  const rules = await Promise.all((await readdir(gherkin)).map(async (name) =>
    [name.replace(/^spec-kernel/u, spec), await readFile(path.join(gherkin, name), "utf8")]));
  return Object.fromEntries([...markdown, ...rules]);
}

export async function copyServiceKernelFixture(destination) {
  await mkdir(destination, { recursive: true });
  for (const [document, content] of Object.entries(await serviceKernelFixture())) {
    await writeFile(path.join(destination, document), content, "utf8");
  }
}

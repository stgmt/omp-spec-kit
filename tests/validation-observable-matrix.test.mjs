import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnMcpServer } from "./helpers/mcp-world.mjs";
import { executeQuery } from "../src/kernel/query/service.js";
import { TOOL_CONTRACTS, jsonSchemaFor } from "../src/adapters/tool-contracts.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(repositoryRoot, "plugins", "omp-spec-kit", "dist", "mcp", "server.js");

async function main() {
  console.log("=== Testing 10 Observable Validation Contract Cases ===");

  const server = spawnMcpServer({
    cwd: repositoryRoot,
    serverPath,
  });

  try {
    await server.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "val-observable-matrix", version: "1.0.0" },
    });

    // 1. весь корпус без specSlugs
    console.log("1. Testing entire corpus without specSlugs...");
    const c1 = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation" },
    });
    const d1 = c1.result?.structuredContent?.data;
    assert.equal(d1?.kind, "validation");
    assert.deepEqual(d1?.scope, { mode: "corpus", specSlugs: [] });
    assert.equal(typeof d1?.valid, "boolean");
    assert.ok(["VALID", "INVALID"].includes(d1?.verdict));
    assert.ok(d1?.counts?.total > 0);
    assert.equal(d1?.counts?.total, d1?.counts?.errors + d1?.counts?.warnings + d1?.counts?.info);
    assert.equal(d1?.counts?.matched, d1?.items?.length);
    console.log("   -> OK: corpus scope, total =", d1?.counts?.total, "verdict =", d1?.verdict);

    // 2. одна и несколько существующих спецификаций
    console.log("2. Testing single and multiple existing specifications...");
    const c2Single = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", specSlugs: ["plugin-distribution"] },
    });
    const d2Single = c2Single.result?.structuredContent?.data;
    assert.equal(d2Single?.kind, "validation");
    assert.deepEqual(d2Single?.scope, { mode: "specifications", specSlugs: ["plugin-distribution"] });
    for (const item of d2Single?.items ?? []) {
      assert.equal(item.specSlug, "plugin-distribution");
    }

    const c2Multi = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: {
        schemaVersion: "spec-kernel@1",
        check: "validation",
        specSlugs: ["spec-mcp-operations", "plugin-distribution"], // intentionally unordered
      },
    });
    const d2Multi = c2Multi.result?.structuredContent?.data;
    assert.equal(d2Multi?.kind, "validation");
    // scope.specSlugs must be normalized and sorted
    assert.deepEqual(d2Multi?.scope, { mode: "specifications", specSlugs: ["plugin-distribution", "spec-mcp-operations"] });
    for (const item of d2Multi?.items ?? []) {
      assert.ok(["plugin-distribution", "spec-mcp-operations"].includes(item.specSlug));
    }
    console.log("   -> OK: single and multi-spec scopes normalized and filtered accurately");

    // 3. неверный и неизвестный slug
    console.log("3. Testing invalid syntax and unknown slug errors...");
    const c3Invalid = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", specSlugs: ["bad slug with spaces!"] },
    });
    assert.equal(c3Invalid.result?.structuredContent?.ok, false);
    assert.equal(c3Invalid.result?.structuredContent?.error?.code, "INVALID_PARAMETER");

    const c3Unknown = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", specSlugs: ["unknown-nonexistent-slug"] },
    });
    assert.equal(c3Unknown.result?.structuredContent?.ok, false);
    assert.equal(c3Unknown.result?.structuredContent?.error?.code, "NOT_FOUND");
    assert.equal(c3Unknown.result?.structuredContent?.error?.specSlug, "unknown-nonexistent-slug");
    console.log("   -> OK: invalid returns INVALID_PARAMETER, unknown returns NOT_FOUND");

    // 4. VALID и INVALID verdicts
    console.log("4. Testing VALID and INVALID verdicts on synthetic graphs...");
    const mockLimits = { maxPageLimit: 200, maxResponseBytes: 1048576, maxCursorBytes: 512 };
    const mockCounts = {
      discoveredDocuments: 1,
      unresolvedReferenceOccurrences: 0,
      markdownHeadingOccurrences: 0,
      markdownLinkOccurrences: 0,
    };
    const validGraph = {
      schemaVersion: "spec-kernel@1",
      fingerprint: "f1",
      valid: true,
      documents: [{ specSlug: "test-slug" }],
      nodes: [],
      edges: [],
      counts: mockCounts,
      diagnostics: [
        { diagnosticId: "d1", severity: "WARNING", code: "BROKEN_MARKDOWN_LINK", specSlug: "test-slug" },
      ],
      limits: mockLimits,
    };
    const validRes = executeQuery(validGraph, {
      schemaVersion: "spec-kernel@1",
      requestId: "val-test",
      operation: "validation",
      args: { severities: [], codes: [], specSlugs: ["test-slug"], paths: [], limit: 50, cursor: null },
    });
    assert.equal(validRes.ok, true);
    assert.equal(validRes.data.valid, true);
    assert.equal(validRes.data.verdict, "VALID");

    const invalidGraph = {
      schemaVersion: "spec-kernel@1",
      fingerprint: "f2",
      valid: false,
      documents: [{ specSlug: "test-slug" }],
      nodes: [],
      edges: [],
      counts: mockCounts,
      diagnostics: [
        { diagnosticId: "d2", severity: "ERROR", code: "BROKEN_REFERENCE", specSlug: "test-slug" },
      ],
      limits: mockLimits,
    };
    const invalidRes = executeQuery(invalidGraph, {
      schemaVersion: "spec-kernel@1",
      requestId: "inval-test",
      operation: "validation",
      args: { severities: [], codes: [], specSlugs: ["test-slug"], paths: [], limit: 50, cursor: null },
    });
    assert.equal(invalidRes.ok, true);
    assert.equal(invalidRes.data.valid, false);
    assert.equal(invalidRes.data.verdict, "INVALID");
    console.log("   -> OK: VALID when 0 errors, INVALID when errors > 0");

    // 5. фильтр, скрывающий ошибку из items, но не меняющий valid, verdict, counts.errors и counts.total
    console.log("5. Testing filter hiding error without changing valid, verdict, or counts.errors/total...");
    const mixedGraph = {
      schemaVersion: "spec-kernel@1",
      fingerprint: "f3",
      valid: false,
      documents: [{ specSlug: "test-slug" }],
      nodes: [],
      edges: [],
      counts: mockCounts,
      diagnostics: [
        { diagnosticId: "d-err", severity: "ERROR", code: "BROKEN_REFERENCE", specSlug: "test-slug" },
        { diagnosticId: "d-warn", severity: "WARNING", code: "BROKEN_MARKDOWN_LINK", specSlug: "test-slug" },
      ],
      limits: mockLimits,
    };
    // Query asking for WARNINGs only
    const filteredRes = executeQuery(mixedGraph, {
      schemaVersion: "spec-kernel@1",
      requestId: "filter-test",
      operation: "validation",
      args: { severities: ["WARNING"], codes: [], specSlugs: ["test-slug"], paths: [], limit: 50, cursor: null },
    });
    assert.equal(filteredRes.ok, true);
    assert.equal(filteredRes.data.valid, false, "valid must remain false despite error being filtered out");
    assert.equal(filteredRes.data.verdict, "INVALID", "verdict must remain INVALID");
    assert.equal(filteredRes.data.counts.errors, 1, "counts.errors must remain 1");
    assert.equal(filteredRes.data.counts.total, 2, "counts.total must remain 2");
    assert.equal(filteredRes.data.counts.matched, 1, "counts.matched must reflect displayed items (1)");
    assert.equal(filteredRes.data.items.length, 1, "items must contain only the warning");
    assert.equal(filteredRes.data.items[0].diagnosticId, "d-warn");
    console.log("   -> OK: pre-filter verdict & totals preserved when error filtered out");

    // 6. counts.matched до разбиения на страницы и стабильные последующие страницы
    console.log("6. Testing counts.matched and stable multi-page pagination...");
    const page1Res = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", limit: 5 },
    });
    const page1Data = page1Res.result?.structuredContent?.data;
    const page1Page = page1Res.result?.structuredContent?.page;
    assert.equal(page1Data.items.length, 5);
    assert.ok(page1Data.counts.matched > 5);
    assert.equal(page1Page.totalMatched, page1Data.counts.matched);
    assert.ok(page1Page.nextCursor);

    const page2Res = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", limit: 5, cursor: page1Page.nextCursor },
    });
    const page2Data = page2Res.result?.structuredContent?.data;
    const page2Page = page2Res.result?.structuredContent?.page;
    assert.equal(page2Data.items.length, 5);
    assert.equal(page2Data.counts.matched, page1Data.counts.matched);
    // Page 2 items must be disjoint from page 1 items
    const page1Ids = new Set(page1Data.items.map((i) => i.diagnosticId));
    for (const item of page2Data.items) {
      assert.equal(page1Ids.has(item.diagnosticId), false, "Pages must be disjoint");
    }
    console.log("   -> OK: counts.matched stable, pages disjoint");

    // 7. изменённые фильтры, изменённая область, подменённый и устаревший cursor
    console.log("7. Testing altered filters, altered scope, substituted, and stale cursor rejection...");
    // Passing page 1 cursor to a call with altered severities filter
    const alteredFilterRes = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", limit: 5, severities: ["INFO"], cursor: page1Page.nextCursor },
    });
    assert.equal(alteredFilterRes.result?.structuredContent?.ok, false);
    assert.equal(alteredFilterRes.result?.structuredContent?.error?.code, "STALE_CURSOR");

    // Passing page 1 cursor to a call with altered scope (specSlugs)
    const alteredScopeRes = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", limit: 5, specSlugs: ["plugin-distribution"], cursor: page1Page.nextCursor },
    });
    assert.equal(alteredScopeRes.result?.structuredContent?.ok, false);
    assert.equal(alteredScopeRes.result?.structuredContent?.error?.code, "STALE_CURSOR");

    // Malformed cursor
    const badCursorRes = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", cursor: "not-a-valid-cursor" },
    });
    assert.equal(badCursorRes.result?.structuredContent?.ok, false);
    assert.ok(["INVALID_CURSOR", "STALE_CURSOR"].includes(badCursorRes.result?.structuredContent?.error?.code));
    console.log("   -> OK: altered filters, scope, or bad cursor return STALE_CURSOR / INVALID_CURSOR");

    // 8. диагностика без specSlug: входит в корпус и исключается из выбранной спеки
    console.log("8. Testing diagnostics without specSlug: included in corpus, excluded from specific spec...");
    const noSlugGraph = {
      schemaVersion: "spec-kernel@1",
      fingerprint: "f-noslug",
      valid: false,
      documents: [{ specSlug: "my-spec" }],
      nodes: [],
      edges: [],
      counts: mockCounts,
      diagnostics: [
        { diagnosticId: "d-corpus-only", severity: "WARNING", code: "IO_READ_FAILED", specSlug: null },
        { diagnosticId: "d-spec-bound", severity: "WARNING", code: "BROKEN_MARKDOWN_LINK", specSlug: "my-spec" },
      ],
      limits: mockLimits,
    };
    // Corpus query: both participate
    const corpusQuery = executeQuery(noSlugGraph, {
      schemaVersion: "spec-kernel@1",
      requestId: "q-corpus",
      operation: "validation",
      args: { severities: [], codes: [], specSlugs: [], paths: [], limit: 50, cursor: null },
    });
    assert.equal(corpusQuery.data.counts.total, 2);
    assert.ok(corpusQuery.data.items.some((i) => i.diagnosticId === "d-corpus-only"));

    // Spec-specific query: d-corpus-only must NOT participate in counts or items
    const specQuery = executeQuery(noSlugGraph, {
      schemaVersion: "spec-kernel@1",
      requestId: "q-spec",
      operation: "validation",
      args: { severities: [], codes: [], specSlugs: ["my-spec"], paths: [], limit: 50, cursor: null },
    });
    assert.equal(specQuery.data.counts.total, 1, "d-corpus-only must not be counted in spec scope");
    assert.equal(specQuery.data.items.length, 1);
    assert.equal(specQuery.data.items[0].diagnosticId, "d-spec-bound");
    console.log("   -> OK: null-specSlug diagnostic included in corpus, excluded from spec scope");

    // 9. точные title/description каждой ветки реальной схемы tools/list и описание дискриминатора
    console.log("9. Testing exact title/description of every branch in tools/list schema...");
    const listRes = await server.request("tools/list", {});
    const tools = listRes.result?.tools ?? [];
    for (const tool of tools) {
      const contract = TOOL_CONTRACTS.find((c) => c.tool === tool.name);
      if (contract?.discriminator) {
        assert.ok(tool.inputSchema.properties[contract.discriminator].description, `${tool.name} discriminator description`);
        assert.equal(
          tool.inputSchema.properties[contract.discriminator].description,
          `Select one declared ${contract.discriminator} branch in oneOf.`
        );
        for (const branch of tool.inputSchema.oneOf) {
          const vName = branch.properties[contract.discriminator].enum[0];
          assert.equal(branch.title, `${contract.discriminator}: ${vName}`);
          assert.equal(branch.description, contract.variants[vName].description);
        }
      }
    }
    console.log("   -> OK: all tools/list oneOf titles and descriptions strictly match contract");

    // 10. additionalProperties: false и отказ несовместимых полей
    console.log("10. Testing additionalProperties: false and refusal of incompatible fields...");
    const c10Unknown = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", unexpectedField: 123 },
    });
    assert.equal(c10Unknown.result?.structuredContent?.ok, false);
    assert.ok(["UNKNOWN_FIELD", "INVALID_REQUEST"].includes(c10Unknown.result?.structuredContent?.error?.code));

    // Cross-branch field (spec from anchor/archivalProof branch)
    const c10Cross = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "validation", spec: "plugin-distribution" },
    });
    assert.equal(c10Cross.result?.structuredContent?.ok, false);
    assert.equal(c10Cross.result?.structuredContent?.error?.code, "INVALID_REQUEST");

    // Old check names
    const c10Old1 = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "specValidation", spec: "plugin-distribution" },
    });
    assert.equal(c10Old1.result?.structuredContent?.ok, false);
    assert.equal(c10Old1.result?.structuredContent?.error?.code, "INVALID_REQUEST");

    const c10Old2 = await server.request("tools/call", {
      name: "spec_inspect",
      arguments: { schemaVersion: "spec-kernel@1", check: "diagnostics" },
    });
    assert.equal(c10Old2.result?.structuredContent?.ok, false);
    assert.equal(c10Old2.result?.structuredContent?.error?.code, "INVALID_REQUEST");
    console.log("   -> OK: unknown, cross-branch, and retired fields refused with INVALID_REQUEST");

    console.log("=== ALL 10 OBSERVABLE CASES PASSED PERFECTLY ===");
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in validation observable matrix:", err);
  process.exit(1);
});

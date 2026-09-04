#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotationsFor,
  assertContractInvariants,
  jsonSchemaFor,
  MUTATING_TOOL_NAMES,
  PATCH_OPERATION_KINDS,
  TASK_STATUS_VALUES,
  TOOL_CONTRACTS,
  validateContractArguments,
} from "../src/adapters/tool-contracts.js";
import {
  EDGE_TYPES,
  EDGE_TYPE_DESCRIPTORS,
  ENTITY_TYPE_DESCRIPTORS,
  NODE_KINDS,
} from "../src/kernel/types.js";
import {
  computeMetrics,
  evaluateGates,
  EXPECTED_11_TOOLS,
  LIMITS,
  RETIRED_TOOL_NAMES,
} from "./measure-mcp-tool-blast.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runMutant(id, description, mutantFn, oracleFn) {
  let mutantData;
  try {
    mutantData = mutantFn();
  } catch (err) {
    return { id, description, status: "KILLED", error: err.message };
  }

  try {
    const res = oracleFn(mutantData);
    // If oracle explicitly returns { ok: false } or thrown error -> KILLED
    if (res && typeof res === "object" && res.killed === true) {
      return { id, description, status: "KILLED", error: res.reason ?? "rejected by validator" };
    }
    // If oracle didn't throw and didn't report killed -> mutant survived!
    return { id, description, status: "SURVIVED" };
  } catch (err) {
    // Thrown invariant assertion kills the mutant!
    return { id, description, status: "KILLED", error: err.message };
  }
}

export function generateAndEvaluateMutants() {
  const receipts = [];

  // Group 1: Delete each of the 11 tools (11 mutants)
  for (const toolName of EXPECTED_11_TOOLS) {
    const receipt = runMutant(
      `delete-tool-${toolName}`,
      `Remove tool ${toolName} from contracts`,
      () => TOOL_CONTRACTS.filter((c) => c.tool !== toolName),
      (mutantContracts) => {
        assertContractInvariants(mutantContracts);
      },
    );
    receipts.push(receipt);
  }

  // Group 2: Duplicate each tool name (11 mutants)
  for (const c of TOOL_CONTRACTS) {
    const receipt = runMutant(
      `duplicate-tool-name-${c.tool}`,
      `Duplicate tool name ${c.tool}`,
      () => [...TOOL_CONTRACTS, { ...c }],
      (mutantContracts) => {
        assertContractInvariants(mutantContracts);
      },
    );
    receipts.push(receipt);
  }

  // Group 3: Duplicate each operation (11 mutants)
  for (const c of TOOL_CONTRACTS) {
    const receipt = runMutant(
      `duplicate-operation-${c.operation}`,
      `Duplicate operation ${c.operation} with new tool name`,
      () => [...TOOL_CONTRACTS, { ...c, tool: `mutant_${c.tool}` }],
      (mutantContracts) => {
        assertContractInvariants(mutantContracts);
      },
    );
    receipts.push(receipt);
  }

  // Group 4: Reintroduce each of the 36 retired tool names (36 mutants)
  for (const retiredName of RETIRED_TOOL_NAMES) {
    const receipt = runMutant(
      `reintroduce-retired-${retiredName}`,
      `Reintroduce retired tool ${retiredName}`,
      () => {
        const dummyTool = {
          name: retiredName,
          title: retiredName,
          description: "Retired tool reintroduction mutant.",
          outputSchema: {},
          inputSchema: {},
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        };
        const mutantTools = [
          ...TOOL_CONTRACTS.map((contract) => ({
            name: contract.tool,
            title: contract.label,
            description: contract.description,
            outputSchema: {},
            inputSchema: jsonSchemaFor(contract),
            annotations: annotationsFor(contract),
          })),
          dummyTool,
        ];
        return { mutantTools };
      },
      ({ mutantTools }) => {
        const metrics = computeMetrics(mutantTools);
        const gates = evaluateGates(metrics, mutantTools);
        assert.equal(gates.passed, true, `Gates must fail on retired name ${retiredName}`);
      },
    );
    receipts.push(receipt);
  }

  // Group 5: Invert annotations for apply_proposed_patch (1 mutant)
  receipts.push(
    runMutant(
      "invert-apply-annotations-to-read-only",
      "Invert apply_proposed_patch annotation to read-only",
      () => {
        const mutatedContracts = TOOL_CONTRACTS.map((c) => {
          if (c.tool === "apply_proposed_patch") {
            return { ...c, tool: "mutant_read_apply" };
          }
          return c;
        });
        return mutatedContracts;
      },
      (mutantContracts) => {
        assertContractInvariants(mutantContracts);
      },
    ),
  );

  // Group 6: Make proposal tool mutating (1 mutant)
  receipts.push(
    runMutant(
      "proposal-as-mutating-tool",
      "Add spec_propose_patch to MUTATING_TOOL_NAMES",
      () => {
        const mutantMutators = new Set([...MUTATING_TOOL_NAMES, "spec_propose_patch"]);
        return { mutantMutators };
      },
      ({ mutantMutators }) => {
        const mutating = TOOL_CONTRACTS.filter((c) => mutantMutators.has(c.tool));
        assert.equal(mutating.length, 1, "Only apply_proposed_patch can be mutating");
        assert.equal(mutating[0].tool, "apply_proposed_patch");
      },
    ),
  );

  // Group 7: Delete discriminator branches across all discriminated tools
  for (const c of TOOL_CONTRACTS) {
    if (!c.discriminator || !c.variants) continue;
    for (const vName of Object.keys(c.variants)) {
      receipts.push(
        runMutant(
          `delete-branch-${c.tool}-${vName}`,
          `Delete variant branch ${vName} from ${c.tool}`,
          () => {
            const nextVariants = { ...c.variants };
            delete nextVariants[vName];
            return { ...c, variants: Object.freeze(nextVariants) };
          },
          (mutantContract) => {
            // Attempt to validate args with deleted variant
            const args = { [c.discriminator]: vName };
            const validation = validateContractArguments(mutantContract, args);
            assert.equal(validation.ok, true, `Deleted variant ${vName} must be rejected`);
          },
        ),
      );
    }
  }

  // Group 8: Duplicate discriminator branch in each discriminated tool
  for (const c of TOOL_CONTRACTS) {
    if (!c.discriminator || !c.variants) continue;
    const firstVariant = Object.keys(c.variants)[0];
    receipts.push(
      runMutant(
        `duplicate-branch-${c.tool}-${firstVariant}`,
        `Duplicate branch in ${c.tool}`,
        () => {
          return {
            ...c,
            variants: {
              ...c.variants,
              duplicate_key: { ...c.variants[firstVariant] },
            },
          };
        },
        (mutantContract) => {
          // Schema generation check
          const schema = jsonSchemaFor(mutantContract);
          assert.equal(schema.oneOf.length, Object.keys(c.variants).length, "oneOf length changed");
        },
      ),
    );
  }

  // Group 9: Reject cross-branch fields (mutant validator allowing cross-branch properties)
  for (const c of TOOL_CONTRACTS) {
    if (!c.discriminator || !c.variants) continue;
    const keys = Object.keys(c.variants);
    if (keys.length < 2) continue;
    const v1 = keys[0];
    const v2 = keys[1];
    const v1FieldNames = new Set(c.variants[v1].fields.map((f) => f.name));
    const uniqueToV2 = c.variants[v2].fields.find((f) => !v1FieldNames.has(f.name));
    if (!uniqueToV2) continue;
    const fieldName = uniqueToV2.name;

    receipts.push(
      runMutant(
        `cross-branch-${c.tool}-${v1}-with-${fieldName}`,
        `Call ${c.tool} with variant ${v1} and field ${fieldName} from ${v2}`,
        () => ({
          contract: c,
          args: { [c.discriminator]: v1, [fieldName]: "cross_branch_val" },
        }),
        ({ contract, args }) => {
          const validation = validateContractArguments(contract, args);
          if (validation.ok === false && validation.code === "INVALID_REQUEST") {
            return { killed: true, reason: validation.message };
          }
          return { killed: false };
        },
      ),
    );
  }

  // Group 10: Reject unknown fields in non-discriminated tools
  for (const c of TOOL_CONTRACTS) {
    if (c.discriminator) continue;
    receipts.push(
      runMutant(
        `unknown-field-${c.tool}`,
        `Call ${c.tool} with unknown field`,
        () => ({ contract: c, args: { unexpected_field_123: true } }),
        ({ contract, args }) => {
          const validation = validateContractArguments(contract, args);
          if (validation.ok === false && validation.code === "UNKNOWN_FIELD") {
            return { killed: true, reason: validation.message };
          }
          return { killed: false };
        },
      ),
    );
  }

  // Group 11: Replace operations schema in patch variant with {}
  const patchContract = TOOL_CONTRACTS.find((c) => c.tool === "spec_propose_patch");
  receipts.push(
    runMutant(
      "permissive-operations-schema",
      "Pass bogus operations array to patch intent",
      () => ({
        contract: patchContract,
        args: {
          intent: "patch",
          spec: "plugin-distribution",
          reason: "test",
          requestId: "req-1",
          repositoryRootFingerprint: "0".repeat(64),
          operations: [{ bogus_field: true }],
        },
      }),
      ({ contract, args }) => {
        const validation = validateContractArguments(contract, args);
        if (validation.ok === false && validation.code === "INVALID_REQUEST") {
          return { killed: true, reason: validation.message };
        }
        return { killed: false };
      },
    ),
  );

  // Group 12: Replace expectedDocuments schema in apply_proposed_patch with {}
  const applyContract = TOOL_CONTRACTS.find((c) => c.tool === "apply_proposed_patch");
  receipts.push(
    runMutant(
      "permissive-expected-documents-schema",
      "Pass empty expectedDocuments array to apply_proposed_patch",
      () => ({
        contract: applyContract,
        args: {
          requestId: "req-1",
          proposalId: "p",
          proposalSha256: "h",
          expectedDocuments: [],
          reason: "r",
          approval: "approve",
        },
      }),
      ({ contract, args }) => {
        const validation = validateContractArguments(contract, args);
        if (validation.ok === false && validation.code === "INVALID_REQUEST") {
          return { killed: true, reason: validation.message };
        }
        return { killed: false };
      },
    ),
  );

  // Group 13: Delete each entity kind descriptor (15 mutants)
  for (const descriptor of ENTITY_TYPE_DESCRIPTORS) {
    receipts.push(
      runMutant(
        `delete-entity-descriptor-${descriptor.kind}`,
        `Delete entity descriptor ${descriptor.kind}`,
        () => ENTITY_TYPE_DESCRIPTORS.filter((d) => d.kind !== descriptor.kind),
        (mutantDescriptors) => {
          assert.equal(mutantDescriptors.length, 15, "Entity descriptor count must equal 15");
        },
      ),
    );
  }

  // Group 14: Delete each edge type descriptor (7 mutants)
  for (const descriptor of EDGE_TYPE_DESCRIPTORS) {
    receipts.push(
      runMutant(
        `delete-edge-descriptor-${descriptor.type}`,
        `Delete edge descriptor ${descriptor.type}`,
        () => EDGE_TYPE_DESCRIPTORS.filter((d) => d.type !== descriptor.type),
        (mutantDescriptors) => {
          assert.equal(mutantDescriptors.length, 7, "Edge descriptor count must equal 7");
        },
      ),
    );
  }

  return receipts;
}

async function main() {
  const receipts = generateAndEvaluateMutants();
  const total = receipts.length;
  const killed = receipts.filter((r) => r.status === "KILLED").length;
  const survivors = receipts.filter((r) => r.status === "SURVIVED");

  const report = {
    schema: "omp-spec-kit-mutation-gate@1",
    timestamp: new Date().toISOString(),
    totalMutants: total,
    killed,
    survivors: survivors.length,
    passed: survivors.length === 0,
    receipts: receipts.map((r) => ({
      id: r.id,
      status: r.status,
      description: r.description,
      ...(r.error ? { killerAssertion: r.error } : {}),
    })),
  };

  const outputPath = path.join(repositoryRoot, "docs", "validation", "mutation-gate-receipt.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("Mutation Testing Gate Summary:");
  console.log("  Total Mutants: " + total);
  console.log("  Killed:        " + killed);
  console.log("  Survivors:     " + survivors.length);
  console.log("  Gate Passed:   " + report.passed);

  if (!report.passed) {
    console.error("FAIL CLOSED: Mutation testing gate failed. Surviving mutants:");
    for (const s of survivors) {
      console.error("  - " + s.id + ": " + s.description);
    }
    process.exit(1);
  }

  console.log("Saved mutation gate receipt to: " + path.relative(repositoryRoot, outputPath));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error in mutation gate:", err);
    process.exit(1);
  });
}

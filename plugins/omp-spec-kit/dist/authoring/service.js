import { createHash } from "node:crypto";
import { detectSecret } from "./secrets.js";
import { error, safeErrorCode } from "./error-codes.js";
import { ProposalCompiler, publicOperationKind } from "./proposals.js";
import {
  canonicalJson,
  commitDocuments,
  MIGRATION_RECEIPT_SCHEMA,
  migrationReceiptChanges,
  migrationReceiptGenerationValid,
  readMigrationReceipt,
  readDocumentBytes,
  requestIdWithinBounds,
  sha256,
  specificationDirectoryDigest,
  withWriteLock,
} from "./transactions.js";
import {
  ELICITATION_HINT,
  ELICITATION_REQUIRED,
  ELICITATION_SKILL_URI,
  FirstWriteElicitationGuard,
} from "./elicitation-guard.js";
import { READINESS_REFUSALS } from "../kernel/readiness.js";

export const AUTHORING_OPERATIONS = Object.freeze(["specPatch"]);
// The refusals NFR-OBS-1 makes durable: admission verdicts from the readiness
// gate, not the transport-level answers the same path can also return.
const ADMISSION_REFUSAL_CODES = new Set(Object.keys(READINESS_REFUSALS));


function compileRefusalCode(code) {
  return code === "CONFLICT";
}

function validateActorRef(actorRef) {
  if (actorRef === undefined || actorRef === null) return { ok: true };
  if (typeof actorRef !== "string" || actorRef.length === 0 || actorRef.length > 64) {
    return { ok: false, message: "actorRef must be a string up to 64 characters" };
  }
  if (/[\x00-\x1f\x7f\\/]/u.test(actorRef)) {
    return { ok: false, message: "actorRef contains forbidden control characters or path separators" };
  }
  if (detectSecret(actorRef)) {
    return { ok: false, message: "actorRef resembles a secret credential" };
  }
  return { ok: true };
}

function appliedMigrationResponse(saved, input) {
  return {
    ok: true,
    data: {
      schemaVersion: "spec-mcp-operations-patch@1",
      requestId: saved.requestId,
      dryRun: false,
      proposalHash: saved.proposalHash,
      outcome: "APPLIED",
      receipt: {
        schemaVersion: "spec-mcp-operations-receipt@1",
        requestId: saved.requestId,
        proposalHash: saved.proposalHash,
        outcome: "APPLIED",
        reason: input.reason,
        ...(input.actorRef ? { actorRef: input.actorRef } : {}),
        changedDocuments: saved.changedDocuments,
        migration: saved.migration,
        findings: [],
      },
    },
  };
}

export class SpecPatchService {
  constructor(root, getGraph, refreshGraph, options = {}) {
    this.root = root;
    this.getGraph = getGraph;
    this.refreshGraph = refreshGraph;
    this.options = options;
    this.compiler = new ProposalCompiler(root);
    this.elicitationGuard = options.elicitationGuard ?? new FirstWriteElicitationGuard();
    this.applied = new Map();
    this.operations = AUTHORING_OPERATIONS;
  }

  // NFR-OBS-1: an operator can see a team stuck at a level without reading an
  // agent transcript. Logging never changes the refusal and never throws.
  auditRefusal(code, input, details = {}) {
    if (typeof this.options.audit !== "function") return;
    // The guard lives here so every caller is covered: only the five admission
    // refusals are durable, never a compile error or a transport answer.
    if (!ADMISSION_REFUSAL_CODES.has(code)) return;
    try {
      const blockers = Array.isArray(details?.blockers) ? details.blockers : [];
      const identities = blockers
        .map((entry) => (typeof entry === "string" ? entry : entry?.code))
        .filter((entry) => typeof entry === "string");
      // The durable access log keeps five shared columns only, and `result` is
      // the one free-text column every driver preserves and listAccess can
      // query. The slug, code, level and blocker identities therefore live in
      // that row, prefixed so an operator can select refusals alone.
      const level = typeof details?.level === "string" ? details.level : "unknown";
      this.options.audit({
        ts: new Date().toISOString(),
        op: "spec_patch",
        spec: typeof input?.spec === "string" ? input.spec : null,
        requestId: typeof input?.requestId === "string" ? input.requestId : null,
        result: `admission-refused:${code}:${level}:${identities.join(",") || "none"}`,
      });
    } catch {
      // The durable log is best-effort; a refusal must still be returned.
    }
  }

  async execute(input = {}, context = {}, internal = {}) {
    const requestId = input.requestId;
    if (input.intent === "approveBddCoverage" && context.coverageOwner !== true) {
      return error("BDD_COVERAGE_PROTECTED", "Approval requires the hosted project owner");
    }

    const actorValidation = validateActorRef(input.actorRef);
    if (!actorValidation.ok) {
      return error("INVALID_REQUEST", actorValidation.message, { requestId });
    }

    if (input.dryRun !== undefined && typeof input.dryRun !== "boolean") {
      return error("INVALID_REQUEST", "dryRun must be a boolean when provided", {
        requestId,
        parameter: "dryRun",
        expected: "boolean",
        receivedType: typeof input.dryRun,
      });
    }

    const dryRun = input.dryRun ?? true;
    const requestKey = canonicalJson({
      input: { ...input, intent: input.intent ?? "patch", dryRun: false },
      ...(input.intent === "migrateSpec" ? { migrationScope: context.migrationScope ?? null } : {}),
    });

    const refusal = (code, message, findings = [], proposalHash = "", details = {}) => {
      this.auditRefusal(code, input, details);
      // The refused answer carries the same QueryError record every other
      // path builds: one builder, so a field never goes missing here.
      const built = error(code, message, {
        findings,
        requestId: typeof requestId === "string" ? requestId : "",
        proposalHash,
      });
      return {
        ok: true,
        data: {
          schemaVersion: "spec-mcp-operations-patch@1",
          requestId: typeof requestId === "string" ? requestId : "",
          dryRun: false,
          proposalHash,
          outcome: "REFUSED",
          error: built.error,
        },
      };
    };

    if (!dryRun) {
      if (this.options.authorityAllowed === false) {
        return refusal("PATH_FORBIDDEN", "untrusted caller cannot mutate specifications");
      }

      const localMigration = input.intent === "migrateSpec" && context.hostedCoverage !== true;
      if (localMigration && !requestIdWithinBounds(requestId)) return error("INVALID_REQUEST", "requestId must be a bounded non-empty string");

      // A migration receipt is durable on local roots. Its read, any stale
      // journal recovery, and a new migration all run under one write lock.
      if (localMigration && !internal.migrationLockHeld) {
        try {
          return await withWriteLock(this.root, requestId, async () => {
            const saved = await readMigrationReceipt(this.root, requestId);
            if (saved) {
              if (saved.requestKeyHash !== sha256(requestKey) || saved.spec !== input.spec ||
                  saved.snapshot !== input.snapshot || saved.proposalHash !== input.expectedProposalHash ||
                  saved.migration.sourceHash !== sha256(canonicalJson(input.mapping)) ||
                  canonicalJson(saved.migration.scope ?? null) !== canonicalJson(context.migrationScope ?? null)) {
                return refusal("CONFLICT", `requestId ${requestId} already used with different payload`);
              }
              if (!(await migrationReceiptGenerationValid(this.root, saved))) {
                return refusal("CONFLICT", "migration was recorded, but its current generation has changed; reconcile before retrying");
              }
              return appliedMigrationResponse(saved, input);
            }
            return this.execute(input, context, { migrationLockHeld: true });
          });
        } catch (caught) {
          return refusal(safeErrorCode(caught?.code ?? "INTERNAL_ERROR"), caught?.message || "migration recovery was refused");
        }
      }

      // Existing migration request IDs must not become ordinary patch IDs
      // after a process restart. Recheck once more under the commit lock below.
      if (!localMigration && context.hostedCoverage !== true && requestIdWithinBounds(requestId)) {
        try {
          if (await readMigrationReceipt(this.root, requestId)) return refusal("CONFLICT", `requestId ${requestId} already used for a migration`);
        } catch (caught) {
          return refusal(safeErrorCode(caught?.code ?? "INTERNAL_ERROR"), caught?.message || "migration receipt could not be checked");
        }
      }

      // Replay detection using canonical request key before compile.
      const prior = this.applied.get(requestId);
      if (prior && !localMigration) {
        if (prior.requestKey === requestKey) {
          return prior.response;
        }
        return refusal("CONFLICT", `requestId ${requestId} already used with different payload`);
      }
    }

    if (typeof this.refreshGraph === "function") await this.refreshGraph();
    const graph = await this.getGraph();

    const compileRes = await this.compiler.compile(input, graph, context);
    if (!compileRes.ok) {
      if (!dryRun && compileRefusalCode(compileRes.error?.code)) {
        // The envelope refusal logs once, with the blockers and level the
        // compiler reported.
        return refusal(
          compileRes.error.code,
          compileRes.error.message,
          compileRes.error.findings,
          compileRes.error.proposalHash,
          compileRes.error,
        );
      }
      this.auditRefusal(compileRes.error?.code ?? "VALIDATION_FAILED", input, compileRes.error);
      return compileRes;
    }
    const proposal = compileRes.data;

    // Mode 1: dryRun preview (no write lock, no staging, no writes)
    if (dryRun) {
      return {
        ok: true,
        data: {
          schemaVersion: "spec-mcp-operations-patch@1",
          requestId: requestId ?? null,
          dryRun: true,
          proposalHash: proposal.proposalHash,
          outcome: "PREVIEW",
          spec: proposal.spec,
          baseGenerationSha256: proposal.baseSnapshotSha256,
          // AC-1.1: a preview reports the level and blockers before any write.
          ...(proposal.readiness ? { readiness: proposal.readiness } : {}),
          operations: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            operation: publicOperationKind(change.operation),
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
            diff: change.preview.unifiedDiff,
          })),
          findings: proposal.findings ?? [],
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
          ...(proposal.migration ? { migration: proposal.migration } : {}),
        },
      };
    }

    // Mode 2: dryRun: false transactional commit
    const proposalHash = proposal.proposalHash;
    if (proposal.kind === "migration" && input.expectedProposalHash !== proposalHash) {
      return refusal("CONFLICT", "Preview migration and pass its exact proposalHash as expectedProposalHash", [], proposalHash);
    }

    try {
      const commit = async () => {
        if (context.hostedCoverage !== true && proposal.kind !== "migration" && await readMigrationReceipt(this.root, requestId)) {
          return refusal("CONFLICT", `requestId ${requestId} already used for a migration`);
        }
        if (proposal.kind === "migration") {
          const current = await specificationDirectoryDigest(this.root, proposal.spec);
          if (!current.ok || current.digest !== proposal.migration.snapshot) {
            return refusal("CONFLICT", "specification snapshot changed after migration preview", [], proposalHash);
          }
        }
        // Under write lock, verify graph fingerprint hasn't changed
        const freshGraph = typeof this.refreshGraph === "function" ? await this.refreshGraph() : await this.getGraph();
        if (freshGraph.fingerprint !== proposal.baseSnapshotSha256) {
          return refusal("CONFLICT", "graph snapshot changed after proposal", [], proposalHash);
        }

        // Under write lock, verify each document preimage hash
        for (const change of proposal.changes) {
          const current = await readDocumentBytes(this.root, proposal.spec, change.document, { allowLegacy: change.migrationLegacy === true });
          const currentHash = current.ok ? current.sha256 : sha256(Buffer.alloc(0));
          if (currentHash !== change.preview.beforeSha256) {
            return refusal("CONFLICT", "a targeted document changed after proposal creation", [], proposalHash);
          }
        }

        const guardCheck = this.elicitationGuard.checkAndRecord(proposal.spec, proposal.changes);
        if (!guardCheck.ok) {
          return {
            ok: true,
            data: {
              schemaVersion: "spec-mcp-operations-patch@1",
              requestId: typeof requestId === "string" ? requestId : "",
              dryRun: false,
              proposalHash,
              outcome: "REFUSED",
              error: {
                code: ELICITATION_REQUIRED,
                message: `${ELICITATION_HINT} (first creation of ${guardCheck.documents.join(", ")} was stopped; retry is allowed)`,
                retryable: false,
                requestId: typeof requestId === "string" ? requestId : "",
                proposalHash,
                skill: ELICITATION_SKILL_URI,
                documents: guardCheck.documents,
                changedPaths: [],
                findings: [],
              },
            },
          };
        }

        let changesToApply = proposal.changes;
        if (proposal.kind === "archive") {
          changesToApply = proposal.changes.map((c) => ({
            ...c,
            destination: "." + "specs/archive/" + proposal.spec + "/" + c.document,
          }));
        }

        const receipt = {
          schemaVersion: "spec-mcp-operations-receipt@1",
          requestId,
          proposalHash,
          outcome: "APPLIED",
          reason: input.reason,
          ...(input.actorRef ? { actorRef: input.actorRef } : {}),
          changedDocuments: proposal.changes.map((change) => ({
            path: "." + "specs/" + change.spec + "/" + change.document,
            beforeSha256: change.preview.beforeSha256,
            afterSha256: change.preview.afterSha256,
          })),
          ...(proposal.archive ? { archive: { ...proposal.archive } } : {}),
          ...(proposal.migration ? { migration: { snapshot: proposal.migration.snapshot, scope: proposal.migration.scope, sourceHash: proposal.migration.summary.sourceHash } } : {}),
          findings: [],
        };

        const durableMigrationReceipt = proposal.kind === "migration" && context.hostedCoverage !== true ? {
          schema: MIGRATION_RECEIPT_SCHEMA,
          requestId,
          requestKeyHash: sha256(requestKey),
          spec: proposal.spec,
          snapshot: proposal.migration.snapshot,
          proposalHash,
          changes: migrationReceiptChanges(changesToApply),
          changedDocuments: receipt.changedDocuments,
          migration: receipt.migration,
        } : null;

        await commitDocuments(this.root, requestId, changesToApply, {
          ...this.options,
          ...(durableMigrationReceipt ? { durableMigrationReceipt } : {}),
        });
        if (typeof this.refreshGraph === "function") await this.refreshGraph();

        return {
          ok: true,
          data: {
            schemaVersion: "spec-mcp-operations-patch@1",
            requestId,
            dryRun: false,
            proposalHash,
            outcome: "APPLIED",
            receipt,
          },
        };
      };
      const result = internal.migrationLockHeld ? await commit() : await withWriteLock(this.root, requestId, commit);

      if (result.ok && result.data?.outcome === "APPLIED") {
        this.applied.set(requestId, { requestKey, response: result });
      }
      return result;
    } catch (caught) {
      const code = safeErrorCode(caught?.code ?? "INTERNAL_ERROR");
      return refusal(code, caught?.message || "specification transaction was refused", [], proposalHash);
    }
  }

  /**
   * The hosted write pipeline commits to the spec branch after the kernel
   * applies the change. When that commit fails, the memoized APPLIED response
   * describes a write that never landed; dropping it lets the same requestId
   * compile again against the restored corpus instead of replaying a lie.
   */
  forgetApplied(requestId) {
    this.applied.delete(requestId);
  }

  /** True when this requestId already produced an APPLIED response. */
  hasApplied(requestId) {
    return this.applied.has(requestId);
  }
}

export function createAuthoringService(root, getGraph, refreshGraph, options = {}) {
  return new SpecPatchService(root, getGraph, refreshGraph, options);
}

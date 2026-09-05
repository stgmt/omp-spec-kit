# OMP Spec Kit Internal URI Guard Regression Audit (2026-09-05)

## 1. Executive Summary and Diagnosis Correction

### Correction of Previous Findings
In previous triage sessions, intermittent `TARGET_INDETERMINATE` errors in consumer repositories (such as `omp-reviewer-kit`) were attributed to:
1. **Missing `.specs` directory**: In early unreleased drafts of `resolve-targets.js`, `realpathSync.native(path.join(projectRoot, ".specs"))` threw `ENOENT` when `.specs` did not exist on disk, causing the catch block to return `INDETERMINATE` for all paths across the entire project. This was addressed in v1.0.0 by `resolveSpecsRoot()`, which falls back to the logical candidate path on `ENOENT`.
2. **Stale OMP process hypothesis**: While a running OMP process does cache loaded plugin hooks, the persistent blocking of `read skill://...` and `read local://...` in v1.0.0 was **not** caused by a stale process running old code. It returned the modern v1.0.0 recovery message:
   `TARGET_INDETERMINATE: Recovery: provide one explicit repository-relative target, or use spec_patch with dryRun: true for preview or dryRun: false to apply.`

### Root Cause
In `src/enforcement/resolve-targets.js`:
```javascript
const URI_SHAPED = /^[a-z][a-z0-9+.-]*:\/\//iu;
const XD_PREFIX = "xd://";

function unsafeTarget(raw) {
  if (typeof raw !== "string" || raw.trim() === "" || INDETERMINATE_INPUT.test(raw)) return true;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith(XD_PREFIX) || URI_SHAPED.test(trimmed)) return true;
  if (process.platform === "win32" && WINDOWS_UNSAFE_PATH.test(raw)) return true;
  return false;
}

export function resolveTarget(root, raw) {
  if (isXdDeviceTarget(raw)) return { resolution: "NON_SPEC", relativePath: null };
  if (unsafeTarget(raw)) return { resolution: "INDETERMINATE", relativePath: null };
  // ...
}
```
`resolveTarget` handled only `isXdDeviceTarget(raw)` as a special-case `NON_SPEC` bypass. For all other internal OMP URIs (`skill://`, `local://`, `history://`, `agent://`, `mcp://`, `omp://`, etc.), `unsafeTarget(raw)` evaluated `URI_SHAPED.test(trimmed)` to `true`. This caused `resolveTarget` to unconditionally return `INDETERMINATE`, completely blocking OMP's 15 other internal URI protocols before they could reach OMP's internal protocol router.

---

## 2. Grounding Table: Claims, Paths, Lines, and Verification Evidence

| Claim | Grounding Path & Line Numbers | Verification Command / Evidence |
| :--- | :--- | :--- |
| **Claim 1: Installed OMP 17.3.7 registers 15 internal URI handlers** | `C:\Users\stigm\.omp\plugins\node_modules\@oh-my-pi\pi-coding-agent\src\internal-urls\router.ts:1-54`, `tools/write.ts:128-130` | `InternalUrlRouter` registers `omp, agent, artifact, memory, local, vault, skill, rule, security, mcp, issue, pr, history, ssh, xd`; `write.ts` also recognizes `conflict://` |
| **Claim 2: Pinned OMP 18.0.11 runtime registers identical 15 protocols** | `tests/fixtures/omp-discovery-runtime/node_modules/@oh-my-pi/pi-coding-agent/src/internal-urls/router.ts:1-53` | Pinned fixture inspection confirms exact match of registered protocol classes |
| **Claim 3: `read` tool routes internal URLs through router, bypassing FS** | `tools/read.ts:1151-1180`, `tools/read.ts:888-925` | `internalRouter.canResolve(readPath)` branches to handler-owned resolution (`resolveLocalUrlToFile`, etc.) |
| **Claim 4: `write` tool permits addressable internal targets** | `tools/write.ts:106-130, 1115-1192` | `assertWriteTargetAddressable` checks `router.canHandle(trimmed)` and passes `conflict://` downstream |
| **Claim 5: `tool_call` hook receives raw input with block semantics** | `extensibility/hooks/types.ts:302-314`, `extensibility/shared-events.ts:306-329` | `ToolCallEvent` passes `event.input`; `{ block: true, reason }` halts tool execution |
| **Claim 6: `resolveTarget` in v1.0.0 blocked all non-xd internal URIs** | `src/enforcement/resolve-targets.js:25-33, 56-60` | `URI_SHAPED.test(raw)` returned `true` for all valid internal URIs, causing `TARGET_INDETERMINATE` |

---

## 3. Error Propagation Flow

```
Agent issues tool call (e.g. read "skill://plain-russian-progress" or write "local://plan.md")
  │
  ▼
OMP `tool_call` lifecycle hook fires before tool execution
  │
  ▼
`createSpecEnforcementHandler` invokes `classifyToolCall(event)`
  │
  ▼
`classifyToolCall` calls `textValues(input)` -> extracts target URI
  │
  ▼
`decidePathPolicy(root, targets)` invokes `resolveTargets(root, targets)`
  │
  ▼
`resolveTarget(root, raw)`:
  ├─ `isXdDeviceTarget(raw)` -> returns false for `skill://`, `local://`, etc.
  └─ `unsafeTarget(raw)` -> `URI_SHAPED.test(raw)` matches `true`!
       │
       ▼
     Returns `{ resolution: "INDETERMINATE", relativePath: null }`
  │
  ▼
`decidePathPolicy` returns `{ decision: "BLOCK", code: "TARGET_INDETERMINATE" }`
  │
  ▼
`classifyToolCall` returns `{ action: "block", code: "TARGET_INDETERMINATE", reason: "TARGET_INDETERMINATE: Recovery: ..." }`
  │
  ▼
OMP aborts tool execution and returns error string to model
```

---

## 4. Handler Responsibility Boundaries

1. **OMP Spec Kit Gate Responsibility**:
   - The gate's sole invariant is ensuring that the physical and logical `.specs` directory is protected from unauthorized direct file mutations (`write`, `edit`, raw filesystem bypasses) and directing callers to `spec_patch`.
   - Internal OMP URIs do not target files within `.specs` of the current project workspace. They are virtual runtime resources, session-scoped sandboxes, device addresses, or global knowledge stores.
   - Therefore, any known OMP internal scheme (`agent`, `artifact`, `history`, `issue`, `local`, `mcp`, `memory`, `omp`, `pr`, `rule`, `security`, `skill`, `ssh`, `vault`, `xd`, `conflict`) must be classified as `NON_SPEC` before filesystem normalization.

2. **Protocol Handler Responsibility**:
   - **`local://`**: Handled by `LocalProtocolHandler` and `resolveLocalUrlToPath()`, which enforces `ensureWithinRoot()` in the session-local directory.
   - **`skill://`**: Handled by `SkillProtocolHandler`, which resolves skills from user/managed/project skill directories.
   - **`xd://`**: Handled by `XdProtocolHandler`, which validates device name syntax (`no / ? #`) and checks device registrations.
   - **`conflict://`**: Handled by `tools/conflict-detect.ts` and `tools/write.ts`.
   - **`agent://`, `history://`, `artifact://`**: Managed by their respective runtime handlers.
   - Syntax validation, permissions, and sandbox containment for these schemes are the authoritative domain of OMP's internal handlers, not `omp-spec-kit`.

---

## 5. Protocol Verification Matrix

### Approved Internal Schemes (16 Schemes -> NON_SPEC -> Continue)
1. `omp://`
2. `agent://missing`
3. `artifact://missing`
4. `memory://`
5. `local://missing`
6. `vault://`
7. `skill://plain-russian-progress`
8. `rule://missing`
9. `security://`
10. `mcp://`
11. `issue://1`
12. `pr://1`
13. `history://main`
14. `ssh://host/path`
15. `xd://propose`
16. `conflict://1`

Case-insensitivity verification: `SKILL://plain-russian-progress` -> `NON_SPEC`.
Read selector verification: `skill://plain-russian-progress:1-2`, `local://missing:raw` -> `NON_SPEC`.

### Rejected Targets (-> TARGET_INDETERMINATE -> Block)
1. `xd://bad/name` (contains `/`)
2. `xd://bad?query` (contains `?`)
3. `https://example.test` (external network URI)
4. `file://target` (external file URI)
5. `s3://bucket/key` (external cloud URI)
6. `custom://resource` (unrecognized internal URI scheme)
7. `""` (empty string)
8. `"   "` (whitespace only)
9. `"\u0000"` (NUL byte)
10. `C:file.txt` (unsafe Windows relative drive path)
11. `\\server\share` (Windows UNC path)
12. `foo:bar` (Windows NTFS Alternate Data Stream)

---

## 6. Release Verification & Patch Transition (v1.0.1 -> v1.0.2)

### v1.0.1 Runner Line-Ending Finding
During GitHub Actions execution for tag `v1.0.1`:
- Workflow run `33967464599` (release) and `33967464590` (distribution-evidence) failed in `scripts/create-release-candidate.mjs:assertTaggedPackageCheckout` with:
  `Error: release-candidate: cannot verify tagged package checkout: release-candidate: tagged package payload is dirty: M plugins/omp-spec-kit/dist/manifest.json`
- **Root Cause**: On Windows, newly authored files (`src/enforcement/resolve-targets.js`, `src/v0.1/extension.js`) were written with CRLF line endings. While Git index converted them to LF per `.gitattributes` (`* text=auto eol=lf`), the pre-commit build on Windows hashed the CRLF file bytes into `plugins/omp-spec-kit/dist/manifest.json`. When the Ubuntu runner executed `npm run build`, it computed hashes over checked-out LF files, creating a two-file hash divergence (`resolve-targets.js` and `extension.js`) in `manifest.json`.

### Resolution in v1.0.2
- In accordance with the repository release operator policy ("If an already pushed tag fails workflow, do not move or reuse it; fix main and release the next patch"), tag `v1.0.1` is retained as immutable history and version `1.0.2` is issued.
- All source files, build scripts, and manifests were normalized to strict LF.
- Re-running `npm run build` produced the canonical LF hashes in `plugins/omp-spec-kit/dist/manifest.json`:
  - `enforcement/resolve-targets.js`: `e776a4a2dc3fd237e75853b18ab4cca3ce5287bf1ce8451bbcaad16d05076ad2`
  - `extension.js`: `bc01c14fdfd89bb89e1e0cc7ac89bcee373fa491ac7de57b4faf31ed8a678b79`
- All gates (`npm test`, `npm run verify`, `npm run release:preflight -- --tag v1.0.2`) pass cleanly with a 0 exit code and zero git status diff.

## 7. Published Release Evidence & Attestation Verification

- **Release URL**: [v1.0.2 on GitHub](https://github.com/stgmt/omp-spec-kit/releases/tag/v1.0.2)
- **Tag**: `v1.0.2` (annotated tag at `bdd4d99de57bfd167127d55339794b8eae6babe1`)
- **Release Commit**: `bdd4d99de57bfd167127d55339794b8eae6babe1`
- **Publication Timestamp**: `2026-09-05T13:05:22Z`
- **Candidate Digest**: `9993e9c1c58a4ed8c25da818353abeae9c524e506aecb4b9d839909da354ebe3`
- **Package Tree Digest**: `ddf824e68d760d598ee40f5dc75d9b148bd2fd5637f6d58b574c52210375745d`
- **Archive File**: `omp-spec-kit-1.0.2.tar` (448,000 bytes)
  - SHA-256: `3483ea470e4a478b76ef9f48e9e2f63b1a43f03259140a8f1b4f7b645b778bca`
- **GitHub Actions Workflows**:
  - `release.yml` (run `33967778143`): Success
  - `distribution-evidence.yml` (run `33967778135`): Success
- **Cryptographic Attestations**:
  - `omp-spec-kit-1.0.2.tar`: `gh attestation verify` exit code 0
  - `candidate.json`: `gh attestation verify` exit code 0
  - `evidence.json`: `gh attestation verify` exit code 0
- **Archive Smoke Test**: `node scripts/smoke-release-archive.mjs --archive omp-spec-kit-1.0.2.tar` exit code 0 (10 tools verified).

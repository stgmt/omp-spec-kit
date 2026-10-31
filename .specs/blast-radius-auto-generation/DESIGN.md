# Design

## Architecture overview

```
spec_patch(intent: "generateBlastRadius")
  ↓
BlastRadiusWorkflow (LangGraph supervisor-subagent)
  ├─ Supervisor node
  ├─ Generator subagent (skill: blast-radius-generator)
  ├─ Reviewer subagent (skill: blast-radius-reviewer)
  └─ Save node (calls spec_patch with insert_at_eof)
```

## Component design

### 1. New spec_patch intent: generateBlastRadius

**Location:** `src/adapters/tool-contracts.js`

Add to `spec_patch` variants:
```javascript
generateBlastRadius: Object.freeze({
  description: "Generate BLAST_RADIUS.md document analyzing change impact.",
  fields: Object.freeze([
    optionalField("baselineCommit", "string"), // git commit for diff
    optionalField("generateBlastRadius", "boolean"), // enable/disable (default true)
  ]),
}),
```

**Operation:** The intent does not directly write documents. Instead, it triggers the BlastRadiusWorkflow.

### 2. BlastRadiusWorkflow (LangGraph)

**Location:** `src/workflows/blast-radius-workflow.js`

**State schema:**
```typescript
{
  repository: string,
  spec: string,
  baselineCommit: string | null,
  patternConfig: object, // hardcoded for omp-spec-kit
  generatorDraft: string | null,
  reviewResult: object | null,
  retryCount: number,
  finalBlastRadius: string | null
}
```

**Nodes:**
- `supervisor`: decides next step based on state
- `generator`: calls blast-radius-generator skill
- `reviewer`: calls blast-radius-reviewer skill
- `save`: calls spec_patch with `insert_at_eof` operation

**Edges:**
- `supervisor` → `generator` (initial)
- `generator` → `reviewer` (draft ready)
- `reviewer` → `save` (if approved)
- `reviewer` → `generator` (if needs_revision and retryCount < 2)
- `reviewer` → `END` (if needs_revision and retryCount >= 2)
- `save` → `END`

### 3. Generator skill: blast-radius-generator

**Location:** `plugins/omp-spec-kit/skills/blast-radius-generator/SKILL.md`

**Input:**
- Repository path
- Git diff (baselineCommit or HEAD~1)
- Pattern config (hardcoded)

**Logic:**
1. Read FILE_CHANGES.md if exists in spec
2. Run ripgrep with patterns for each section
3. Collect statistics: occurrences, files, top locations
4. Format as BLAST_RADIUS.md (11 sections)
5. Return Markdown content

**Technical details:**
- Use `child_process.spawn` for `rg --json`
- Parse JSON output from ripgrep
- Cache results for large repositories
- Fallback to `git grep` if ripgrep not available

**Hardcoded patterns (omp-spec-kit):**
```yaml
sections:
  - name: "Authoring surface"
    pattern: "specPatch|authoring|proposals"
  - name: "Kernel surface"
    pattern: "kernel|graph|parsers"
  - name: "MCP contracts"
    pattern: "tool-contracts|TOOL_CONTRACTS"
  - name: "Service layer"
    pattern: "service|dispatch|writepath"
  - name: "Test surface"
    pattern: "test.*\.test\.|step-definitions"
  - name: "Plugin payload"
    pattern: "plugins/omp-spec-kit"
  - name: "Skills"
    pattern: "skills/"
  - name: "Tests"
    pattern: "tests/"
  - name: "Documentation"
    pattern: "docs/"
  - name: "Workflows"
    pattern: ".github/workflows"
  - name: "Release"
    pattern: "release-candidate|CHANGELOG"
```

### 4. Reviewer skill: blast-radius-reviewer

**Location:** `plugins/omp-spec-kit/skills/blast-radius-reviewer/SKILL.md`

**Input:**
- Generated BLAST_RADIUS.md
- Git diff / FILE_CHANGES.md
- Pattern config

**Logic:**
1. Check completeness:
   - All changed files mentioned?
   - All changed files covered by patterns?
2. Check accuracy:
   - Patterns not too broad (no false positives)?
   - Patterns not too narrow (no false negatives)?
3. Check correctness:
   - Sections not empty without reason
   - Counts are correct
4. Return verdict: APPROVED or NEEDS_REVISION with comments

**Output schema:**
```json
{
  "verdict": "APPROVED" | "NEEDS_REVISION",
  "comments": [
    {
      "section": string,
      "severity": "blocking" | "warning" | "suggestion",
      "message": string
    }
  ]
}
```

### 5. Integration with spec_patch

**Location:** `src/authoring/service.js`

After successful patch application:
1. Check if `generateBlastRadius` is true (default true)
2. If true, invoke BlastRadiusWorkflow
3. Ask user for confirmation
4. If confirmed, save BLAST_RADIUS.md via spec_patch

**New parameter in spec_patch:**
```json
{
  "intent": "patch",
  "operations": [...],
  "generateBlastRadius": true // optional, default true
}
```

## Data flow

```
User calls spec_patch(intent: "patch", generateBlastRadius: true)
  ↓
SpecPatchService applies patch
  ↓
BlastRadiusWorkflow starts
  ↓
Generator runs ripgrep, produces BLAST_RADIUS.md draft
  ↓
Reviewer validates draft
  ↓
If APPROVED:
  spec_patch(intent: "patch", operations: [{
    kind: "insert_at_eof",
    document: "BLAST_RADIUS.md",
    text: "<draft content>"
  }])
If NEEDS_REVISION and retryCount < 2:
  Retry generator with reviewer comments
If NEEDS_REVISION and retryCount >= 2:
  Fail with reviewer comments
```

## Error handling

- ripgrep not found → fallback to git grep
- git not available → fail with clear error
- FILE_CHANGES.md missing → use git diff directly
- Pattern matches zero files → section marked as "No matches"
- Reviewer blocks → abort workflow, show comments to user

## Testing strategy

- Unit tests for pattern matching logic
- Integration tests for generator skill
- Integration tests for reviewer skill
- E2E test for full workflow (spec_patch → BLAST_RADIUS.md generated)
- Regression tests: ensure existing spec_patch behavior unchanged
